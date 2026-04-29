import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downsizeImage, sniffMime, IMAGE_MAX_DIMENSION, WEBP_QUALITY } from '../downsize';

const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_HEADER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const GIF_HEADER = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const SVG_HEADER = new Uint8Array([0x3c, 0x73, 0x76, 0x67]); // '<svg'

interface FakeBitmap {
  width: number;
  height: number;
  close: () => void;
}

function makeCreateImageBitmap(
  width: number,
  height: number,
): (blob: Blob, opts?: { imageOrientation?: string }) => Promise<FakeBitmap> {
  return async () => ({ width, height, close: () => undefined });
}

class FakeOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext(_kind: '2d'): { drawImage: (...args: unknown[]) => void } {
    return { drawImage: () => undefined };
  }
  async convertToBlob(opts: { type?: string; quality?: number }): Promise<Blob> {
    // Minimal RIFF…WEBP magic so consumers can verify the
    // returned bytes look like a real WebP. The container's
    // size/payload bytes are zeros — fine for unit tests.
    const webpStub = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x4c,
    ]);
    return new Blob([webpStub], { type: opts.type ?? 'image/webp' });
  }
}

beforeEach(() => {
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sniffMime', () => {
  it('detects JPEG', () => {
    expect(sniffMime(JPEG_HEADER)).toBe('image/jpeg');
  });

  it('detects PNG', () => {
    expect(sniffMime(PNG_HEADER)).toBe('image/png');
  });

  it('detects WebP', () => {
    expect(sniffMime(WEBP_HEADER)).toBe('image/webp');
  });

  it('detects GIF', () => {
    expect(sniffMime(GIF_HEADER)).toBe('image/gif');
  });

  it('detects SVG via leading "<"', () => {
    expect(sniffMime(SVG_HEADER)).toBe('image/svg+xml');
  });

  it('falls back to octet-stream for unknown bytes', () => {
    expect(sniffMime(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBe('application/octet-stream');
  });

  it('returns octet-stream for an empty input', () => {
    expect(sniffMime(new Uint8Array([]))).toBe('application/octet-stream');
  });
});

describe('downsizeImage — pass-through (under threshold)', () => {
  it('returns the original bytes unchanged for an 800×600 input', async () => {
    vi.stubGlobal('createImageBitmap', makeCreateImageBitmap(800, 600));
    const result = await downsizeImage(JPEG_HEADER);
    expect(result.resized).toBe(false);
    expect(result.bytes).toBe(JPEG_HEADER);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.originalWidth).toBe(800);
    expect(result.originalHeight).toBe(600);
    expect(result.newWidth).toBe(800);
    expect(result.newHeight).toBe(600);
  });

  it('passes through at exactly the threshold (1500×1125)', async () => {
    vi.stubGlobal('createImageBitmap', makeCreateImageBitmap(1500, 1125));
    const result = await downsizeImage(PNG_HEADER);
    expect(result.resized).toBe(false);
    expect(result.bytes).toBe(PNG_HEADER);
    expect(result.mimeType).toBe('image/png');
  });

  it('preserves the input MIME on pass-through', async () => {
    vi.stubGlobal('createImageBitmap', makeCreateImageBitmap(200, 200));
    const result = await downsizeImage(WEBP_HEADER);
    expect(result.resized).toBe(false);
    expect(result.mimeType).toBe('image/webp');
  });
});

describe('downsizeImage — resize (over threshold)', () => {
  it('downsizes a 4000×3000 landscape input to 1500×1125', async () => {
    vi.stubGlobal('createImageBitmap', makeCreateImageBitmap(4000, 3000));
    const result = await downsizeImage(JPEG_HEADER);
    expect(result.resized).toBe(true);
    expect(result.newWidth).toBe(1500);
    expect(result.newHeight).toBe(1125);
    expect(result.originalWidth).toBe(4000);
    expect(result.originalHeight).toBe(3000);
    expect(result.mimeType).toBe('image/webp');
  });

  it('downsizes a 3000×4000 portrait input to 1125×1500', async () => {
    vi.stubGlobal('createImageBitmap', makeCreateImageBitmap(3000, 4000));
    const result = await downsizeImage(JPEG_HEADER);
    expect(result.resized).toBe(true);
    expect(result.newWidth).toBe(1125);
    expect(result.newHeight).toBe(1500);
  });

  it('downsizes a 4000×4000 square input to 1500×1500', async () => {
    vi.stubGlobal('createImageBitmap', makeCreateImageBitmap(4000, 4000));
    const result = await downsizeImage(JPEG_HEADER);
    expect(result.resized).toBe(true);
    expect(result.newWidth).toBe(1500);
    expect(result.newHeight).toBe(1500);
  });

  it('returns valid WebP magic bytes on resize', async () => {
    vi.stubGlobal('createImageBitmap', makeCreateImageBitmap(4000, 3000));
    const result = await downsizeImage(JPEG_HEADER);
    expect(result.bytes.slice(0, 4)).toEqual(new Uint8Array([0x52, 0x49, 0x46, 0x46]));
    expect(result.bytes.slice(8, 12)).toEqual(new Uint8Array([0x57, 0x45, 0x42, 0x50]));
  });

  it('preserves aspect ratio within ±1px (rounding)', async () => {
    // 1234 / 4321 → not a clean ratio; just check it doesn't drift more than 1px.
    vi.stubGlobal('createImageBitmap', makeCreateImageBitmap(4321, 1234));
    const result = await downsizeImage(JPEG_HEADER);
    const expectedRatio = 1234 / 4321;
    const actualRatio = result.newHeight / result.newWidth;
    expect(Math.abs(actualRatio - expectedRatio) * result.newWidth).toBeLessThanOrEqual(1);
  });

  it('honours a custom maxDimension override', async () => {
    vi.stubGlobal('createImageBitmap', makeCreateImageBitmap(1000, 1000));
    const result = await downsizeImage(JPEG_HEADER, 500);
    expect(result.resized).toBe(true);
    expect(result.newWidth).toBe(500);
    expect(result.newHeight).toBe(500);
  });
});

describe('downsizeImage — decode behaviour', () => {
  it('passes imageOrientation: "from-image" to createImageBitmap', async () => {
    const spy = vi.fn(makeCreateImageBitmap(800, 600));
    vi.stubGlobal('createImageBitmap', spy);
    await downsizeImage(JPEG_HEADER);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toEqual({ imageOrientation: 'from-image' });
  });

  it('constructs the decode Blob with the sniffed MIME type', async () => {
    const spy = vi.fn(makeCreateImageBitmap(800, 600));
    vi.stubGlobal('createImageBitmap', spy);
    await downsizeImage(PNG_HEADER);
    const blob = spy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('image/png');
  });

  it('propagates decode failures to the caller', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('not an image');
      }),
    );
    await expect(downsizeImage(new Uint8Array([0x00, 0x01]))).rejects.toThrow('not an image');
  });
});

describe('constants', () => {
  it('exports the documented threshold and quality', () => {
    expect(IMAGE_MAX_DIMENSION).toBe(1500);
    expect(WEBP_QUALITY).toBe(0.8);
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ensureSvgDimensions, patchCreateImageBitmap } from '../createImageBitmap-svg';

const decode = vi.fn(async () => undefined);

class FakeImage {
  src = '';
  decoding = '';
  naturalWidth = 200;
  naturalHeight = 200;
  decode = decode;
}

describe('ensureSvgDimensions', () => {
  it('injects width and height from viewBox when both absent', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect/></svg>';
    const result = ensureSvgDimensions(svg);
    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
    expect(result.text).toContain('width="200"');
    expect(result.text).toContain('height="100"');
    // ViewBox preserved.
    expect(result.text).toContain('viewBox="0 0 200 100"');
  });

  it('leaves the SVG unchanged when both attributes are present', () => {
    const svg = '<svg width="42" height="24" viewBox="0 0 200 100"></svg>';
    const result = ensureSvgDimensions(svg);
    expect(result.text).toBe(svg);
    expect(result.width).toBe(42);
    expect(result.height).toBe(24);
  });

  it('only injects the missing attribute', () => {
    const svg = '<svg height="50" viewBox="0 0 200 100"></svg>';
    const result = ensureSvgDimensions(svg);
    expect(result.text).toContain('width="200"');
    expect(result.text).toContain('height="50"');
    expect(result.width).toBe(200);
    expect(result.height).toBe(50);
  });

  it('handles self-closing svg tags', () => {
    const svg = '<svg viewBox="0 0 10 20"/>';
    const result = ensureSvgDimensions(svg);
    expect(result.text).toContain('width="10"');
    expect(result.text).toContain('height="20"');
    expect(result.text).toMatch(/\/>\s*$/);
  });

  it('returns zero dimensions when there is no viewBox or attributes', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const result = ensureSvgDimensions(svg);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
    expect(result.text).toBe(svg);
  });
});

describe('patchCreateImageBitmap', () => {
  let nativeMock: ReturnType<typeof vi.fn>;
  let originalImage: typeof Image;
  let originalCIB: typeof globalThis.createImageBitmap;
  let originalCreateURL: typeof URL.createObjectURL;
  let originalRevokeURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    if (!('text' in Blob.prototype)) {
      (Blob.prototype as unknown as { text: () => Promise<string> }).text =
        function text(): Promise<string> {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ''));
            reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
            reader.readAsText(this as unknown as Blob);
          });
        };
    }

    nativeMock = vi.fn(async () => ({}) as ImageBitmap);
    originalCIB = globalThis.createImageBitmap;
    globalThis.createImageBitmap = nativeMock as unknown as typeof globalThis.createImageBitmap;

    originalImage = globalThis.Image;
    globalThis.Image = FakeImage as unknown as typeof Image;
    originalCreateURL = URL.createObjectURL;
    originalRevokeURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();

    decode.mockClear();

    patchCreateImageBitmap();
  });

  afterEach(() => {
    globalThis.createImageBitmap = originalCIB;
    globalThis.Image = originalImage;
    URL.createObjectURL = originalCreateURL;
    URL.revokeObjectURL = originalRevokeURL;
  });

  it('passes the decoded HTMLImageElement (no resize) when natural dimensions are present', async () => {
    const svg = '<svg viewBox="0 0 200 200"><rect/></svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    await globalThis.createImageBitmap(blob);
    expect(nativeMock).toHaveBeenCalledOnce();
    const args = nativeMock.mock.calls[0]!;
    // First arg is the FakeImage instance, second is undefined (no resize options)
    expect(args[0]).toBeInstanceOf(FakeImage);
    expect(args[1]).toBeUndefined();
  });

  it('passes non-SVG sources straight through to the native implementation', async () => {
    const blob = new Blob([new Uint8Array([0xff])], { type: 'image/png' });
    await globalThis.createImageBitmap(blob);
    expect(nativeMock).toHaveBeenCalledWith(blob);
  });
});

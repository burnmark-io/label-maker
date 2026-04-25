import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { patchCreateImageBitmap } from '../createImageBitmap-svg';

const decode = vi.fn(async () => undefined);

class FakeImage {
  src = '';
  decoding = '';
  naturalWidth = 0;
  naturalHeight = 0;
  decode = decode;
}

describe('patchCreateImageBitmap', () => {
  let nativeMock: ReturnType<typeof vi.fn>;
  let originalImage: typeof Image;
  let originalCIB: typeof globalThis.createImageBitmap;
  let originalCreateURL: typeof URL.createObjectURL;
  let originalRevokeURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    // jsdom's Blob lacks `.text()` — polyfill it via FileReader (which
    // jsdom does have) so the shim's blob.text() call resolves.
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

  it('extracts dimensions from viewBox when width/height absent', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect/></svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    await globalThis.createImageBitmap(blob);
    expect(nativeMock).toHaveBeenCalledOnce();
    const args = nativeMock.mock.calls[0]!;
    expect(args[1]).toEqual({ resizeWidth: 200, resizeHeight: 100 });
  });

  it('prefers explicit width/height over viewBox', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="24" viewBox="0 0 200 100"></svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    await globalThis.createImageBitmap(blob);
    const args = nativeMock.mock.calls[0]!;
    expect(args[1]).toEqual({ resizeWidth: 42, resizeHeight: 24 });
  });

  it('strips unit suffix from width/height', async () => {
    const svg = '<svg width="100px" height="50px" viewBox="0 0 1 1"></svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    await globalThis.createImageBitmap(blob);
    const args = nativeMock.mock.calls[0]!;
    expect(args[1]).toEqual({ resizeWidth: 100, resizeHeight: 50 });
  });

  it('passes non-SVG sources straight through to the native implementation', async () => {
    const blob = new Blob([new Uint8Array([0xff])], { type: 'image/png' });
    await globalThis.createImageBitmap(blob);
    expect(nativeMock).toHaveBeenCalledWith(blob);
  });
});

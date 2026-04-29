import { InMemoryAssetLoader } from '@burnmark-io/designer-core';
import { downsizeImage, sniffMime } from '@/lib/image/downsize';

/**
 * Browser asset loader. Phase 6 will swap this for an IndexedDB-backed
 * implementation; for now, in-memory is sufficient.
 *
 * Image bytes go through `downsizeImage` at the upload boundary so the
 * canvas resamples a bounded source on every paint. See `lib/image/
 * downsize.ts` for threshold/quality rationale.
 */

export class BurnmarkAssetLoader extends InMemoryAssetLoader {
  async storeFromBlob(blob: Blob): Promise<string> {
    const incoming = new Uint8Array(await blob.arrayBuffer());
    const result = await downsizeImage(incoming);
    return this.store(result.bytes);
  }

  async loadAsBlob(key: string): Promise<Blob> {
    const bytes = await this.load(key);
    // Cast through a fresh Uint8Array to a plain ArrayBuffer copy so the
    // Blob owns its own backing buffer (defensive against subsequent
    // mutations to the asset store).
    const copy = new Uint8Array(bytes);
    return new Blob([copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength)], {
      type: sniffMime(copy),
    });
  }

  async loadAsImage(key: string): Promise<HTMLImageElement> {
    const blob = await this.loadAsBlob(key);
    const url = URL.createObjectURL(blob);
    try {
      return await loadImageElement(url);
    } finally {
      // Revoke after the Image has loaded — the browser keeps the decoded
      // pixels available even after the URL is gone.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

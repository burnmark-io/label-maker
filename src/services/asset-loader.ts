import { InMemoryAssetLoader } from '@burnmark-io/designer-core';

/**
 * Browser asset loader. Phase 6 will swap this for an IndexedDB-backed
 * implementation; for now, in-memory is sufficient.
 *
 * Resizes images on import to a max dimension and re-encodes them as PNG
 * to keep document sizes manageable. The plan calls for max 2400px.
 */
const MAX_DIMENSION = 2400;

export class BurnmarkAssetLoader extends InMemoryAssetLoader {
  async storeFromBlob(blob: Blob): Promise<string> {
    const resized = await resizeIfNeeded(blob);
    const buffer = await resized.arrayBuffer();
    return this.store(new Uint8Array(buffer));
  }

  async loadAsBlob(key: string): Promise<Blob> {
    const bytes = await this.load(key);
    // Cast through a fresh Uint8Array to a plain ArrayBuffer copy so the
    // Blob owns its own backing buffer (defensive against subsequent
    // mutations to the asset store).
    const copy = new Uint8Array(bytes);
    return new Blob([copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength)], {
      type: 'image/png',
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

async function resizeIfNeeded(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  if (longest <= MAX_DIMENSION) {
    bitmap.close();
    return blob;
  }
  const ratio = MAX_DIMENSION / longest;
  const w = Math.round(width * ratio);
  const h = Math.round(height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Failed to create 2D context for image resize');
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(out => {
      if (out) resolve(out);
      else reject(new Error('Failed to encode resized image'));
    }, 'image/png');
  });
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

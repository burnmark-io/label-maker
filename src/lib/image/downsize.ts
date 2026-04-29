/**
 * Image downsize at the asset-import boundary.
 *
 * Decodes user-imported image bytes, downsizes if the longer
 * edge exceeds IMAGE_MAX_DIMENSION, and re-encodes to WebP.
 * Bytes already at or below the threshold pass through
 * unchanged (no re-encode, no quality loss). EXIF orientation
 * is honoured at decode so under-threshold pass-through and
 * over-threshold re-encoded images render with the same
 * orientation.
 *
 * Threshold and quality are tuned for the thermal-printer
 * pipeline, which dithers everything to 1-bit at print time —
 * sub-grid resolution and high-quality compression both add
 * cost without perceivable benefit. See the amendment for the
 * full rationale.
 */

export const IMAGE_MAX_DIMENSION = 1500;
export const WEBP_QUALITY = 0.8;

export interface DownsizeResult {
  bytes: Uint8Array;
  mimeType: string;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
  resized: boolean;
}

/**
 * Sniff the image MIME type from leading magic bytes. Used to
 * give the decode Blob an explicit `type` (some browsers want
 * the hint) and to label pass-through bytes correctly.
 */
export function sniffMime(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  if (bytes.length >= 1 && bytes[0] === 0x3c) {
    return 'image/svg+xml';
  }
  return 'application/octet-stream';
}

/**
 * Read a Blob as a Uint8Array. Mirrors the FileReader fallback
 * used elsewhere (see `services/label-import.ts`) because
 * jsdom's Blob doesn't implement `.arrayBuffer()`.
 */
async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function downsizeImage(
  bytes: Uint8Array,
  maxDimension: number = IMAGE_MAX_DIMENSION,
): Promise<DownsizeResult> {
  const mimeType = sniffMime(bytes);
  const blob = new Blob([bytes], { type: mimeType });
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const { width: w, height: h } = bitmap;

  const longest = Math.max(w, h);
  if (longest <= maxDimension) {
    bitmap.close();
    return {
      bytes,
      mimeType,
      originalWidth: w,
      originalHeight: h,
      newWidth: w,
      newHeight: h,
      resized: false,
    };
  }

  const scale = maxDimension / longest;
  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);

  const useOffscreen = typeof OffscreenCanvas !== 'undefined';
  let resizedBlob: Blob;
  if (useOffscreen) {
    const canvas = new OffscreenCanvas(newW, newH);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('Failed to create 2D context for image downsize');
    }
    ctx.drawImage(bitmap, 0, 0, newW, newH);
    bitmap.close();
    resizedBlob = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('Failed to create 2D context for image downsize');
    }
    ctx.drawImage(bitmap, 0, 0, newW, newH);
    bitmap.close();
    resizedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Failed to encode resized image'))),
        'image/webp',
        WEBP_QUALITY,
      );
    });
  }

  const out = await readBlobBytes(resizedBlob);
  return {
    bytes: out,
    mimeType: 'image/webp',
    originalWidth: w,
    originalHeight: h,
    newWidth: newW,
    newHeight: newH,
    resized: true,
  };
}

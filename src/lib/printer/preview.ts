import type { LabelBitmap } from '@mbtech-nl/bitmap';

/**
 * Render a 1bpp `LabelBitmap` into a freshly allocated RGBA `ImageData`,
 * using `displayColor` for set pixels and transparent for unset. Apps
 * composite multiple planes by drawing them onto the same canvas in
 * order.
 */
export function bitmapToImageData(bitmap: LabelBitmap, displayColor: string): ImageData {
  const { widthPx, heightPx, data } = bitmap;
  const bytesPerRow = Math.ceil(widthPx / 8);
  const rgba = new Uint8ClampedArray(widthPx * heightPx * 4);
  const [r, g, b] = parseColor(displayColor);

  for (let y = 0; y < heightPx; y += 1) {
    const rowOffset = y * bytesPerRow;
    for (let x = 0; x < widthPx; x += 1) {
      const byte = data[rowOffset + (x >> 3)];
      const bit = (byte >> (7 - (x & 7))) & 1;
      if (bit === 1) {
        const i = (y * widthPx + x) * 4;
        rgba[i] = r;
        rgba[i + 1] = g;
        rgba[i + 2] = b;
        rgba[i + 3] = 255;
      }
    }
  }
  return new ImageData(rgba, widthPx, heightPx);
}

function parseColor(css: string): [number, number, number] {
  const trimmed = css.trim();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0]! + hex[0]!, 16),
        parseInt(hex[1]! + hex[1]!, 16),
        parseInt(hex[2]! + hex[2]!, 16),
      ];
    }
    if (hex.length === 6) {
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
  }
  // Fallback to black for unrecognised colour strings — preview still legible.
  return [0, 0, 0];
}

import { describe, expect, it } from 'vitest';
import type { LabelBitmap } from '@mbtech-nl/bitmap';
import { bitmapToRgba } from '../preview';

describe('bitmapToRgba', () => {
  it('renders set bits in the requested colour and clears unset bits', () => {
    // 8×1 bitmap, alternating bits = 0b10101010 = 0xAA
    const bitmap: LabelBitmap = {
      widthPx: 8,
      heightPx: 1,
      data: new Uint8Array([0xaa]),
    };
    const image = bitmapToRgba(bitmap, '#ff0000');
    expect(image.width).toBe(8);
    expect(image.height).toBe(1);
    // Pixel 0 (set): r=255 a=255
    expect(image.data[0]).toBe(255);
    expect(image.data[3]).toBe(255);
    // Pixel 1 (unset): a=0
    expect(image.data[7]).toBe(0);
    // Pixel 2 (set)
    expect(image.data[8]).toBe(255);
    expect(image.data[11]).toBe(255);
  });

  it('handles 3-digit hex colours', () => {
    const bitmap: LabelBitmap = {
      widthPx: 8,
      heightPx: 1,
      data: new Uint8Array([0x80]),
    };
    const image = bitmapToRgba(bitmap, '#f00');
    expect(image.data[0]).toBe(0xff);
    expect(image.data[1]).toBe(0);
    expect(image.data[2]).toBe(0);
  });

  it('falls back to black for unrecognised colours', () => {
    const bitmap: LabelBitmap = {
      widthPx: 8,
      heightPx: 1,
      data: new Uint8Array([0x80]),
    };
    const image = bitmapToRgba(bitmap, 'hotpink');
    expect(image.data[0]).toBe(0);
    expect(image.data[1]).toBe(0);
    expect(image.data[2]).toBe(0);
    expect(image.data[3]).toBe(255);
  });
});

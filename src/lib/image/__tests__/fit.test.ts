import { describe, expect, it } from 'vitest';
import { computeFit } from '../fit';

const BBOX_WIDE = { width: 400, height: 200 }; // 2:1
const BBOX_SQUARE = { width: 200, height: 200 };
const BBOX_TALL = { width: 200, height: 400 }; // 1:2

const LANDSCAPE = { width: 4000, height: 2000 }; // 2:1
const PORTRAIT = { width: 2000, height: 4000 }; // 1:2
const SQUARE = { width: 1000, height: 1000 };

describe('computeFit — fill', () => {
  it('fills the bbox exactly, regardless of source aspect', () => {
    expect(computeFit({ fit: 'fill', bbox: BBOX_WIDE, source: PORTRAIT })).toEqual({
      width: 400,
      height: 200,
      offsetX: 200,
      offsetY: 100,
    });
  });

  it('omits crop properties (no cropping in fill mode)', () => {
    const r = computeFit({ fit: 'fill', bbox: BBOX_SQUARE, source: LANDSCAPE });
    expect(r.cropX).toBeUndefined();
    expect(r.cropWidth).toBeUndefined();
  });
});

describe('computeFit — contain', () => {
  it('letterboxes a wide source inside a square bbox', () => {
    // 4000x2000 source (2:1) inside 200x200 bbox → 200x100 centred.
    expect(computeFit({ fit: 'contain', bbox: BBOX_SQUARE, source: LANDSCAPE })).toEqual({
      width: 200,
      height: 100,
      offsetX: 100,
      offsetY: 50,
    });
  });

  it('pillarboxes a tall source inside a square bbox', () => {
    // 2000x4000 source (1:2) inside 200x200 bbox → 100x200 centred.
    expect(computeFit({ fit: 'contain', bbox: BBOX_SQUARE, source: PORTRAIT })).toEqual({
      width: 100,
      height: 200,
      offsetX: 50,
      offsetY: 100,
    });
  });

  it('matches bbox exactly when source aspect equals bbox aspect', () => {
    // Both 2:1.
    const r = computeFit({ fit: 'contain', bbox: BBOX_WIDE, source: LANDSCAPE });
    expect(r.width).toBe(400);
    expect(r.height).toBe(200);
  });

  it('does not produce crop properties (contain never crops)', () => {
    const r = computeFit({ fit: 'contain', bbox: BBOX_SQUARE, source: LANDSCAPE });
    expect(r.cropX).toBeUndefined();
  });
});

describe('computeFit — cover', () => {
  it('crops a wide source horizontally to fill a square bbox', () => {
    // 4000x2000 source into 200x200 bbox: keep all 2000 height,
    // crop width to 2000 (1:1), centred → cropX = 1000.
    const r = computeFit({ fit: 'cover', bbox: BBOX_SQUARE, source: LANDSCAPE });
    expect(r.width).toBe(200);
    expect(r.height).toBe(200);
    expect(r.cropWidth).toBe(2000);
    expect(r.cropHeight).toBe(2000);
    expect(r.cropX).toBe(1000);
    expect(r.cropY).toBe(0);
  });

  it('crops a tall source vertically to fill a square bbox', () => {
    // 2000x4000 source into 200x200 bbox: keep all 2000 width,
    // crop height to 2000, centred → cropY = 1000.
    const r = computeFit({ fit: 'cover', bbox: BBOX_SQUARE, source: PORTRAIT });
    expect(r.width).toBe(200);
    expect(r.height).toBe(200);
    expect(r.cropWidth).toBe(2000);
    expect(r.cropHeight).toBe(2000);
    expect(r.cropX).toBe(0);
    expect(r.cropY).toBe(1000);
  });

  it('does not crop when source aspect equals bbox aspect', () => {
    const r = computeFit({ fit: 'cover', bbox: BBOX_WIDE, source: LANDSCAPE });
    expect(r.cropWidth).toBe(LANDSCAPE.width);
    expect(r.cropHeight).toBe(LANDSCAPE.height);
    expect(r.cropX).toBe(0);
    expect(r.cropY).toBe(0);
  });

  it('crops correctly with a tall bbox and wide source', () => {
    // 4000x2000 source into 200x400 bbox (1:2): keep height 2000,
    // crop width to 1000, centred → cropX = 1500.
    const r = computeFit({ fit: 'cover', bbox: BBOX_TALL, source: LANDSCAPE });
    expect(r.width).toBe(200);
    expect(r.height).toBe(400);
    expect(r.cropWidth).toBe(1000);
    expect(r.cropHeight).toBe(2000);
    expect(r.cropX).toBe(1500);
  });
});

describe('computeFit — none', () => {
  it('renders at natural size when smaller than bbox', () => {
    // 24x24 source inside 200x200 bbox → 24x24, no crop offset.
    const r = computeFit({
      fit: 'none',
      bbox: BBOX_SQUARE,
      source: { width: 24, height: 24 },
    });
    expect(r.width).toBe(24);
    expect(r.height).toBe(24);
    expect(r.cropX).toBe(0);
    expect(r.cropY).toBe(0);
    expect(r.cropWidth).toBe(24);
    expect(r.cropHeight).toBe(24);
  });

  it('clips a larger source to bbox, centred', () => {
    // 1000x1000 source inside 200x200 bbox → display 200x200 of
    // the centre → cropX = 400, cropY = 400.
    const r = computeFit({ fit: 'none', bbox: BBOX_SQUARE, source: SQUARE });
    expect(r.width).toBe(200);
    expect(r.height).toBe(200);
    expect(r.cropX).toBe(400);
    expect(r.cropY).toBe(400);
    expect(r.cropWidth).toBe(200);
    expect(r.cropHeight).toBe(200);
  });

  it('handles asymmetric overflow (source wider than bbox, shorter than bbox)', () => {
    const r = computeFit({
      fit: 'none',
      bbox: { width: 200, height: 400 },
      source: { width: 1000, height: 100 },
    });
    expect(r.width).toBe(200); // clipped on the wide axis
    expect(r.height).toBe(100); // native on the shorter axis
    expect(r.cropX).toBe(400); // (1000 - 200) / 2
    expect(r.cropY).toBe(0); // no vertical crop
    expect(r.cropWidth).toBe(200);
    expect(r.cropHeight).toBe(100);
  });
});

describe('computeFit — degenerate inputs', () => {
  it('falls back to fill when source is null (image not yet loaded)', () => {
    expect(computeFit({ fit: 'contain', bbox: BBOX_WIDE, source: null })).toEqual({
      width: 400,
      height: 200,
      offsetX: 200,
      offsetY: 100,
    });
  });

  it('falls back to fill when source has a zero dimension', () => {
    expect(
      computeFit({ fit: 'cover', bbox: BBOX_SQUARE, source: { width: 0, height: 100 } }),
    ).toEqual({
      width: 200,
      height: 200,
      offsetX: 100,
      offsetY: 100,
    });
  });
});

describe('computeFit — anchor convention', () => {
  it('always centres offsetX/offsetY on the rendered width/height', () => {
    for (const fit of ['fill', 'contain', 'cover', 'none'] as const) {
      const r = computeFit({ fit, bbox: BBOX_SQUARE, source: LANDSCAPE });
      expect(r.offsetX).toBe(r.width / 2);
      expect(r.offsetY).toBe(r.height / 2);
    }
  });
});

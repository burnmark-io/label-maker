import { describe, expect, it } from 'vitest';
import { BUNDLED_FONTS } from '@burnmark-io/designer-core';
import { DEFAULT_FONT_FAMILY, FONT_OPTIONS, fontOptionsFor } from '@/lib/fonts';

describe('font options', () => {
  it('offers the bundled fonts first, without the Burnmark prefix', () => {
    expect(FONT_OPTIONS.slice(0, 4)).toEqual([
      { value: 'Burnmark Sans', label: 'Sans' },
      { value: 'Burnmark Serif', label: 'Serif' },
      { value: 'Burnmark Mono', label: 'Mono' },
      { value: 'Burnmark Narrow', label: 'Narrow' },
    ]);
  });

  it('stores families designer-core actually bundles', () => {
    for (const o of FONT_OPTIONS.slice(0, 4)) expect(o.value in BUNDLED_FONTS).toBe(true);
    expect(DEFAULT_FONT_FAMILY in BUNDLED_FONTS).toBe(true);
  });

  it('then offers plain system fonts', () => {
    expect(FONT_OPTIONS.slice(4).map(o => o.value)).toEqual(['Arial', 'Helvetica', 'Courier New']);
  });

  it('keeps an unlisted family (older labels) visible under its own name', () => {
    expect(fontOptionsFor('Inter')[0]).toEqual({ value: 'Inter', label: 'Inter' });
    expect(fontOptionsFor('Burnmark Sans')).toBe(FONT_OPTIONS);
  });
});

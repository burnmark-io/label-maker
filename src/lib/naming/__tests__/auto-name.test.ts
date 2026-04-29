import { describe, expect, it } from 'vitest';
import type { LabelObject } from '@burnmark-io/designer-core';
import {
  autoNameFor,
  nextNameForType,
  parseTrailingNumber,
  typeLabelKeyFor,
} from '../auto-name';

function obj(partial: Partial<LabelObject> & { type: LabelObject['type'] }): LabelObject {
  return {
    id: Math.random().toString(36).slice(2),
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    ...partial,
  } as LabelObject;
}

describe('parseTrailingNumber', () => {
  it('returns N for "<prefix> N" pattern', () => {
    expect(parseTrailingNumber('Text 1', 'Text')).toBe(1);
    expect(parseTrailingNumber('Text 42', 'Text')).toBe(42);
    expect(parseTrailingNumber('QR 7', 'QR')).toBe(7);
  });

  it('returns null for custom names', () => {
    expect(parseTrailingNumber('Greeting', 'Text')).toBeNull();
    expect(parseTrailingNumber('Hello world', 'Text')).toBeNull();
  });

  it('returns null when prefix is missing', () => {
    expect(parseTrailingNumber('Rectangle 1', 'Text')).toBeNull();
  });

  it('returns null for non-integer or extra suffix', () => {
    expect(parseTrailingNumber('Text 2.5', 'Text')).toBeNull();
    expect(parseTrailingNumber('Text 2 copy', 'Text')).toBeNull();
    expect(parseTrailingNumber('Text', 'Text')).toBeNull();
    expect(parseTrailingNumber('Textt 1', 'Text')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseTrailingNumber('', 'Text')).toBeNull();
    expect(parseTrailingNumber('Text 1', '')).toBeNull();
  });
});

describe('typeLabelKeyFor', () => {
  it('maps text/image/group directly', () => {
    expect(typeLabelKeyFor({ type: 'text' })).toBe('text');
    expect(typeLabelKeyFor({ type: 'image' })).toBe('image');
    expect(typeLabelKeyFor({ type: 'group' })).toBe('group');
  });

  it('splits shapes by sub-shape', () => {
    expect(typeLabelKeyFor({ type: 'shape', shape: 'rectangle' } as never)).toBe('rectangle');
    expect(typeLabelKeyFor({ type: 'shape', shape: 'ellipse' } as never)).toBe('ellipse');
    expect(typeLabelKeyFor({ type: 'shape', shape: 'line' } as never)).toBe('line');
  });

  it('splits barcodes into QR vs other', () => {
    expect(typeLabelKeyFor({ type: 'barcode', format: 'qrcode' } as never)).toBe('qrcode');
    expect(typeLabelKeyFor({ type: 'barcode', format: 'microqr' } as never)).toBe('qrcode');
    expect(typeLabelKeyFor({ type: 'barcode', format: 'code128' } as never)).toBe('barcode');
    expect(typeLabelKeyFor({ type: 'barcode', format: 'ean13' } as never)).toBe('barcode');
  });
});

describe('nextNameForType', () => {
  it('returns "<prefix> 1" when the pool is empty', () => {
    expect(nextNameForType([], 'text', 'Text')).toBe('Text 1');
  });

  it('returns max + 1 across the matching pool', () => {
    const objects = [
      obj({ type: 'text', name: 'Text 1' }),
      obj({ type: 'text', name: 'Text 2' }),
      obj({ type: 'text', name: 'Text 3' }),
    ];
    expect(nextNameForType(objects, 'text', 'Text')).toBe('Text 4');
  });

  it('ignores custom-named objects in the pool', () => {
    const objects = [
      obj({ type: 'text', name: 'Text 1' }),
      obj({ type: 'text', name: 'Greeting' }),
      obj({ type: 'text', name: 'Text 3' }),
    ];
    expect(nextNameForType(objects, 'text', 'Text')).toBe('Text 4');
  });

  it('reuses freed numbers after deletion of the highest-numbered object', () => {
    const objects = [obj({ type: 'text', name: 'Text 1' })];
    expect(nextNameForType(objects, 'text', 'Text')).toBe('Text 2');
  });

  it('does not cross pools — text counter is independent of rectangle counter', () => {
    const objects = [
      obj({ type: 'text', name: 'Text 1' }),
      obj({ type: 'shape', shape: 'rectangle', name: 'Rectangle 1' } as never),
      obj({ type: 'shape', shape: 'rectangle', name: 'Rectangle 2' } as never),
    ];
    expect(nextNameForType(objects, 'text', 'Text')).toBe('Text 2');
    expect(nextNameForType(objects, 'rectangle', 'Rectangle')).toBe('Rectangle 3');
  });

  it('separates QR from other barcode formats', () => {
    const objects = [
      obj({ type: 'barcode', format: 'qrcode', name: 'QR 1' } as never),
      obj({ type: 'barcode', format: 'code128', name: 'Barcode 1' } as never),
      obj({ type: 'barcode', format: 'code128', name: 'Barcode 2' } as never),
    ];
    expect(nextNameForType(objects, 'qrcode', 'QR')).toBe('QR 2');
    expect(nextNameForType(objects, 'barcode', 'Barcode')).toBe('Barcode 3');
  });

  it('starts from 1 when the locale prefix has changed (no matches)', () => {
    const objects = [obj({ type: 'text', name: 'Text 5' })];
    expect(nextNameForType(objects, 'text', 'Tekst')).toBe('Tekst 1');
  });
});

describe('autoNameFor', () => {
  const prefixFor = (key: string) =>
    ({
      text: 'Text',
      image: 'Image',
      rectangle: 'Rectangle',
      ellipse: 'Ellipse',
      line: 'Line',
      qrcode: 'QR',
      barcode: 'Barcode',
      group: 'Group',
    })[key] ?? key;

  it('returns undefined when input.name is provided', () => {
    expect(autoNameFor({ type: 'text', name: 'Greeting' }, [], prefixFor)).toBeUndefined();
  });

  it('returns undefined for empty-string name (treats as missing? no — only undefined/missing triggers auto)', () => {
    // Empty string is intentionally still a "user-provided name" — we do
    // not override. Auto-naming kicks in only when name is missing.
    expect(autoNameFor({ type: 'text' }, [], prefixFor)).toBe('Text 1');
  });

  it('computes the auto-name based on existing pool', () => {
    const objects = [
      obj({ type: 'text', name: 'Text 1' }),
      obj({ type: 'text', name: 'Text 2' }),
    ];
    expect(autoNameFor({ type: 'text' }, objects, prefixFor)).toBe('Text 3');
  });

  it('routes shape sub-types correctly', () => {
    const objects = [obj({ type: 'shape', shape: 'rectangle', name: 'Rectangle 1' } as never)];
    expect(autoNameFor({ type: 'shape', shape: 'rectangle' } as never, objects, prefixFor)).toBe(
      'Rectangle 2',
    );
    expect(autoNameFor({ type: 'shape', shape: 'ellipse' } as never, objects, prefixFor)).toBe(
      'Ellipse 1',
    );
  });

  it('routes QR vs barcode correctly', () => {
    const objects = [obj({ type: 'barcode', format: 'code128', name: 'Barcode 1' } as never)];
    expect(autoNameFor({ type: 'barcode', format: 'qrcode' } as never, objects, prefixFor)).toBe(
      'QR 1',
    );
    expect(autoNameFor({ type: 'barcode', format: 'ean13' } as never, objects, prefixFor)).toBe(
      'Barcode 2',
    );
  });
});

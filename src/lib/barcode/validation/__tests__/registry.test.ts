import { describe, expect, it } from 'vitest';
import type { BarcodeFormat } from '@burnmark-io/designer-core';
import { applyMask, getRule, hasPlaceholders, validate } from '../index.js';
import { REGISTERED_FORMATS } from '../registry.js';

interface FormatFixture {
  format: BarcodeFormat;
  /** Inputs that must NOT produce `error` severity. */
  valid: string[];
  invalid: Array<{ data: string; expectedSeverity: 'error' | 'warning' }>;
  maskDrops?: Array<{ raw: string; cleaned: string }>;
}

const FIXTURES: FormatFixture[] = [
  {
    format: 'code128',
    valid: ['BURNMARK-001', 'A'],
    invalid: [{ data: 'héllo', expectedSeverity: 'error' }],
  },
  {
    format: 'code128a',
    valid: ['HELLO 001'],
    invalid: [{ data: 'hello', expectedSeverity: 'error' }],
  },
  {
    format: 'code128b',
    valid: ['Hello 001'],
    invalid: [{ data: 'héllo', expectedSeverity: 'error' }],
  },
  {
    format: 'code128c',
    valid: ['12345678'],
    invalid: [
      { data: '1234567', expectedSeverity: 'error' },
      { data: 'ABCD', expectedSeverity: 'error' },
    ],
    maskDrops: [{ raw: '12-34-56', cleaned: '123456' }],
  },
  {
    format: 'code39',
    valid: ['BURNMARK 01'],
    invalid: [{ data: 'BURNMARK!', expectedSeverity: 'error' }],
    maskDrops: [{ raw: 'burn!mark', cleaned: 'BURNMARK' }],
  },
  {
    format: 'code39ext',
    valid: ['Burnmark!01'],
    invalid: [{ data: 'héllo', expectedSeverity: 'error' }],
  },
  {
    format: 'code93',
    valid: ['BURNMARK 01'],
    invalid: [{ data: 'burnmark!', expectedSeverity: 'error' }],
  },
  {
    format: 'code11',
    valid: ['555-1212'],
    invalid: [{ data: 'ABC', expectedSeverity: 'error' }],
  },
  {
    format: 'codabar',
    valid: ['12-34-56'],
    invalid: [{ data: 'ABCD', expectedSeverity: 'error' }],
  },
  {
    format: 'ean13',
    valid: ['590123412345', '5901234123457'],
    invalid: [
      { data: '5901234', expectedSeverity: 'error' },
      { data: '5901234123458', expectedSeverity: 'error' },
      { data: 'abc', expectedSeverity: 'error' },
    ],
    maskDrops: [{ raw: '590-1234-1234-5', cleaned: '590123412345' }],
  },
  {
    format: 'ean8',
    valid: ['9638507', '96385074'],
    invalid: [
      { data: '12345', expectedSeverity: 'error' },
      { data: '96385079', expectedSeverity: 'error' },
    ],
  },
  {
    format: 'upca',
    valid: ['01234567890', '012345678905'],
    invalid: [
      { data: '0123', expectedSeverity: 'error' },
      { data: '012345678901', expectedSeverity: 'error' },
    ],
  },
  {
    format: 'upce',
    valid: ['01234565', '0123456'],
    invalid: [{ data: '0123', expectedSeverity: 'error' }],
  },
  {
    format: 'itf14',
    valid: ['1234567890123', '12345678901231'],
    invalid: [
      { data: '12345678901', expectedSeverity: 'error' },
      { data: '12345678901234', expectedSeverity: 'error' },
    ],
  },
  {
    format: 'interleaved2of5',
    valid: ['1234567890'],
    invalid: [
      { data: '123', expectedSeverity: 'error' },
      { data: 'ABCD', expectedSeverity: 'error' },
    ],
  },
  {
    format: 'msi',
    valid: ['1234567'],
    invalid: [{ data: 'ABC', expectedSeverity: 'error' }],
  },
  {
    format: 'pharmacode',
    valid: ['12345', '3'],
    invalid: [
      { data: '0', expectedSeverity: 'error' },
      { data: '999999', expectedSeverity: 'error' },
    ],
  },
  {
    format: 'pzn',
    valid: ['1234567', '123456'],
    invalid: [{ data: 'ABCDEFG', expectedSeverity: 'error' }],
  },
  {
    format: 'hibccode128',
    valid: ['+A123BJC5D6E71'],
    invalid: [{ data: 'lower!', expectedSeverity: 'error' }],
  },
  {
    format: 'isbt128',
    valid: ['=A1234500001'],
    invalid: [{ data: 'héllo', expectedSeverity: 'error' }],
  },
  {
    format: 'leitcode',
    valid: ['12345678901234'],
    invalid: [{ data: '1234', expectedSeverity: 'error' }],
  },
  {
    format: 'identcode',
    valid: ['123456789012'],
    invalid: [{ data: '1234', expectedSeverity: 'error' }],
  },

  // 2D
  {
    format: 'qrcode',
    valid: ['https://burnmark.io', 'a'],
    invalid: [{ data: 'a'.repeat(2001), expectedSeverity: 'warning' }],
  },
  {
    format: 'microqr',
    valid: ['12345'],
    invalid: [{ data: 'a'.repeat(36), expectedSeverity: 'warning' }],
  },
  {
    format: 'datamatrix',
    valid: ['BURNMARK-2026-001'],
    invalid: [{ data: 'a'.repeat(2336), expectedSeverity: 'warning' }],
  },
  {
    format: 'datamatrixrectangular',
    valid: ['BURNMARK-001'],
    invalid: [{ data: 'a'.repeat(2336), expectedSeverity: 'warning' }],
  },
  {
    format: 'pdf417',
    valid: ['BURNMARK shipping data'],
    invalid: [{ data: 'a'.repeat(1851), expectedSeverity: 'warning' }],
  },
  {
    format: 'micropdf417',
    valid: ['LOT-12345'],
    invalid: [{ data: 'a'.repeat(251), expectedSeverity: 'warning' }],
  },
  {
    format: 'azteccode',
    valid: ['BURNMARK-001'],
    invalid: [{ data: 'a'.repeat(3068), expectedSeverity: 'warning' }],
  },
  {
    format: 'aztecrune',
    valid: ['42', '0', '255'],
    invalid: [{ data: '300', expectedSeverity: 'error' }],
  },
  {
    format: 'maxicode',
    valid: ['BURNMARK-001'],
    invalid: [{ data: 'a'.repeat(94), expectedSeverity: 'warning' }],
  },

  // GS1
  {
    format: 'gs1_128',
    valid: ['(01)12345678901234', '(01)12345678901234(17)260101'],
    invalid: [
      { data: '01 12345 17 260101', expectedSeverity: 'error' },
      { data: '(01)1234', expectedSeverity: 'error' },
      { data: '(99)foo', expectedSeverity: 'warning' },
    ],
  },
  {
    format: 'gs1qrcode',
    valid: ['(01)12345678901234'],
    invalid: [{ data: '(99)abc', expectedSeverity: 'warning' }],
  },
  {
    format: 'gs1datamatrix',
    valid: ['(01)12345678901234(10)LOT001'],
    invalid: [{ data: '()12345', expectedSeverity: 'error' }],
  },
  {
    format: 'gs1_cc',
    valid: ['(01)12345678901234'],
    invalid: [{ data: 'no-ais-here', expectedSeverity: 'error' }],
  },
  {
    format: 'databar',
    valid: ['12345678901234'],
    invalid: [{ data: '1234', expectedSeverity: 'error' }],
  },
  {
    format: 'databarexpanded',
    valid: ['(01)12345678901234(3103)001234'],
    invalid: [{ data: '()', expectedSeverity: 'error' }],
  },

  // Postal
  {
    format: 'postnet',
    valid: ['94103', '941030000', '94103000099'],
    invalid: [{ data: '9410', expectedSeverity: 'error' }],
  },
  {
    format: 'onecode',
    valid: ['01234567094987654321'],
    invalid: [{ data: '1234', expectedSeverity: 'error' }],
  },
  {
    format: 'royalmail',
    valid: ['SN34RD1A'],
    invalid: [{ data: 'A'.repeat(20), expectedSeverity: 'error' }],
  },
  {
    format: 'kix',
    valid: ['2500GG75'],
    invalid: [{ data: 'A'.repeat(20), expectedSeverity: 'error' }],
  },
  {
    format: 'auspost',
    valid: ['12345678', '1234567890123', '1234567890123456'],
    invalid: [{ data: '1234', expectedSeverity: 'error' }],
  },
  {
    format: 'japanpost',
    valid: ['1310034-3-2-1'],
    invalid: [{ data: 'A'.repeat(21), expectedSeverity: 'error' }],
  },
];

describe.each(FIXTURES)('format $format', ({ format, valid, invalid, maskDrops }) => {
  it.each(valid.map(v => [v]))('accepts valid input: %s', data => {
    expect(validate(format, data).severity).not.toBe('error');
  });
  it.each(invalid.map(({ data, expectedSeverity }) => [data, expectedSeverity]))(
    'flags invalid input: %s as %s',
    (data, expectedSeverity) => {
      expect(validate(format, data).severity).toBe(expectedSeverity);
    },
  );
  if (maskDrops) {
    it.each(maskDrops.map(({ raw, cleaned }) => [raw, cleaned]))(
      'mask cleans %s → %s',
      (raw, cleaned) => {
        expect(applyMask(format, raw)).toBe(cleaned);
      },
    );
  }
});

describe('registry coverage', () => {
  it('every BarcodeFormat in REGISTERED_FORMATS has a hint and placeholder key', () => {
    for (const fmt of REGISTERED_FORMATS) {
      const rule = getRule(fmt);
      expect(rule.hintKey).toBeTruthy();
      expect(rule.placeholderKey).toBeTruthy();
    }
  });
});

describe('placeholder bypass', () => {
  it('detects double-brace placeholders', () => {
    expect(hasPlaceholders('hello {{name}} world')).toBe(true);
    expect(hasPlaceholders('plain text')).toBe(false);
    expect(hasPlaceholders('LOT-{{batch}}')).toBe(true);
  });

  it('skips strict validation when input has placeholders', () => {
    // EAN-13 with a placeholder where digits should be — must be info, not error.
    const r = validate('ean13', '{{barcode_id}}');
    expect(r.severity).toBe('info');
    expect(r.message).toBe('properties.barcode.validation.placeholderBypass');
  });
});

describe('mask exception for braces', () => {
  it('lets `{` and `}` pass through a digits-only mask', () => {
    // `name` itself is dropped by the digits-only mask, but the user can
    // build the token character-by-character; the higher-level component
    // hands the input to applyMask only when no placeholder is present
    // yet — once `{{...}}` appears, hasPlaceholders bypasses the mask.
    const cleaned = applyMask('ean13', '{{name}}');
    expect(cleaned).toBe('{{}}');
  });

  it('uppercase transform applies after mask filter', () => {
    expect(applyMask('code39', 'burn!mark 01')).toBe('BURNMARK 01');
  });
});

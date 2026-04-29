import { describe, expect, it } from 'vitest';
import type { PrinterError } from '@thermal-label/contracts';

import { localisedErrorMessage } from '../usePrinterErrors';

const TRANSLATIONS: Record<string, string> = {
  'printer.errors.no_media': 'No labels or tape loaded',
  'printer.errors.cover_open': 'Cover is open',
  'printer.errors.cutter_jam': 'Cutter jam',
};

/** Minimal `t` shim that mirrors vue-i18n's "return key when missing" behaviour. */
function fakeT(key: string): string {
  return TRANSLATIONS[key] ?? key;
}

describe('localisedErrorMessage', () => {
  it('returns the i18n string for a known code', () => {
    const err: PrinterError = { code: 'no_media', message: 'No media' };
    expect(localisedErrorMessage(err, fakeT)).toBe('No labels or tape loaded');
  });

  it('uses the canonical string regardless of which driver phrased the message', () => {
    // Same code from three drivers, three different driver messages —
    // all should resolve to the canonical i18n string.
    const drivers: PrinterError[] = [
      { code: 'no_media', message: 'No media' },
      { code: 'no_media', message: 'No labels loaded' },
      { code: 'no_media', message: 'No tape inserted' },
    ];
    for (const err of drivers) {
      expect(localisedErrorMessage(err, fakeT)).toBe('No labels or tape loaded');
    }
  });

  it('falls back to the driver message for an unknown code', () => {
    const err: PrinterError = { code: 'made_up_code', message: 'Specific driver text' };
    expect(localisedErrorMessage(err, fakeT)).toBe('Specific driver text');
  });

  it('falls back for system_error (intentionally unkeyed)', () => {
    // system_error is the catch-all for several distinct conditions
    // (battery, fan, voltage); the driver message carries the specifics.
    const err: PrinterError = { code: 'system_error', message: 'Weak battery' };
    expect(localisedErrorMessage(err, fakeT)).toBe('Weak battery');
  });
});

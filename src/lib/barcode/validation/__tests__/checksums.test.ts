import { describe, expect, it } from 'vitest';
import { ean13Checksum, ean8Checksum, isValidGtin, upcaChecksum } from '../checksums.js';

describe('GTIN checksums', () => {
  it('computes the EAN-13 check digit', () => {
    // 590123412345 → 7
    expect(ean13Checksum('590123412345')).toBe(7);
  });

  it('computes the EAN-8 check digit', () => {
    // 9638507 → 4
    expect(ean8Checksum('9638507')).toBe(4);
  });

  it('computes the UPC-A check digit', () => {
    // 01234567890 → 5
    expect(upcaChecksum('01234567890')).toBe(5);
  });

  it('isValidGtin accepts a known-good code', () => {
    expect(isValidGtin('5901234123457')).toBe(true);
    expect(isValidGtin('012345678905')).toBe(true);
    expect(isValidGtin('96385074')).toBe(true);
  });

  it('isValidGtin rejects a tampered checksum', () => {
    expect(isValidGtin('5901234123458')).toBe(false);
    expect(isValidGtin('012345678901')).toBe(false);
  });

  it('isValidGtin rejects non-digits', () => {
    expect(isValidGtin('59012341234A7')).toBe(false);
    expect(isValidGtin('')).toBe(false);
    expect(isValidGtin('1')).toBe(false);
  });
});

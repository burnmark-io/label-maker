import { describe, expect, it } from 'vitest';
import { lookupAi, parseGs1, validateParsedAis } from '../gs1.js';

describe('parseGs1', () => {
  it('parses a single AI', () => {
    const r = parseGs1('(01)12345678901234');
    expect(r.errors).toEqual([]);
    expect(r.ais).toHaveLength(1);
    expect(r.ais[0]).toMatchObject({ ai: '01', value: '12345678901234' });
  });

  it('parses multiple AIs', () => {
    const r = parseGs1('(01)12345678901234(17)260101(10)LOT001');
    expect(r.errors).toEqual([]);
    expect(r.ais.map(a => a.ai)).toEqual(['01', '17', '10']);
    expect(r.ais.map(a => a.value)).toEqual(['12345678901234', '260101', 'LOT001']);
  });

  it('flags input that does not start with `(`', () => {
    const r = parseGs1('01)12345678');
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('flags an empty AI', () => {
    const r = parseGs1('()1234');
    expect(r.errors.some(e => e.code === 'emptyAi')).toBe(true);
  });

  it('flags an unterminated AI', () => {
    const r = parseGs1('(01');
    expect(r.errors.some(e => e.code === 'unterminated')).toBe(true);
  });
});

describe('lookupAi', () => {
  it('returns the spec for a known AI', () => {
    expect(lookupAi('01')?.fixedLength).toBe(14);
    expect(lookupAi('21')?.maxLength).toBe(20);
  });

  it('falls back to the 310 family for 4-digit decimal-position variants', () => {
    expect(lookupAi('3100')?.alphabet).toBe('numeric');
    expect(lookupAi('3105')?.fixedLength).toBe(6);
    expect(lookupAi('3203')?.alphabet).toBe('numeric');
  });

  it('returns undefined for unknown AIs', () => {
    expect(lookupAi('99')).toBeUndefined();
  });
});

describe('validateParsedAis', () => {
  it('passes a valid GTIN payload', () => {
    const r = parseGs1('(01)12345678901234');
    expect(validateParsedAis(r.ais)).toEqual([]);
  });

  it('flags wrong-length GTIN', () => {
    const r = parseGs1('(01)1234');
    const issues = validateParsedAis(r.ais);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ai: '01', code: 'wrongLength', expectedLength: 14 });
  });

  it('flags non-numeric values for numeric AIs', () => {
    const r = parseGs1('(01)abcdefghijklmn');
    const issues = validateParsedAis(r.ais);
    expect(issues[0]?.code).toBe('badAlphabet');
  });

  it('warns on unknown AI without erroring', () => {
    const r = parseGs1('(99)foo');
    const issues = validateParsedAis(r.ais);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ai: '99', code: 'unknown' });
  });

  it('flags variable-length AI past max', () => {
    const r = parseGs1('(10)' + 'A'.repeat(25));
    const issues = validateParsedAis(r.ais);
    expect(issues[0]?.code).toBe('wrongLength');
  });
});

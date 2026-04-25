import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyMappingToRow,
  autoMapColumns,
  loadMapping,
  saveMapping,
  templateKeyFromPlaceholders,
} from '../column-mapper';

describe('autoMapColumns', () => {
  it('exact-matches columns to placeholders (case-insensitive)', () => {
    const result = autoMapColumns(['Name', 'Email'], ['name', 'email']);
    expect(result.mapping).toEqual({ name: 'Name', email: 'Email' });
    expect(result.complete).toBe(true);
    expect(result.unmapped).toEqual([]);
  });

  it('matches via fuzzy / synonym lookup', () => {
    const result = autoMapColumns(
      ['naam', 'adres', 'woonplaats'],
      ['name', 'address', 'city'],
    );
    expect(result.mapping).toMatchObject({
      name: 'naam',
      address: 'adres',
      city: 'woonplaats',
    });
    expect(result.complete).toBe(true);
  });

  it('falls back positionally when no match is found', () => {
    const result = autoMapColumns(['col1', 'col2'], ['foo', 'bar']);
    expect(result.complete).toBe(false);
    expect(result.mapping).toEqual({ foo: 'col1', bar: 'col2' });
  });

  it('reports unmapped placeholders when there are not enough columns', () => {
    const result = autoMapColumns(['only'], ['foo', 'bar']);
    expect(result.complete).toBe(false);
    // foo gets the column positionally, bar is left unmapped
    expect(result.unmapped).toEqual(['bar']);
  });

  it('reports unused columns', () => {
    const result = autoMapColumns(['name', 'extra'], ['name']);
    expect(result.unusedColumns).toEqual(['extra']);
  });
});

describe('mapping persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves and loads a mapping by template key', () => {
    const key = templateKeyFromPlaceholders(['name', 'email']);
    saveMapping(key, { name: 'Name', email: 'E-mail' });
    expect(loadMapping(key)).toEqual({ name: 'Name', email: 'E-mail' });
  });

  it('returns null when no mapping is stored', () => {
    expect(loadMapping('nope')).toBeNull();
  });

  it('produces a stable key regardless of placeholder order', () => {
    const a = templateKeyFromPlaceholders(['name', 'email']);
    const b = templateKeyFromPlaceholders(['email', 'name']);
    expect(a).toEqual(b);
  });
});

describe('applyMappingToRow', () => {
  it('projects row data through the placeholder mapping', () => {
    const row = { Name: 'Alice', Email: 'alice@example.com', Extra: 'x' };
    const mapping = { name: 'Name', email: 'Email' };
    expect(applyMappingToRow(row, mapping)).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('skips placeholders whose mapped column is missing', () => {
    expect(applyMappingToRow({ Foo: 'x' }, { bar: 'Bar' })).toEqual({});
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDataStore, ROW_LIMIT } from '../data';

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => ({
    getPlaceholders: () => ['name'],
  }),
}));

describe('data store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
  });

  it('enforces the 30 row limit on import', () => {
    const data = useDataStore();
    const rows = Array.from({ length: 50 }, (_, i) => ({ Name: `n${i}` }));
    data.setData(['Name'], rows, {
      source: 'csv',
      fileName: 'big.csv',
      totalRowsInFile: 50,
    });
    expect(data.rows).toHaveLength(ROW_LIMIT);
    expect(data.limited).toBe(true);
    expect(data.lastImport?.totalRowsInFile).toBe(50);
  });

  it('does not flag limited when the file has fewer than 30 rows', () => {
    const data = useDataStore();
    data.setData(['Name'], [{ Name: 'a' }, { Name: 'b' }], {
      source: 'csv',
      fileName: 'small.csv',
      totalRowsInFile: 2,
    });
    expect(data.limited).toBe(false);
    expect(data.rows).toHaveLength(2);
  });

  it('cycles the previewed row index', () => {
    const data = useDataStore();
    data.setData(['Name'], [{ Name: 'a' }, { Name: 'b' }, { Name: 'c' }], {
      source: 'csv',
      fileName: 'x.csv',
      totalRowsInFile: 3,
    });
    expect(data.currentIndex).toBe(0);
    data.step(1);
    expect(data.currentIndex).toBe(1);
    data.step(-2);
    expect(data.currentIndex).toBe(2);
  });

  it('exposes substituted variables for the current row via auto-mapping', () => {
    const data = useDataStore();
    data.setData(['Name'], [{ Name: 'Alice' }, { Name: 'Bob' }], {
      source: 'csv',
      fileName: 'x.csv',
      totalRowsInFile: 2,
    });
    expect(data.currentVariables).toEqual({ name: 'Alice' });
    data.step(1);
    expect(data.currentVariables).toEqual({ name: 'Bob' });
  });

  it('persists mapping changes to localStorage', () => {
    const data = useDataStore();
    data.setData(['First Name'], [{ 'First Name': 'Alice' }], {
      source: 'csv',
      fileName: 'x.csv',
      totalRowsInFile: 1,
    });
    data.setColumnFor('name', 'First Name');
    const stored = window.localStorage.getItem('burnmark.columnMapper');
    expect(stored).toBeTruthy();
    expect(stored).toContain('First Name');
  });

  it('clear() empties everything', () => {
    const data = useDataStore();
    data.setData(['Name'], [{ Name: 'a' }], {
      source: 'csv',
      fileName: 'x.csv',
      totalRowsInFile: 1,
    });
    data.clear();
    expect(data.rows).toEqual([]);
    expect(data.headers).toEqual([]);
    expect(data.lastImport).toBeNull();
  });
});

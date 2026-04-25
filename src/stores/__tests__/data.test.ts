import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDataStore, ROW_LIMIT, DATASET_LIMIT } from '../data';
import {
  __resetForTests as resetStorage,
  putDataset,
  type StoredDataset,
} from '../../services/storage';

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => ({
    getPlaceholders: () => ['name'],
  }),
}));

async function resetIdb(): Promise<void> {
  await resetStorage();
  await new Promise<void>(resolve => {
    const req = indexedDB.deleteDatabase('burnmark');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function dataset(overrides: Partial<StoredDataset> = {}): StoredDataset {
  return {
    id: overrides.id ?? `ds-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test set',
    source: 'csv',
    fileName: 'test.csv',
    headers: ['Name'],
    rows: [{ Name: 'a' }],
    totalRowsInFile: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('data store — legacy API', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    await resetIdb();
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

describe('data store — global dataset pool', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    await resetIdb();
  });

  it('hydrates the pool from IDB on demand', async () => {
    const seeded = dataset({ id: 'seed-a', name: 'Seeded A' });
    await putDataset(seeded);
    const data = useDataStore();
    await data.hydrate();
    expect(data.datasets.map(d => d.id)).toContain('seed-a');
  });

  it('round-trips datasets through IDB across store instances', async () => {
    const first = useDataStore();
    await first.hydrate();
    first.createDataset({
      source: 'manual',
      headers: ['name'],
      rows: [{ name: 'one' }],
      name: 'First',
    });
    first.createDataset({
      source: 'manual',
      headers: ['name'],
      rows: [{ name: 'two' }],
      name: 'Second',
    });
    await first.flushPersist();

    setActivePinia(createPinia());
    const second = useDataStore();
    await second.hydrate();
    expect(second.datasets).toHaveLength(2);
    expect(second.datasets.map(d => d.name).sort()).toEqual(['First', 'Second']);
  });

  it('evicts the least-recently-updated non-active set when at the cap', async () => {
    const data = useDataStore();
    await data.hydrate();
    const created: string[] = [];
    for (let i = 0; i < DATASET_LIMIT; i += 1) {
      const ds = data.createDataset({
        source: 'csv',
        fileName: `f${i}.csv`,
        headers: ['name'],
        rows: [{ name: `v${i}` }],
      });
      if (ds) created.push(ds.id);
    }
    // Activate the most-recently-created so eviction skips it.
    data.setActiveDataset(created[created.length - 1]);
    expect(data.datasets).toHaveLength(DATASET_LIMIT);
    const oldestId = created[0];
    const overflow = data.createDataset({
      source: 'csv',
      fileName: 'overflow.csv',
      headers: ['name'],
      rows: [{ name: 'new' }],
    });
    expect(overflow).not.toBeNull();
    expect(data.datasets).toHaveLength(DATASET_LIMIT);
    expect(data.datasets.some(d => d.id === oldestId)).toBe(false);
  });

  it('confirms before evicting a manual dataset', async () => {
    const data = useDataStore();
    await data.hydrate();
    // Fill the pool with one manual + (LIMIT - 1) imported sets.
    const manual = data.createDataset({
      source: 'manual',
      headers: ['name'],
      rows: [{ name: 'hand-typed' }],
      name: 'Manual',
    });
    expect(manual).not.toBeNull();
    for (let i = 0; i < DATASET_LIMIT - 1; i += 1) {
      data.createDataset({
        source: 'csv',
        fileName: `f${i}.csv`,
        headers: ['name'],
        rows: [{ name: `v${i}` }],
      });
    }
    // Activate the most recent so the manual set is the eviction victim
    // (it has the oldest updatedAt).
    data.setActiveDataset(data.datasets[0].id);

    // User declines the eviction → no new dataset, nothing removed.
    const declined = data.createDataset(
      { source: 'csv', fileName: 'over.csv', headers: ['name'], rows: [{ name: 'x' }] },
      { onEvictManual: () => false },
    );
    expect(declined).toBeNull();
    expect(data.datasets.some(d => d.id === manual!.id)).toBe(true);

    // User accepts → manual is gone, new one added.
    const accepted = data.createDataset(
      { source: 'csv', fileName: 'over.csv', headers: ['name'], rows: [{ name: 'x' }] },
      { onEvictManual: () => true },
    );
    expect(accepted).not.toBeNull();
    expect(data.datasets.some(d => d.id === manual!.id)).toBe(false);
  });

  it('appends rows to the active set, merging new headers and padding missing ones', async () => {
    const data = useDataStore();
    await data.hydrate();
    const ds = data.createDataset({
      source: 'csv',
      fileName: 'a.csv',
      headers: ['name'],
      rows: [{ name: 'Alice' }],
    });
    expect(ds).not.toBeNull();
    data.setActiveDataset(ds!.id);

    data.appendRowsToActive(['name', 'city'], [{ name: 'Bob', city: 'Amsterdam' }]);
    expect(data.headers).toEqual(['name', 'city']);
    expect(data.rows).toHaveLength(2);
    expect(data.rows[0]).toEqual({ name: 'Alice', city: '' });
    expect(data.rows[1]).toEqual({ name: 'Bob', city: 'Amsterdam' });
  });

  it('falls back to the most-recent set when the active id no longer resolves', async () => {
    const ghost = dataset({ id: 'real-1', name: 'Real' });
    await putDataset(ghost);
    window.localStorage.setItem('burnmark.activeDatasetId', '"missing-id"');
    const data = useDataStore();
    await data.hydrate();
    expect(data.activeDataset?.id).toBe('real-1');
  });

  it('resetAll wipes the pool and clears the active pointer', async () => {
    const data = useDataStore();
    await data.hydrate();
    data.createDataset({
      source: 'manual',
      headers: ['name'],
      rows: [{ name: 'x' }],
    });
    expect(data.datasets).toHaveLength(1);
    data.resetAll();
    expect(data.datasets).toEqual([]);
    expect(data.activeDataset).toBeNull();
  });
});

describe('data store — row-level mutators', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    await resetIdb();
  });

  function seedManual(headers: string[] = ['name'], rows: Record<string, string>[] = []): string {
    const data = useDataStore();
    const ds = data.createDataset({ source: 'manual', headers, rows });
    data.setActiveDataset(ds!.id);
    return ds!.id;
  }

  it('adds an empty row and steps the preview to it', () => {
    seedManual(['name'], [{ name: 'A' }]);
    const data = useDataStore();
    expect(data.rows).toHaveLength(1);
    data.addRowToActive();
    expect(data.rows).toHaveLength(2);
    expect(data.rows[1]).toEqual({ name: '' });
    expect(data.currentIndex).toBe(1);
  });

  it('caps row insertion at ROW_LIMIT', () => {
    const headers = ['name'];
    const seed = Array.from({ length: ROW_LIMIT }, (_, i) => ({ name: `n${i}` }));
    seedManual(headers, seed);
    const data = useDataStore();
    expect(data.rows).toHaveLength(ROW_LIMIT);
    data.addRowToActive();
    expect(data.rows).toHaveLength(ROW_LIMIT);
  });

  it('updates a cell, deletes a row, duplicates a row, moves a row', () => {
    seedManual(['name'], [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    const data = useDataStore();

    data.updateActiveRow(1, 'name', 'B!');
    expect(data.rows[1]).toEqual({ name: 'B!' });

    data.duplicateActiveRow(0);
    expect(data.rows.map(r => r.name)).toEqual(['A', 'A', 'B!', 'C']);

    data.moveActiveRow(0, 1);
    expect(data.rows.map(r => r.name)).toEqual(['A', 'A', 'B!', 'C']);

    data.deleteActiveRow(2);
    expect(data.rows.map(r => r.name)).toEqual(['A', 'A', 'C']);
  });

  it('addColumnToActive seeds existing rows with empty strings', () => {
    seedManual(['name'], [{ name: 'A' }, { name: 'B' }]);
    const data = useDataStore();
    const created = data.addColumnToActive('city');
    expect(created).toBe('city');
    expect(data.headers).toEqual(['name', 'city']);
    expect(data.rows[0]).toEqual({ name: 'A', city: '' });
    expect(data.rows[1]).toEqual({ name: 'B', city: '' });
  });

  it('addColumnToActive auto-numbers when no name is given and refuses duplicates', () => {
    seedManual(['name']);
    const data = useDataStore();
    expect(data.addColumnToActive()).toBe('column_2');
    expect(data.addColumnToActive('name')).toBeNull();
    expect(data.headers).toEqual(['name', 'column_2']);
  });

  it('duplicateDataset creates an independent copy', () => {
    seedManual(['name'], [{ name: 'A' }]);
    const data = useDataStore();
    const original = data.activeDataset!;
    const dup = data.duplicateDataset(original.id);
    expect(dup).not.toBeNull();
    expect(dup!.id).not.toBe(original.id);
    expect(dup!.rows).toEqual([{ name: 'A' }]);
    // Mutating the duplicate must not bleed into the original.
    data.setActiveDataset(dup!.id);
    data.updateActiveRow(0, 'name', 'B');
    expect(data.datasets.find(d => d.id === original.id)?.rows[0]).toEqual({ name: 'A' });
  });
});

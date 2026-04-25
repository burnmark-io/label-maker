import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type * as DesignerCore from '@burnmark-io/designer-core';

import { useCsvImport, type ImportRouteContext } from '../useCsvImport';
import { useDataStore } from '@/stores/data';
import { usePreferencesStore } from '@/stores/preferences';
import { __resetForTests } from '@/services/storage';

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => ({
    getPlaceholders: () => ['name'],
    designer: { on: () => () => undefined },
  }),
}));

vi.mock('@burnmark-io/designer-core', async actual => {
  const real = await actual<typeof DesignerCore>();
  return {
    ...real,
    parseCsv: vi.fn(async () => ({
      headers: ['name'],
      rows: [{ name: 'Alice' }, { name: 'Bob' }],
      rowCount: 2,
    })),
  };
});

async function resetIdb(): Promise<void> {
  await __resetForTests();
  await new Promise<void>(resolve => {
    const req = indexedDB.deleteDatabase('burnmark');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function fakeFile(name = 'guests.csv'): File {
  return new File(['name\nAlice\nBob'], name, { type: 'text/csv' });
}

describe('useCsvImport — routing', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    await resetIdb();
  });

  it('creates and activates a new dataset when no active set exists', async () => {
    const data = useDataStore();
    await data.hydrate();
    const importer = useCsvImport();
    await importer.importFile(fakeFile());
    expect(data.datasets).toHaveLength(1);
    expect(data.activeDataset?.rows).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
  });

  it('appends when prefs.csvImportBehavior === "append"', async () => {
    const data = useDataStore();
    const prefs = usePreferencesStore();
    await data.hydrate();
    const seed = data.createDataset({
      source: 'csv',
      fileName: 'old.csv',
      headers: ['name'],
      rows: [{ name: 'Existing' }],
      totalRowsInFile: 1,
    });
    data.setActiveDataset(seed!.id);
    prefs.csvImportBehavior = 'append';

    const importer = useCsvImport();
    await importer.importFile(fakeFile('extra.csv'));
    expect(data.datasets).toHaveLength(1);
    expect(data.activeDataset?.rows.map(r => r.name)).toEqual(['Existing', 'Alice', 'Bob']);
  });

  it('creates a fresh set when prefs.csvImportBehavior === "new"', async () => {
    const data = useDataStore();
    const prefs = usePreferencesStore();
    await data.hydrate();
    const seed = data.createDataset({
      source: 'csv',
      fileName: 'old.csv',
      headers: ['name'],
      rows: [{ name: 'Existing' }],
      totalRowsInFile: 1,
    });
    data.setActiveDataset(seed!.id);
    prefs.csvImportBehavior = 'new';

    const importer = useCsvImport();
    await importer.importFile(fakeFile('fresh.csv'));
    expect(data.datasets).toHaveLength(2);
    expect(data.activeDataset?.fileName).toBe('fresh.csv');
  });

  it('invokes onAsk when the active set has rows and behaviour is "ask"', async () => {
    const data = useDataStore();
    await data.hydrate();
    const seed = data.createDataset({
      source: 'csv',
      fileName: 'old.csv',
      headers: ['name'],
      rows: [{ name: 'Existing' }],
      totalRowsInFile: 1,
    });
    data.setActiveDataset(seed!.id);

    const onAsk = vi.fn((_ctx: ImportRouteContext) => ({ kind: 'append' as const }));
    const importer = useCsvImport({ onAsk });
    await importer.importFile(fakeFile());
    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(data.activeDataset?.rows.map(r => r.name)).toEqual(['Existing', 'Alice', 'Bob']);
  });

  it('honours a "cancel" decision', async () => {
    const data = useDataStore();
    await data.hydrate();
    const seed = data.createDataset({
      source: 'csv',
      fileName: 'old.csv',
      headers: ['name'],
      rows: [{ name: 'Existing' }],
      totalRowsInFile: 1,
    });
    data.setActiveDataset(seed!.id);

    const importer = useCsvImport({ onAsk: () => ({ kind: 'cancel' }) });
    await importer.importFile(fakeFile());
    expect(data.datasets).toHaveLength(1);
    expect(data.activeDataset?.rows).toHaveLength(1);
  });
});

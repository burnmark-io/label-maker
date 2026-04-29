import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

const dataState = reactive<{ rows: Record<string, string>[]; currentIndex: number }>({
  rows: [],
  currentIndex: 0,
});

const designerState = reactive<{ document: { id: string } | null }>({
  document: { id: 'doc-1' },
});

vi.mock('@/stores/data', () => ({
  useDataStore: () => dataState,
}));

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => designerState,
}));

import { usePrintConfigStore } from '../print-config';

function makeRows(n: number): Record<string, string>[] {
  return Array.from({ length: n }, (_, i) => ({ name: `row${i + 1}` }));
}

beforeEach(() => {
  setActivePinia(createPinia());
  dataState.rows = [];
  dataState.currentIndex = 0;
  designerState.document = { id: 'doc-1' };
});

describe('print-config store — defaults', () => {
  it('starts with copies = 1, density = normal, selection = active', () => {
    const store = usePrintConfigStore();
    expect(store.copies).toBe(1);
    expect(store.density).toBe('normal');
    expect(store.outputSelection).toEqual({ kind: 'active' });
  });

  it('count = 1 when no dataset', () => {
    const store = usePrintConfigStore();
    expect(store.count).toBe(1);
    expect(store.rowsForSelection).toEqual([]);
  });

  it('count multiplies by copies when no dataset', () => {
    const store = usePrintConfigStore();
    store.copies = 5;
    expect(store.count).toBe(5);
  });
});

describe('print-config store — dataset transitions', () => {
  it('defaults selection to "all" when an empty dataset becomes loaded', async () => {
    const store = usePrintConfigStore();
    expect(store.outputSelection).toEqual({ kind: 'active' });

    dataState.rows = makeRows(10);
    await nextTick();

    expect(store.outputSelection).toEqual({ kind: 'all' });
    expect(store.rowsForSelection).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(store.count).toBe(10);
  });

  it('falls back to "active" when dataset becomes empty', async () => {
    const store = usePrintConfigStore();
    dataState.rows = makeRows(5);
    await nextTick();
    expect(store.outputSelection).toEqual({ kind: 'all' });

    dataState.rows = [];
    await nextTick();

    expect(store.outputSelection).toEqual({ kind: 'active' });
    expect(store.rowsForSelection).toEqual([]);
  });

  it('clamps range bounds when dataset shrinks', async () => {
    const store = usePrintConfigStore();
    dataState.rows = makeRows(20);
    await nextTick();

    store.setOutputSelection({ kind: 'range', from: 5, to: 18 });
    expect(store.outputSelection).toEqual({ kind: 'range', from: 5, to: 18 });

    dataState.rows = makeRows(10);
    await nextTick();

    expect(store.outputSelection).toEqual({ kind: 'range', from: 5, to: 10 });
  });
});

describe('print-config store — rowsForSelection', () => {
  it('Source = active uses the dataset table active row pointer', async () => {
    const store = usePrintConfigStore();
    dataState.rows = makeRows(10);
    await nextTick();

    store.setOutputSelection({ kind: 'active' });
    dataState.currentIndex = 3;
    expect(store.rowsForSelection).toEqual([3]);
    expect(store.count).toBe(1);
  });

  it('Source = all returns every row', async () => {
    const store = usePrintConfigStore();
    dataState.rows = makeRows(3);
    await nextTick();
    store.setOutputSelection({ kind: 'all' });
    expect(store.rowsForSelection).toEqual([0, 1, 2]);
  });

  it('Source = range returns the inclusive 1-indexed slice', async () => {
    const store = usePrintConfigStore();
    dataState.rows = makeRows(10);
    await nextTick();
    store.setOutputSelection({ kind: 'range', from: 3, to: 6 });
    expect(store.rowsForSelection).toEqual([2, 3, 4, 5]);
  });

  it('count multiplies rowsForSelection by copies', async () => {
    const store = usePrintConfigStore();
    dataState.rows = makeRows(30);
    await nextTick();
    store.setOutputSelection({ kind: 'all' });
    store.copies = 2;
    expect(store.count).toBe(60);
  });
});

describe('print-config store — per-document selection', () => {
  it('selections persist per document within a session', async () => {
    const store = usePrintConfigStore();
    dataState.rows = makeRows(10);
    await nextTick();
    store.setOutputSelection({ kind: 'range', from: 2, to: 5 });
    expect(store.outputSelection).toEqual({ kind: 'range', from: 2, to: 5 });

    designerState.document = { id: 'doc-2' };
    await nextTick();
    expect(store.outputSelection).toEqual({ kind: 'all' });

    designerState.document = { id: 'doc-1' };
    await nextTick();
    expect(store.outputSelection).toEqual({ kind: 'range', from: 2, to: 5 });
  });

  it('clearSelectionFor wipes the selection for a given document', async () => {
    const store = usePrintConfigStore();
    dataState.rows = makeRows(10);
    await nextTick();
    store.setOutputSelection({ kind: 'range', from: 1, to: 3 });
    store.clearSelectionFor('doc-1');
    expect(store.outputSelection).toEqual({ kind: 'all' });
  });
});

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createDocument } from '@burnmark-io/designer-core';
import { __resetForTests } from '@/services/storage';
import { useLibraryStore, LibraryFullError } from '../library';

beforeEach(async () => {
  setActivePinia(createPinia());
  await __resetForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('burnmark');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe('library store', () => {
  it('saves and loads designs', async () => {
    const lib = useLibraryStore();
    await lib.load();
    const doc = createDocument('lib-1', { widthDots: 200, heightDots: 100, dpi: 300 }, 'Test');
    await lib.save(doc);
    expect(lib.entries).toHaveLength(1);
    const loaded = await lib.loadDesign('lib-1');
    expect(loaded?.name).toBe('Test');
    expect(lib.lastOpenedId).toBe('lib-1');
  });

  it('throws LibraryFullError when at the slot limit', async () => {
    const lib = useLibraryStore();
    await lib.load();
    for (let i = 0; i < lib.MAX_SLOTS; i += 1) {
      const doc = createDocument(`d-${i}`, { widthDots: 100, heightDots: 60, dpi: 300 });
      await lib.save(doc);
    }
    expect(lib.entries.length).toBe(lib.MAX_SLOTS);
    expect(lib.isFull).toBe(true);

    const overflow = createDocument('extra', { widthDots: 100, heightDots: 60, dpi: 300 });
    await expect(lib.save(overflow)).rejects.toBeInstanceOf(LibraryFullError);
  });

  it('updating an existing design does not consume a slot', async () => {
    const lib = useLibraryStore();
    await lib.load();
    for (let i = 0; i < lib.MAX_SLOTS; i += 1) {
      const doc = createDocument(`d-${i}`, { widthDots: 100, heightDots: 60, dpi: 300 });
      await lib.save(doc);
    }
    const reused = createDocument('d-0', { widthDots: 200, heightDots: 100, dpi: 300 }, 'Renamed');
    await expect(lib.save(reused)).resolves.toBeTruthy();
    expect(lib.entries.length).toBe(lib.MAX_SLOTS);
  });

  it('deletes designs', async () => {
    const lib = useLibraryStore();
    await lib.load();
    const doc = createDocument('to-delete', { widthDots: 100, heightDots: 60, dpi: 300 });
    await lib.save(doc);
    await lib.deleteDesign('to-delete');
    expect(lib.entries.find((e) => e.id === 'to-delete')).toBeUndefined();
  });
});

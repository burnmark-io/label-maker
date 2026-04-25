import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@burnmark-io/designer-core';

import {
  __resetForTests,
  deleteDesign,
  getMeta,
  listDatasets,
  listDesignSummaries,
  loadDesign,
  putDataset,
  saveDesign,
  setMeta,
  type StoredDataset,
} from '../storage';

beforeEach(async () => {
  await __resetForTests();
  await new Promise<void>(resolve => {
    const req = indexedDB.deleteDatabase('burnmark');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe('storage', () => {
  it('saves a design and lists it back', async () => {
    const doc = createDocument('design-1', { widthDots: 200, heightDots: 100, dpi: 300 }, 'Test');
    await saveDesign(doc);

    const list = await listDesignSummaries();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'design-1', name: 'Test', canvasWidth: 200 });
  });

  it('round-trips a document through save + load', async () => {
    const doc = createDocument('design-2', { widthDots: 200, heightDots: 100, dpi: 300 }, 'Round');
    await saveDesign(doc);

    const loaded = await loadDesign('design-2');
    expect(loaded?.id).toBe('design-2');
    expect(loaded?.name).toBe('Round');
  });

  it('returns null for a missing design', async () => {
    expect(await loadDesign('missing')).toBeNull();
  });

  it('deletes a design', async () => {
    const doc = createDocument('design-3', { widthDots: 100, heightDots: 60, dpi: 300 });
    await saveDesign(doc);
    await deleteDesign('design-3');
    const list = await listDesignSummaries();
    expect(list).toEqual([]);
  });

  it('persists meta key/value pairs', async () => {
    await setMeta('lastOpenedId', 'design-x');
    expect(await getMeta<string>('lastOpenedId')).toBe('design-x');
  });

  it('round-trips datasets through the v2 store', async () => {
    const ds: StoredDataset = {
      id: 'ds-1',
      name: 'Guests',
      source: 'csv',
      fileName: 'guests.csv',
      headers: ['name', 'city'],
      rows: [
        { name: 'Alice', city: 'Amsterdam' },
        { name: 'Bob', city: 'Utrecht' },
      ],
      totalRowsInFile: 2,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };
    await putDataset(ds);
    const all = await listDatasets();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 'ds-1', name: 'Guests', headers: ['name', 'city'] });
  });

  it('v1 → v2 upgrade preserves existing designs / assets / meta', async () => {
    // Manually open a v1 DB with a design / asset / meta entry, close
    // it, then reopen at v2 via the production opener. Anything we
    // pre-seeded should survive.
    await __resetForTests();
    await new Promise<void>(resolve => {
      const req = indexedDB.deleteDatabase('burnmark');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('burnmark', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('designs', { keyPath: 'id' });
        db.createObjectStore('assets');
        db.createObjectStore('meta');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['designs', 'assets', 'meta'], 'readwrite');
        tx.objectStore('designs').put({
          id: 'legacy-1',
          name: 'Legacy',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          canvasWidth: 200,
          canvasHeight: 100,
          json: '{"id":"legacy-1","name":"Legacy"}',
        });
        tx.objectStore('assets').put(new Uint8Array([1, 2, 3]), 'asset-key');
        tx.objectStore('meta').put('legacy-1', 'lastOpenedId');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    // Production opener jumps the version to 2 and adds the datasets store.
    const designs = await listDesignSummaries();
    expect(designs.map(d => d.id)).toContain('legacy-1');
    const lastOpened = await getMeta<string>('lastOpenedId');
    expect(lastOpened).toBe('legacy-1');
    const datasets = await listDatasets();
    expect(datasets).toEqual([]);
  });
});

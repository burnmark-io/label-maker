import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@burnmark-io/designer-core';

import { deriveKey, newSalt } from '../crypto';
import {
  __resetForTests,
  clearAllStores,
  countAssets,
  deleteDesign,
  getAsset,
  getMeta,
  listDatasets,
  listDesignSummaries,
  loadDesign,
  migrateEncryption,
  putAsset,
  putDataset,
  saveDesign,
  setMeta,
  setStorageKey,
  type StoredDataset,
} from '../storage';

const TEST_KDF = { iterations: 1_000, hash: 'SHA-256' as const };

beforeEach(async () => {
  await __resetForTests();
  await new Promise<void>(resolve => {
    const req = indexedDB.deleteDatabase('burnmark');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

afterEach(() => {
  // Make sure no encrypted-mode key leaks into the next test.
  setStorageKey(null);
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

  describe('encryption', () => {
    it('encrypts designs end-to-end when a key is set', async () => {
      const key = await deriveKey('hunter2', newSalt(), TEST_KDF);
      setStorageKey(key);

      const doc = createDocument(
        'design-enc',
        { widthDots: 200, heightDots: 100, dpi: 300 },
        'Aunt Carla',
      );
      await saveDesign(doc);

      // Round-trip through the public API still works.
      const summaries = await listDesignSummaries();
      expect(summaries.map(s => s.name)).toEqual(['Aunt Carla']);
      const loaded = await loadDesign('design-enc');
      expect(loaded?.name).toBe('Aunt Carla');

      // Without the key, the encrypted record can't be decoded — the
      // plaintext name "Aunt Carla" is unreachable.
      setStorageKey(null);
      expect(await loadDesign('design-enc')).toBeNull();
      expect(await listDesignSummaries()).toEqual([]);
    });

    it('encrypts datasets end-to-end when a key is set', async () => {
      const key = await deriveKey('pw', newSalt(), TEST_KDF);
      setStorageKey(key);

      const ds: StoredDataset = {
        id: 'ds-enc',
        name: 'Guests',
        source: 'csv',
        fileName: 'g.csv',
        headers: ['name'],
        rows: [{ name: 'Alice' }],
        totalRowsInFile: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      await putDataset(ds);
      const all = await listDatasets();
      expect(all).toHaveLength(1);
      expect(all[0].rows[0].name).toBe('Alice');

      setStorageKey(null);
      expect(await listDatasets()).toEqual([]);
    });

    it('encrypts asset bytes when a key is set', async () => {
      const key = await deriveKey('pw', newSalt(), TEST_KDF);
      setStorageKey(key);

      const data = new Uint8Array([10, 20, 30, 40]);
      await putAsset('a1', data);
      const back = await getAsset('a1');
      expect(back && Array.from(back)).toEqual([10, 20, 30, 40]);

      setStorageKey(null);
      // Without the key, the encrypted record can't be decoded.
      expect(await getAsset('a1')).toBeUndefined();
    });

    it('migrates plaintext → encrypted in place', async () => {
      const doc = createDocument(
        'design-mig',
        { widthDots: 150, heightDots: 60, dpi: 300 },
        'Plain',
      );
      await saveDesign(doc);
      await putDataset({
        id: 'ds-mig',
        name: 'X',
        source: 'manual',
        fileName: null,
        headers: ['h'],
        rows: [{ h: 'v' }],
        totalRowsInFile: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
      await putAsset('asset-mig', new Uint8Array([1, 2, 3]));

      const key = await deriveKey('pw', newSalt(), TEST_KDF);
      await migrateEncryption(null, key);

      // Same data, now reachable only with the key.
      expect((await listDesignSummaries()).map(s => s.name)).toEqual(['Plain']);
      expect((await listDatasets()).map(d => d.id)).toEqual(['ds-mig']);
      const back = await getAsset('asset-mig');
      expect(back && Array.from(back)).toEqual([1, 2, 3]);

      setStorageKey(null);
      expect(await listDesignSummaries()).toEqual([]);
      expect(await getAsset('asset-mig')).toBeUndefined();
    });

    it('migrates encrypted → plaintext on disable', async () => {
      const key = await deriveKey('pw', newSalt(), TEST_KDF);
      setStorageKey(key);
      const doc = createDocument(
        'design-dec',
        { widthDots: 100, heightDots: 60, dpi: 300 },
        'Secret',
      );
      await saveDesign(doc);

      await migrateEncryption(key, null);
      // After disable, listing/loading work without any key set.
      expect((await listDesignSummaries()).map(s => s.name)).toEqual(['Secret']);
      const loaded = await loadDesign('design-dec');
      expect(loaded?.name).toBe('Secret');
    });

    it('migrates encrypted → encrypted with a new key (change password)', async () => {
      const oldKey = await deriveKey('old', newSalt(), TEST_KDF);
      setStorageKey(oldKey);
      await saveDesign(
        createDocument('design-cp', { widthDots: 100, heightDots: 60, dpi: 300 }, 'Roll'),
      );

      const newKey = await deriveKey('new', newSalt(), TEST_KDF);
      await migrateEncryption(oldKey, newKey);

      // Old key no longer works; new key does.
      setStorageKey(oldKey);
      expect(await loadDesign('design-cp')).toBeNull();
      setStorageKey(newKey);
      expect((await loadDesign('design-cp'))?.name).toBe('Roll');
    });

    it('countAssets returns the asset count', async () => {
      expect(await countAssets()).toBe(0);
      await putAsset('a', new Uint8Array([1]));
      await putAsset('b', new Uint8Array([2]));
      expect(await countAssets()).toBe(2);
    });

    it('clearAllStores empties every store and resets the key', async () => {
      const key = await deriveKey('pw', newSalt(), TEST_KDF);
      setStorageKey(key);
      await saveDesign(createDocument('d', { widthDots: 100, heightDots: 60, dpi: 300 }, 'X'));
      await putAsset('a', new Uint8Array([1]));
      await setMeta('k', 'v');

      await clearAllStores();
      // After reset, no key is set; every list is empty.
      expect(await listDesignSummaries()).toEqual([]);
      expect(await listDatasets()).toEqual([]);
      expect(await countAssets()).toBe(0);
      expect(await getMeta('k')).toBeUndefined();
    });
  });
});

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@burnmark-io/designer-core';

import {
  __resetForTests,
  deleteDesign,
  getMeta,
  listDesignSummaries,
  loadDesign,
  saveDesign,
  setMeta,
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
});

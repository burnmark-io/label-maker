import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { LabelDocument } from '@burnmark-io/designer-core';
import { fromJSON, toJSON } from '@burnmark-io/designer-core';

/**
 * IndexedDB-backed persistence for label-maker. One DB, four stores:
 *
 * - `designs`     — saved label documents (JSON)
 * - `assets`      — image assets keyed by content hash
 * - `meta`        — small key/value scratchpad (last opened id, etc.)
 * - `datasets`    — global dataset pool (added at v2). Not bound to any
 *                   particular `LabelDocument`; one set lives across all
 *                   designs that share the same placeholder shape.
 *
 * Designs are stored as JSON strings so the schema is robust against
 * future document migrations (the parser handles versioning on load).
 *
 * Schema upgrades are idempotent: v1 → v2 only adds the `datasets`
 * store, leaving `designs`, `assets`, `meta` untouched.
 */

const DB_NAME = 'burnmark';
const DB_VERSION = 2;

export interface StoredDesignSummary {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  canvasWidth: number;
  canvasHeight: number;
}

interface StoredDesign extends StoredDesignSummary {
  json: string;
}

export type DatasetSource = 'csv' | 'tsv' | 'xlsx' | 'manual';

export interface StoredDataset {
  id: string;
  name: string;
  source: DatasetSource;
  fileName: string | null;
  headers: string[];
  rows: Record<string, string>[];
  /** Total rows in the original file. Drives the "showing first 30 of N" banner. */
  totalRowsInFile: number;
  createdAt: string;
  updatedAt: string;
}

interface BurnmarkSchema extends DBSchema {
  designs: {
    key: string;
    value: StoredDesign;
  };
  assets: {
    key: string;
    value: Uint8Array;
  };
  meta: {
    key: string;
    value: unknown;
  };
  datasets: {
    key: string;
    value: StoredDataset;
  };
}

let dbPromise: Promise<IDBPDatabase<BurnmarkSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<BurnmarkSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<BurnmarkSchema>(DB_NAME, DB_VERSION, {
      // Idempotent upgrade — `idb` runs this for every version step from
      // oldVersion+1 to DB_VERSION, so each `if (!contains)` adds the
      // store on the first version that introduced it without disturbing
      // existing stores on subsequent boots.
      upgrade(db) {
        if (!db.objectStoreNames.contains('designs')) {
          db.createObjectStore('designs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
        if (!db.objectStoreNames.contains('datasets')) {
          db.createObjectStore('datasets', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Test-only: close any cached connection and forget the memoised promise
 * so the next call reopens cleanly. Used by tests that want a fresh DB
 * without stale handles holding the deleteDatabase request open.
 */
export async function __resetForTests(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // ignore
    }
    dbPromise = null;
  }
}

export async function listDesignSummaries(): Promise<StoredDesignSummary[]> {
  const db = await getDb();
  const all = await db.getAll('designs');
  return all
    .map(({ json: _json, ...summary }) => summary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadDesign(id: string): Promise<LabelDocument | null> {
  const db = await getDb();
  const stored = await db.get('designs', id);
  if (!stored) return null;
  try {
    return fromJSON(stored.json);
  } catch {
    return null;
  }
}

export async function saveDesign(
  doc: LabelDocument,
  extras: { description?: string; thumbnail?: string } = {},
): Promise<StoredDesignSummary> {
  const db = await getDb();
  const summary: StoredDesignSummary = {
    id: doc.id,
    name: doc.name,
    description: extras.description,
    thumbnail: extras.thumbnail,
    createdAt: doc.createdAt,
    updatedAt: new Date().toISOString(),
    canvasWidth: doc.canvas.widthDots,
    canvasHeight: doc.canvas.heightDots,
  };
  const stored: StoredDesign = { ...summary, json: toJSON(doc) };
  await db.put('designs', stored);
  return summary;
}

export async function deleteDesign(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('designs', id);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return (await db.get('meta', key)) as T | undefined;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put('meta', value, key);
}

export async function deleteMeta(key: string): Promise<void> {
  const db = await getDb();
  await db.delete('meta', key);
}

/**
 * Asset storage — the design library's image bytes. Keyed by content
 * hash so duplicates dedupe naturally.
 */
export async function putAsset(key: string, data: Uint8Array): Promise<void> {
  const db = await getDb();
  await db.put('assets', data, key);
}

export async function getAsset(key: string): Promise<Uint8Array | undefined> {
  const db = await getDb();
  return db.get('assets', key);
}

/**
 * Dataset pool — global, not keyed by document. Sorted most-recently-
 * updated first so the boot-time hydrate hands the data store something
 * the dataset switcher can render straight away.
 */
export async function listDatasets(): Promise<StoredDataset[]> {
  const db = await getDb();
  const all = await db.getAll('datasets');
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function putDataset(dataset: StoredDataset): Promise<void> {
  const db = await getDb();
  await db.put('datasets', dataset);
}

export async function deleteDataset(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('datasets', id);
}

export async function clearDatasets(): Promise<void> {
  const db = await getDb();
  await db.clear('datasets');
}

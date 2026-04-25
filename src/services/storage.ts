import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { LabelDocument } from '@burnmark-io/designer-core';
import { fromJSON, toJSON } from '@burnmark-io/designer-core';

/**
 * IndexedDB-backed persistence for label-maker. One DB, three stores:
 *
 * - `designs`     — saved label documents (JSON)
 * - `assets`      — image assets keyed by content hash
 * - `meta`        — small key/value scratchpad (last opened id, etc.)
 *
 * Designs are stored as JSON strings so the schema is robust against
 * future document migrations (the parser handles versioning on load).
 */

const DB_NAME = 'burnmark';
const DB_VERSION = 1;

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
}

let dbPromise: Promise<IDBPDatabase<BurnmarkSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<BurnmarkSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<BurnmarkSchema>(DB_NAME, DB_VERSION, {
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

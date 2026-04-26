import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { LabelDocument } from '@burnmark-io/designer-core';
import { fromJSON, toJSON } from '@burnmark-io/designer-core';

import { decryptBytes, decryptString, encryptBytes, encryptString, type Envelope } from './crypto';

/**
 * IndexedDB-backed persistence for label-maker. One DB, four stores:
 *
 * - `designs`     — saved label documents (JSON)
 * - `assets`      — image assets keyed by content hash
 * - `meta`        — small key/value scratchpad (last opened id, encryption
 *                   metadata). Always plaintext.
 * - `datasets`    — global dataset pool
 *
 * Encryption is opt-in (see `amendment-local-data-encryption.md`). When a
 * key is registered via `setStorageKey`, every value-bearing read/write
 * routes through an AES-GCM envelope; `meta` stays plaintext so the
 * encryption metadata itself can be read pre-unlock.
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

interface StoredDesignPlain extends StoredDesignSummary {
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

interface EncryptedDesignRecord {
  id: string;
  iv: Uint8Array;
  ciphertext: Uint8Array;
  encVer: 1;
}

interface EncryptedDatasetRecord {
  id: string;
  iv: Uint8Array;
  ciphertext: Uint8Array;
  encVer: 1;
}

interface EncryptedAssetRecord {
  iv: Uint8Array;
  ciphertext: Uint8Array;
  encVer: 1;
}

interface BurnmarkSchema extends DBSchema {
  designs: {
    key: string;
    value: StoredDesignPlain | EncryptedDesignRecord;
  };
  assets: {
    key: string;
    value: Uint8Array | EncryptedAssetRecord;
  };
  meta: {
    key: string;
    value: unknown;
  };
  datasets: {
    key: string;
    value: StoredDataset | EncryptedDatasetRecord;
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

// ---- Active-key registry --------------------------------------------------
//
// `services/storage.ts` is a leaf service used by stores; routing the
// encryption key through every call site would be invasive. Instead we
// hold the session key here and let `stores/crypto.ts` register/clear it
// at boot/unlock/lock boundaries. Outside callers MUST NOT introspect the
// key — only set/clear.

let activeKey: CryptoKey | null = null;

export function setStorageKey(key: CryptoKey | null): void {
  activeKey = key;
}

export function getStorageKey(): CryptoKey | null {
  return activeKey;
}

export function isStorageEncrypted(): boolean {
  return activeKey !== null;
}

function isEncryptedDesign(v: unknown): v is EncryptedDesignRecord {
  return (
    typeof v === 'object' &&
    v !== null &&
    'ciphertext' in v &&
    'iv' in v &&
    !('json' in v) &&
    !('name' in v)
  );
}

function isEncryptedDataset(v: unknown): v is EncryptedDatasetRecord {
  return typeof v === 'object' && v !== null && 'ciphertext' in v && 'iv' in v && !('headers' in v);
}

function isEncryptedAsset(v: unknown): v is EncryptedAssetRecord {
  return typeof v === 'object' && v !== null && 'ciphertext' in v && 'iv' in v && 'encVer' in v;
}

function envelopeOf(rec: { iv: Uint8Array; ciphertext: Uint8Array }): Envelope {
  return { iv: rec.iv, ciphertext: rec.ciphertext };
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
  activeKey = null;
}

// ---- Designs --------------------------------------------------------------

function summaryOf(stored: StoredDesignPlain): StoredDesignSummary {
  const { json: _json, ...summary } = stored;
  return summary;
}

async function readDesignRecord(
  record: StoredDesignPlain | EncryptedDesignRecord,
): Promise<StoredDesignPlain | null> {
  if (isEncryptedDesign(record)) {
    if (!activeKey) return null;
    try {
      const plain = await decryptString(activeKey, envelopeOf(record));
      return JSON.parse(plain) as StoredDesignPlain;
    } catch {
      return null;
    }
  }
  return record;
}

async function writeDesignRecord(
  stored: StoredDesignPlain,
): Promise<StoredDesignPlain | EncryptedDesignRecord> {
  if (!activeKey) return stored;
  const env = await encryptString(activeKey, JSON.stringify(stored));
  return { id: stored.id, iv: env.iv, ciphertext: env.ciphertext, encVer: 1 };
}

export async function listDesignSummaries(): Promise<StoredDesignSummary[]> {
  const db = await getDb();
  const all = await db.getAll('designs');
  const summaries: StoredDesignSummary[] = [];
  for (const record of all) {
    const plain = await readDesignRecord(record);
    if (plain) summaries.push(summaryOf(plain));
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadDesign(id: string): Promise<LabelDocument | null> {
  const db = await getDb();
  const record = await db.get('designs', id);
  if (!record) return null;
  const plain = await readDesignRecord(record);
  if (!plain) return null;
  try {
    return fromJSON(plain.json);
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
  const stored: StoredDesignPlain = { ...summary, json: toJSON(doc) };
  const record = await writeDesignRecord(stored);
  await db.put('designs', record);
  return summary;
}

export async function deleteDesign(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('designs', id);
}

// ---- Meta -----------------------------------------------------------------
// Plaintext intentionally — the encryption metadata itself lives here.

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

// ---- Assets ---------------------------------------------------------------

export async function putAsset(key: string, data: Uint8Array): Promise<void> {
  const db = await getDb();
  if (activeKey) {
    const env = await encryptBytes(activeKey, data);
    const record: EncryptedAssetRecord = { iv: env.iv, ciphertext: env.ciphertext, encVer: 1 };
    await db.put('assets', record, key);
  } else {
    await db.put('assets', data, key);
  }
}

export async function getAsset(key: string): Promise<Uint8Array | undefined> {
  const db = await getDb();
  const record = await db.get('assets', key);
  if (!record) return undefined;
  if (isEncryptedAsset(record)) {
    if (!activeKey) return undefined;
    try {
      return await decryptBytes(activeKey, envelopeOf(record));
    } catch {
      return undefined;
    }
  }
  return record;
}

export async function countAssets(): Promise<number> {
  const db = await getDb();
  return db.count('assets');
}

// ---- Datasets -------------------------------------------------------------

async function readDatasetRecord(
  record: StoredDataset | EncryptedDatasetRecord,
): Promise<StoredDataset | null> {
  if (isEncryptedDataset(record)) {
    if (!activeKey) return null;
    try {
      const plain = await decryptString(activeKey, envelopeOf(record));
      return JSON.parse(plain) as StoredDataset;
    } catch {
      return null;
    }
  }
  return record;
}

async function writeDatasetRecord(
  dataset: StoredDataset,
): Promise<StoredDataset | EncryptedDatasetRecord> {
  if (!activeKey) return dataset;
  const env = await encryptString(activeKey, JSON.stringify(dataset));
  return { id: dataset.id, iv: env.iv, ciphertext: env.ciphertext, encVer: 1 };
}

export async function listDatasets(): Promise<StoredDataset[]> {
  const db = await getDb();
  const all = await db.getAll('datasets');
  const out: StoredDataset[] = [];
  for (const record of all) {
    const plain = await readDatasetRecord(record);
    if (plain) out.push(plain);
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function putDataset(dataset: StoredDataset): Promise<void> {
  const db = await getDb();
  const record = await writeDatasetRecord(dataset);
  await db.put('datasets', record);
}

export async function deleteDataset(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('datasets', id);
}

export async function clearDatasets(): Promise<void> {
  const db = await getDb();
  await db.clear('datasets');
}

// ---- Encryption migration -------------------------------------------------
//
// Re-write every record in `designs`, `datasets`, `assets` from the shape
// implied by `oldKey` (null = plaintext) to the shape implied by `newKey`
// (null = plaintext). Used by stores/crypto.ts on setup, change-password,
// and disable. Sets `activeKey` to `newKey` once the rewrite completes
// successfully so subsequent reads/writes stay consistent.

export async function migrateEncryption(
  oldKey: CryptoKey | null,
  newKey: CryptoKey | null,
): Promise<void> {
  const db = await getDb();

  // Designs
  {
    const all = await db.getAll('designs');
    const ids = await db.getAllKeys('designs');
    for (let i = 0; i < all.length; i += 1) {
      const record = all[i];
      const id = ids[i];
      // Decrypt with old key (or pass through if plaintext)
      let plain: StoredDesignPlain | null;
      if (isEncryptedDesign(record)) {
        if (!oldKey) throw new Error('Refusing to migrate: encrypted design but no old key.');
        const text = await decryptString(oldKey, envelopeOf(record));
        plain = JSON.parse(text) as StoredDesignPlain;
      } else {
        plain = record;
      }
      // Re-encrypt with new key (or store plaintext)
      let next: StoredDesignPlain | EncryptedDesignRecord;
      if (newKey) {
        const env = await encryptString(newKey, JSON.stringify(plain));
        next = { id: plain.id, iv: env.iv, ciphertext: env.ciphertext, encVer: 1 };
      } else {
        next = plain;
      }
      await db.put('designs', next);
      // The id may have changed shape (envelope.id vs plain.id) — both keep the
      // same string id, but the stored record is in-place. No need to delete.
      void id;
    }
  }

  // Datasets
  {
    const all = await db.getAll('datasets');
    for (const record of all) {
      let plain: StoredDataset | null;
      if (isEncryptedDataset(record)) {
        if (!oldKey) throw new Error('Refusing to migrate: encrypted dataset but no old key.');
        const text = await decryptString(oldKey, envelopeOf(record));
        plain = JSON.parse(text) as StoredDataset;
      } else {
        plain = record;
      }
      let next: StoredDataset | EncryptedDatasetRecord;
      if (newKey) {
        const env = await encryptString(newKey, JSON.stringify(plain));
        next = { id: plain.id, iv: env.iv, ciphertext: env.ciphertext, encVer: 1 };
      } else {
        next = plain;
      }
      await db.put('datasets', next);
    }
  }

  // Assets — keyed out-of-line, so we need keys + values
  {
    const keys = await db.getAllKeys('assets');
    const values = await db.getAll('assets');
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const record = values[i];
      let plain: Uint8Array;
      if (isEncryptedAsset(record)) {
        if (!oldKey) throw new Error('Refusing to migrate: encrypted asset but no old key.');
        plain = await decryptBytes(oldKey, envelopeOf(record));
      } else {
        plain = record;
      }
      let next: Uint8Array | EncryptedAssetRecord;
      if (newKey) {
        const env = await encryptBytes(newKey, plain);
        next = { iv: env.iv, ciphertext: env.ciphertext, encVer: 1 };
      } else {
        next = plain;
      }
      await db.put('assets', next, key);
    }
  }

  activeKey = newKey;
}

/**
 * Wipe every store. Used by the "Reset all my data" path. Does not touch
 * localStorage — that's the caller's job.
 */
export async function clearAllStores(): Promise<void> {
  const db = await getDb();
  await db.clear('designs');
  await db.clear('datasets');
  await db.clear('assets');
  await db.clear('meta');
  activeKey = null;
}

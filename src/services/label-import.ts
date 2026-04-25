import type { LabelDocument } from '@burnmark-io/designer-core';
import { fromJSON } from '@burnmark-io/designer-core';
import { parseBundle } from './label-import.bundle';

/**
 * Minimal asset-loader surface needed by import. Both
 * `BurnmarkAssetLoader` and the pinia-store flavour from
 * `useDesignerStore` are structurally compatible.
 */
export interface ImportAssetLoader {
  set(key: string, data: Uint8Array): void;
  has(key: string): Promise<boolean>;
}

export const MAX_IMPORT_SIZE = 50 * 1024 * 1024;

export type ImportErrorCode =
  | 'too-large'
  | 'unknown-format'
  | 'invalid-json'
  | 'invalid-zip'
  | 'bundle-missing-label'
  | 'bundle-label-malformed';

export class ImportError extends Error {
  constructor(
    public readonly code: ImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

export type ImportResult =
  | { kind: 'label'; doc: LabelDocument }
  | {
      kind: 'bundle';
      doc: LabelDocument;
      restoredAssetKeys: string[];
      missingAssetKeys: string[];
    };

async function readBlobText(blob: Blob): Promise<string> {
  // Blob.text() isn't available in every test environment; fall back to a
  // FileReader-based read which jsdom does support.
  if (typeof blob.text === 'function') return blob.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function isZipFile(file: File): boolean {
  if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed') return true;
  return file.name.toLowerCase().endsWith('.zip');
}

function isJsonFile(file: File): boolean {
  if (file.type === 'application/json') return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith('.label') || lower.endsWith('.json');
}

/**
 * Parse a `.label` JSON file or `.zip` bundle into a LabelDocument and
 * (for bundles) restore referenced asset bytes into the asset loader.
 *
 * Always rewrites the document's id + timestamps so a freshly imported
 * doc cannot silently overwrite an existing library slot. Mirrors the
 * share-URL path in `readDocumentFromHash`.
 */
export async function importLabelFile(
  file: File,
  assetLoader: ImportAssetLoader,
): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_SIZE) {
    throw new ImportError(
      'too-large',
      `File is too large to import (${file.size} bytes; limit ${MAX_IMPORT_SIZE}).`,
    );
  }

  let result: ImportResult;
  if (isZipFile(file)) {
    const parsed = await parseBundle(file);
    for (const { key, bytes } of parsed.assets) {
      assetLoader.set(key, bytes);
    }
    result = {
      kind: 'bundle',
      doc: parsed.doc,
      restoredAssetKeys: parsed.assets.map(a => a.key),
      missingAssetKeys: parsed.missingAssetKeys,
    };
  } else if (isJsonFile(file)) {
    const text = await readBlobText(file);
    let doc: LabelDocument;
    try {
      doc = fromJSON(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ImportError('invalid-json', message);
    }
    result = { kind: 'label', doc };
  } else {
    throw new ImportError('unknown-format', `Unsupported file type: ${file.name}`);
  }

  // Final step (both paths) — rewrite id + timestamps so the imported
  // document is never confused with an existing library slot. Mirrors
  // share-encoder's readDocumentFromHash rewrite.
  const now = new Date().toISOString();
  result.doc.id = crypto.randomUUID();
  result.doc.createdAt = now;
  result.doc.updatedAt = now;

  return result;
}

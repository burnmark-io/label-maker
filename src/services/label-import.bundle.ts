import JSZip from 'jszip';
import type { LabelDocument } from '@burnmark-io/designer-core';
import { fromJSON, isImageObject, walkObjects } from '@burnmark-io/designer-core';
import { ImportError } from './label-import';

export interface ParsedBundle {
  doc: LabelDocument;
  assets: Array<{ key: string; bytes: Uint8Array }>;
  missingAssetKeys: string[];
}

/**
 * Parse a `.zip` bundle produced by `exportBundled`. Layout:
 *   - `label.json` at the zip root
 *   - `assets/<assetKey>` for each referenced image
 *
 * Throws `ImportError` for malformed input. Missing assets are
 * reported in `missingAssetKeys` rather than thrown — the document
 * still loads, the renderer's missing-asset placeholder covers the
 * gap.
 */
export async function parseBundle(blob: Blob): Promise<ParsedBundle> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(blob);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ImportError('invalid-zip', message);
  }

  const labelEntry = zip.file('label.json');
  if (!labelEntry) {
    throw new ImportError('bundle-missing-label', 'Bundle is missing label.json');
  }

  let doc: LabelDocument;
  try {
    const json = await labelEntry.async('string');
    doc = fromJSON(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ImportError('bundle-label-malformed', message);
  }

  const referenced = new Set<string>();
  for (const obj of walkObjects(doc.objects)) {
    if (isImageObject(obj) && obj.assetKey) referenced.add(obj.assetKey);
  }

  const assets: Array<{ key: string; bytes: Uint8Array }> = [];
  const missingAssetKeys: string[] = [];

  for (const key of referenced) {
    const entry = zip.file(`assets/${key}`);
    if (!entry) {
      missingAssetKeys.push(key);
      continue;
    }
    const bytes = await entry.async('uint8array');
    assets.push({ key, bytes });
  }

  // Best-effort dev-only integrity check: warn if the file's name (the
  // expected key) disagrees with the content hash. Skipped in tests
  // (where test fixtures are not content-addressed) and in production
  // (the renderer's missing-asset placeholder covers tampered bundles).
  if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') {
    for (const { key, bytes } of assets) {
      void verifyHashInDev(key, bytes);
    }
  }

  return { doc, assets, missingAssetKeys };
}

async function verifyHashInDev(key: string, bytes: Uint8Array): Promise<void> {
  try {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const digest = await globalThis.crypto.subtle.digest('SHA-1', buffer);
    const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hex !== key) {
      console.warn(`[label-import] asset key/content hash mismatch: key=${key}, hash=${hex}`);
    }
  } catch {
    // Best-effort: don't break import on verification failure.
  }
}

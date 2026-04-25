import { describe, expect, it } from 'vitest';
import { createDocument, exportBundled } from '@burnmark-io/designer-core';
import type { ImageObject, LabelDocument } from '@burnmark-io/designer-core';
import { BurnmarkAssetLoader } from '@/services/asset-loader';
import { importLabelFile, type ImportResult } from '../label-import';

async function buildDocWithImage(loader: BurnmarkAssetLoader): Promise<{
  doc: LabelDocument;
  assetKey: string;
}> {
  // Use a deterministic asset payload — sha-1 keys are content-addressed.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = i;
  const assetKey = await loader.store(bytes);
  const doc = createDocument('roundtrip', { widthDots: 100, heightDots: 60, dpi: 300 });
  const img: ImageObject = {
    id: 'i1',
    type: 'image',
    x: 0,
    y: 0,
    width: 50,
    height: 50,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#000000',
    assetKey,
    fit: 'contain',
    threshold: 128,
    dither: false,
    invert: false,
  };
  doc.objects.push(img);
  return { doc, assetKey };
}

describe('label-import round-trip', () => {
  it('export → import round-trips a document with image assets', async () => {
    const exportLoader = new BurnmarkAssetLoader();
    const { doc, assetKey } = await buildDocWithImage(exportLoader);

    const { blob, missing } = await exportBundled(doc, exportLoader);
    expect(missing).toEqual([]);

    const importLoader = new BurnmarkAssetLoader();
    const file = new File([blob], 'roundtrip.zip', { type: 'application/zip' });
    const result = (await importLabelFile(file, importLoader)) as Extract<
      ImportResult,
      { kind: 'bundle' }
    >;

    expect(result.kind).toBe('bundle');
    expect(result.doc.id).not.toBe(doc.id);
    expect(result.missingAssetKeys).toEqual([]);
    expect(await importLoader.has(assetKey)).toBe(true);

    // Strip rewritten fields and compare structure.
    const { id: _i1, createdAt: _c1, updatedAt: _u1, ...restA } = result.doc;
    const { id: _i2, createdAt: _c2, updatedAt: _u2, ...restB } = doc;
    void _i1;
    void _c1;
    void _u1;
    void _i2;
    void _c2;
    void _u2;
    expect(restA).toEqual(restB);
  });
});

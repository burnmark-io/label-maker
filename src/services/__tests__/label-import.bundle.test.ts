import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createDocument } from '@burnmark-io/designer-core';
import type { LabelDocument } from '@burnmark-io/designer-core';
import { parseBundle } from '../label-import.bundle';

function docWithImage(assetKey: string): LabelDocument {
  const doc = createDocument('bundle-test', { widthDots: 100, heightDots: 60, dpi: 300 });
  doc.objects.push({
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
  });
  return doc;
}

async function makeBundle(
  label: LabelDocument,
  assets: Array<{ key: string; bytes: Uint8Array }>,
): Promise<Blob> {
  const zip = new JSZip();
  zip.file('label.json', JSON.stringify(label));
  for (const { key, bytes } of assets) zip.file(`assets/${key}`, bytes);
  return zip.generateAsync({ type: 'blob' });
}

describe('parseBundle', () => {
  it('round-trips a label.json with one asset', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const blob = await makeBundle(docWithImage('abc'), [{ key: 'abc', bytes }]);
    const result = await parseBundle(blob);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].key).toBe('abc');
    expect(Array.from(result.assets[0].bytes)).toEqual([1, 2, 3, 4]);
    expect(result.missingAssetKeys).toEqual([]);
  });

  it('reports missing assets without throwing', async () => {
    const blob = await makeBundle(docWithImage('abc'), []);
    const result = await parseBundle(blob);
    expect(result.assets).toEqual([]);
    expect(result.missingAssetKeys).toEqual(['abc']);
  });

  it('throws ImportError(bundle-missing-label) when label.json is absent', async () => {
    const zip = new JSZip();
    zip.file('readme.txt', 'oops');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseBundle(blob)).rejects.toMatchObject({ code: 'bundle-missing-label' });
  });

  it('throws ImportError(invalid-zip) on a corrupt zip', async () => {
    const blob = new Blob([new Uint8Array([0, 1, 2, 3, 4, 5])]);
    await expect(parseBundle(blob)).rejects.toMatchObject({ code: 'invalid-zip' });
  });

  it('throws ImportError(bundle-label-malformed) when label.json is junk', async () => {
    const zip = new JSZip();
    zip.file('label.json', '{not-json');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseBundle(blob)).rejects.toMatchObject({ code: 'bundle-label-malformed' });
  });
});

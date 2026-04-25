import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createDocument } from '@burnmark-io/designer-core';
import type { LabelDocument, TextObject } from '@burnmark-io/designer-core';
import { BurnmarkAssetLoader } from '@/services/asset-loader';
import { ImportError, importLabelFile, MAX_IMPORT_SIZE, type ImportResult } from '../label-import';

function tinyDoc(): LabelDocument {
  const doc = createDocument('import-test', { widthDots: 200, heightDots: 100, dpi: 300 });
  const text: TextObject = {
    id: 't1',
    type: 'text',
    x: 10,
    y: 10,
    width: 80,
    height: 30,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#000000',
    content: 'Hello',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    verticalAlign: 'top',
    letterSpacing: 0,
    lineHeight: 1.2,
    invert: false,
    wrap: true,
    autoHeight: false,
  };
  doc.objects.push(text);
  return doc;
}

function fileFrom(content: string | Uint8Array | Blob, name: string, type: string): File {
  return new File([content], name, { type });
}

describe('importLabelFile (.label JSON path)', () => {
  it('imports a valid .label JSON file', async () => {
    const doc = tinyDoc();
    const file = fileFrom(JSON.stringify(doc), 'x.label', 'application/json');
    const result = await importLabelFile(file, new BurnmarkAssetLoader());
    expect(result.kind).toBe('label');
    expect(result.doc.objects).toHaveLength(1);
    expect((result.doc.objects[0] as TextObject).content).toBe('Hello');
  });

  it('rewrites the document id and timestamps so an imported doc cannot collide with a library slot', async () => {
    const doc = tinyDoc();
    const before = new Date().toISOString();
    const file = fileFrom(JSON.stringify(doc), 'x.label', 'application/json');
    const result = await importLabelFile(file, new BurnmarkAssetLoader());
    expect(result.doc.id).not.toBe(doc.id);
    expect(typeof result.doc.id).toBe('string');
    expect(result.doc.id.length).toBeGreaterThan(0);
    expect(result.doc.createdAt).toBe(result.doc.updatedAt);
    expect(result.doc.createdAt! >= before).toBe(true);
  });

  it('rejects oversize files', async () => {
    // The size guard reads file.size, so we can use a fake big File without
    // actually allocating MAX_IMPORT_SIZE+1 bytes.
    const bigBlob = new Blob([new Uint8Array(8)]);
    const file = fileFrom(bigBlob, 'x.label', 'application/json');
    Object.defineProperty(file, 'size', { value: MAX_IMPORT_SIZE + 1 });
    await expect(importLabelFile(file, new BurnmarkAssetLoader())).rejects.toMatchObject({
      code: 'too-large',
    });
  });

  it('rejects unknown extensions', async () => {
    const file = fileFrom('hello', 'notes.txt', 'text/plain');
    await expect(importLabelFile(file, new BurnmarkAssetLoader())).rejects.toMatchObject({
      code: 'unknown-format',
    });
  });

  it('rejects malformed JSON with an ImportError', async () => {
    const file = fileFrom('{not json', 'x.label', 'application/json');
    let caught: unknown;
    try {
      await importLabelFile(file, new BurnmarkAssetLoader());
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ImportError);
    expect((caught as ImportError).code).toBe('invalid-json');
  });
});

describe('importLabelFile (.zip bundle path)', () => {
  async function makeBundle(
    label: LabelDocument,
    assets: Array<{ key: string; bytes: Uint8Array }>,
  ): Promise<Blob> {
    const zip = new JSZip();
    zip.file('label.json', JSON.stringify(label));
    for (const { key, bytes } of assets) zip.file(`assets/${key}`, bytes);
    return zip.generateAsync({ type: 'blob' });
  }

  it('imports a bundle and restores asset bytes into the loader', async () => {
    const doc = tinyDoc();
    const assetKey = 'abc123';
    doc.objects.push({
      id: 'img1',
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
    const bundle = await makeBundle(doc, [{ key: assetKey, bytes: new Uint8Array([1, 2, 3, 4]) }]);
    const loader = new BurnmarkAssetLoader();
    const file = fileFrom(bundle, 'x.zip', 'application/zip');
    const result = (await importLabelFile(file, loader)) as Extract<
      ImportResult,
      { kind: 'bundle' }
    >;
    expect(result.kind).toBe('bundle');
    expect(result.restoredAssetKeys).toEqual([assetKey]);
    expect(result.missingAssetKeys).toEqual([]);
    expect(await loader.has(assetKey)).toBe(true);
  });

  it('reports missing assets without throwing', async () => {
    const doc = tinyDoc();
    const assetKey = 'missing';
    doc.objects.push({
      id: 'img1',
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
    const bundle = await makeBundle(doc, []);
    const loader = new BurnmarkAssetLoader();
    const file = fileFrom(bundle, 'x.zip', 'application/zip');
    const result = (await importLabelFile(file, loader)) as Extract<
      ImportResult,
      { kind: 'bundle' }
    >;
    expect(result.missingAssetKeys).toEqual([assetKey]);
    expect(result.restoredAssetKeys).toEqual([]);
  });

  it('rewrites id + timestamps for bundle imports too', async () => {
    const doc = tinyDoc();
    const before = new Date().toISOString();
    const bundle = await makeBundle(doc, []);
    const file = fileFrom(bundle, 'x.zip', 'application/zip');
    const result = await importLabelFile(file, new BurnmarkAssetLoader());
    expect(result.doc.id).not.toBe(doc.id);
    expect(result.doc.createdAt).toBe(result.doc.updatedAt);
    expect(result.doc.createdAt! >= before).toBe(true);
  });

  it('throws bundle-missing-label when label.json is absent', async () => {
    const zip = new JSZip();
    zip.file('readme.txt', 'oops');
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = fileFrom(blob, 'x.zip', 'application/zip');
    await expect(importLabelFile(file, new BurnmarkAssetLoader())).rejects.toMatchObject({
      code: 'bundle-missing-label',
    });
  });

  it('throws invalid-zip on a corrupt zip', async () => {
    const blob = new Blob([new Uint8Array([0, 1, 2, 3, 4, 5])]);
    const file = fileFrom(blob, 'x.zip', 'application/zip');
    await expect(importLabelFile(file, new BurnmarkAssetLoader())).rejects.toMatchObject({
      code: 'invalid-zip',
    });
  });

  it('throws bundle-label-malformed when label.json is junk', async () => {
    const zip = new JSZip();
    zip.file('label.json', '{not-json');
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = fileFrom(blob, 'x.zip', 'application/zip');
    await expect(importLabelFile(file, new BurnmarkAssetLoader())).rejects.toMatchObject({
      code: 'bundle-label-malformed',
    });
  });
});

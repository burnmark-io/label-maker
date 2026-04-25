import { describe, expect, it } from 'vitest';
import { createDocument } from '@burnmark-io/designer-core';
import type { LabelDocument, TextObject } from '@burnmark-io/designer-core';
import {
  decodeDocument,
  encodeDocument,
  MAX_ENCODED_LENGTH,
  readDocumentFromHash,
  ShareTooLargeError,
} from '../share-encoder';

function tinyDoc(): LabelDocument {
  const doc = createDocument('share-test', {
    widthDots: 200,
    heightDots: 100,
    dpi: 300,
  });
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

describe('share encoder', () => {
  it('round-trips a small document via encode/decode', () => {
    const original = tinyDoc();
    const encoded = encodeDocument(original);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
    expect(encoded.length).toBeLessThanOrEqual(MAX_ENCODED_LENGTH);

    const decoded = decodeDocument(encoded);
    expect(decoded.id).toBe(original.id);
    expect(decoded.objects).toHaveLength(1);
    expect((decoded.objects[0] as TextObject).content).toBe('Hello');
  });

  it('throws ShareTooLargeError when the design exceeds the limit', () => {
    const doc = tinyDoc();
    const big = doc.objects[0] as TextObject;
    // Stuff a large incompressible payload (random base64-ish noise).
    big.content = Array.from({ length: 16000 }, () => Math.random().toString(36).slice(2, 4)).join(
      '',
    );
    expect(() => encodeDocument(doc)).toThrow(ShareTooLargeError);
  });

  it('returns null when the hash is empty', () => {
    expect(readDocumentFromHash('')).toBeNull();
    expect(readDocumentFromHash('#')).toBeNull();
  });

  it('returns null when the hash is invalid', () => {
    expect(readDocumentFromHash('#not-base64-or-deflated!!')).toBeNull();
  });

  it('readDocumentFromHash decodes a valid hash and preserves content', () => {
    const doc = tinyDoc();
    const encoded = encodeDocument(doc);
    const hash = `#${encoded}`;
    const decoded = readDocumentFromHash(hash);
    expect(decoded).not.toBeNull();
    expect(decoded?.objects).toHaveLength(1);
    expect((decoded?.objects[0] as TextObject).content).toBe('Hello');
  });

  it('readDocumentFromHash rewrites the id and timestamps so imports cannot collide with a library slot', () => {
    const doc = tinyDoc();
    const encoded = encodeDocument(doc);
    const before = new Date().toISOString();
    const decoded = readDocumentFromHash(`#${encoded}`);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).not.toBe(doc.id);
    expect(typeof decoded?.id).toBe('string');
    expect(decoded?.id.length).toBeGreaterThan(0);
    expect(decoded?.createdAt).toBeDefined();
    expect(decoded?.updatedAt).toBeDefined();
    expect(decoded?.createdAt).toBe(decoded?.updatedAt);
    // The fresh timestamp should be at-or-after the test start.
    expect(decoded!.createdAt! >= before).toBe(true);
  });
});

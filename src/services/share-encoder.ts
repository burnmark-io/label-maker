import pako from 'pako';
import type { LabelDocument } from '@burnmark-io/designer-core';
import { fromJSON, toJSON } from '@burnmark-io/designer-core';

/**
 * URL share encoding — deflate the document JSON, base64url-encode the
 * bytes, and pack into the location hash. Beyond
 * {@link MAX_ENCODED_LENGTH} the design is too large to share via URL
 * and the user is steered toward the .label / .zip export.
 */

export const MAX_ENCODED_LENGTH = 8192;

export class ShareTooLargeError extends Error {
  constructor(public readonly encodedLength: number) {
    super(
      `Design is too large to share via URL (${encodedLength} bytes; limit ${MAX_ENCODED_LENGTH})`,
    );
    this.name = 'ShareTooLargeError';
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  // Avoid `String.fromCharCode(...bytes)` to dodge stack-limit issues on
  // larger payloads.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + padding);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Encode a label document to a base64url string. Throws
 * {@link ShareTooLargeError} when the encoded length exceeds 8KB.
 */
export function encodeDocument(doc: LabelDocument): string {
  const json = toJSON(doc);
  const compressed = pako.deflate(json);
  const encoded = bytesToBase64Url(compressed);
  if (encoded.length > MAX_ENCODED_LENGTH) {
    throw new ShareTooLargeError(encoded.length);
  }
  return encoded;
}

export function decodeDocument(encoded: string): LabelDocument {
  const compressed = base64UrlToBytes(encoded);
  const json = pako.inflate(compressed, { to: 'string' });
  return fromJSON(json);
}

/**
 * Build the full share URL for the current origin. Caller is expected
 * to handle {@link ShareTooLargeError}.
 */
export function buildShareUrl(doc: LabelDocument, origin: string): string {
  const encoded = encodeDocument(doc);
  return `${origin}/#${encoded}`;
}

/**
 * Read an encoded design from `location.hash`, returning `null` if the
 * hash is empty or invalid. Always swallows decoding errors — a bad
 * hash should never crash the app.
 *
 * The decoded document is rewritten with a fresh id + timestamps before
 * returning, so a shared link can never silently overwrite an existing
 * library slot whose id happens to match.
 */
export function readDocumentFromHash(hash: string): LabelDocument | null {
  if (!hash || hash.length < 2) return null;
  try {
    const doc = decodeDocument(hash.slice(1));
    const now = new Date().toISOString();
    doc.id = crypto.randomUUID();
    doc.createdAt = now;
    doc.updatedAt = now;
    return doc;
  } catch {
    return null;
  }
}

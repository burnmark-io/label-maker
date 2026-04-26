/**
 * Web Crypto wrapper for local-data encryption. PBKDF2-SHA-256 → AES-GCM-256.
 *
 * The threat model is documented in `amendment-local-data-encryption.md` §2.
 * This module deliberately stays a thin shell around `crypto.subtle` so the
 * encryption-at-rest behaviour is easy to audit. No third-party crypto deps.
 */

const SUBTLE = (): SubtleCrypto => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto is not available in this environment.');
  }
  return crypto.subtle;
};

export interface KdfParams {
  iterations: number;
  hash: 'SHA-256';
}

/** OWASP 2023 baseline for PBKDF2-SHA-256. */
export const DEFAULT_KDF: KdfParams = { iterations: 600_000, hash: 'SHA-256' };

export const SALT_BYTES = 16;
export const IV_BYTES = 12;

export const VERIFIER_PLAINTEXT = 'burnmark.verifier.v1';

export interface Envelope {
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export function newSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

export function newIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_BYTES));
}

export async function deriveKey(
  password: string,
  salt: Uint8Array,
  kdf: KdfParams = DEFAULT_KDF,
): Promise<CryptoKey> {
  const subtle = SUBTLE();
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: kdf.iterations, hash: kdf.hash },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(key: CryptoKey, plaintext: Uint8Array): Promise<Envelope> {
  const iv = newIv();
  const cipherBuffer = await SUBTLE().encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  return { iv, ciphertext: new Uint8Array(cipherBuffer) };
}

export async function decryptBytes(key: CryptoKey, env: Envelope): Promise<Uint8Array> {
  const plainBuffer = await SUBTLE().decrypt(
    { name: 'AES-GCM', iv: env.iv as BufferSource },
    key,
    env.ciphertext as BufferSource,
  );
  return new Uint8Array(plainBuffer);
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<Envelope> {
  return encryptBytes(key, new TextEncoder().encode(plaintext));
}

export async function decryptString(key: CryptoKey, env: Envelope): Promise<string> {
  const bytes = await decryptBytes(key, env);
  return new TextDecoder().decode(bytes);
}

/**
 * Build the verifier envelope used to detect a wrong password on unlock.
 * Encrypting a known plaintext lets us reject incorrect passwords without
 * having to attempt a real record decrypt.
 */
export function buildVerifier(key: CryptoKey): Promise<Envelope> {
  return encryptString(key, VERIFIER_PLAINTEXT);
}

/**
 * Returns true iff the key decrypts the verifier and the plaintext matches
 * `VERIFIER_PLAINTEXT`. Any thrown error (auth-tag failure) is caught and
 * treated as a wrong-password signal.
 */
export async function verifyKey(key: CryptoKey, env: Envelope): Promise<boolean> {
  try {
    const text = await decryptString(key, env);
    return text === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

/**
 * Base64 helpers for the localStorage path (column-mapper). IDB stores
 * `Uint8Array` directly; localStorage is string-only so we encode there.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin =
    typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export interface SerializedEnvelope {
  iv: string;
  ct: string;
}

export function serializeEnvelope(env: Envelope): SerializedEnvelope {
  return { iv: bytesToBase64(env.iv), ct: bytesToBase64(env.ciphertext) };
}

export function deserializeEnvelope(serialized: SerializedEnvelope): Envelope {
  return { iv: base64ToBytes(serialized.iv), ciphertext: base64ToBytes(serialized.ct) };
}

// ---- Master-key indirection (v2) -----------------------------------------
//
// In v2, the active record-encryption key (MK) is random and never derived
// from the password. The password (and any registered passkey) instead
// produce a key-encryption key (KEK) that wraps MK. Wrapping = AES-GCM
// over the raw 32 bytes of MK; unwrapping = decrypt + import.

const MK_BYTES = 32;

/**
 * Generate a fresh random master key. `extractable: true` so it can be
 * exported to bytes and wrapped under a KEK. The exported bytes never
 * leave the wrap envelope.
 */
export async function generateMasterKey(): Promise<CryptoKey> {
  const raw = crypto.getRandomValues(new Uint8Array(MK_BYTES));
  return SUBTLE().importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Wrap a 32-byte AES-GCM key under a KEK. The KEK can be password-derived
 * (PBKDF2) or PRF-derived (WebAuthn). AES-GCM auth tag on the wrap doubles
 * as a "right KEK?" check on unwrap.
 */
export async function wrapKey(kek: CryptoKey, key: CryptoKey): Promise<Envelope> {
  const raw = new Uint8Array(await SUBTLE().exportKey('raw', key));
  return encryptBytes(kek, raw);
}

/**
 * Unwrap a wrapped key. Throws on auth-tag failure (wrong KEK / tampered
 * envelope).
 */
export async function unwrapKey(kek: CryptoKey, env: Envelope): Promise<CryptoKey> {
  const raw = await decryptBytes(kek, env);
  return SUBTLE().importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Import a 32-byte WebAuthn PRF result as an AES-GCM key. The PRF result
 * is the output of the authenticator's hmac-secret extension; it acts as
 * a per-credential KEK for wrapping MK.
 */
export async function importPrfKey(prfBytes: Uint8Array): Promise<CryptoKey> {
  if (prfBytes.length !== MK_BYTES) {
    throw new Error(`Expected ${MK_BYTES}-byte PRF result, got ${prfBytes.length}.`);
  }
  return SUBTLE().importKey('raw', prfBytes as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

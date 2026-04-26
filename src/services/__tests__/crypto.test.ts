import { describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  buildVerifier,
  bytesToBase64,
  decryptBytes,
  decryptString,
  deriveKey,
  deserializeEnvelope,
  encryptBytes,
  encryptString,
  IV_BYTES,
  newIv,
  newSalt,
  SALT_BYTES,
  serializeEnvelope,
  VERIFIER_PLAINTEXT,
  verifyKey,
} from '../crypto';

const TEST_KDF = { iterations: 1_000, hash: 'SHA-256' as const };

describe('crypto', () => {
  it('generates a salt of the documented size', () => {
    expect(newSalt()).toHaveLength(SALT_BYTES);
  });

  it('generates a fresh IV per call', () => {
    const a = newIv();
    const b = newIv();
    expect(a).toHaveLength(IV_BYTES);
    expect(b).toHaveLength(IV_BYTES);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('round-trips a string through encrypt/decrypt', async () => {
    const salt = newSalt();
    const key = await deriveKey('hunter2', salt, TEST_KDF);
    const env = await encryptString(key, 'aunt carla');
    expect(await decryptString(key, env)).toBe('aunt carla');
  });

  it('round-trips bytes through encrypt/decrypt', async () => {
    const salt = newSalt();
    const key = await deriveKey('hunter2', salt, TEST_KDF);
    const plaintext = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
    const env = await encryptBytes(key, plaintext);
    expect(Array.from(await decryptBytes(key, env))).toEqual(Array.from(plaintext));
  });

  it('rejects the wrong key with an exception', async () => {
    const salt = newSalt();
    const right = await deriveKey('hunter2', salt, TEST_KDF);
    const wrong = await deriveKey('hunter3', salt, TEST_KDF);
    const env = await encryptString(right, 'secret');
    await expect(decryptString(wrong, env)).rejects.toBeDefined();
  });

  it('produces a different IV on each encrypt call (uniqueness)', async () => {
    const key = await deriveKey('hunter2', newSalt(), TEST_KDF);
    const a = await encryptString(key, 'same');
    const b = await encryptString(key, 'same');
    expect(Array.from(a.iv)).not.toEqual(Array.from(b.iv));
    expect(Array.from(a.ciphertext)).not.toEqual(Array.from(b.ciphertext));
  });

  it('verifier mechanism: right key returns true, wrong key returns false', async () => {
    const salt = newSalt();
    const right = await deriveKey('hunter2', salt, TEST_KDF);
    const wrong = await deriveKey('nope', salt, TEST_KDF);
    const env = await buildVerifier(right);
    expect(await verifyKey(right, env)).toBe(true);
    expect(await verifyKey(wrong, env)).toBe(false);
  });

  it('verifier plaintext matches the documented constant', async () => {
    const key = await deriveKey('x', newSalt(), TEST_KDF);
    const env = await buildVerifier(key);
    expect(await decryptString(key, env)).toBe(VERIFIER_PLAINTEXT);
  });

  it('honors the iteration count on the KDF', async () => {
    // Both derive successfully but produce different keys, so a verifier
    // built with one set of params won't validate against the other.
    const salt = newSalt();
    const k1 = await deriveKey('pw', salt, { iterations: 500, hash: 'SHA-256' });
    const k2 = await deriveKey('pw', salt, { iterations: 1_000, hash: 'SHA-256' });
    const env = await buildVerifier(k1);
    expect(await verifyKey(k1, env)).toBe(true);
    expect(await verifyKey(k2, env)).toBe(false);
  });

  it('base64 helpers round-trip arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 42]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('serialize/deserialize envelope round-trips', async () => {
    const key = await deriveKey('x', newSalt(), TEST_KDF);
    const env = await encryptString(key, 'hello');
    const restored = deserializeEnvelope(serializeEnvelope(env));
    expect(await decryptString(key, restored)).toBe('hello');
  });
});

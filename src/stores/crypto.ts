import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  buildVerifier,
  DEFAULT_KDF,
  deriveKey,
  newSalt,
  type Envelope,
  type KdfParams,
  verifyKey,
} from '@/services/crypto';
import {
  clearAllStores,
  deleteMeta,
  getMeta,
  migrateEncryption,
  setMeta,
  setStorageKey,
} from '@/services/storage';
import {
  clearAllMappings,
  flushMappings,
  hydrateMappings,
  migrateMappings,
} from '@/services/column-mapper';

const META_ENABLED = 'enc.enabled';
const META_SALT = 'enc.salt';
const META_KDF = 'enc.kdfParams';
const META_VERIFIER = 'enc.verifier';
const META_MIGRATING = 'enc.migrating';

interface SerializedEnvelopeMeta {
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

function envFromMeta(stored: SerializedEnvelopeMeta): Envelope {
  return { iv: new Uint8Array(stored.iv), ciphertext: new Uint8Array(stored.ciphertext) };
}

function metaFromEnv(env: Envelope): SerializedEnvelopeMeta {
  return { iv: env.iv, ciphertext: env.ciphertext };
}

/**
 * Crypto store — owns the session encryption key and orchestrates the
 * setup / unlock / change-password / disable flows. The store NEVER
 * holds the password string; only the derived `CryptoKey`.
 *
 * Boot order: `init()` runs *before* any other store hydrates so we
 * can decide whether to gate the UI on an unlock screen. After unlock
 * (or when encryption is off), other stores hydrate normally — they
 * read through `services/storage.ts`, which transparently encrypts/
 * decrypts based on the registered active key.
 */
export const useCryptoStore = defineStore('crypto', () => {
  const enabled = ref(false);
  const key = ref<CryptoKey | null>(null);
  const initialized = ref(false);
  const migrating = ref(false);

  /** True when encryption is on and we don't yet have the session key. */
  const locked = computed(() => enabled.value && key.value === null);

  /**
   * Read encryption state from `meta`. Idempotent. Sets `enabled` and
   * `migrating` flags but does not derive any key — that requires user
   * input via {@link unlock}.
   */
  async function init(): Promise<void> {
    if (initialized.value) return;
    enabled.value = (await getMeta<boolean>(META_ENABLED)) === true;
    migrating.value = (await getMeta<boolean>(META_MIGRATING)) === true;
    initialized.value = true;
  }

  /**
   * Turn encryption on for the first time. Re-encrypts every record in
   * place. The caller (the setup form) is responsible for confirming
   * the password and showing the irreversibility warning.
   */
  async function setupEncryption(password: string): Promise<void> {
    if (enabled.value) throw new Error('Encryption is already enabled.');
    const salt = newSalt();
    const kdf: KdfParams = DEFAULT_KDF;
    const derived = await deriveKey(password, salt, kdf);

    // Mark migrating so a crash mid-rewrite is detectable on next boot.
    await setMeta(META_MIGRATING, true);
    migrating.value = true;

    try {
      await migrateEncryption(null, derived);
      await migrateMappings(null, derived);

      const verifier = await buildVerifier(derived);
      await setMeta(META_SALT, salt);
      await setMeta(META_KDF, kdf);
      await setMeta(META_VERIFIER, metaFromEnv(verifier));
      await setMeta(META_ENABLED, true);
    } finally {
      await deleteMeta(META_MIGRATING);
      migrating.value = false;
    }

    enabled.value = true;
    key.value = derived;
    setStorageKey(derived);
    await hydrateMappings(true);
  }

  /**
   * Try a password. On success, derives the session key, registers it
   * with storage, and hydrates mapping cache. Returns `false` on a
   * verifier mismatch (wrong password). Throws only on truly broken
   * state (missing salt/verifier — should be impossible after a clean
   * setup, possible only after a partial migration).
   */
  async function unlock(password: string): Promise<boolean> {
    const saltStored = await getMeta<Uint8Array>(META_SALT);
    const kdfStored = await getMeta<KdfParams>(META_KDF);
    const verifierStored = await getMeta<SerializedEnvelopeMeta>(META_VERIFIER);
    if (!saltStored || !kdfStored || !verifierStored) {
      throw new Error('Encryption metadata is incomplete. Reset all data to recover.');
    }
    const salt = new Uint8Array(saltStored);
    const candidate = await deriveKey(password, salt, kdfStored);
    const ok = await verifyKey(candidate, envFromMeta(verifierStored));
    if (!ok) return false;
    key.value = candidate;
    setStorageKey(candidate);
    await hydrateMappings(true);
    return true;
  }

  /**
   * Replace the password. Verifies the old password, then re-encrypts
   * every record under a freshly-derived key (with a new salt). The
   * session key is swapped on success; on failure (wrong old password)
   * nothing changes.
   */
  async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    if (!enabled.value) throw new Error('Encryption is not enabled.');
    const saltStored = await getMeta<Uint8Array>(META_SALT);
    const kdfStored = await getMeta<KdfParams>(META_KDF);
    const verifierStored = await getMeta<SerializedEnvelopeMeta>(META_VERIFIER);
    if (!saltStored || !kdfStored || !verifierStored) return false;

    const oldKey = await deriveKey(oldPassword, new Uint8Array(saltStored), kdfStored);
    const verified = await verifyKey(oldKey, envFromMeta(verifierStored));
    if (!verified) return false;

    const nextSalt = newSalt();
    const nextKdf: KdfParams = DEFAULT_KDF;
    const nextKey = await deriveKey(newPassword, nextSalt, nextKdf);

    await setMeta(META_MIGRATING, true);
    migrating.value = true;
    try {
      await flushMappings();
      await migrateEncryption(oldKey, nextKey);
      await migrateMappings(oldKey, nextKey);

      const verifier = await buildVerifier(nextKey);
      await setMeta(META_SALT, nextSalt);
      await setMeta(META_KDF, nextKdf);
      await setMeta(META_VERIFIER, metaFromEnv(verifier));
    } finally {
      await deleteMeta(META_MIGRATING);
      migrating.value = false;
    }

    key.value = nextKey;
    setStorageKey(nextKey);
    return true;
  }

  /**
   * Decrypt every record back to plaintext and remove the encryption
   * metadata. Verifies the password first so a wrong password doesn't
   * accidentally null-write everything.
   */
  async function disableEncryption(password: string): Promise<boolean> {
    if (!enabled.value) throw new Error('Encryption is not enabled.');
    const saltStored = await getMeta<Uint8Array>(META_SALT);
    const kdfStored = await getMeta<KdfParams>(META_KDF);
    const verifierStored = await getMeta<SerializedEnvelopeMeta>(META_VERIFIER);
    if (!saltStored || !kdfStored || !verifierStored) return false;

    const oldKey = await deriveKey(password, new Uint8Array(saltStored), kdfStored);
    const verified = await verifyKey(oldKey, envFromMeta(verifierStored));
    if (!verified) return false;

    await setMeta(META_MIGRATING, true);
    migrating.value = true;
    try {
      await flushMappings();
      await migrateEncryption(oldKey, null);
      await migrateMappings(oldKey, null);

      await deleteMeta(META_SALT);
      await deleteMeta(META_KDF);
      await deleteMeta(META_VERIFIER);
      await deleteMeta(META_ENABLED);
    } finally {
      await deleteMeta(META_MIGRATING);
      migrating.value = false;
    }

    enabled.value = false;
    key.value = null;
    setStorageKey(null);
    return true;
  }

  /**
   * Wipe everything. Used by the "Reset all my data" path on the
   * Privacy page and as the forgot-password escape hatch on the unlock
   * screen. Caller is expected to reload the tab afterwards.
   */
  async function resetAllUserData(): Promise<void> {
    await clearAllStores();
    clearAllMappings();
    if (typeof window !== 'undefined') {
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('burnmark.')) toRemove.push(k);
      }
      for (const k of toRemove) {
        try {
          window.localStorage.removeItem(k);
        } catch {
          // ignore
        }
      }
    }
    enabled.value = false;
    key.value = null;
    migrating.value = false;
  }

  return {
    enabled,
    key,
    initialized,
    migrating,
    locked,
    init,
    setupEncryption,
    unlock,
    changePassword,
    disableEncryption,
    resetAllUserData,
  };
});

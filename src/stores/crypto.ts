import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  buildVerifier,
  DEFAULT_KDF,
  deriveKey,
  generateMasterKey,
  importPrfKey,
  newSalt,
  type Envelope,
  type KdfParams,
  unwrapKey,
  verifyKey,
  wrapKey,
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
import {
  authenticateAndDerivePrf,
  registerPasskeyAndDerivePrf,
  type PasskeyRegistration,
} from '@/services/webauthn';

const META_ENABLED = 'enc.enabled';
const META_FORMAT = 'enc.format';
const META_WRAPS = 'enc.wraps';
const META_VERIFIER = 'enc.verifier';
const META_MIGRATING = 'enc.migrating';
const META_PASSKEY_USER_ID = 'enc.passkeyUserId';

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

export interface PasswordWrap {
  kind: 'password';
  salt: Uint8Array;
  kdfParams: KdfParams;
  wrappedMk: SerializedEnvelopeMeta;
}

export interface PasskeyWrap {
  kind: 'passkey';
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
  addedAt: string;
  wrappedMk: SerializedEnvelopeMeta;
}

export type WrapRecord = PasswordWrap | PasskeyWrap;

function isPasswordWrap(w: WrapRecord): w is PasswordWrap {
  return w.kind === 'password';
}

function isPasskeyWrap(w: WrapRecord): w is PasskeyWrap {
  return w.kind === 'passkey';
}

/**
 * Normalise a wrap so every byte field is a fresh, non-reactive
 * `Uint8Array`. Used both on reads (structured-clone may produce other
 * typed-array wrappers that confuse downstream `BufferSource` consumers)
 * and on writes (Vue's reactive proxy wraps nested objects, and
 * `structuredClone` / `IDBObjectStore.put` reject proxied values).
 */
function rehydrateWrap(w: WrapRecord): WrapRecord {
  if (isPasswordWrap(w)) {
    return {
      kind: 'password',
      salt: new Uint8Array(w.salt),
      kdfParams: { iterations: w.kdfParams.iterations, hash: w.kdfParams.hash },
      wrappedMk: {
        iv: new Uint8Array(w.wrappedMk.iv),
        ciphertext: new Uint8Array(w.wrappedMk.ciphertext),
      },
    };
  }
  return {
    kind: 'passkey',
    credentialId: new Uint8Array(w.credentialId),
    prfSalt: new Uint8Array(w.prfSalt),
    addedAt: w.addedAt,
    wrappedMk: {
      iv: new Uint8Array(w.wrappedMk.iv),
      ciphertext: new Uint8Array(w.wrappedMk.ciphertext),
    },
  };
}

/** Produce a structured-clone-safe copy of the wraps list for IDB. */
function cloneWrapsForPersist(list: WrapRecord[]): WrapRecord[] {
  return list.map(rehydrateWrap);
}

/**
 * Crypto store — owns the session master key (MK) and orchestrates the
 * setup / unlock / change-password / disable / passkey flows. The store
 * NEVER holds the password string; only the derived `CryptoKey` for MK.
 *
 * v2 layout (the only one this codebase ships): MK is random and
 * persistent. Each registered factor (password, optional passkey)
 * produces a key-encryption key (KEK) that wraps MK. Adding/removing the
 * passkey is an append/filter on the wraps list — no record-level work.
 *
 * Boot order: `init()` runs before any other store hydrates so we can
 * decide whether to gate the UI on an unlock screen. After unlock (or
 * when encryption is off), other stores hydrate normally — they read
 * through `services/storage.ts`, which transparently encrypts/decrypts
 * based on the registered MK.
 */
export const useCryptoStore = defineStore('crypto', () => {
  const enabled = ref(false);
  const key = ref<CryptoKey | null>(null);
  const initialized = ref(false);
  const migrating = ref(false);
  const wraps = ref<WrapRecord[]>([]);

  /** True when encryption is on and we don't yet have MK in memory. */
  const locked = computed(() => enabled.value && key.value === null);
  const hasPasskey = computed(() => wraps.value.some(isPasskeyWrap));
  const passkeyAddedAt = computed(() => {
    const w = wraps.value.find(isPasskeyWrap);
    return w ? w.addedAt : null;
  });

  async function loadWraps(): Promise<WrapRecord[]> {
    const stored = await getMeta<WrapRecord[]>(META_WRAPS);
    if (!stored || !Array.isArray(stored)) return [];
    return stored.map(rehydrateWrap);
  }

  /**
   * Read encryption state from `meta`. Idempotent. Sets `enabled`,
   * `migrating`, and `wraps` flags but does not derive any key — that
   * requires user input via {@link unlock} or {@link unlockWithPasskey}.
   */
  async function init(): Promise<void> {
    if (initialized.value) return;
    enabled.value = (await getMeta<boolean>(META_ENABLED)) === true;
    migrating.value = (await getMeta<boolean>(META_MIGRATING)) === true;
    if (enabled.value) {
      wraps.value = await loadWraps();
    }
    initialized.value = true;
  }

  /**
   * Turn encryption on for the first time. Re-encrypts every record in
   * place under a fresh random MK, stores a single password wrap. The
   * caller (the setup form) is responsible for confirming the password
   * and showing the irreversibility warning.
   */
  async function setupEncryption(password: string): Promise<void> {
    if (enabled.value) throw new Error('Encryption is already enabled.');

    const mk = await generateMasterKey();

    const salt = newSalt();
    const kdf: KdfParams = DEFAULT_KDF;
    const kekPw = await deriveKey(password, salt, kdf);
    const wrappedMk = await wrapKey(kekPw, mk);
    const passwordWrap: PasswordWrap = {
      kind: 'password',
      salt,
      kdfParams: kdf,
      wrappedMk: metaFromEnv(wrappedMk),
    };

    await setMeta(META_MIGRATING, true);
    migrating.value = true;

    try {
      await migrateEncryption(null, mk);
      await migrateMappings(null, mk);

      const verifier = await buildVerifier(mk);
      await setMeta(META_FORMAT, 2);
      await setMeta(META_WRAPS, cloneWrapsForPersist([passwordWrap]));
      await setMeta(META_VERIFIER, metaFromEnv(verifier));
      await setMeta(META_ENABLED, true);
    } finally {
      await deleteMeta(META_MIGRATING);
      migrating.value = false;
    }

    enabled.value = true;
    key.value = mk;
    wraps.value = [passwordWrap];
    setStorageKey(mk);
    await hydrateMappings(true);
  }

  /**
   * Try a password. On success, derives KEK_pw, unwraps MK, registers MK
   * with storage, and hydrates the mapping cache. Returns `false` on a
   * wrong password (auth-tag failure during MK unwrap, or verifier
   * mismatch). Throws only on truly broken state (missing wraps —
   * possible only after a partial migration / disk corruption).
   */
  async function unlock(password: string): Promise<boolean> {
    const verifierStored = await getMeta<SerializedEnvelopeMeta>(META_VERIFIER);
    if (!verifierStored) {
      throw new Error('Encryption metadata is incomplete. Reset all data to recover.');
    }
    const allWraps = await loadWraps();
    const passwordWrap = allWraps.find(isPasswordWrap);
    if (!passwordWrap) {
      throw new Error('Encryption metadata is incomplete (no password wrap). Reset all data.');
    }
    const kekPw = await deriveKey(password, passwordWrap.salt, passwordWrap.kdfParams);
    let mk: CryptoKey;
    try {
      mk = await unwrapKey(kekPw, envFromMeta(passwordWrap.wrappedMk));
    } catch {
      return false;
    }
    // Defensive: AES-GCM auth tag would already have caught this, but the
    // verifier provides a predictable failure shape independent of wrap
    // shape changes down the road.
    const ok = await verifyKey(mk, envFromMeta(verifierStored));
    if (!ok) return false;
    key.value = mk;
    wraps.value = allWraps;
    setStorageKey(mk);
    await hydrateMappings(true);
    return true;
  }

  /**
   * Try the registered passkey. On success, derives `KEK_passkey` from
   * the WebAuthn PRF result, unwraps MK, registers MK with storage,
   * hydrates the mapping cache. Returns `false` on cancellation, missing
   * PRF result, or auth-tag failure on the wrap. The caller is expected
   * to surface a "fall back to password" affordance.
   */
  async function unlockWithPasskey(): Promise<boolean> {
    const allWraps = await loadWraps();
    const passkeyWrap = allWraps.find(isPasskeyWrap);
    if (!passkeyWrap) return false;

    let prfBytes: Uint8Array;
    try {
      prfBytes = await authenticateAndDerivePrf(passkeyWrap.credentialId, passkeyWrap.prfSalt);
    } catch {
      return false;
    }
    const kekPasskey = await importPrfKey(prfBytes);
    let mk: CryptoKey;
    try {
      mk = await unwrapKey(kekPasskey, envFromMeta(passkeyWrap.wrappedMk));
    } catch {
      return false;
    }
    // No verifier check — AES-GCM auth tag on the unwrap is itself proof
    // that MK is correct.
    key.value = mk;
    wraps.value = allWraps;
    setStorageKey(mk);
    await hydrateMappings(true);
    return true;
  }

  /**
   * Replace the password. Verifies the old password by unwrapping MK
   * with it, then re-wraps the same MK under a freshly-derived KEK. No
   * record walk — only the password wrap entry changes. The optional
   * passkey wrap is left untouched.
   */
  async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    if (!enabled.value || !key.value) throw new Error('Encryption is not enabled / unlocked.');
    const allWraps = await loadWraps();
    const passwordWrap = allWraps.find(isPasswordWrap);
    if (!passwordWrap) return false;

    const oldKek = await deriveKey(oldPassword, passwordWrap.salt, passwordWrap.kdfParams);
    let mk: CryptoKey;
    try {
      mk = await unwrapKey(oldKek, envFromMeta(passwordWrap.wrappedMk));
    } catch {
      return false;
    }

    const nextSalt = newSalt();
    const nextKdf: KdfParams = DEFAULT_KDF;
    const nextKek = await deriveKey(newPassword, nextSalt, nextKdf);
    const nextWrapped = await wrapKey(nextKek, mk);
    const nextPasswordWrap: PasswordWrap = {
      kind: 'password',
      salt: nextSalt,
      kdfParams: nextKdf,
      wrappedMk: metaFromEnv(nextWrapped),
    };
    const nextWraps: WrapRecord[] = allWraps.map(w => (isPasswordWrap(w) ? nextPasswordWrap : w));
    await setMeta(META_WRAPS, cloneWrapsForPersist(nextWraps));
    wraps.value = nextWraps;
    return true;
  }

  /**
   * Decrypt every record back to plaintext and remove all encryption
   * metadata (password wrap, optional passkey wrap, verifier, format
   * marker, passkeyUserId). Verifies the password first so a wrong
   * password can't accidentally null-write everything.
   */
  async function disableEncryption(password: string): Promise<boolean> {
    if (!enabled.value) throw new Error('Encryption is not enabled.');
    const allWraps = await loadWraps();
    const passwordWrap = allWraps.find(isPasswordWrap);
    if (!passwordWrap) return false;

    const kekPw = await deriveKey(password, passwordWrap.salt, passwordWrap.kdfParams);
    let mk: CryptoKey;
    try {
      mk = await unwrapKey(kekPw, envFromMeta(passwordWrap.wrappedMk));
    } catch {
      return false;
    }

    await setMeta(META_MIGRATING, true);
    migrating.value = true;
    try {
      await flushMappings();
      await migrateEncryption(mk, null);
      await migrateMappings(mk, null);

      await deleteMeta(META_FORMAT);
      await deleteMeta(META_WRAPS);
      await deleteMeta(META_VERIFIER);
      await deleteMeta(META_PASSKEY_USER_ID);
      await deleteMeta(META_ENABLED);
    } finally {
      await deleteMeta(META_MIGRATING);
      migrating.value = false;
    }

    enabled.value = false;
    key.value = null;
    wraps.value = [];
    setStorageKey(null);
    return true;
  }

  /**
   * Read the stable WebAuthn `user.id`, creating + persisting one on
   * first call. Stable so that re-registering after Remove → Add
   * replaces the existing credential in the OS keychain instead of
   * orphaning it.
   */
  async function getOrCreatePasskeyUserId(): Promise<Uint8Array> {
    const stored = await getMeta<Uint8Array>(META_PASSKEY_USER_ID);
    if (stored) return new Uint8Array(stored);
    const fresh = crypto.getRandomValues(new Uint8Array(32));
    await setMeta(META_PASSKEY_USER_ID, fresh);
    return fresh;
  }

  /**
   * Register a passkey for this profile. Requires the app to be unlocked
   * (MK in memory). Single-passkey policy: rejects if one is already
   * registered. Returns a discriminated result instead of throwing so
   * the caller can map the reason code to localized copy.
   */
  async function addPasskey(): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (!enabled.value || !key.value) {
      return { ok: false, reason: 'not-unlocked' };
    }
    if (hasPasskey.value) {
      return { ok: false, reason: 'already-exists' };
    }
    const userId = await getOrCreatePasskeyUserId();
    let registration: PasskeyRegistration;
    try {
      registration = await registerPasskeyAndDerivePrf(userId);
    } catch (err) {
      const reason = (err as Error)?.message ?? 'register-failed';
      return { ok: false, reason };
    }
    const kekPasskey = await importPrfKey(registration.prfBytes);
    const wrappedMk = await wrapKey(kekPasskey, key.value);
    const passkeyWrap: PasskeyWrap = {
      kind: 'passkey',
      credentialId: registration.credentialId,
      prfSalt: registration.prfSalt,
      addedAt: new Date().toISOString(),
      wrappedMk: metaFromEnv(wrappedMk),
    };
    const nextWraps: WrapRecord[] = [...wraps.value, passkeyWrap];
    await setMeta(META_WRAPS, cloneWrapsForPersist(nextWraps));
    wraps.value = nextWraps;
    return { ok: true };
  }

  /**
   * Drop the registered passkey wrap. Non-destructive — data stays
   * reachable via the password. The credential lingers in the OS
   * keychain (WebAuthn provides no programmatic deregister); the UI
   * surfaces this in the confirmation copy.
   */
  async function removePasskey(): Promise<boolean> {
    if (!enabled.value) return false;
    if (!hasPasskey.value) return false;
    const nextWraps = wraps.value.filter(w => !isPasskeyWrap(w));
    await setMeta(META_WRAPS, cloneWrapsForPersist(nextWraps));
    wraps.value = nextWraps;
    return true;
  }

  /**
   * Wipe everything. Used by the "Reset all my data" path on the Privacy
   * page and as the forgot-password escape hatch on the unlock screen.
   * Caller is expected to reload the tab afterwards.
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
    wraps.value = [];
    migrating.value = false;
  }

  return {
    enabled,
    key,
    initialized,
    migrating,
    wraps,
    locked,
    hasPasskey,
    passkeyAddedAt,
    init,
    setupEncryption,
    unlock,
    unlockWithPasskey,
    changePassword,
    disableEncryption,
    addPasskey,
    removePasskey,
    resetAllUserData,
  };
});

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createDocument } from '@burnmark-io/designer-core';

import { useCryptoStore } from '../crypto';
import {
  __resetForTests,
  listDesignSummaries,
  loadDesign,
  saveDesign,
  setStorageKey,
} from '@/services/storage';
import {
  __resetMappingCacheForTests,
  hydrateMappings,
  loadMapping,
  saveMapping,
} from '@/services/column-mapper';

// Override the OWASP-baseline iteration count for tests so they run in
// milliseconds rather than seconds. The store reads DEFAULT_KDF from the
// crypto module; we monkey-patch it via the module's mutable export.
import * as cryptoMod from '@/services/crypto';
import * as webauthnMod from '@/services/webauthn';

const ORIGINAL_KDF = { ...cryptoMod.DEFAULT_KDF };

beforeEach(async () => {
  // Pin a fast KDF for the duration of each test.
  Object.assign(cryptoMod.DEFAULT_KDF, { iterations: 1_000, hash: 'SHA-256' });

  await __resetForTests();
  __resetMappingCacheForTests();
  setStorageKey(null);
  await new Promise<void>(resolve => {
    const req = indexedDB.deleteDatabase('burnmark');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
  setActivePinia(createPinia());

  // Clear localStorage so the column-mapper key-prefix sweep starts fresh.
  if (typeof window !== 'undefined') {
    const toClear: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('burnmark.')) toClear.push(k);
    }
    toClear.forEach(k => window.localStorage.removeItem(k));
  }
});

afterEach(() => {
  Object.assign(cryptoMod.DEFAULT_KDF, ORIGINAL_KDF);
});

describe('crypto store', () => {
  it('init() reads enabled=false on a fresh DB', async () => {
    const store = useCryptoStore();
    await store.init();
    expect(store.initialized).toBe(true);
    expect(store.enabled).toBe(false);
    expect(store.locked).toBe(false);
  });

  it('setupEncryption flips enabled=true and registers the session key', async () => {
    const store = useCryptoStore();
    await store.init();
    await store.setupEncryption('hunter2');
    expect(store.enabled).toBe(true);
    expect(store.key).not.toBeNull();
    expect(store.locked).toBe(false);
  });

  it('after setup, an existing design is reachable through the encrypted store', async () => {
    // Pre-seed a plaintext design.
    const doc = createDocument(
      'design-pre',
      { widthDots: 100, heightDots: 60, dpi: 300 },
      'Pre-encrypt',
    );
    await saveDesign(doc);

    const store = useCryptoStore();
    await store.init();
    await store.setupEncryption('hunter2');

    // The same record reads through unchanged.
    const loaded = await loadDesign('design-pre');
    expect(loaded?.name).toBe('Pre-encrypt');
  });

  it('unlock with the right password derives the same key; wrong password returns false', async () => {
    const store = useCryptoStore();
    await store.init();
    await store.setupEncryption('hunter2');

    // Simulate a fresh boot: drop the in-memory key but keep IDB.
    store.key = null;
    setStorageKey(null);

    expect(await store.unlock('wrong')).toBe(false);
    expect(store.key).toBeNull();
    expect(await store.unlock('hunter2')).toBe(true);
    expect(store.key).not.toBeNull();
  });

  it('locked is true between an enabled-on-disk state and an unlock', async () => {
    const store = useCryptoStore();
    await store.init();
    await store.setupEncryption('hunter2');

    // Simulate fresh boot.
    store.key = null;
    setStorageKey(null);
    expect(store.locked).toBe(true);

    await store.unlock('hunter2');
    expect(store.locked).toBe(false);
  });

  it('changePassword preserves access to existing data with the new password', async () => {
    const doc = createDocument(
      'design-cp',
      { widthDots: 100, heightDots: 60, dpi: 300 },
      'Roll over',
    );
    await saveDesign(doc);

    const store = useCryptoStore();
    await store.init();
    await store.setupEncryption('old-pw');
    expect(await store.changePassword('old-pw', 'new-pw')).toBe(true);

    // Simulate a fresh boot, unlock with new password.
    store.key = null;
    setStorageKey(null);
    expect(await store.unlock('old-pw')).toBe(false);
    expect(await store.unlock('new-pw')).toBe(true);
    expect((await loadDesign('design-cp'))?.name).toBe('Roll over');
  });

  it('changePassword with the wrong old password is a no-op', async () => {
    const store = useCryptoStore();
    await store.init();
    await store.setupEncryption('old-pw');
    const keyBefore = store.key;
    expect(await store.changePassword('not-the-old-pw', 'new-pw')).toBe(false);
    expect(store.key).toBe(keyBefore);
  });

  it('disableEncryption clears the flag and yields plaintext data', async () => {
    const doc = createDocument(
      'design-dis',
      { widthDots: 100, heightDots: 60, dpi: 300 },
      'Plain again',
    );
    await saveDesign(doc);

    const store = useCryptoStore();
    await store.init();
    await store.setupEncryption('hunter2');
    expect(await store.disableEncryption('hunter2')).toBe(true);

    expect(store.enabled).toBe(false);
    expect(store.key).toBeNull();
    expect((await loadDesign('design-dis'))?.name).toBe('Plain again');
  });

  it('disableEncryption with a wrong password is a no-op', async () => {
    const store = useCryptoStore();
    await store.init();
    await store.setupEncryption('hunter2');
    expect(await store.disableEncryption('wrong')).toBe(false);
    expect(store.enabled).toBe(true);
    expect(store.key).not.toBeNull();
  });

  it('column-mapper persistence survives setup + unlock', async () => {
    saveMapping('tpl|name', { name: 'Header' });

    const store = useCryptoStore();
    await store.init();
    await store.setupEncryption('hunter2');

    // After setup, the mapping is reachable through the cache.
    expect(loadMapping('tpl|name')).toEqual({ name: 'Header' });

    // Simulate fresh boot.
    store.key = null;
    setStorageKey(null);
    __resetMappingCacheForTests();

    // Without unlocking, hydrate yields nothing usable (encrypted on disk).
    await hydrateMappings();
    expect(loadMapping('tpl|name')).toBeNull();

    // Unlock and re-hydrate.
    await store.unlock('hunter2');
    expect(loadMapping('tpl|name')).toEqual({ name: 'Header' });
  });

  it('resetAllUserData wipes IDB, localStorage, and store state', async () => {
    saveMapping('tpl|x', { x: 'y' });
    await saveDesign(createDocument('d', { widthDots: 100, heightDots: 60, dpi: 300 }, 'X'));

    const store = useCryptoStore();
    await store.init();
    await store.setupEncryption('hunter2');
    await store.resetAllUserData();

    expect(store.enabled).toBe(false);
    expect(store.key).toBeNull();
    expect(await listDesignSummaries()).toEqual([]);
    // Localstorage burnmark.* keys gone.
    if (typeof window !== 'undefined') {
      const remaining: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('burnmark.')) remaining.push(k);
      }
      expect(remaining).toEqual([]);
    }
  });

  describe('passkey wraps', () => {
    const FAKE_CRED_ID = new Uint8Array([10, 20, 30, 40]);
    const FAKE_PRF_BYTES = new Uint8Array(32).fill(0x33);

    function stubRegistration(): void {
      vi.spyOn(webauthnMod, 'registerPasskeyAndDerivePrf').mockResolvedValue({
        credentialId: FAKE_CRED_ID,
        prfSalt: new Uint8Array(32).fill(0xab),
        prfBytes: FAKE_PRF_BYTES,
      });
      vi.spyOn(webauthnMod, 'authenticateAndDerivePrf').mockResolvedValue(FAKE_PRF_BYTES);
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('addPasskey appends a passkey wrap and persists it', async () => {
      stubRegistration();
      const store = useCryptoStore();
      await store.init();
      await store.setupEncryption('hunter2');
      expect(store.hasPasskey).toBe(false);

      const result = await store.addPasskey();
      expect(result).toEqual({ ok: true });
      expect(store.hasPasskey).toBe(true);
      expect(store.wraps).toHaveLength(2);
      expect(store.passkeyAddedAt).toBeTruthy();
    });

    it('a second addPasskey rejects with already-exists (single-passkey policy)', async () => {
      stubRegistration();
      const store = useCryptoStore();
      await store.init();
      await store.setupEncryption('hunter2');
      await store.addPasskey();

      const result = await store.addPasskey();
      expect(result).toEqual({ ok: false, reason: 'already-exists' });
      expect(store.wraps).toHaveLength(2);
    });

    it('addPasskey rejects when the app is locked (no MK in memory)', async () => {
      stubRegistration();
      const store = useCryptoStore();
      await store.init();
      await store.setupEncryption('hunter2');
      // Simulate locked state.
      store.key = null;
      const result = await store.addPasskey();
      expect(result).toEqual({ ok: false, reason: 'not-unlocked' });
    });

    it('addPasskey surfaces register failures with the reason code', async () => {
      vi.spyOn(webauthnMod, 'registerPasskeyAndDerivePrf').mockRejectedValue(
        new Error('prf-not-supported'),
      );
      const store = useCryptoStore();
      await store.init();
      await store.setupEncryption('hunter2');
      const result = await store.addPasskey();
      expect(result).toEqual({ ok: false, reason: 'prf-not-supported' });
      expect(store.hasPasskey).toBe(false);
    });

    it('removePasskey filters the passkey wrap and leaves the password wrap', async () => {
      stubRegistration();
      const store = useCryptoStore();
      await store.init();
      await store.setupEncryption('hunter2');
      await store.addPasskey();
      expect(store.hasPasskey).toBe(true);

      const removed = await store.removePasskey();
      expect(removed).toBe(true);
      expect(store.hasPasskey).toBe(false);
      expect(store.wraps).toHaveLength(1);
      expect(store.wraps[0].kind).toBe('password');
    });

    it('removePasskey is a no-op when no passkey is registered', async () => {
      const store = useCryptoStore();
      await store.init();
      await store.setupEncryption('hunter2');
      const removed = await store.removePasskey();
      expect(removed).toBe(false);
    });

    it('passkey unlock yields the same MK as password unlock', async () => {
      stubRegistration();
      // Save a record before encryption so the migration step encrypts it
      // under MK; both unlock paths should make it readable again.
      const doc = createDocument(
        'design-pk',
        { widthDots: 100, heightDots: 60, dpi: 300 },
        'Both paths',
      );
      await saveDesign(doc);

      const store = useCryptoStore();
      await store.init();
      await store.setupEncryption('hunter2');
      await store.addPasskey();

      // Simulate fresh boot.
      store.key = null;
      setStorageKey(null);
      __resetMappingCacheForTests();

      // Passkey path.
      const okPk = await store.unlockWithPasskey();
      expect(okPk).toBe(true);
      expect((await loadDesign('design-pk'))?.name).toBe('Both paths');

      // Lock again, unlock with password.
      store.key = null;
      setStorageKey(null);
      __resetMappingCacheForTests();
      const okPw = await store.unlock('hunter2');
      expect(okPw).toBe(true);
      expect((await loadDesign('design-pk'))?.name).toBe('Both paths');
    });

    it('unlockWithPasskey returns false when no passkey is registered', async () => {
      const store = useCryptoStore();
      await store.init();
      await store.setupEncryption('hunter2');
      store.key = null;
      setStorageKey(null);
      const ok = await store.unlockWithPasskey();
      expect(ok).toBe(false);
    });

    it('unlockWithPasskey returns false when WebAuthn auth is cancelled', async () => {
      stubRegistration();
      const store = useCryptoStore();
      await store.init();
      await store.setupEncryption('hunter2');
      await store.addPasskey();

      store.key = null;
      setStorageKey(null);

      vi.spyOn(webauthnMod, 'authenticateAndDerivePrf').mockRejectedValue(
        new Error('auth-cancelled'),
      );
      const ok = await store.unlockWithPasskey();
      expect(ok).toBe(false);
      expect(store.key).toBeNull();
    });

    it('changePassword leaves the passkey wrap intact', async () => {
      stubRegistration();
      const store = useCryptoStore();
      await store.init();
      await store.setupEncryption('hunter2');
      await store.addPasskey();
      expect(store.wraps).toHaveLength(2);

      expect(await store.changePassword('hunter2', 'hunter3')).toBe(true);
      expect(store.wraps).toHaveLength(2);
      expect(store.hasPasskey).toBe(true);

      // Old password no longer works; new password does.
      store.key = null;
      setStorageKey(null);
      expect(await store.unlock('hunter2')).toBe(false);
      expect(await store.unlock('hunter3')).toBe(true);
    });

    it('disableEncryption removes the passkey wrap along with everything else', async () => {
      stubRegistration();
      const store = useCryptoStore();
      await store.init();
      await store.setupEncryption('hunter2');
      await store.addPasskey();

      expect(await store.disableEncryption('hunter2')).toBe(true);
      expect(store.enabled).toBe(false);
      expect(store.wraps).toEqual([]);
      expect(store.hasPasskey).toBe(false);
    });
  });
});

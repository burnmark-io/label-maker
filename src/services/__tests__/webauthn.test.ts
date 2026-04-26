import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authenticateAndDerivePrf,
  detectPasskeyPlatform,
  isPrfLikelySupported,
  isWebAuthnAvailable,
  registerPasskeyAndDerivePrf,
} from '../webauthn';

/**
 * jsdom doesn't ship a WebAuthn implementation. We stub the surface we
 * actually call: `window.PublicKeyCredential` (presence + getClientCapabilities)
 * and `navigator.credentials.create` / `get`. Each test installs fresh
 * stubs and tears them down in `afterEach`.
 */

interface StubCredential {
  rawId: ArrayBuffer;
  getClientExtensionResults: () => {
    prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
  };
}

const RAW_ID_BYTES = new Uint8Array([1, 2, 3, 4]);
const PRF_RESULT_BYTES = new Uint8Array(32).fill(0x42);

function makeStubCred(opts: {
  prfEnabled?: boolean;
  prfResult?: Uint8Array | null;
  rawId?: Uint8Array;
}): StubCredential {
  const ext: ReturnType<StubCredential['getClientExtensionResults']> = {};
  if (opts.prfEnabled !== undefined || opts.prfResult !== undefined) {
    ext.prf = {};
    if (opts.prfEnabled !== undefined) ext.prf.enabled = opts.prfEnabled;
    if (opts.prfResult !== undefined && opts.prfResult !== null) {
      ext.prf.results = { first: opts.prfResult.buffer.slice(0) as ArrayBuffer };
    }
  }
  return {
    rawId: (opts.rawId ?? RAW_ID_BYTES).buffer.slice(0) as ArrayBuffer,
    getClientExtensionResults: () => ext,
  };
}

let originalPKC: unknown;
let originalCreds: unknown;

beforeEach(() => {
  originalPKC = (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential;
  originalCreds = (navigator as unknown as { credentials?: unknown }).credentials;
});

afterEach(() => {
  Object.defineProperty(window, 'PublicKeyCredential', {
    configurable: true,
    writable: true,
    value: originalPKC,
  });
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    writable: true,
    value: originalCreds,
  });
});

function installWebAuthn(handlers: {
  create?: ReturnType<typeof vi.fn>;
  get?: ReturnType<typeof vi.fn>;
  getClientCapabilities?: ReturnType<typeof vi.fn>;
}): void {
  Object.defineProperty(window, 'PublicKeyCredential', {
    configurable: true,
    writable: true,
    value: {
      getClientCapabilities: handlers.getClientCapabilities,
    } as unknown,
  });
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    writable: true,
    value: { create: handlers.create, get: handlers.get } as unknown,
  });
}

function uninstallWebAuthn(): void {
  Object.defineProperty(window, 'PublicKeyCredential', {
    configurable: true,
    writable: true,
    value: undefined,
  });
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

describe('webauthn capability detection', () => {
  it('isWebAuthnAvailable returns false when PublicKeyCredential is missing', () => {
    uninstallWebAuthn();
    expect(isWebAuthnAvailable()).toBe(false);
  });

  it('isWebAuthnAvailable returns true once the API surface is installed', () => {
    installWebAuthn({ create: vi.fn(), get: vi.fn() });
    expect(isWebAuthnAvailable()).toBe(true);
  });

  it('isPrfLikelySupported returns false when the API is missing entirely', async () => {
    uninstallWebAuthn();
    expect(await isPrfLikelySupported()).toBe(false);
  });

  it('isPrfLikelySupported returns false when getClientCapabilities reports prf=false', async () => {
    installWebAuthn({
      create: vi.fn(),
      get: vi.fn(),
      getClientCapabilities: vi.fn().mockResolvedValue({ 'extension:prf': false }),
    });
    expect(await isPrfLikelySupported()).toBe(false);
  });

  it('isPrfLikelySupported returns true when the capabilities API is missing', async () => {
    installWebAuthn({ create: vi.fn(), get: vi.fn() });
    // No getClientCapabilities — fall through to optimistic.
    expect(await isPrfLikelySupported()).toBe(true);
  });

  it('isPrfLikelySupported returns true when prf is reported as supported', async () => {
    installWebAuthn({
      create: vi.fn(),
      get: vi.fn(),
      getClientCapabilities: vi.fn().mockResolvedValue({ 'extension:prf': true }),
    });
    expect(await isPrfLikelySupported()).toBe(true);
  });
});

describe('webauthn registration + PRF eval', () => {
  it('happy path: returns credentialId, salt, and PRF result', async () => {
    const create = vi.fn().mockResolvedValue(makeStubCred({ prfEnabled: true }));
    const get = vi.fn().mockResolvedValue(makeStubCred({ prfResult: PRF_RESULT_BYTES }));
    installWebAuthn({ create, get });

    const userId = new Uint8Array(32).fill(9);
    const result = await registerPasskeyAndDerivePrf(userId);

    expect(result.credentialId).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.credentialId)).toEqual(Array.from(RAW_ID_BYTES));
    expect(result.prfSalt).toHaveLength(32);
    expect(result.prfBytes).toHaveLength(32);
    expect(Array.from(result.prfBytes)).toEqual(Array.from(PRF_RESULT_BYTES));

    // The get() call MUST have been issued with the same salt the
    // result reports — that's what the unlock path will replay.
    const [getArg] = get.mock.calls[0] as [{ publicKey: PublicKeyCredentialRequestOptions }];
    const passedSalt = (
      getArg.publicKey.extensions as unknown as { prf: { eval: { first: Uint8Array } } }
    ).prf.eval.first;
    expect(Array.from(passedSalt)).toEqual(Array.from(result.prfSalt));
  });

  it('rejects with prf-not-supported when prf.enabled is false', async () => {
    const create = vi.fn().mockResolvedValue(makeStubCred({ prfEnabled: false }));
    installWebAuthn({ create, get: vi.fn() });

    await expect(registerPasskeyAndDerivePrf(new Uint8Array(32))).rejects.toThrow(
      'prf-not-supported',
    );
  });

  it('rejects with register-cancelled when create() throws NotAllowedError', async () => {
    const err = new Error('cancelled');
    err.name = 'NotAllowedError';
    const create = vi.fn().mockRejectedValue(err);
    installWebAuthn({ create, get: vi.fn() });

    await expect(registerPasskeyAndDerivePrf(new Uint8Array(32))).rejects.toThrow(
      'register-cancelled',
    );
  });

  it('rejects with prf-eval-failed when the immediate get() returns no PRF result', async () => {
    const create = vi.fn().mockResolvedValue(makeStubCred({ prfEnabled: true }));
    // No prf result on the assertion → eval failed.
    const get = vi.fn().mockResolvedValue(makeStubCred({}));
    installWebAuthn({ create, get });

    await expect(registerPasskeyAndDerivePrf(new Uint8Array(32))).rejects.toThrow(
      'prf-eval-failed',
    );
  });
});

describe('webauthn authentication path (unlock)', () => {
  it('returns the 32-byte PRF result on a matching credential', async () => {
    const get = vi.fn().mockResolvedValue(makeStubCred({ prfResult: PRF_RESULT_BYTES }));
    installWebAuthn({ create: vi.fn(), get });

    const credId = new Uint8Array([5, 6, 7]);
    const salt = new Uint8Array(32).fill(0x11);
    const result = await authenticateAndDerivePrf(credId, salt);
    expect(result).toHaveLength(32);
    expect(Array.from(result)).toEqual(Array.from(PRF_RESULT_BYTES));

    // Verify it passed the right credentialId + salt to the browser.
    const [arg] = get.mock.calls[0] as [{ publicKey: PublicKeyCredentialRequestOptions }];
    const allow = arg.publicKey.allowCredentials!;
    expect(allow).toHaveLength(1);
    const passedSalt = (
      arg.publicKey.extensions as unknown as { prf: { eval: { first: Uint8Array } } }
    ).prf.eval.first;
    expect(Array.from(passedSalt)).toEqual(Array.from(salt));
  });

  it('rejects with auth-cancelled when get() throws NotAllowedError', async () => {
    const err = new Error('cancelled');
    err.name = 'NotAllowedError';
    const get = vi.fn().mockRejectedValue(err);
    installWebAuthn({ create: vi.fn(), get });

    await expect(authenticateAndDerivePrf(new Uint8Array([1]), new Uint8Array(32))).rejects.toThrow(
      'auth-cancelled',
    );
  });

  it('rejects with prf-eval-failed when the assertion returns no PRF result', async () => {
    const get = vi.fn().mockResolvedValue(makeStubCred({}));
    installWebAuthn({ create: vi.fn(), get });

    await expect(authenticateAndDerivePrf(new Uint8Array([1]), new Uint8Array(32))).rejects.toThrow(
      'prf-eval-failed',
    );
  });
});

describe('detectPasskeyPlatform', () => {
  // jsdom's UA is fixed per test env; just sanity-check the return shape.
  it('returns one of the four platform tags', () => {
    const p = detectPasskeyPlatform();
    expect(['touchid', 'windows-hello', 'android', 'generic']).toContain(p);
  });
});

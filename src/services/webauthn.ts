/**
 * WebAuthn wrapper for the passkey unlock flow. Wraps the bare browser API
 * with two operations the rest of the app cares about:
 *
 * - {@link registerPasskeyAndDerivePrf} — register a new credential AND
 *   immediately follow with an authentication call so the PRF extension's
 *   `eval` runs against the freshly-created credential. The assertion's
 *   PRF result is the 32 bytes the crypto layer wraps the master key
 *   under. Registration without a successful PRF eval is rolled back to
 *   avoid leaving dead credentials in the OS keychain.
 * - {@link authenticateAndDerivePrf} — for the unlock path. Calls
 *   `navigator.credentials.get` with the stored `credentialId` and
 *   `prfSalt`, returns the 32-byte PRF result.
 *
 * The threat-model and architectural rationale lives in
 * `amendments/backlog/amendment-passkey-unlock.md`.
 */

const RP_NAME = 'burnmark';

function rpId(): string {
  if (typeof location === 'undefined') return 'localhost';
  return location.hostname;
}

export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials &&
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function'
  );
}

interface PublicKeyCredentialWithCaps {
  getClientCapabilities?: () => Promise<Record<string, boolean>>;
}

/**
 * Best-effort PRF capability detection. The reliable signal is "register
 * and observe `prf.enabled === true`" — that's the source of truth used
 * by registration. This pre-flight check only catches browsers that
 * actively report PRF as unsupported via `getClientCapabilities`. Browsers
 * that don't expose the capabilities API (or that do but don't list PRF)
 * are treated as "maybe supported" — we attempt registration and let it
 * roll back if PRF doesn't actually work.
 */
export async function isPrfLikelySupported(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false;
  const PKC = window.PublicKeyCredential as unknown as PublicKeyCredentialWithCaps;
  if (typeof PKC.getClientCapabilities === 'function') {
    try {
      const caps = await PKC.getClientCapabilities();
      // If the browser explicitly says PRF is unsupported, trust it.
      if (caps?.['extension:prf'] === false) return false;
    } catch {
      // ignore — fall through to optimistic path
    }
  }
  return true;
}

export type PasskeyPlatform = 'touchid' | 'windows-hello' | 'android' | 'generic';

/**
 * Best-effort guess at which authenticator the OS is likely to surface,
 * used only to pick a friendlier button label ("Use Touch ID" vs the
 * generic "Use registered passkey"). Falls back to 'generic' on anything
 * uncertain.
 */
export function detectPasskeyPlatform(): PasskeyPlatform {
  if (typeof navigator === 'undefined') return 'generic';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod|Mac OS X|Macintosh/i.test(ua)) return 'touchid';
  if (/Windows/i.test(ua)) return 'windows-hello';
  if (/Android/i.test(ua)) return 'android';
  return 'generic';
}

export interface PasskeyRegistration {
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
  prfBytes: Uint8Array;
}

interface PrfExtensionResults {
  prf?: {
    enabled?: boolean;
    results?: { first?: ArrayBuffer | Uint8Array };
  };
}

/**
 * `PublicKeyCredential` only types extension results in the standard
 * DOM lib via the opaque `AuthenticationExtensionsClientOutputs`. The
 * `prf` extension isn't in the standard yet, so we reach in via a
 * helper cast rather than a structural extends clause (which TS rejects
 * because the result types don't overlap).
 */
function readPrfResults(cred: PublicKeyCredential): PrfExtensionResults {
  const ext = cred.getClientExtensionResults() as unknown as PrfExtensionResults;
  return ext;
}

function asBytes(buffer: ArrayBuffer | Uint8Array | undefined): Uint8Array | null {
  if (!buffer) return null;
  if (buffer instanceof Uint8Array) return new Uint8Array(buffer);
  return new Uint8Array(buffer);
}

/**
 * Register a fresh WebAuthn credential and immediately verify the PRF
 * extension by running an assertion against it. Returns everything the
 * caller needs to wrap MK and recall the credential at unlock time.
 *
 * Throws (with a stable string code in `.message`) on every failure mode:
 * - `webauthn-unavailable`
 * - `register-cancelled`
 * - `prf-not-supported`     (authenticator doesn't implement hmac-secret)
 * - `prf-eval-failed`       (registered ok, but eval returned no result)
 * - `auth-cancelled`        (user dismissed the immediate verify-eval prompt)
 *
 * The caller (the crypto store) is expected to surface the error code in
 * a friendly i18n string and roll back the registration intent — we don't
 * persist any state for a credential that fails verification.
 */
export async function registerPasskeyAndDerivePrf(
  userId: Uint8Array,
): Promise<PasskeyRegistration> {
  if (!isWebAuthnAvailable()) throw new Error('webauthn-unavailable');

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));

  const createOpts: PublicKeyCredentialCreationOptions = {
    rp: { id: rpId(), name: RP_NAME },
    user: {
      id: userId as BufferSource,
      name: `burnmark@${rpId()}`,
      displayName: 'burnmark',
    },
    challenge: challenge as BufferSource,
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    authenticatorSelection: {
      // Prefer the device's built-in authenticator (Touch ID, Windows
      // Hello, Android fingerprint/PIN). Without this hint Chrome on
      // Android tends to surface the cross-device QR flow first, which
      // hides the local biometric option users actually want.
      authenticatorAttachment: 'platform',
      residentKey: 'discouraged',
      userVerification: 'required',
    },
    extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
  };

  let cred: PublicKeyCredential | null;
  try {
    cred = (await navigator.credentials.create({
      publicKey: createOpts,
    })) as PublicKeyCredential | null;
  } catch (err) {
    // NotAllowedError / AbortError both surface as cancellation here.
    const name = (err as { name?: string }).name;
    if (name === 'NotAllowedError' || name === 'AbortError') {
      throw new Error('register-cancelled');
    }
    throw err;
  }
  if (!cred) throw new Error('register-cancelled');

  const ext = readPrfResults(cred);
  if (ext.prf?.enabled !== true) {
    throw new Error('prf-not-supported');
  }

  const credentialId = new Uint8Array(cred.rawId);

  // Immediately follow with a get() to actually derive the PRF result.
  // If this throws, we treat it the same as registration failure — no
  // wrap is persisted.
  let prfBytes: Uint8Array;
  try {
    prfBytes = await authenticateAndDerivePrf(credentialId, prfSalt);
  } catch (err) {
    const code = (err as Error)?.message;
    if (code === 'auth-cancelled') throw new Error('auth-cancelled');
    throw new Error('prf-eval-failed');
  }
  return { credentialId, prfSalt, prfBytes };
}

/**
 * Authenticate against a previously-registered credential and return the
 * PRF eval result. The salt MUST match the salt used at registration —
 * a different salt produces a different (useless) PRF output. Throws on
 * cancellation or missing eval result.
 */
export async function authenticateAndDerivePrf(
  credentialId: Uint8Array,
  prfSalt: Uint8Array,
): Promise<Uint8Array> {
  if (!isWebAuthnAvailable()) throw new Error('webauthn-unavailable');

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const getOpts: PublicKeyCredentialRequestOptions = {
    challenge: challenge as BufferSource,
    allowCredentials: [{ type: 'public-key', id: credentialId as BufferSource }],
    userVerification: 'required',
    extensions: {
      prf: { eval: { first: prfSalt } },
    } as AuthenticationExtensionsClientInputs,
  };

  let assertion: PublicKeyCredential | null;
  try {
    assertion = (await navigator.credentials.get({
      publicKey: getOpts,
    })) as PublicKeyCredential | null;
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'NotAllowedError' || name === 'AbortError') {
      throw new Error('auth-cancelled');
    }
    throw err;
  }
  if (!assertion) throw new Error('auth-cancelled');

  const ext = readPrfResults(assertion);
  const result = asBytes(ext.prf?.results?.first);
  if (!result || result.length === 0) throw new Error('prf-eval-failed');
  return result;
}

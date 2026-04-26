# Amendment — Passkey & Biometric Unlock

> **Amends:** `amendment-local-data-encryption.md` (the password-based
> encryption MVP, now shipped) — adds an optional one-tap unlock path
> on top of the existing password flow. The password stays as the
> canonical unlock method; a passkey is a delight-layer shortcut you
> can add and remove from the Privacy page.
> **Companion to:** `PROGRESS.md`, `DECISIONS.md`.
>
> One sentence: let the user **unlock burnmark with Touch ID,
> Windows Hello, Android biometric, or a hardware key** by registering
> the device's authenticator as an alternate way to unwrap the master
> key — keeping the password as the always-available canonical path.
>
> **Pure label-maker scope.** Designer-core, the share/import formats,
> and the on-disk record envelopes from
> [amendment-local-data-encryption.md](../implemented/amendment-local-data-encryption.md)
> are unchanged. The change is in the *master-key indirection*: instead
> of MK being the password-derived key directly, MK is wrapped under a
> per-factor KEK. Adding/removing the passkey is then an append/filter
> on a small list — and the v1→v2 migration is a meta-store rewrite
> with no record walk.
>
> **Delight scope.** A profile can have at most one passkey registered
> at a time. No naming, no editing, no multi-passkey UX — just
> "add a passkey for this device" and "remove it." Anything beyond
> that is out of scope.

---

## 1. The Problem

The MVP works, but every session opens with the same friction: type
your password, wait ~1s for PBKDF2, hit unlock. For a craft tool you
return to several times a day, that's a tax on a feature meant to be
opt-in and friendly. Meanwhile the OS already has a perfectly good
authenticator sitting right there — Touch ID, Windows Hello, the
Android biometric prompt, or a hardware key plugged into USB.

The web platform exposes that authenticator via WebAuthn, and the
**`prf` extension** specifically gives us what we need: a way to
derive 32 bytes of high-entropy key material from the authenticator,
keyed to a salt we provide. That's exactly the input shape an AES-GCM
key wants. So the unlock screen can grow a "Use Touch ID" button next
to the password field, and most sessions become a one-tap unlock.

The password remains the canonical path — it's what you fall back on
when:

- The OS is reinstalled or the platform authenticator gets purged.
- The fingerprint sensor breaks or biometric registration is reset.
- The browser profile is restored from backup on a fresh machine.
- The user just wants to skip the prompt and type the password.

What this is **not**: a replacement for the password. The password
stays in your head; the passkey lives in the OS / hardware. Only the
password is portable across "this exact authenticator stops working"
events on the same IDB.

---

## 2. Threat Model — What Changes

### 2.1 What this preserves

Everything from the v1 amendment §2.1: encrypted IDB, encrypted
profile copy, casual snooping. The on-disk records are still AES-GCM
under a master key.

### 2.2 What this adds (good)

- **Faster, friendlier unlock** for the common path.
- **Resistance to over-the-shoulder password capture** — the user
  can use biometric in a public place without typing.
- **Hardware-key option** for users who want it (YubiKey on a shared
  dev machine, etc.).

### 2.3 What this does NOT change

- **Anything about the unlocked state.** Once unlocked, the master key
  is in JS memory; same caveats as v1.
- **The "no recovery" promise.** If the user forgets the password
  *and* the passkey is unusable, the data is gone. Adding a passkey
  doesn't remove that promise.

### 2.4 What this introduces (be honest)

- **Synced passkeys** (iCloud Keychain, Google Password Manager) move
  the secret across devices linked to the user's cloud account. That's
  a feature for the user but a fact worth noting in the Privacy copy:
  "If your passkey syncs via iCloud / Google, anyone with that account
  can register a new device and unlock burnmark."
- **Passkey theft** is a real risk for hardware keys without a PIN —
  the Privacy copy should encourage PIN protection on hardware keys.
- **Browser/authenticator quirks.** PRF support is uneven (see §6.4).
  We hide the feature on unsupported configurations rather than
  registering a passkey that can't actually unlock anything.

### 2.5 Non-goals

- **Passwordless setup.** First-time encryption setup still requires a
  password. Passkey is added *after* setup, on top.
- **WebAuthn for second-factor / 2FA.** burnmark has no server and no
  account — there's nothing to 2FA against. Passkey replaces the
  password *for unlock*, not in addition to it.
- **Multiple passkeys per profile.** One at a time. Replace by removing
  the existing one and adding a new one.
- **Naming or editing the passkey.** It just shows as
  "Passkey · added {date}" in the Privacy list. No free-text input.
- **Server-side passkey escrow / cross-device sync via QR code.**
  burnmark stays no-account.

---

## 3. Architecture — Key-Wrapping Indirection

The v1 design has a direct relationship: `MK = PBKDF2(password, salt)`.
That's why "change password" in v1 has to re-encrypt every record —
the master key itself changes.

The v2 design adds one indirection:

```
                    ┌─ KEK_password = PBKDF2(password, salt)
       MK ──wrap──┤
   (256 bits)      └─ KEK_passkey  = PRF(authenticator, prfSalt)   (optional)
```

`MK` never changes once the store is in v2 form. Each unlock factor
produces a `KEK` that wraps MK with AES-GCM (see §10 for why GCM over
KW). Unlock = pick a factor, derive its KEK, unwrap MK.

This makes every operation cheap:

| Operation | v1 cost | v2 cost |
|---|---|---|
| Change password | Re-encrypt every record | Re-wrap MK once |
| Add passkey | n/a | Wrap MK once, append |
| Remove passkey | n/a | Filter the wraps list |
| v1 → v2 migration | n/a | Meta-store rewrite, **no record walk** |
| Disable encryption | Decrypt every record | (unchanged from v1 — still walks records) |

The on-disk record envelope shape is *unchanged*. Records continue
to use AES-GCM under MK. Only the meta-store layout changes.

---

## 4. Storage Layout (meta keys)

Replaces the v1 trio (`enc.salt`, `enc.kdfParams`, `enc.verifier`)
with a typed wraps list:

| Key | Type | Purpose |
|---|---|---|
| `enc.enabled` | `boolean` | Master flag (unchanged). |
| `enc.format` | `1 \| 2` | Storage format version. v1 = direct-derive; v2 = wrapped. New setups always v2; v1 stores get migrated transparently on next unlock. |
| `enc.wraps` | `WrapRecord[]` | One password wrap; optionally one passkey wrap. |
| `enc.verifier` | `Envelope` | Verifier (encrypted under MK). Used on the password path; redundant on the passkey path since AES-GCM unwrap is already authenticated. |
| `enc.passkeyUserId` | `Uint8Array` | Stable 32-byte WebAuthn `user.id`. Created lazily on the first passkey-add and reused forever after, so re-registering replaces the old credential in the OS keychain instead of orphaning it. |
| `enc.migrating` | `boolean` | (unchanged) crash-safety flag. |

```ts
type WrapRecord =
  | {
      kind: 'password';
      salt: Uint8Array;          // 16 bytes
      kdfParams: KdfParams;      // PBKDF2 iterations, hash
      wrappedMk: Envelope;       // AES-GCM wrap of MK under KEK_pw
    }
  | {
      kind: 'passkey';
      credentialId: Uint8Array;  // returned by navigator.credentials.create
      prfSalt: Uint8Array;       // 32 bytes, generated at registration
      addedAt: string;           // ISO timestamp for the listing UI
      wrappedMk: Envelope;       // AES-GCM wrap of MK under KEK_passkey
    };
```

**Invariants enforced by `cryptoStore`:**
- Exactly **one** `kind: 'password'` wrap (the canonical fallback).
- **Zero or one** `kind: 'passkey'` wraps. The "Add a passkey" UI is
  hidden when one exists, and a defensive check in the store rejects
  duplicate adds.

---

## 5. Setup Flows

### 5.1 First-time encryption setup (new users)

UI shell from v1 §4.1 (warnings, password+confirm). Internally:

1. Generate random `MK` (32 bytes).
2. Generate random `salt`. Derive `KEK_pw = PBKDF2(password, salt)`.
3. Wrap MK under KEK_pw → `wrappedMk`.
4. Build verifier under MK.
5. Migrate every IDB record (plaintext → encrypted under MK).
6. Persist meta:
   - `enc.format = 2`
   - `enc.wraps = [{ kind: 'password', salt, kdfParams, wrappedMk }]`
   - `enc.verifier`
   - `enc.enabled = true`

After successful setup, the modal **transitions to the passkey
nudge** (see §5.2) instead of closing immediately. The user is
already unlocked, so accepting the nudge runs straight into the
registration flow with no extra prompts.

### 5.2 The passkey nudge (post-setup only)

Shown as a second "step" inside `EncryptionSetup.vue` after a
successful first-time setup, only when:
- Encryption is now enabled (just succeeded).
- The browser supports PRF (best-effort detect; see §6.4).
- No passkey wrap exists (always true at this point for new users).

```
┌──────────────────────────────────────────────┐
│  ✨  Unlock burnmark faster                  │
│                                              │
│  Use Touch ID instead of typing your         │
│  password every time. Your password still    │
│  works as a backup.                          │
│                                              │
│       [ Maybe later ]   [ Add Touch ID ]     │
└──────────────────────────────────────────────┘
```

- Button label is "Add Touch ID" / "Add Windows Hello" when we can
  guess the platform from `navigator.userAgent`, otherwise
  "Add a passkey."
- "Maybe later" closes the modal — passkeys are still discoverable
  later in the Privacy page.
- If PRF isn't supported, the nudge step is skipped and the modal
  closes directly after setup (same as v1's current behavior).

The same WebAuthn registration flow (§5.3) runs both from the nudge
and from the Privacy page's "+ Add a passkey for this device" button.

Migrated v1 users are **not** shown a nudge — see §5.5. Discovery
happens via the Privacy page.

### 5.3 Adding a passkey (the registration flow itself)

Preconditions (enforced by the store, not the caller):
- Encryption is enabled.
- The browser supports the PRF extension.
- No passkey wrap currently exists.
- The app is unlocked (MK is in memory). **No password re-prompt.**

Flow:

1. **Make sure `enc.passkeyUserId` exists.** If missing, generate 32
   random bytes and persist before continuing.
2. **Register the credential.** Call `navigator.credentials.create`
   with:
   ```ts
   {
     publicKey: {
       rp: { id: location.hostname, name: 'burnmark' },
       user: {
         id: enc.passkeyUserId,
         name: `burnmark@${location.hostname}`,
         displayName: 'burnmark',
       },
       challenge: <random 32 bytes>,
       pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
       authenticatorSelection: {
         residentKey: 'discouraged',     // we always pass allowCredentials at unlock
         userVerification: 'required',   // every unlock requires presence
       },
       extensions: { prf: {} },
     }
   }
   ```
3. **Verify PRF actually works.** Read
   `getClientExtensionResults().prf.enabled`. If it's not `true`, the
   authenticator doesn't support hmac-secret — surface "This device's
   authenticator can't be used here. Try a different one." and abort.
   Don't store anything. (The unused credential is left in the OS
   keychain; honest copy in the error mentions it.)
4. **Generate `prfSalt`** (32 random bytes) and **immediately follow
   registration with `navigator.credentials.get`** passing
   `prf: { eval: { first: prfSalt } }`. Proves the PRF eval works on
   this credential before we commit any state. If the eval result is
   missing, treat as unsupported and abort (per step 3).
5. **Derive `KEK_passkey`** from the 32-byte PRF result (import as
   AES-GCM-256 key).
6. **Wrap MK under KEK_passkey**, append to `enc.wraps`, save.

The flow is presented as a single modal that says "Touch the sensor
/ approve in your browser…" while WebAuthn is up, then closes on
success or shows an error inline.

### 5.4 Removing a passkey

Single button on the passkey row in the Privacy "Devices" list.
Confirms with "Remove the passkey? You'll need your password to unlock
from now on. You may also want to remove burnmark from your device's
saved passkeys." Then filters the passkey wrap out of `enc.wraps`. No
password confirmation — removing the wrap is non-destructive and the
data stays reachable via the password.

The password wrap is non-removable; hide its delete control entirely.

**OS keychain caveat:** WebAuthn provides no programmatic deregister.
The credential lingers in the OS / authenticator until the user
deletes it manually. Because we use a stable `enc.passkeyUserId`,
re-registering later replaces the old credential rather than stacking
a new one — but there's still a window where the OS keychain shows
an entry that no longer unlocks anything. Confirmation copy
acknowledges this.

### 5.5 Migrating an existing v1 store (transparent, on next unlock)

When a user with `enc.format = 1` (or no `enc.format`) successfully
unlocks with their password, we have the v1 KEK in scope. Migration
happens **silently before** the app boots into the editor:

1. Treat the v1 KEK as the v2 MK directly. (Both are 32-byte AES-GCM
   keys; nothing about the records on disk needs to change — they're
   already AES-GCM under that key.)
2. Generate a fresh `salt`. Derive `KEK_pw' = PBKDF2(password, salt)`.
3. Wrap MK under `KEK_pw'` → new password wrap.
4. Build verifier under MK (same plaintext as v1).
5. Persist atomically (under `enc.migrating`):
   - `enc.format = 2`
   - `enc.wraps = [password_wrap]`
   - `enc.verifier` (rewritten in the v2 envelope shape)
6. Delete v1 fields: `enc.salt`, `enc.kdfParams`.

**No record walk.** Records remain AES-GCM under the same key; only
the meta-store changes. Total cost is one fresh PBKDF2 (~1s) plus a
handful of meta writes — and the PBKDF2 amortizes against the unlock
the user just did. Crash-safety is the same shape as v1 setup:
`enc.migrating` is set first, cleared last; partial state on next
boot prompts the user as v1 already does.

After migration, the app boots normally. The §5.2 nudge is **not**
shown — surprising users mid-unlock with a new prompt would feel
sketchy. Migrated users discover passkeys via the Privacy page.

### 5.6 Change password (v2)

Replaces the v1 record-walk entirely:
1. Verify old password (unwrap MK using the existing password wrap).
2. Derive new `KEK_pw` from new password + fresh salt.
3. Re-wrap MK under the new KEK_pw, replace the password wrap entry.
4. (Records and the passkey wrap, if any, are untouched.)

Three IDB writes total. Sub-second.

### 5.7 Disable encryption

Mostly unchanged from v1: walk every record, decrypt under MK, write
plaintext, then delete `enc.*` meta. The wraps list and
`enc.passkeyUserId` go away with the rest.

If a passkey wrap was present, the disable confirmation copy adds:
"Your passkey for burnmark will stop working. You may also want to
remove burnmark from your device's saved passkeys."

---

## 6. Unlock Flow

### 6.1 The unlock screen

Layout depends on what's available:

```
┌─────────────────────────────────┐
│   🏷️  burnmark                  │
│   Unlock burnmark               │
│                                 │
│   ┌───────────────────────────┐ │
│   │ 🔐  Use Touch ID          │ │   ← only if a passkey is
│   └───────────────────────────┘ │       registered for this profile
│                                 │
│   ─────  or use password  ───── │
│                                 │
│   Password  [...............]   │
│   [        Unlock        ]      │
│                                 │
│   Forgot password? Reset all    │
└─────────────────────────────────┘
```

If no passkey is registered, or the browser doesn't support PRF, the
top button isn't rendered — the screen looks identical to v1.

Button label heuristic (best-effort, falls back gracefully):
- macOS / iOS → *"Use Touch ID"*
- Windows → *"Use Windows Hello"*
- Anything else → *"Use registered passkey"*

### 6.2 Passkey unlock — what happens

1. Call `navigator.credentials.get` with:
   ```ts
   {
     publicKey: {
       challenge: <random 32 bytes>,
       allowCredentials: [{
         type: 'public-key',
         id: passkeyWrap.credentialId,
       }],
       userVerification: 'required',
       extensions: { prf: { eval: { first: passkeyWrap.prfSalt } } },
     }
   }
   ```
   Single-element `allowCredentials` keeps the UX deterministic —
   the browser invokes the matching authenticator directly, no
   picker.
2. Read `getClientExtensionResults().prf.results.first` (32 bytes).
   Import as AES-GCM-256 key → `KEK_passkey`.
3. Unwrap MK from `passkeyWrap.wrappedMk`. AES-GCM auth-tag failure
   here means PRF returned a different value than at registration —
   surface "Couldn't unlock with this passkey. Try your password."
   No verifier check needed: the AES-GCM auth tag is itself proof
   that MK is correct.
4. On success → register MK as the active storage key, hydrate
   stores, show the editor.

### 6.3 Password unlock — what happens

Branches on `enc.format`:

**v2 store (`enc.format === 2`):**
1. Derive `KEK_pw` from password + the password wrap's salt/kdf.
2. Unwrap MK from the password wrap. Auth-tag failure → wrong
   password.
3. Verify against `enc.verifier` (defensive; auth-tag failure in
   step 2 already covers the wrong-password case, but the verifier
   gives a predictable failure shape and protects against a future
   wrap shape change).
4. Same as 6.2 step 4.

**v1 store (`enc.format` missing or `1`):**
1. Derive password key from `enc.salt` + `enc.kdfParams` (v1 layout).
2. Try to decrypt the v1 verifier. Failure → wrong password.
3. Success → that derived key is MK. Run the §5.5 migration **before
   continuing** (still within the unlock call, while password is in
   scope).
4. Continue as v2 step 4.

### 6.4 Capability detection

Two conditions for offering passkey unlock at all on a given device:

1. **Browser supports WebAuthn** —
   `typeof window.PublicKeyCredential !== 'undefined'`.
2. **Browser supports PRF.** The reliable signal is "registration
   returned `prf.enabled === true`" — that's the source of truth
   (§5.3 step 3 rolls back if PRF doesn't work). As an optional
   pre-flight nicety we may *also* probe
   `PublicKeyCredential.getClientCapabilities?.()` and read
   `caps?.['extension:prf']` to skip the registration ceremony on
   known-bad browsers, but we never gate the feature *on*
   `getClientCapabilities` returning truthy — the API is still
   rolling out.

A third condition gates the unlock-screen button specifically:
3. **A passkey is registered for this profile** —
   `enc.wraps.some(w => w.kind === 'passkey')`.

When (1) or (2) is false, the Privacy "Add a passkey" entry is
hidden in favor of a small disabled note: "This browser doesn't
support adding passkeys for unlock." When (3) is false, only the
unlock-screen button is hidden.

| Browser (as of writing) | PRF status |
|---|---|
| Chrome / Edge / Brave | Supported (Chrome 132+) |
| Safari | Supported (iOS 18 / macOS 15) |
| Firefox | Partial / behind flag — feature-detect, hide if missing |

| Platform authenticator | Reliability |
|---|---|
| Touch ID (macOS, iOS) | Solid |
| Windows Hello | Mixed historically; improving |
| Android (Play Services) | Per-OEM, mixed |
| Hardware keys (YubiKey 5+, with hmac-secret) | Solid |

---

## 7. Privacy Page Changes

The existing "Encryption" section grows a sub-section when encryption
is enabled and the browser supports passkeys:

```
Encryption
  Encryption is on. [Change password]  [Turn off encryption]

  Devices that can unlock burnmark
  ┌──────────────────────────────────────────────┐
  │ 🔑 Password (always)                         │
  ├──────────────────────────────────────────────┤
  │ 👆 Passkey · added Apr 26      [Remove]      │   ← only if registered
  └──────────────────────────────────────────────┘
  [+ Add a passkey for this device]              ← hidden when one exists
                                                    or when PRF unsupported
```

Notes:
- The password row is non-removable (no Remove button).
- "Add a passkey" hides when a passkey is already registered (single-
  passkey policy) or when the browser doesn't support PRF. In the
  PRF-unsupported case, show a small disabled note: "This browser
  doesn't support adding passkeys for unlock."
- Honesty footnote near the section: *"Passkeys synced via iCloud or
  Google Password Manager carry across the devices linked to that
  account. Use a hardware key if you want one device only."*

---

## 8. File Changes

| File | Change |
|---|---|
| `src/services/webauthn.ts` | **New.** Capability detect, register, authenticate (with PRF), credential ID handling. ~120 LOC. |
| `src/services/crypto.ts` | Add `wrapKey` / `unwrapKey` helpers (AES-GCM wrap of a 32-byte raw key). Add `importPrfKey` (32 bytes → AES-GCM CryptoKey). |
| `src/services/storage.ts` | No public-API change; the meta keys it stores grow but it's still just `getMeta`/`setMeta` calls. |
| `src/stores/crypto.ts` | Significant: introduce wrapped-MK model. New methods: `addPasskey()`, `removePasskey()`, `unlockWithPasskey()`. Existing `setupEncryption` / `unlock` / `changePassword` / `disableEncryption` adjusted to operate on wraps. v1→v2 migration runs inside `unlock` when `enc.format` is missing/1. |
| `src/components/common/UnlockScreen.vue` | Conditionally render the passkey button above the password field. |
| `src/components/common/PrivacyDialog.vue` | New "Devices that can unlock burnmark" sub-section with list + Add/Remove. |
| `src/components/common/EncryptionSetup.vue` | After successful setup, transition to the §5.2 passkey nudge step before closing (skipped when PRF isn't supported). |
| `src/i18n/locales/en.json`, `nl.json` | New `passkey.*` namespace: button labels, list headings, nudge copy, error messages, capability-not-supported note. |

(No separate `AddPasskeyDialog.vue` — the registration flow is a
brief WebAuthn ceremony shown as inline status; success closes
immediately, errors surface in the same surface.)

---

## 9. Test Plan

| Area | Approach |
|---|---|
| `services/__tests__/crypto.test.ts` | Add wrap/unwrap-key round-trip, `importPrfKey`, MK randomness. |
| `services/__tests__/webauthn.test.ts` | **New.** Mock `navigator.credentials.create` / `get`. Test the registration → PRF-eval → wrap path with a synthetic 32-byte PRF result. Test the unlock path: matching credentialId → unwrap → MK. |
| `stores/__tests__/crypto.test.ts` | Add: `addPasskey` appends a wrap; second call rejects (single-passkey invariant); `removePasskey` filters; password and passkey both unlock the same MK; `enc.passkeyUserId` is created lazily and reused; v1 → v2 migration on first unlock leaves records byte-identical and is a no-op on second unlock. |
| Capability detection | Unit-test the gating logic in isolation — mocked `PublicKeyCredential` and `getClientCapabilities`. |
| Manual QA matrix | Touch ID Mac (Chrome + Safari), Windows Hello (Edge + Chrome + Firefox), Android Chrome with platform authenticator, YubiKey 5 with hmac-secret on Chrome/Firefox/Safari. The honest set — full coverage isn't possible without the hardware. PWA install case: register a passkey in a browser tab, unlock from the PWA shell, and vice-versa. |

WebAuthn isn't exercisable in jsdom. Integration confidence comes
from the manual matrix; unit tests cover the wrap/unwrap glue around
a mocked WebAuthn surface.

---

## 10. Open Questions (mostly resolved)

1. **AES-KW vs AES-GCM for wrapping MK.** AES-KW is the by-the-book
   key-wrap primitive but it's not exposed via Web Crypto in all
   browsers consistently. AES-GCM with a fresh IV per wrap gives
   equivalent security and zero compatibility surprises.
   **Decision: AES-GCM.**

2. **`userVerification: 'preferred'` vs `'required'`.** Preferred
   lets the OS skip if it just did one a moment ago. For an
   encryption-unlock flow, required is the honest default — *every*
   unlock should require user presence. **Decision: `'required'`.**

3. **PWA install caveat.** When burnmark is installed as a PWA, the
   passkey is bound to the same origin and works across both the PWA
   shell and a regular browser tab on the same profile. No extra
   handling needed — manual QA covers it.

4. **`userVerification: 'discouraged'`** (silent unlock without
   biometric prompt)? Tempting for the "frictionless" goal but
   defeats the threat model — a roommate plugged into the user's
   USB port could silent-unlock with the YubiKey.
   **Don't ship.**

5. **Passkey conditional UI / autofill** (`mediation: 'conditional'`).
   Polish; not load-bearing. Defer.

6. **Should the migration nudge migrated users to add a passkey?**
   §5.5 currently chooses *no* — too surprising on what was an
   ordinary unlock. Privacy page is the discovery surface. Worth
   revisiting if discovery turns out to be poor.

---

## 11. Out of Scope

- **Passwordless setup.** First-time setup still prompts for a
  password (§2.5).
- **Multiple passkeys per profile.** One at a time.
- **Naming / renaming the passkey.** "Passkey · added {date}" is the
  whole UI.
- **Server-side passkey escrow / cross-device QR sync.** No server.
- **Per-record passkey scoping** (different passkeys unlock different
  designs). Threat model doesn't ask for it.
- **Recovery codes.** Could be a third wrap kind (`kind: 'recovery'`)
  in a v3 amendment if forgot-password requests start coming in.
- **Encryption of the `.label` / `.zip` exports under a passkey-derived
  key.** Same reason as v1 §10 — exports are meant to be portable.

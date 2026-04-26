# Amendment — Passkey & Biometric Unlock

> **Amends:** `amendment-local-data-encryption.md` (the password-based
> encryption MVP) — adds a second unlock path on top of the existing
> password flow. The password stays as the canonical, always-available
> fallback; passkeys are a delight-layer shortcut.
> **Companion to:** `PROGRESS.md`, `DECISIONS.md`.
>
> One sentence: let the user **unlock burnmark with Touch ID,
> Windows Hello, Android biometric, or a hardware key** by registering
> the device's authenticator as an alternate way to unwrap the master
> key — keeping the password as the recovery path so losing a device
> never means losing data, and lose-everything still requires losing
> *both* the password and every registered authenticator.
>
> **Pure label-maker scope.** Designer-core, the share/import formats,
> and the on-disk record envelopes from
> [amendment-local-data-encryption.md](amendment-local-data-encryption.md)
> are unchanged. The change is in the *master-key indirection*: MK is
> no longer derived from the password directly; instead MK is random
> and gets wrapped under a key-encryption key (KEK) per registered
> unlock factor. Adding/removing factors is then an append/filter on a
> small list — no record-level migration.

---

## 1. The Problem

The MVP works, but every session opens with the same friction: type a
password, wait ~1s for PBKDF2, hit unlock. For a craft tool people
return to several times a day, that's a tax on a feature meant to be
opt-in and friendly. Meanwhile the OS already has a perfectly good
authenticator sitting right there — Touch ID, Windows Hello, the
Android biometric prompt, or a hardware key plugged into USB.

The web platform exposes that authenticator via WebAuthn, and the
**`prf` extension** specifically gives us what we need: a way to
derive 32 bytes of high-entropy key material from the authenticator,
keyed to a salt we provide. That's exactly the input shape an AES-GCM
key wants. So the unlock screen can grow a "Use Touch ID" button next
to the password field, and the password becomes the *fallback* you
only need on first setup, on a new device, or when you forget which
fingerprint the laptop is configured for.

What this is **not**: a replacement for the password. Passkeys can be
lost (laptop dies, factory reset, biometric registration purged). The
password is the recovery path that's always in your head.

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
- **Hardware-key support** as a separate factor for users who want
  it (YubiKey on a shared dev machine, etc.).

### 2.3 What this does NOT change

- **Anything about the unlocked state.** Once unlocked, the master key
  is in JS memory; same caveats as v1.
- **The "no recovery" promise.** If the user forgets the password
  *and* loses every device with a registered passkey, the data is
  gone. Adding factors raises the bar for permanent loss but does not
  remove it.

### 2.4 What this introduces (be honest)

- **Synced passkeys** (iCloud Keychain, Google Password Manager) move
  the secret across devices linked to the user's cloud account. That's
  a feature for the user but a fact worth noting in the Privacy copy:
  "If your passkey syncs via iCloud / Google, anyone with that account
  can register a new device and unlock burnmark."
- **Passkey theft** is a real risk for hardware keys without a PIN —
  the Privacy copy should encourage PIN protection on hardware keys.
- **Browser/authenticator quirks.** PRF support is uneven (see §6.4).
  We must hide the feature on unsupported configurations rather than
  registering a passkey that can't actually unlock anything.

### 2.5 Non-goals

- **Passwordless setup.** First-time encryption setup still requires a
  password, period. Passkey is added *after* setup, on top.
- **WebAuthn for second-factor / 2FA.** burnmark has no server and no
  account — there's nothing to 2FA against. Passkey replaces password
  *for unlock*, not in addition to it.
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
random MK ──wrap──┤
   (256 bits)      ├─ KEK_passkey_A = PRF(authenticator A, salt_A)
                    └─ KEK_passkey_B = PRF(authenticator B, salt_B)
```

`MK` is generated once (at first setup) and never changes. Each
unlock factor produces a `KEK` that wraps MK with AES-KW (or
AES-GCM, if AES-KW isn't convenient). Unlock = pick any factor,
derive its KEK, unwrap MK.

This makes every operation cheap:

| Operation | v1 cost | v2 cost |
|---|---|---|
| Change password | Re-encrypt every record | Re-wrap MK once |
| Add passkey | n/a | Wrap MK once, append |
| Remove passkey | n/a | Filter the wraps list |
| Disable encryption | Decrypt every record | (unchanged from v1 — still walks records) |

The on-disk record envelope shape is *unchanged*. Records continue
to use AES-GCM under MK. Only the meta-store layout changes.

---

## 4. Storage Layout (meta keys)

Replaces the v1 trio (`enc.salt`, `enc.kdfParams`, `enc.verifier`)
with a single typed list:

| Key | Type | Purpose |
|---|---|---|
| `enc.enabled` | `boolean` | Master flag (unchanged). |
| `enc.format` | `1 \| 2` | Storage format version. v1 = direct-derive; v2 = wrapped. New setups always v2; v1 stores get migrated on first passkey add. |
| `enc.wraps` | `WrapRecord[]` | One entry per registered factor. |
| `enc.verifier` | `Envelope` | Verifier (encrypted under MK, not KEK). Lets us reject a wrong unwrap result without trying a record decrypt. |
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
      friendlyName: string;      // user-set: "Touch ID on this Mac"
      prfSalt: Uint8Array;       // 32 bytes, per-passkey
      addedAt: string;           // ISO timestamp for the listing UI
      wrappedMk: Envelope;       // AES-GCM wrap of MK under KEK_passkey
    };
```

There is always exactly **one** `kind: 'password'` wrap (the
canonical fallback). There can be zero or more `kind: 'passkey'`
wraps.

---

## 5. Setup Flows

### 5.1 First-time encryption setup (new users)

Identical UI to v1 §4.1 — same warnings, same password+confirm.
Internally:

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

The user sees the same flow as v1. The internal layout is just the
new shape from day one.

### 5.2 Adding a passkey to an existing setup

New section on Privacy ("Devices that can unlock burnmark"). Visible
only when:
- Encryption is enabled.
- The browser supports the PRF extension (capability detect; see §6.4).

Flow:

1. **Confirm with password.** Required so we can unwrap MK on this
   device, *and* to give us a clean upgrade path from v1 (see §5.4).
2. **Name this passkey.** Free-text input, default `"This {browser}
   on {OS}"` derived from `navigator.userAgent` parsing. The user
   can rename later.
3. **Register the credential.** Call `navigator.credentials.create`
   with:
   ```ts
   {
     publicKey: {
       rp: { id: location.hostname, name: 'burnmark' },
       user: { id: <random 32 bytes>, name: 'local', displayName: 'burnmark' },
       challenge: <random 32 bytes>,
       pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
       authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
       extensions: { prf: {} },  // request PRF capability
     }
   }
   ```
4. **Verify PRF actually works.** The browser returns
   `getClientExtensionResults().prf.enabled`. If it's not `true`, the
   authenticator doesn't support hmac-secret — surface "This device's
   authenticator can't be used here. Try a different one." and abort.
   Don't store the credential.
5. **Evaluate PRF for the first time.** Immediately follow registration
   with a `navigator.credentials.get` call passing `prf: { eval: { first: prfSalt } }`,
   so we can derive `KEK_passkey` and wrap MK *without* leaving the user
   at a registered-but-unusable state. A registered credential whose
   PRF eval failed is dead weight.
6. **Wrap MK under KEK_passkey**, append to `enc.wraps`, save.

### 5.3 Removing a passkey

Single button per row in the Privacy "Devices" list. Confirms
("Remove this passkey? You'll need your password — or another
registered passkey — to unlock from now on."), then filters the
wrap out of `enc.wraps`. No password confirmation required because
removing a wrap is non-destructive — the data stays reachable via
the password (and any other passkeys).

The password wrap can never be removed (it's the canonical recovery
path). Hide its delete button entirely.

### 5.4 Migrating an existing v1 store (auto, on first passkey add)

Triggered the moment a user with `enc.format = 1` clicks "Add a
passkey." They've just confirmed their password (§5.2 step 1), so we
have access to the v1 KEK (which is also the MK in v1).

1. Derive the v1 KEK from the entered password (using v1 salt + KDF).
2. Unwrap... wait, in v1 there's no wrap — KEK *is* MK directly. So:
   - Generate a *new* random MK_v2.
   - Migrate every record: decrypt under v1 MK, re-encrypt under MK_v2.
   - This is the same record-walk as v1's migrate, bounded by ≤10
     designs / ≤10 datasets / N assets.
3. Build the v2 password wrap: derive KEK_pw from the (same) password
   with a fresh salt, wrap MK_v2.
4. Build the passkey wrap (registration flow §5.2 steps 3–6).
5. Persist: `enc.format = 2`, `enc.wraps = [password_wrap, passkey_wrap]`,
   new verifier under MK_v2.
6. Delete the v1 fields: `enc.salt`, `enc.kdfParams`, old `enc.verifier`.

This is the only one-time cost in the entire amendment. Bounded,
done atomically (under `enc.migrating`), recoverable from a crash
the same way v1 setup is.

### 5.5 Change password (v2)

Replaces the v1 record-walk entirely:
1. Verify old password (unwrap MK using the existing password wrap).
2. Derive new `KEK_pw` from new password + fresh salt.
3. Re-wrap MK under the new KEK_pw, replace the password wrap entry.
4. (Records and passkey wraps untouched.)

Three IDB writes total. Sub-second.

### 5.6 Disable encryption

Mostly unchanged from v1: walk every record, decrypt under MK, write
plaintext, then delete `enc.*` meta. The wraps list goes away with
the rest.

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
│   │ 🔐  Use Touch ID          │ │   ← if any passkey registered
│   └───────────────────────────┘ │       AND PRF supported here
│                                 │
│   ─────  or use password  ───── │
│                                 │
│   Password  [...............]   │
│   [        Unlock        ]      │
│                                 │
│   Forgot password? Reset all    │
└─────────────────────────────────┘
```

If no passkeys are registered, or the browser doesn't support PRF,
the "Use Touch ID" button isn't rendered — the screen looks
identical to v1.

The button label is dynamic:
- Single passkey, friendly name "Touch ID on this Mac" → button reads
  *"Use Touch ID"*
- Single passkey, generic name → *"Use registered passkey"*
- Multiple passkeys → *"Use a registered passkey"* (browser picker
  handles selection)

### 6.2 Passkey unlock — what happens

1. Call `navigator.credentials.get` with:
   ```ts
   {
     publicKey: {
       challenge: <random 32 bytes>,
       allowCredentials: enc.wraps
         .filter(w => w.kind === 'passkey')
         .map(w => ({ type: 'public-key', id: w.credentialId })),
       userVerification: 'preferred',
       extensions: { prf: { eval: { first: <prfSalt of the matched wrap> } } },
     }
   }
   ```
   Subtle: `prf.eval.first` has to match the salt for the *specific*
   credential the user picks. Since we don't know which one until they
   pick, the cleanest pattern is: pass the same salt for all (a single
   app-wide `enc.prfSalt`) — but then if salts differ across wraps
   (e.g., from old registrations) we fall back to running the call
   without `prf.eval`, then a second call once we know the credential
   ID. For v2, we use **one app-wide PRF salt** stored in
   `meta.enc.prfSalt`. Each wrap still records it for forward-compat,
   but registrations always use the app-wide value.
2. Read `getClientExtensionResults().prf.results.first` (32 bytes).
   Import as AES-GCM-256 key → `KEK_passkey`.
3. Find the wrap matching the returned `credential.id`. Unwrap MK.
4. Verify MK against `enc.verifier` (same mechanism as v1, just
   keyed under MK instead of the password-derived key).
5. On success → register MK as the active storage key, hydrate stores,
   show the editor.

### 6.3 Password unlock — what happens

Mostly v1 logic, adjusted for the wrap layer:
1. Derive `KEK_pw` from password + the password wrap's salt/kdf.
2. Unwrap MK from the password wrap.
3. Verify against `enc.verifier`.
4. Same as 6.2 step 5.

### 6.4 Capability detection

Three conditions must hold to offer passkey unlock:

1. **Browser supports WebAuthn** — `typeof window.PublicKeyCredential !== 'undefined'`.
2. **Browser supports PRF** — best-effort detection via:
   ```ts
   const caps = await PublicKeyCredential.getClientCapabilities?.();
   const prfSupported = caps?.['extension:prf'] === true;
   ```
   Falls back to "feature-detect at registration time" — register
   succeeds but PRF eval result is missing → treat that authenticator
   as unsupported (registration is rolled back per §5.2 step 4).
3. **At least one passkey is registered for this profile** —
   `enc.wraps.some(w => w.kind === 'passkey')`.

When any of these fails on the unlock screen, the passkey button is
hidden. The Privacy "Add passkey" button is hidden when the first
two fail.

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
  │ 🔑 This password (always)                    │
  ├──────────────────────────────────────────────┤
  │ 👆 Touch ID on this Mac      Added Apr 26    │
  │                                  [Remove]    │
  ├──────────────────────────────────────────────┤
  │ 🔐 YubiKey 5 NFC             Added Apr 27    │
  │                                  [Remove]    │
  └──────────────────────────────────────────────┘
  [+ Add a passkey for this device]
```

Notes:
- The password row is non-removable (no Remove button).
- "Add a passkey" button hides when the browser doesn't support PRF;
  in its place we show a small disabled note: "This browser doesn't
  support adding passkeys for unlock."
- Honesty footnote near the section: *"Passkeys synced via iCloud or
  Google Password Manager carry across the devices linked to that
  account. Use a hardware key if you want one device only."*

---

## 8. File Changes

| File | Change |
|---|---|
| `src/services/webauthn.ts` | **New.** Capability detect, register, authenticate (with PRF), credential ID handling. ~150 LOC. |
| `src/services/crypto.ts` | Add `wrapKey` / `unwrapKey` helpers (AES-GCM wrap of a 32-byte raw key). Add `importPrfKey` (32 bytes → AES-GCM CryptoKey). |
| `src/services/storage.ts` | No public-API change; the meta keys it stores grow but it's still just `getMeta`/`setMeta` calls. |
| `src/stores/crypto.ts` | Significant: introduce wrapped-MK model. New methods: `addPasskey(password, friendlyName)`, `removePasskey(credentialId)`, `unlockWithPasskey()`. Existing `setupEncryption` / `unlock` / `changePassword` / `disableEncryption` adjusted to operate on wraps. v1→v2 migration on first passkey add. |
| `src/components/common/UnlockScreen.vue` | Conditionally render "Use Touch ID / passkey" button above the password field. |
| `src/components/common/PrivacyDialog.vue` | New "Devices that can unlock burnmark" sub-section with list + Add/Remove. |
| `src/components/common/AddPasskeyDialog.vue` | **New.** Confirm-with-password + name-the-passkey + run-registration. |
| `src/i18n/locales/en.json`, `nl.json` | New `passkey.*` namespace: button labels, list headings, error messages, capability-not-supported note. |

---

## 9. Test Plan

| Area | Approach |
|---|---|
| `services/__tests__/crypto.test.ts` | Add wrap/unwrap-key round-trip, importPrfKey, MK randomness. |
| `services/__tests__/webauthn.test.ts` | **New.** Mock `navigator.credentials.create` / `get`. Test the registration → PRF-eval → wrap path with a synthetic 32-byte PRF result. Test the unlock path: matching credentialId → unwrap → MK. |
| `stores/__tests__/crypto.test.ts` | Add: addPasskey appends a wrap; removePasskey filters; password and passkey both unlock the same MK; v1 → v2 migration on first passkey add preserves all records. |
| Capability detection | Unit-test the gating logic in isolation — mocked `PublicKeyCredential.getClientCapabilities`. |
| Manual QA matrix | Touch ID Mac (Chrome + Safari), Windows Hello (Edge + Chrome + Firefox), Android Chrome with platform authenticator, YubiKey 5 with hmac-secret on Chrome/Firefox/Safari. The honest set — full coverage isn't possible without the hardware. |

WebAuthn isn't exercisable in jsdom. Integration confidence comes from
the manual matrix; unit tests cover the wrap/unwrap glue around a
mocked WebAuthn surface.

---

## 10. Open Questions

1. **One PRF salt or one per credential?** §6.2 picks app-wide for
   simplicity. Per-credential is more "rotate-friendly" but no real
   threat model demands it for a local-only app. Sticking with
   app-wide unless a concrete reason emerges.

2. **AES-KW vs AES-GCM for wrapping MK.** AES-KW is the by-the-book
   key-wrap primitive but it's not exposed via Web Crypto in all
   browsers consistently. AES-GCM with a fresh IV per wrap gives
   equivalent security and zero compatibility surprises.
   Recommendation: **AES-GCM**.

3. **Should we allow `userVerification: 'required'` instead of
   `'preferred'`?** Required forces a biometric/PIN on every unlock,
   no silent passkey use. Preferred lets the OS skip if it just did
   one a moment ago. For an encryption-unlock flow, required is the
   honest default — *every* unlock should require user presence.
   Switch to `'required'` for v2.

4. **Passkey conditional UI / autofill.** Browsers expose
   `mediation: 'conditional'` for passkey-on-form-focus suggestions.
   It's polish; not load-bearing. Defer.

5. **PWA install caveat.** When burnmark is installed as a PWA, the
   passkey is bound to the same origin and works across both the PWA
   shell and a regular browser tab on the same profile. No extra
   handling needed — call this out in the manual QA so we're sure.

6. **What about the conditional `userVerification: 'discouraged'`
   path** (silent unlock without biometric prompt, just hardware
   presence)? Tempting for the "frictionless" goal but defeats the
   threat model — a roommate plugged into the user's USB port could
   silent-unlock with the YubiKey. Recommendation: **don't ship**.

---

## 11. Out of Scope

- **Passwordless setup.** First-time setup still prompts for a
  password (§2.5).
- **Server-side passkey escrow / cross-device QR sync.** No server.
- **Per-record passkey scoping** (different passkeys unlock different
  designs). The threat model doesn't ask for it; complexity is steep.
- **Recovery codes.** Could be a third wrap kind (`kind: 'recovery'`,
  KEK derived from a printable BIP39-like phrase). Worth considering
  in a v3 amendment if forgot-password / lost-device support requests
  start coming in.
- **Encryption of the `.label` / `.zip` exports under a passkey-derived
  key.** Same reason as v1 §10 — exports are meant to be portable.

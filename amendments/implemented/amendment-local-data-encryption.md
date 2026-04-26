# Amendment — Local Data Encryption

> **Amends:** `PLAN.md` §10 (Storage), and adds a new chrome surface
> ("Privacy" footer link) parallel to About/Help.
> **Companion to:** `PROGRESS.md`, `DECISIONS.md`.
>
> One sentence: ship an **opt-in, password-based encryption** for the
> data the app keeps on the user's device — designs, datasets, assets,
> and the column-mapper cache — fronted by a footer "Privacy" page that
> explains the storage model honestly, shows the user what they have,
> and offers a one-click reset. Password gone = data gone. No recovery,
> no hint, no second factor.
>
> **Pure label-maker scope.** Designer-core and the share/import
> formats are unchanged. Encryption is an outer wrap around
> [storage.ts](src/services/storage.ts) values; nothing about the
> document model changes.

---

## 1. The Problem

burnmark runs entirely on the user's device. That's a feature — no
account, no server, your data never leaves the browser. But "on your
device" includes the cases where the *device* isn't really yours:

- A shared family PC where everyone uses the same browser profile.
- A library or coworking machine where someone forgets to log out of
  the OS user.
- A laptop that gets borrowed for ten minutes.
- A future "ugh, I should clear my labels off this old machine"
  moment, where the user wants confidence that whatever they typed
  is gone.

Today, anyone with access to the running browser can open
[library.ts:62-69](src/stores/library.ts#L62-L69) territory by simply
opening the app — every saved design, every dataset, every imported
address list is one click away. DevTools makes it worse: the IDB
contents are visible verbatim.

The fix is opt-in encryption-at-rest with a user-set password. The
threat model is *casual access on a shared device*, not *malware on a
compromised machine*, and the UX should make that distinction loud.

---

## 2. Scope and Threat Model

### 2.1 What this protects

- **The IndexedDB contents.** A second user on the same browser
  profile, opening DevTools or Application → IndexedDB, sees ciphertext
  blobs instead of label JSON, dataset rows, or asset bytes.
- **A copied browser profile.** Same story — the on-disk IDB is
  ciphertext, useless without the password.
- **Casual snooping** generally — the kind where someone clicks
  around the running app expecting it to just open.

### 2.2 What this does NOT protect

These must be stated plainly in the Privacy page so users don't
over-trust the feature:

- **Anything that happens while the app is unlocked.** The decryption
  key lives in JS memory for the session. A concurrent attacker on the
  same OS user who can run code in the tab can read everything.
- **Malware / keyloggers** on the host — they capture the password
  on entry.
- **The other browser tab the user already had unlocked.** Locking
  the app re-prompts in *new* tabs and on next session, not retroactively
  in already-open ones.
- **Data the user has exported.** `.label`, `.zip`, share-link hashes
  are plaintext by design; encryption stops at the IDB boundary.

### 2.3 Non-goals

- **Recovery.** No password hint, no recovery questions, no key
  escrow, no "email me a reset link." There is no server.
- **Server-side anything.** burnmark stays no-account.
- **Per-document encryption.** One password for the whole local
  store. Adding per-design granularity is feature creep against the
  threat model.
- **Encrypting localStorage UI prefs** (`burnmark.showGrid`,
  `burnmark.locale`, etc.). They aren't sensitive and need to be
  readable *before* unlock so the lock screen renders in the user's
  language.

---

## 3. Privacy Page

A new footer link, between Help and GitHub:

```
About · Help · Privacy · GitHub
```

The page is a modal — same shell as
[AboutDialog.vue](src/components/common/AboutDialog.vue) and
[HelpDialog.vue](src/components/common/HelpDialog.vue), wired through
[useUiDialogs.ts](src/composables/useUiDialogs.ts) with a new
`privacyOpen` flag and `openPrivacy()` action.

### 3.1 Sections (top to bottom)

1. **How burnmark stores your data.** Two short paragraphs.
   Browser-local; never sent anywhere; persists across sessions until
   the user (or browser) clears it. Link to MDN's "[Clear site
   data](https://developer.mozilla.org/en-US/docs/Web/Privacy/Storage_Access_Policy/Storage_quotas)"
   docs and a per-browser cheat-sheet (Chrome / Firefox / Safari) for
   the "I want this off this machine *now*" case.

2. **What you have on this device.** Live counters read from the
   stores after hydration:
   - Saved labels: `library.entries.length` / `MAX_SLOTS`
   - Datasets: `datasets.length` / `DATASET_LIMIT`
   - Image assets: new `countAssets()` helper in
     [storage.ts](src/services/storage.ts) (`db.count('assets')`)
   - Approx. storage used: `navigator.storage.estimate().usage` —
     formatted as MB. Hide the row if the API isn't available.

3. **Encryption.** Two states:
   - **Off (default):** "Set up a password" CTA, with the warnings
     panel inline (see §4.1). Below: "Why might I want this?" → one
     paragraph naming the shared-PC case explicitly.
   - **On:** "Encryption is enabled." Buttons: **Change password**,
     **Turn off encryption** (decrypts back to plaintext). Each routes
     through a confirmation flow.

4. **Reset all my data.** Destructive button, red. Confirmation
   dialog with a typed-confirmation field (`type "delete" to confirm`).
   Wipes the entire `burnmark` IDB and every `burnmark.*`
   localStorage key. Reloads the app to a clean state.

### 3.2 Non-modal hooks

The privacy link is *only* in the footer. We don't surface it in the
top bar or the side panel — it's a deliberate "go look for it" feature,
matching the user's "hidden in a menu" framing.

---

## 4. Encryption Setup Flow

Triggered from the Privacy page CTA. A second modal (or a routed step
inside the privacy modal — implementation detail).

### 4.1 The setup form

```
┌────────────────────────────────────────────────────────┐
│  Encrypt your local data                               │
│                                                        │
│  ⚠  If you forget this password, your designs and      │
│     datasets are unrecoverable. There is no reset,     │
│     no recovery, no hint. We do not have a copy.       │
│                                                        │
│  ⚠  This protects your data when someone else uses     │
│     this browser. It does NOT protect against malware  │
│     or anyone using this app while it's unlocked.      │
│                                                        │
│  Password         [................]                   │
│  Confirm          [................]                   │
│                                                        │
│  ☐ I understand my data is gone if I lose this password│
│                                                        │
│         [ Cancel ]    [ Encrypt my data ]              │
└────────────────────────────────────────────────────────┘
```

The "Encrypt my data" button is disabled until:
- Both fields are non-empty and equal.
- The "I understand" checkbox is ticked.
- The password meets a minimum length (8 chars). No complexity
  rules — they push users to write the password down somewhere worse.

### 4.2 What happens on submit

1. Generate a random 16-byte salt; store in `meta` under `enc.salt`.
2. Derive a 256-bit key with PBKDF2-SHA-256, 600k iterations
   (OWASP 2023 baseline). Iteration count lives in
   `meta.enc.kdfParams` so we can raise it later without breaking old
   stores.
3. Encrypt a known verifier plaintext (`"burnmark.verifier.v1"`)
   with AES-GCM-256, fresh 12-byte IV, store under `meta.enc.verifier`
   as `{ iv, ciphertext }`.
4. **Re-encrypt every existing record** in `designs`, `datasets`,
   `assets`, plus the `burnmark.columnMapper` localStorage key (see
   §6.3). Each record gets its own random IV.
5. Set `meta.enc.enabled = true` *last*. If we crash between steps 4
   and 5, boot logic detects the partial state (records are
   ciphertext but flag is false) and offers a recovery prompt —
   "Looks like encryption setup didn't finish. Enter the password to
   complete it, or reset all data." See §7.4.
6. Hold the derived key in the `cryptoStore` (Pinia, see §6.1) for
   the rest of the session. No need to re-prompt right after setup.

The migration runs inside an IDB transaction per store. Designs are
already JSON strings ([storage.ts:153](src/services/storage.ts#L153))
so the wrap is text-in / text-out. Datasets and assets need a
serialize step (`JSON.stringify` for datasets, pass-through for
`Uint8Array` assets).

---

## 5. Unlock Flow

### 5.1 Boot sequence change

[main.ts](src/main.ts) (or wherever `useDataStore().hydrate()` lives —
mentioned in [data.ts:594-597](src/stores/data.ts#L594-L597)) gains a
gate **before** any store hydration:

```
boot:
  1. open IDB, read meta.enc.enabled
  2. if false: hydrate stores normally → render app
  3. if true:  render <UnlockScreen /> only; defer all hydration
               until unlock succeeds
```

Why fully gate the app: stores cache plaintext in memory after
hydration. If we let the app boot and then asked for the password
later, we'd either (a) hydrate to ciphertext garbage (bugs), or
(b) hydrate to nothing and confuse users with an empty library that
"isn't really empty." Gating is simpler and matches the user's
mental model ("locked = locked").

### 5.2 The unlock screen

Full-viewport, branded but minimal. Logo, "Unlock burnmark",
password field, Unlock button. A small "Forgot password? → Reset all
data" escape hatch routes to the same destructive reset as the
Privacy page (§3.1 step 4).

On submit:
1. Read salt + verifier from `meta`.
2. Derive key via PBKDF2 with the stored params.
3. Try to decrypt the verifier. Success → put key in
   `cryptoStore.key`, run normal hydration, render app. Failure →
   show "Wrong password" and re-enable the form. No lockout, no
   rate-limit beyond what PBKDF2 already imposes (~0.5–1s per attempt
   at 600k iters on a modern laptop).

### 5.3 Re-locking

For v1, the only way to re-lock is to reload the tab. We don't ship
an explicit lock button; it adds chrome for a use case that's already
served by Cmd/Ctrl+R. Revisit if users ask.

---

## 6. Architecture

### 6.1 New module: `services/crypto.ts`

Thin wrapper over `crypto.subtle`. No third-party crypto deps.

```ts
export interface KdfParams { iterations: number; hash: 'SHA-256'; }
export const DEFAULT_KDF: KdfParams = { iterations: 600_000, hash: 'SHA-256' };

export async function deriveKey(password: string, salt: Uint8Array, kdf: KdfParams): Promise<CryptoKey>;
export async function encrypt(key: CryptoKey, plaintext: Uint8Array): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }>;
export async function decrypt(key: CryptoKey, iv: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array>;

export function newSalt(): Uint8Array;  // crypto.getRandomValues(new Uint8Array(16))
export function newIv(): Uint8Array;    // crypto.getRandomValues(new Uint8Array(12))
```

Plus tiny `encryptString` / `decryptString` helpers that go through
`TextEncoder` / `TextDecoder` for the JSON-string path.

### 6.2 New store: `stores/crypto.ts`

```ts
useCryptoStore = defineStore('crypto', () => {
  const enabled = ref(false);          // mirrors meta.enc.enabled
  const key = ref<CryptoKey | null>(null);
  const locked = computed(() => enabled.value && key.value === null);
  // setupEncryption(password)
  // unlock(password) → boolean
  // changePassword(oldPw, newPw)
  // disableEncryption(password)
});
```

The store does *not* hold the password — only the derived key. The
password string is dropped from the call site immediately after
derivation.

### 6.3 Wrapping the storage layer

Every value-bearing function in
[storage.ts](src/services/storage.ts) routes through a new internal
`wrapValue` / `unwrapValue` pair that is a no-op when
`!cryptoStore.enabled`, and an AES-GCM round-trip when enabled.

Stored shape under encryption (per record):

```ts
// designs (was: { ...summary, json: string })
{ ...summary, ciphertext: Uint8Array, iv: Uint8Array, encVer: 1 }

// datasets (was: StoredDataset object)
// → wrap the whole object as JSON, store under one envelope:
{ id, ciphertext: Uint8Array, iv: Uint8Array, encVer: 1 }
//   ^ id stays in the clear so summaries/listing work

// assets (was: Uint8Array)
{ ciphertext: Uint8Array, iv: Uint8Array, encVer: 1 }
```

Note that **listing semantics change** for `designs` and `datasets`
when encrypted: the design summary fields (`name`, `updatedAt`,
`canvasWidth`, etc.) currently sit in the clear in the IDB record so
the library can render thumbnails without loading every JSON. Under
encryption, those fields leak — names like "Tax filings" and "Aunt
Carla's address list" defeat the point.

**Decision:** when encryption is on, the design summary shape collapses
to `{ id, ciphertext, iv, encVer }` — `listDesignSummaries()` decrypts
the envelope to read names/timestamps/thumbnails. This is more work at
boot (N decrypts where N ≤ 10) but worth it. Costs ~1ms per record
after key derivation; total <50ms at the slot ceiling.

The `burnmark.columnMapper` localStorage entry (set by
[column-mapper.ts:14](src/services/column-mapper.ts#L14)) stores
header names that may also be sensitive. When encryption is on,
column-mapper writes ciphertext to that key (base64-encoded since
localStorage is string-only). Reads decrypt on the way out.

### 6.4 Meta keys (clear, never encrypted)

| Key | Type | Purpose |
|---|---|---|
| `enc.enabled` | `boolean` | Master flag. Read pre-hydration. |
| `enc.salt` | `Uint8Array` | KDF salt. 16 bytes. |
| `enc.kdfParams` | `KdfParams` | Iteration count + hash. Allows future raise. |
| `enc.verifier` | `{ iv, ciphertext }` | Detects wrong password. |
| `enc.encVer` | `number` | Envelope schema version. Currently `1`. |

### 6.5 Change password

Same machinery as setup, applied as a re-encrypt:

1. Verify the old password (decrypt verifier).
2. Derive new key from new password + a *new* salt.
3. Stream every record: decrypt with old key → encrypt with new key
   → put back. New IV per record.
4. Replace `enc.salt`, `enc.verifier`. Bump nothing else.
5. Swap `cryptoStore.key`.

Same crash-safety story as setup: detect inconsistency on next boot
(verifier doesn't decrypt with either key? — flag a recovery state
and offer reset).

### 6.6 Disable encryption

Decrypt every record back to its plaintext shape, set
`enc.enabled = false`, delete `enc.salt` / `enc.verifier` /
`enc.kdfParams`. Same in-place rewrite pattern.

The user's question floated "or point at export/import for new
pass / decrypt?" — we don't take that route. In-place re-encryption
is well-bounded (≤10 designs, ≤10 datasets, finite assets) and saves
the user from a brittle export-import dance. Export/import stays as
the *escape hatch* if the in-place flow ever fails (the recovery
prompt mentions it).

---

## 7. File Changes

| File | Change |
|---|---|
| `src/services/crypto.ts` | **New.** Web Crypto wrapper (§6.1). |
| `src/services/storage.ts` | Wrap value paths via `cryptoStore`; gain `countAssets()`; envelope schema. See §6.3–6.4. |
| `src/services/column-mapper.ts` | Encrypt the localStorage payload when encryption is on. |
| `src/stores/crypto.ts` | **New.** Session key state, setup/unlock/change/disable methods (§6.2). |
| `src/stores/library.ts` | Awaits crypto-aware `listDesignSummaries`; no API change. |
| `src/stores/data.ts` | Same — hydration goes through wrapped storage; no API change. |
| `src/main.ts` | Boot gate (§5.1): read `enc.enabled` before any store hydration. |
| `src/components/common/PrivacyDialog.vue` | **New.** §3 page. |
| `src/components/common/EncryptionSetup.vue` | **New.** §4 setup form. |
| `src/components/common/UnlockScreen.vue` | **New.** §5.2 lock screen. |
| `src/components/common/ResetDataDialog.vue` | **New.** Typed-confirmation reset (§3.1 step 4). |
| `src/composables/useUiDialogs.ts` | Add `privacyOpen` + `openPrivacy()`. |
| `src/components/layout/AppFooter.vue` | Insert "Privacy" link between Help and GitHub. |
| `src/components/layout/AppShell.vue` | Mount `<PrivacyDialog />` and (when locked) `<UnlockScreen />` outside the normal layout. |
| `src/i18n/locales/en.json`, `nl.json` | New `privacy.*` namespace: page copy, warnings, button labels. |

---

## 8. Test Plan

| Suite | Cases |
|---|---|
| `services/__tests__/crypto.test.ts` | Round-trip encrypt/decrypt; wrong key fails; IV uniqueness; verifier mechanism; KDF iteration count honored. |
| `services/__tests__/storage.test.ts` (extend) | Plain mode unchanged (regression); enabled mode: encrypted record shape, listing decrypts envelopes, asset bytes round-trip. |
| `stores/__tests__/crypto.test.ts` | **New.** setup → enabled, unlock(wrong) → false, unlock(right) → true, changePassword preserves data, disableEncryption returns plaintext records. |
| Boot integration | `enc.enabled = true` blocks hydration until unlock; `enc.enabled = false` boots normally; partial-setup state surfaces recovery prompt. |
| E2E (manual checklist) | Set up encryption with two designs and two datasets present; reload tab → unlock screen; wrong pw rejected; right pw → app boots with same library; change pw → still works after reload; disable → records are plaintext in DevTools again; reset all → clean state. |

happy-dom (or jsdom) supports `crypto.subtle` natively in recent
versions — no polyfill needed for the unit suite. The existing tests
use `fake-indexeddb` ([data.ts:597](src/stores/data.ts#L597)
references it), which is unaffected.

---

## 9. Open Questions

1. **PBKDF2 vs Argon2id.** PBKDF2 is built-in, Argon2id requires a
   WASM dep. PBKDF2 at 600k SHA-256 is OWASP-blessed and good enough
   for our threat model — recommendation is to stick with it and
   revisit only if the threat model widens.

2. **Idle re-lock.** Should the app auto-relock after N minutes of
   inactivity? Skipped for v1 — the threat model is "someone else
   uses this browser later," which is solved by tab close + reload.
   Revisit if users ask.

3. **PWA install.** No special handling — same browser profile, same
   IDB, same encryption flag. The PWA shell goes through the same
   boot gate.

4. **Multi-tab during setup.** If tab A is mid-migration and tab B
   reloads, B sees a partial state. The recovery prompt (§4.2 step
   5) handles it. Migration is fast enough (≤10 designs, ≤10
   datasets) that the window is small; we accept it.

5. **Sample label on locked boot.** [sample-label.ts](src/services/sample-label.ts)
   is auto-loaded on first boot. Suppressed under the locked state —
   the unlock screen is the only thing that renders. After unlock,
   boot proceeds normally and the sample loads if the library is
   empty (existing behavior).

---

## 10. Out of Scope

- Encrypting `.label` / `.zip` exports. They're meant to be portable;
  encrypting them shifts the password problem to the receiver.
- Encrypting share-link payloads. Share links are explicitly opt-in
  outbound sharing — encryption defeats the point.
- Per-design passwords or multi-user vaults.
- Cloud sync of encrypted blobs. (Could be added later as a separate
  amendment without changing the local format.)
- Biometric/WebAuthn unlock. Possible v2; needs a key-wrapping
  scheme on top of the password-derived key.

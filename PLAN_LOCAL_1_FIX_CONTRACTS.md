# Plan Local-1 — Fix breakage from local-linked contracts/transport/drivers

> **Status:** Draft. Source of truth for the inventory is the `pnpm typecheck`
> output against `link:` deps as of 2026-05-03.
>
> **Goal:** restore green typecheck/build against locally-linked
> `@thermal-label/*` and `@burnmark-io/*` packages with no functional
> regression. Engine-aware UI and multi-printer work live in Plan Local-2;
> support-status CTAs in Plan Local-3.

---

## 0. Inventory (verified)

`pnpm typecheck` produces exactly six errors after `link:` swap and rebuild
of every sibling package:

| #   | File:Line                                                      | Root cause                                                                                                                                                                                        |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `../designer-core/packages/core/src/render/barcode.ts:104,145` | `bwip-js` not resolved when vue-tsc walks designer-core source via `link:`. designer-core's `package.json` points `types` at `./src/index.ts`, so consumers compile its source. **External fix.** |
| 2   | `src/lib/printer/drivers.ts:52`                                | `BROTHER_DEVICES.QL_820NWB` renamed to `QL_820NWBc` in brother-ql-core.                                                                                                                           |
| 3   | `src/lib/printer/registry.ts:11,17,29`                         | `DeviceDescriptor` removed from `@thermal-label/contracts`; replacement is `DeviceEntry` with a different shape.                                                                                  |
| 4   | `src/stores/printer.ts:129`                                    | `device.vid` / `device.pid` no longer top-level on `DeviceEntry`. New location: `device.transports.usb?.{vid,pid}`, **and stored as hex strings** (`'0x0922'`, not `2338`).                       |

Untyped follow-ons (will surface as the typed errors are fixed):

- `src/lib/printer/__tests__/registry.test.ts:12,18,24` calls
  `identifyByVidPid(0x04f9, 0x20a7)` etc. Function survives but its
  underlying lookup must read the new shape.
- `src/composables/__tests__/useAutoReconnect.test.ts:35-61` builds a
  fake `PrinterAdapter`. The interface added an optional `device?:
DeviceEntry` field — already optional, nothing to update unless we
  decide to exercise the device-aware path in tests.

`MediaDescriptor` is **additive** in the new contracts (new optional
fields: `printMargins`, `cornerRadiusMm`, `skus`, `category`,
`targetModels`, `palette` typed as `readonly PaletteEntry[]`). Nothing
to fix; new affordances are picked up in Plan Local-3 §3.

---

## 1. Phase 1 — Unblock typecheck under `link:`

Two paths exist. Pick **1A** for a permanent fix; **1B** is the in-repo
stopgap if upstream landing has to wait.

### 1A. Upstream fix in designer-core (recommended)

`/home/mannes/burnmark-io/designer-core/packages/core/package.json`:

```diff
   "exports": {
     ".": {
-      "types": "./src/index.ts",
+      "types": "./dist/index.d.ts",
       "import": "./dist/index.js"
     }
   },
-  "types": "./src/index.ts",
+  "types": "./dist/index.d.ts",
```

Same change for `packages/vue/package.json`. Rationale: `files: ["dist",
"README.md"]` means npm consumers already only see `dist/`. Pointing
`types` at `dist/index.d.ts` makes link: consumers identical to npm
consumers and removes the transitive `bwip-js` resolution. Trade-off:
you must build designer-core for typecheck to reflect source edits
(`tsc -w` in the package solves it).

Apply the same shape (`types: dist/index.d.ts`) to each of the
`*-core` packages whose `exports.types` currently points at `src/`:

- `thermal-label/brother-ql/packages/core`
- `thermal-label/labelmanager/packages/core`
- `thermal-label/labelwriter/packages/core`

This is a **dev-experience** win, not strictly required for the
errors above. Bundle into 1A or skip.

### 1B. In-repo stopgap (only if upstream cannot be touched)

Add `bwip-js` as a direct devDependency of label-maker so the resolver
finds it from designer-core's source location:

```diff
   "devDependencies": {
+    "bwip-js": "^4.0.0",
```

Pure shim — label-maker does not import bwip-js itself. Remove when
1A lands.

---

## 2. Phase 2 — Adapt `registry.ts` to the new device shape

### 2.1 Imports

```diff
-import type { DeviceDescriptor, MediaDescriptor } from '@thermal-label/contracts';
+import type { DeviceEntry, MediaDescriptor } from '@thermal-label/contracts';
```

### 2.2 `RegistryEntry`

```diff
 export interface RegistryEntry {
   family: PrinterFamily;
-  device: DeviceDescriptor;
+  device: DeviceEntry;
 }
```

### 2.3 `ALL_DEVICES` typing falls out automatically — drop the explicit `DeviceDescriptor[]` annotation.

### 2.4 `identifyByVidPid`

The signature stays `(vid: number, pid: number)` so callers don't move.
The body switches to per-driver helpers:

```ts
import { findDevice as findBrother } from '@thermal-label/brother-ql-core';
import { findDevice as findLabelwriter } from '@thermal-label/labelwriter-core';
import { findDevice as findLabelmanager } from '@thermal-label/labelmanager-core';

export function identifyByVidPid(vid: number, pid: number): RegistryEntry | undefined {
  const b = findBrother(vid, pid);
  if (b) return { family: 'brother-ql', device: b };
  const w = findLabelwriter(vid, pid);
  if (w) return { family: 'labelwriter', device: w };
  const m = findLabelmanager(vid, pid);
  if (m) return { family: 'labelmanager', device: m };
  return undefined;
}
```

This is faster (each driver does its own hex-string parse internally)
and survives further hex-vs-number contract changes.

### 2.5 `getAllUsbFilters`

`buildUsbFilters` now takes `readonly DeviceEntry[]` — the existing
`ALL_DEVICES.map(e => e.device)` call passes through cleanly. No code
change after 2.2.

### 2.6 New helper: `identifyByModel`

For Plan Local-2 we'll need `(family, model) → RegistryEntry`. Add it
alongside `identifyByVidPid` so §3 below can stop relying on
VID/PID for lookups.

```ts
export function identifyByModel(family: PrinterFamily, model: string): RegistryEntry | undefined {
  switch (family) {
    case 'brother-ql':
      return findBrotherByModel(model);
    case 'labelwriter':
      return findLabelwriterByModel(model);
    case 'labelmanager':
      return findLabelmanagerByModel(model);
  }
}
```

(Each driver may already export this; if not, fall back to
`Object.values(DEVICES).find(d => d.name === model)` — `DeviceEntry.name`
is the human-readable model.)

---

## 3. Phase 3 — Adapt `stores/printer.ts`

Drop the VID/PID round-trip in `setAdapter`. The adapter already
exposes `family: string` directly, so the lookup is unnecessary:

```diff
   function setAdapter(next: PrinterAdapter | null): void {
     adapter.value = next;
     if (next) {
-      const entry = next.device
-        ? identifyByVidPid(next.device.vid ?? -1, next.device.pid ?? -1)
-        : undefined;
-      const fam: PrinterFamily =
-        (entry?.family as PrinterFamily | undefined) ?? (next.family as PrinterFamily);
+      const fam = next.family as PrinterFamily;
       connection.value = { kind: 'connected', family: fam, model: next.model };
       lastPaired.value = { family: fam, model: next.model };
```

If we want belt-and-braces validation (assert `next.family` is one of
the three known families), wrap with `assertPrinterFamily(next.family)`
that throws — same blast radius, more honest error.

---

## 4. Phase 4 — Driver entry-point rename

`src/lib/printer/drivers.ts:52`:

```diff
-  return new WebBrotherQLPrinter(BROTHER_DEVICES.QL_820NWB, transport);
+  return new WebBrotherQLPrinter(BROTHER_DEVICES.QL_820NWBc, transport);
```

The `c` reflects Brother's silent firmware revision. Update the inline
comment above (lines 49-51) to mention QL-820NWBc explicitly.

---

## 5. Phase 5 — Tests

### 5.1 `src/lib/printer/__tests__/registry.test.ts`

Calls survive (still take VID/PID as numbers). Verify they still
return entries — the `identifyByVidPid(0x0922, 0x0020)` test expects
the QL-820 family; the device key is now `QL_820NWBc`, so any
assertion on `entry.device.key` (if any) needs the rename.

### 5.2 `src/stores/__tests__/printer.test.ts`

The `MockAdapter` extends `PrinterAdapter`. Because `device` is
optional, no required field is added. If any test sets `mockAdapter.device =
{ vid: ..., pid: ... }` (old shape), rewrite as
`{ key, name, family, transports: { usb: { vid: '0x...', pid: '0x...' } }, engines: [{ role: 'primary', protocol, dpi, headDots }], support: { status: 'untested' } }`.

### 5.3 `useAutoReconnect.test.ts`

`makeAdapter()` returns a `PrinterAdapter`-shaped object. No change
unless tests cover the `device`-aware path; verify by running and
patching call-sites if so.

---

## 6. Verification

Run in this order — each must pass before moving to the next:

```bash
pnpm install                                        # link: graph healthy
pnpm typecheck                                      # 0 errors expected
pnpm test                                           # all pass
pnpm dev                                            # smoke: open canvas, connect a printer (real or fake-USB), print a label
pnpm build                                          # vite build green
```

Spot-check in the browser dev tools:

- `printer.adapter.device.transports.usb.vid` is a hex string and
  matches what was paired.
- `printer.adapter.engines` is an array of one engine for every
  currently-supported printer (no Duo/Twin yet — Plan Local-2 covers
  those).

---

## 7. Out-of-scope for this plan

- Engine-aware UI (Plan Local-2 §1).
- Multi-printer connection management (Plan Local-2 §2).
- `resolveSupportedDevices`-driven registry (Plan Local-2 §3).
- Support-status banners and report CTA (Plan Local-3).
- Richer media affordances unlocked by new `MediaDescriptor` fields
  (Plan Local-3 §3).

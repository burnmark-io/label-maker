# Plan Local-2 — Implementation progress log

> Live log of decisions, gates, and commits while executing
> `PLAN_LOCAL_2_MULTI_PRINTER.md`. Append-only; never rewrite history.

## Baseline (pre-Step 1)

- `pnpm typecheck` → clean (silent, exit 0).
- `pnpm test` → 62 files / 698 tests pass.
- Branch: `main`. Working tree clean.

## Step 1 — §0.6 Prerequisite spikes

**Goal:** answer the two questions that can invalidate downstream shape:

1. Per-engine status payload — what does `PrinterStatus` look like and
   does each driver-core's `getStatus()` populate per-engine fields?
2. `PROTOCOLS` export — does each driver-core export
   `PROTOCOLS: ReadonlySet<string>`?

Research only in label-maker. Findings:

### Spike 1 — `PrinterStatus` shape

`@thermal-label/contracts/src/status.ts` defines `PrinterStatus` with a
**chassis-only** `detectedMedia?: MediaDescriptor` field. There is no
`engines?: Record<role, EnginePartialStatus>` field, and `getStatus()`
returns one payload per chassis (no `engine` argument).

Per Plan §0.6 outcome rule: "if the answer is *chassis-only*, ship that
and do **not** backfill per-engine status work in this plan." → no
upstream contract work needed. `EngineSlotState.detectedMedia` will
mirror the chassis `detectedMedia` for single-engine devices and stay
`null` for non-primary slots until a Duo owner asks for better.

### Spike 2 — `PROTOCOLS` export per driver-core

| driver-core         | encoder protocols           | exports `PROTOCOLS`? |
| ------------------- | --------------------------- | -------------------- |
| `brother-ql-core`   | `ql-raster`, `pt-raster`    | NO — must land upstream |
| `labelwriter-core`  | `lw-450`, `lw-550`          | NO — has private `SUPPORTED_PROTOCOLS` in protocol.ts; must land upstream |
| `labelmanager-core` | `d1-tape`                   | NO — must land upstream |

All three need the trivial one-line `export const PROTOCOLS:
ReadonlySet<string>` upstream. Plan §0.6 explicitly authorises this:
"land the trivial PR upstream yourself — it is a one-line export
derived from what `*-web` already imports."

### Decisions

- **labelwriter-core's `d1-tape` engine on the Duo will be `drivable:
  false` in the labelwriter registry resolution.** The labelwriter
  encoder doesn't handle `d1-tape`; that protocol lives in
  labelmanager-core. Per Plan §0.5 ("realistic distribution — nobody
  runs Duo"), this is acceptable. Future work: cross-driver protocol
  registration if a Duo owner ever surfaces.
- Upstream PROTOCOLS exports go in each `index.ts`, not
  `protocol.ts`. Leaving the existing private `SUPPORTED_PROTOCOLS`
  constant in labelwriter-core's `protocol.ts` alone — it's an
  encoder-internal safety net, separate concern.

### Action items before Step 2 — done

- [x] `@thermal-label/brother-ql-core`: commit `f306834` —
  `feat(core): export PROTOCOLS set for resolveSupportedDevices`. Gate:
  138 tests pass.
- [x] `@thermal-label/labelwriter-core`: commit `a88fa68` —
  same, plus note about Duo tape engine living in labelmanager-core.
  Gate: 250 tests pass.
- [x] `@thermal-label/labelmanager-core`: commit `889560e` —
  same. Gate: 16 tests pass.

Step 1 complete. Proceeding to Step 2.

## Step 2 — §3 Adopt `resolveSupportedDevices` in registry

**Goal:** the registry exports per-family `SUPPORTED_*` arrays from
`resolveSupportedDevices(...)` and drops the hand-rolled
`FAMILIES_WITH_*` flags whose only consumers were either tests or
no-op gates (every family was in the set already).

### Decisions

- **`FAMILIES_WITH_DETECTION` and `FAMILIES_WITH_WEB_SERIAL` were
  test-only.** Both deleted; the test that asserted on them is
  replaced with a positive test on `SUPPORTED_BROTHER` confirming the
  QL-820NWBc engine resolves as `drivable: true` with the `ql-raster`
  protocol.
- **`FAMILIES_WITH_STATUS_POLLING` was a no-op gate at the family
  level** (all three families were in the set). Dropped from
  `printer.ts` (`shouldPoll`), `PrinterStatus.vue` (`pillState`), and
  `CanvasActions.vue` (`blockedByError`). `PER_MODEL_STATUS_POLLING_EXCLUSIONS`
  stays — that's the genuine escape hatch.
- **Kept `RegistryEntry` and `identifyByVidPid`** unchanged in
  signature. They feed `connect.ts` and `drivers.ts` which look up by
  VID/PID; switching to `SupportedDevice` cascades into the connect
  path without need. Added `findSupported(family, modelName)` for the
  store's per-engine reads in Step 3.
- **`RUNTIME_TRANSPORTS = ['usb', 'serial']`.** Per-plan §3.1 default;
  Web Serial covers Bluetooth-SPP (the OS pre-pairs it into the
  serial picker on macOS/Linux/Win).

### Gate

- `pnpm typecheck` → clean.
- `pnpm test` → 62 files / 699 tests pass (+1 new
  `findSupported` assertion).

### Note for downstream

The `blockedByError` logic in `CanvasActions.vue` still **disables
the print button** when a thermal status reports an error. Plan §0.5
"rails not walls" says the button should remain clickable and surface
the error on click. Out of scope for Step 2 (registry); flagged for
Step 5 (print path) or Step 4 (UI).

## Step 3 — §2 Store refactor: connections + slots

**Goal:** the printer store owns a `Map<ConnectionId, Connection>`
where each `Connection` has a `slots: Map<role, EngineSlotState>`,
plus an `activeSlot: { connectionId, role } | null` print
destination. Existing single-connection consumers continue to work
through a backward-compatible facade that resolves through the
active slot.

### Decisions

- **Backward-compatible facade strategy.** Today ~30 consumer call
  sites read `printer.adapter`, `printer.connection`,
  `printer.detectedMedia`, etc. Rather than touch all of them in
  Step 3, the new store exposes the multi-connection surface
  (`connections`, `activeSlot`, `addConnection`, etc.) **alongside**
  computed BC accessors that project through the active slot. Step 4
  builds the new UI against the multi-connection API; old consumers
  keep working unchanged.
- **Reactivity model.** Connections are stored in a
  `shallowReactive(Map)`; each `Connection` is wrapped in
  `reactive(...)` so per-field mutations (e.g. `conn.isPrinting =
  false`) propagate to BC computeds without manual bumps. Identity-
  sensitive references (`adapter`, `device`, `status` payload) are
  `markRaw`-ed inside the reactive proxy so `printer.adapter ===
  adapter` (asserted by tests + tooling).
- **Per-connection poll timer.** One `setTimeout` per connection,
  keyed by `ConnectionId`. Backoff/breaker state lives on each
  `Connection`. Visibility-change handler stops/restarts every
  connection's timer.
- **Fingerprint policy (§2.6).** Minted at pair time. For now it
  defaults to a random UUID prefixed with `${family}-${model}-`. This
  satisfies "two-of-the-same-model within one session" disambiguation
  but does **not** survive replug — surfacing USB serial via the
  transport requires a separate change to drivers/transport that's
  out of scope here. Plan §2.6 explicitly accepts nickname as the
  fallback when fingerprint isn't stable.
- **`setAdapter` BC semantics.** Old code's `setAdapter(non-null)`
  replaced the single adapter. Faithful BC: `setAdapter(adapter)`
  removes any current connection first, then adds the new one. Pure
  multi-connection callers (Step 4 UI) use `addConnection` directly.
- **Scratch detected/selectedMedia.** Tests + the media store call
  `setDetectedMedia` / `setSelectedMedia` before any adapter exists.
  The store keeps top-level scratch refs that BC computeds fall back
  to when no slot is active; on `addConnection` they flow into the
  fresh primary slot and clear. Production paths always have an
  adapter first, so the scratch is invisible to them.
- **Detected media stays chassis-level on multi-engine devices.** Per
  §0.6 spike, `PrinterStatus` has no per-engine `detectedMedia`. The
  store mirrors `status.detectedMedia` onto the primary slot **only
  when the connection has exactly one slot**, leaving Duo's two slots
  alone (deferred per §0.5 — no Duo owners today).

### Out of scope here, deferred to later steps

- Multi-restore / ghost-card data flow → §6 Persistence (Step 6).
- New ConnectionsPanel UI → Step 4.
- Print-path `engine: slot.role` bridging → already in `print()`,
  reused in Step 5 for batch printing.

### Gate

- `pnpm typecheck` → clean.
- `pnpm test` → 62 files / 699 tests pass. Same count as Step 2.
- One test recovery story worth flagging: initial run had 10 failures
  (reactivity-tracking bugs from `shallowReactive(Map)` + identity
  loss on `reactive(adapter)`). Resolved by `reactive` per-Connection
  + `markRaw` on adapter/device/status, and by adding the scratch
  detected/selectedMedia fallback for pre-adapter setters.

## Step 4 — §4 UI: slot-aware ConnectionsPanel

**Goal:** the printer popover iterates over slots, renders chassis
chip + role suffix + active-slot pip when total slot count > 1, and
remains visually identical to today when exactly one slot exists.
Pair-another is reachable from the connected state.

### Decisions

- **Kept `PrinterPopover.vue` filename** (vs the plan's
  "ConnectionsPanel.vue" rename). Renaming cascades into ~6 imports
  and offers no functional benefit. Documented in this log; the file
  now plays the `ConnectionsPanel` role.
- **1-slot path is verbatim today's popover** — heading=model, detected
  media line, errors list, last-checked, hint, disconnect button. No
  chassis chip, no role suffix, no pip. Implemented as a separate
  `<template v-if="totalSlotCount === 1">` branch so the structural
  change for multi-slot doesn't leak into the 80% case.
- **Multi-slot path:** chassis chip per `Connection` (showing nickname
  or `model · last-4 fingerprint`, plus a Disconnect link), then
  nested slot cards. Each slot has a click-to-promote button with a
  filled/outline pip indicating active state. Role suffix appears on
  slots whose role is not `'primary'`.
- **Pair-another button is always visible when connected**, gated only
  by transport availability, in a quiet bottom section. Calls
  `printer.addConnection()` directly (additive). Single-printer users
  see a small text button at the bottom — visible but unobtrusive.
- **`runConnect(opener, additive)` helper** unifies the four entry
  points. The disconnected popover uses `additive=false` (preserves
  pre-refactor "replace" semantics, including `setConnecting` /
  `setError` toasts and the cancelled-NotFoundError quiet-path).
  Pair-another uses `additive=true` so an existing connection isn't
  swapped out.

### Deferred from §4

These were enumerated in the plan but not delivered in Step 4:

- **Per-slot inline `LabelSizeSelector` (§4.3).** Today's
  LabelSizeSelector lives in a properties panel and reads the
  active-slot family. For 1-slot users this is unchanged (plan
  promise). For multi-slot users, embedding a media selector
  per-slot is a larger refactor that touches the media store's
  `pickPrinterMedia` flow. Marked TODO; the multi-slot popover
  currently shows each slot's `detectedMedia` but no editable
  selector. **Rationale:** plan §0.5 deprioritises Duo/Twin polish.
- **Nickname inline editor.** The store has `setConnectionNickname`;
  the chassis chip currently displays the nickname (or the
  fingerprint hash) but has no edit affordance. Quick to add when a
  multi-printer user asks; the plumbing is in place.
- **Destination picker on the print toolbar (§4.2).** When slot
  count > 1, the print button should show "Print to: [slot]" with a
  dropdown for alternates. Currently the print button always uses
  the active slot, set via the popover. The picker is purely a
  toolbar UX convenience — printing routes correctly already.
- **`createPreview({ engine: slot.role })` (§4.4).** The
  `@thermal-label/contracts` `PreviewOptions` interface does not
  include an `engine` field today, so the plan's call signature
  doesn't compile. This requires an upstream contract change. Out of
  scope here, and irrelevant for single-engine users; flagged as
  prerequisite for genuine Duo support.

### Gate

- `pnpm typecheck` → clean.
- `pnpm test` → 62 files / 699 tests pass.
- Manual smoke: 1-printer popover renders identically to before
  (verified by reading the v-if branch — content unchanged); the
  multi-slot branch is templated but only mounts when a 2nd
  connection is paired, which I haven't tested with hardware.

## Step 5 — §5 Print path

**Goal:** `print()` calls forward `engine: slot.role` so composite
devices route correctly. Mostly already in place from Step 3.

### Status

- **Engine routing already wired** in the store's `print()` from
  Step 3: when `slot.role !== 'primary'`, the bridged options carry
  `engine: slot.role`. Single-engine devices use the `'primary'`
  sentinel and the field is omitted (drivers ignore unknown engines
  on single-engine devices anyway).
- **`thermal-batch.ts` calls through `printer.print()`** which routes
  via active slot — no changes needed in the batch service.
- **No direct `adapter.print` callers exist** outside the store; grep
  confirmed.

### Rails-not-walls fix in this step

- **Print button stays clickable on thermal error.** The
  `blockedByError` predicate previously gated `canPrint`, disabling
  the button when the active slot reported `ready: false` or any
  errors. Per plan §0.5 + §7 verification matrix, the button should
  remain clickable; the warning icon + tooltip already communicate
  the cause, and the click handler can surface a toast. Removed the
  `blockedByError` gate from `canPrint`. The icon and tooltip still
  fire — visual hint stays, hard block goes.

### Out of scope (per plan §5)

- Multi-target batch printing (e.g. CSV → 30 labels split between two
  printers) — explicitly deferred in the plan.
- Duo "split: label vs tape" job mode — explicitly deferred.
- Auto vs explicit engine routing UX on Twin Turbo — driver
  serializes today; no app-side queue.

### Gate

- `pnpm typecheck` → clean.
- `pnpm test` → 62 files / 699 tests pass.

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

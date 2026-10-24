# Plan Local-2 — Multi-printer & multi-engine support

> **Status:** Draft. Depends on Plan Local-1 (clean typecheck) being
> merged. Independent of Plan Local-3.
>
> **Goal:** the user can pair multiple printers at once, see each engine
> as its own slot in the UI (Duo's label + tape, Twin Turbo's left +
> right shown as two cards), and pick a destination at print time.

---

## 0. What the contracts already give us

After the unification:

- Each `DeviceEntry.engines` is a non-empty `PrintEngine[]`. Single-head
  devices fabricate `'primary'`; composite devices carry one entry per
  independent head with its own `protocol`, `dpi`, `headDots`,
  `mediaCompatibility`, `bind`, and `capabilities`.
- `PrinterAdapter.print(image, media, options)` accepts
  `options.engine` to route to a specific engine. `'auto'` (or omitted)
  lets the driver pick.
- `DeviceSupport.engines` tracks per-engine status independently
  (Duo's "label works, tape doesn't" case).
- `resolveSupportedDevices(registry, protocols, transports)` filters
  the per-driver `DEVICE_REGISTRY` to what this runtime can drive,
  with per-transport drivability flags surfaced so the UI can hint
  "Bluetooth-SPP requires the web package" without removing the
  device.

So the data is in place. Plan Local-2 is purely a label-maker
refactor of the connection store and printer UI.

---

## 1. Hardware reality check — can Duo really print on both heads at once?

Yes, with caveats:

- **LabelWriter Duo.** Two physical print engines, two separate USB
  interfaces (`bind.usb.bInterfaceNumber` differs per engine). Bulk
  pipes are independent at the OS level — concurrent writes to both
  interfaces are valid. The driver still has to serialize per-engine
  status polls and not deadlock on a shared lock; that is a driver
  concern, not a contracts concern. Treat as **parallelizable**.
- **LabelWriter Twin Turbo.** One USB endpoint, in-band protocol-level
  addressing (`bind.address`, encoded as `ESC q 0x01` for `lw-450`).
  Concurrent calls from label-maker get serialized at the chassis
  level — transparent to the caller, but the driver's command queue
  is shared. Treat as **single-flight** with two destinations.
- **Brother / Dymo single-head.** One engine. Listed once.

Implementation policy in label-maker:

> **Treat every engine as a logically independent printer slot.** The
> UI does not branch on chassis vs engine. The driver layer is
> responsible for whatever serialization the hardware needs.

This is the same answer the user proposed ("show twins as two
printers too") and falls out cleanly from the contracts model.

---

## 2. State refactor — from one adapter to a connection map

### 2.1 Identifier

Define `ConnectionId = string` (UUID v4 minted at pair time).
Define `EngineSlotId = ${ConnectionId}:${role}`. Slots are what
print, status, and selection bind to.

### 2.2 Pinia store split

`src/stores/printer.ts` currently holds a single `adapter` ref +
parallel ref state. Refactor:

```ts
interface Connection {
  id: ConnectionId;
  adapter: PrinterAdapter;
  family: PrinterFamily;
  model: string;
  device: DeviceEntry | null;
  // per-engine state
  slots: Map<string, EngineSlotState>;
  // chassis-level
  status: PrinterStatus | null;
  statusAt: number;
  consecutiveFailures: number;
  circuitBroken: boolean;
}

interface EngineSlotState {
  role: string;
  engine: PrintEngine;
  // detected media is engine-scoped
  detectedMedia: MediaDescriptor | null;
  selectedMedia: MediaDescriptor | null;
}
```

The store's public surface:

- `connections: Map<ConnectionId, Connection>` (shallowReactive).
- `activeSlot: { connectionId, role } | null` — the print target.
- `addConnection(adapter)`, `removeConnection(id)`, `setActiveSlot(slotId)`.
- `effectiveMedia(slotId)` replaces today's chassis-scoped
  `effectiveMedia` computed.

Connection-level concerns (status polling, auto-reconnect circuit
breaker, error-code dedupe set) stay chassis-scoped — the printer
reports one status per chassis even on Duo (engines report through
the same `getStatus()` call; the `PrinterStatus` shape may add
per-engine fields, check before assuming).

### 2.3 Status polling

Today: one `pollTimer` for the single adapter. After:

- One timer per connection (Map keyed by `ConnectionId`).
- Polling cadence and backoff stay per-connection.
- Status payload carries per-engine media when the driver supports
  that — split it into the right slot.

### 2.4 Auto-reconnect

`composables/useAutoReconnect.ts` currently restores the last
connection on app boot. After:

- `localStorage` key `last-connections` holds an array of
  `{ family, model, transportKind, address }` (whatever pairs to a
  re-openable handle). On boot, attempt each in parallel; failures
  are silent.
- Single-connection users get the same UX (their list has one entry).

### 2.5 Active slot — the destination picker's source of truth

When >1 slot is connected, surface a destination picker on the print
button. Persist `activeSlot` in the design (so reopening a label
remembers "this was for the Twin's right head") with graceful
fallback to the first available slot if that exact one is gone.

---

## 3. Adopt `resolveSupportedDevices` for the registry

### 3.1 New `src/lib/printer/registry.ts` shape

```ts
import {
  resolveSupportedDevices,
  type SupportedDevice,
  type TransportType,
} from '@thermal-label/contracts';
import {
  DEVICE_REGISTRY as BROTHER,
  PROTOCOLS as BROTHER_PROTOCOLS,
} from '@thermal-label/brother-ql-core';
// ...same for labelwriter, labelmanager

const RUNTIME_TRANSPORTS = new Set<TransportType>(['usb', 'serial']); // expand as we add Web TCP / Web Bluetooth

export const SUPPORTED_BROTHER = resolveSupportedDevices(
  BROTHER,
  BROTHER_PROTOCOLS,
  RUNTIME_TRANSPORTS,
);
// ...same for the other two
```

Each entry already carries:

- `engines: EngineDescriptor[]` (PrintEngine + per-engine `drivable`)
- `drivableTransports`, `undrivableTransports`
- `allEnginesDrivable`

This data drives the device picker (badges for "Bluetooth requires
desktop app" etc.), the engine slot list at pair time, and Plan
Local-3's status banners.

### 3.2 Per-driver `PROTOCOLS` export

Verify each driver-core actually exports a `PROTOCOLS:
ReadonlySet<string>` covering the protocols its `*-web` package
implements. If not, file an upstream issue — it is the trivial
sibling to `DEVICE_REGISTRY` and is the resolver's required input.

### 3.3 Drop hand-rolled feature flags

Sets like `FAMILIES_WITH_DETECTION`, `FAMILIES_WITH_STATUS_POLLING`,
`FAMILIES_WITH_WEB_SERIAL` were registry-coarse. Replace with
per-engine reads on the live device:

- `mediaDetection`: `engine.capabilities?.mediaDetection === true`
- `autocut`: `engine.capabilities?.autocut === true`
- Status polling: probe by call (every driver implements `getStatus`;
  failures decay via the existing circuit breaker).
- Web Serial: read `device.transports['bluetooth-spp']` and check
  whether the runtime advertises `'serial'` (since SPP is surfaced via
  the OS's serial stack).

`PER_MODEL_STATUS_POLLING_EXCLUSIONS` survives unchanged — it is the
escape hatch for misbehaving firmware and nothing in the new
contracts replaces it.

---

## 4. UI — what the user sees

### 4.1 Connections panel

`components/printer/PrinterStatus.vue` becomes
`components/printer/ConnectionsPanel.vue`:

- One card per **slot** (not per connection). Duo paired = two cards.
- Card shows: family + model + role suffix when role !== 'primary'
  (e.g. "LabelWriter Duo — label", "LabelWriter Duo — tape"; "QL-820NWBc"
  with no suffix on a single-engine device).
- Connection-level affordances (disconnect, reconnect, pair another)
  live in a small chassis chip above each group of slots, grouped by
  `connectionId`.
- "Pair another printer" button is always visible.

### 4.2 Active-slot indicator

A persistent pip on each card shows the active-slot state:

- Solid: this slot is the print destination.
- Outline: this slot is connected but not active.

Clicking promotes the slot. On the print toolbar, show "Print to:
[active slot label]" with a dropdown for the alternates.

### 4.3 Per-slot media

Every slot has its own `selectedMedia` and `detectedMedia`. The
existing `LabelSizeSelector.vue` becomes scoped to the active slot.
When the user switches active slot, the selector re-renders against
that slot's options (filtered by `engine.mediaCompatibility` and the
family registry).

### 4.4 Print preview

Driven by `adapter.createPreview` today. Update to pass
`{ engine: activeSlot.role }` so the driver previews against the
right head's geometry on composite devices. Single-engine devices
ignore the option transparently.

---

## 5. Print path

`src/composables/usePrintAction.ts` (or wherever `print()` is
invoked) takes the active slot:

```ts
await connection.adapter.print(image, slot.selectedMedia ?? undefined, {
  engine: slot.role === 'primary' ? undefined : slot.role,
  // ...other PrintOptions
});
```

For Duo (parallelizable): multi-label batch jobs may want a
"split: label vs tape" mode in a future iteration; out-of-scope here.

For Twin Turbo (single-flight): the driver serializes; no app-side
queue needed.

For multi-connection batches (CSV import → 30 labels across 2
printers): also out-of-scope here. Today the print path is one
target per design; that stays.

---

## 6. Persistence

### 6.1 Per-design active slot

`Document.metadata.targetSlot` (new optional field) — persists
`{ family, model, role }` (not connectionId — that is ephemeral).
On load, resolve to a current slot if available; otherwise fall back
to the first available slot and surface a one-shot toast: "this
design was made for [model] (label head) — printing to [current
slot] instead."

### 6.2 Last-connections list

`localStorage` key `last-connections`: array of pair-up records.
Boot path replays them in parallel. Failed entries are dropped
silently after their first attempt within a session.

---

## 7. Verification

```bash
pnpm typecheck
pnpm test
```

Browser smoke matrix:

| scenario                             | expected                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| pair one QL-820NWBc                  | one card, role 'primary' (no suffix shown), prints normally                  |
| pair one Brother + one Dymo          | two cards, picker on print, both pollable                                    |
| pair LabelWriter Duo (when wired)    | two cards labelled "label" / "tape", per-card media, prints to active slot   |
| disconnect cable on a paired printer | both that connection's slots show "lost"; auto-reconnect attempts on plug-in |
| reload page with two paired          | both restored from localStorage; first-listed = active slot                  |

---

## 8. Out-of-scope

- Concurrent multi-target batch printing (covered by a future plan
  if/when CSV-fanout becomes a feature).
- Picker UX for picking `engine: 'auto'` vs explicit role on Twin
  Turbo (the model treats every slot as explicit; auto-routing in
  PrintOptions is for drivers that want it, not users).
- Cross-chassis media bookkeeping (each slot's media is local).

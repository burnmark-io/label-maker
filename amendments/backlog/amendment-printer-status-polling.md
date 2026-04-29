# label-maker — Amendment: Periodic Printer Status Polling

> Today the printer status is fetched once at connect time
> (`useAutoReconnect` calls `printer.refreshStatus()` on mount). After
> that, the UI is blind. If the user opens the cover, runs out of
> labels, hits a cutter jam, or swaps to a different roll, the
> editor doesn't know — they only find out by clicking Print and
> getting an error.
>
> Add a periodic status loop for printers that report it. Surface the
> result in three places: the printer status pill colour-codes by
> state and lists errors in its popover; the print button is disabled
> with a warning icon while there's an error; when the error clears,
> everything returns to normal silently. Paper roll changes are
> picked up automatically and routed through the existing auto-adopt
> machinery from `amendment-canvas-resize-and-first-print.md`.
>
> **Scope is the polling loop, the UI surface, and the print
> guard.** The driver-level status contract (`PrinterStatus`,
> `PrinterError`) already exists in `@thermal-label/contracts`; this
> amendment consumes it.
>
> Sibling amendments:
> - `amendment-canvas-resize-and-first-print.md` — defines the
>   "canvas untouched → silent adopt; canvas touched → banner" rule
>   for media changes. This amendment reuses that rule for paper
>   roll changes mid-session and references its print-button
>   guard, layering the error-block on top.

---

## 1. The Problem

Three sharp edges, all caused by the same blind spot:

**(a) Errors are invisible until print time.** A user opens the cover
to swap a roll, forgets to close it, and goes back to designing.
They click Print 20 minutes later and finally see "cover open".
The cycle of clicking Print → fixing → clicking Print → fixing
again is high-friction. A live indicator would catch it
immediately.

**(b) Paper roll changes are silent.** The user pops in a 29mm tape
where a 62mm tape was. The canvas still says 62mm. They print and
their label gets cut wrong. The driver could tell us — we just
don't ask.

**(c) Print button gives no warning before failing.** Today, an
error-state printer accepts the print click, then errors at the
driver level. With status polling we can disable the button with
a clear reason instead of letting the user crash into the wall.

The driver contract is already in place. `PrinterStatus` from
`@thermal-label/contracts` exposes `ready: boolean`, `mediaLoaded:
boolean`, `detectedMedia?: MediaDescriptor`, and `errors:
PrinterError[]` with `{ code, message }`. Brother QL reports all of
these meaningfully. We need to call `getStatus()` periodically and
react.

---

## 2. Scope

In:
- Background polling loop in `stores/printer.ts` while the printer
  is connected, the tab is visible, and no print job is in flight.
- Per-family opt-in via a new `FAMILIES_WITH_STATUS_POLLING` set.
  All three currently supported families ship in the initial set
  — every driver already implements `getStatus()` with structured
  errors. Confirmed by inspecting the driver sources (see §3.6
  for the per-protocol breakdown).
- Per-model opt-out seam (architecture, not used in v1) for the
  reverse case — a specific model within a polling family that
  turns out to misbehave can be excluded without dropping the
  whole family.
- Tab-visibility pause via `document.visibilitychange` — no
  polling while the tab is hidden.
- Print-job pause — polling suspends from the moment a print
  begins until ~3 seconds after it completes. Brother QL can't
  answer status queries while raster bytes are streaming.
- Post-print burst — for 30 seconds after a print completes,
  poll at 2s instead of 5s to catch immediate post-print errors.
- Status pill UI: colour-coded state (green ready, yellow warning,
  red error) plus icon. Click opens popover listing each error's
  human-readable `message`.
- One-time toast per error code per session — surfaces the first
  occurrence, suppresses repeats while the same error persists.
- Print button guard: disabled while `!ready || errors.length > 0`.
  Warning icon next to the button, tooltip / inline note shows the
  primary error message. Re-enables silently when the condition
  clears.
- Paper roll changes: routed through the existing media auto-adopt
  watcher in `stores/media.ts`. Untouched canvas → silent adopt;
  touched canvas → banner offer (per
  `amendment-canvas-resize-and-first-print.md` §3, §5).
- Auto-stop on disconnect, auto-restart on reconnect.

Out:
- Polling for any future driver family that genuinely doesn't
  expose status. None today — but the per-family gate stays as
  an architectural seam for that case.
- Predictive / heuristic error detection (e.g. "if last 3 prints
  errored, warn that the cutter might be misaligned"). Just the
  driver's reported state.
- Customising error severity per code. We treat any non-empty
  errors array or `ready === false` as "blocked"; finer
  classification is a future concern.
- Driver code coverage beyond what's reported today. New codes
  added to a driver later just need a matching i18n key (§4.5).
- Auto-recovery actions (e.g. an "open cover, then close" prompt
  guiding the user). Future UX polish; v1 just shows the message.
- Web Bluetooth notifications / push-style status. Polling-only.
  Brother's protocol doesn't support unsolicited status anyway over
  the bulk transport we use.

---

## 3. Polling Loop

### 3.1 State Machine

```
disconnected ──connect──▶ idle ──visible & printer-supports-polling──▶ polling
   ▲                       ▲                                            │
   │                       │                                            │
   └──disconnect───────────┴────────tab-hidden / job-in-flight──────────┘
```

`idle` is the resting state when polling is paused but the printer
is still connected. The store transitions between `idle` and
`polling` based on tab visibility, print-job state, and family
support.

### 3.2 Cadence

- **Default interval**: 5000 ms.
- **Post-print burst**: 2000 ms for 30 s after a print completes.
- **Backoff on error**: if `getStatus()` itself throws (transport
  failure, not a printer error), back off to 10 s, then 20 s, max
  60 s. Reset to 5 s on the first successful response. Avoids
  hammering a flaky USB connection.

### 3.3 Pause Conditions

Polling does NOT run when any of:
- `connection.kind !== 'connected'`
- `!FAMILIES_WITH_STATUS_POLLING.has(connection.family)`
- `document.hidden === true` (visibilitychange listener)
- `printJobInFlight === true` (set by the print path; see §3.5)

### 3.4 Implementation Sketch

```typescript
// stores/printer.ts
const POLL_INTERVAL_MS = 5000;
const POLL_INTERVAL_BURST_MS = 2000;
const POLL_BURST_DURATION_MS = 30_000;
const POLL_BACKOFF_MS = [10_000, 20_000, 60_000];

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let consecutiveFailures = 0;
let burstUntil = 0;

function shouldPoll(): boolean {
  return (
    connection.value.kind === 'connected' &&
    connection.value.family !== undefined &&
    FAMILIES_WITH_STATUS_POLLING.has(connection.value.family) &&
    !document.hidden &&
    !printJobInFlight.value
  );
}

function scheduleNextPoll(): void {
  if (pollTimer) clearTimeout(pollTimer);
  if (!shouldPoll()) return;
  const interval =
    consecutiveFailures > 0
      ? POLL_BACKOFF_MS[Math.min(consecutiveFailures - 1, POLL_BACKOFF_MS.length - 1)]
      : Date.now() < burstUntil
        ? POLL_INTERVAL_BURST_MS
        : POLL_INTERVAL_MS;
  pollTimer = setTimeout(tick, interval);
}

async function tick(): Promise<void> {
  if (!shouldPoll()) return;
  try {
    await refreshStatus();
    consecutiveFailures = 0;
  } catch {
    consecutiveFailures += 1;
    // refreshStatus already logged
  }
  scheduleNextPoll();
}

function startPolling(): void {
  consecutiveFailures = 0;
  scheduleNextPoll();
}
function stopPolling(): void {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}
```

Wired up:
- After `setAdapter()` resolves successfully → `startPolling()`.
- Before `disconnect()` → `stopPolling()`.
- `document.addEventListener('visibilitychange', () => visible ? scheduleNextPoll() : stopPolling())`.
- `notifyPrintStarted()` / `notifyPrintCompleted()` exported for the
  print path.

### 3.5 Print-Job Hook

The print flow needs to gate the loop:

```typescript
// in print path
printer.notifyPrintStarted();
try {
  await printer.adapter.value.print(/* … */);
} finally {
  printer.notifyPrintCompleted();  // sets burstUntil = now + 30s
}
```

`notifyPrintStarted` sets `printJobInFlight.value = true` and stops
the loop. `notifyPrintCompleted` clears the flag, sets
`burstUntil = Date.now() + POLL_BURST_DURATION_MS`, and resumes.

### 3.6 Family Support Gate

All three currently supported families implement `getStatus()` with
structured errors. The shape and richness vary, but every family
returns something useful:

| Family | Protocol | What `getStatus()` reports |
|---|---|---|
| `brother-ql` | bulk transport | full errors + `detectedMedia` |
| `labelwriter` (550 protocol — LW 550 series) | 32-byte response | `not_ready`, `no_media`, `paper_jam`, `cover_open`, `label_too_long` + `detectedMedia` |
| `labelwriter` (450 protocol — LW 450 series) | 1-byte response | `not_ready`, `no_media`, `label_too_long`. **No media detection.** |
| `labelmanager` | 1-byte response | `not_ready`, `no_media`, `low_media`. **No media detection.** |

So:
- **Status polling**: enabled for every family from v1.
- **Media auto-adopt** on roll change (the auto-adopt watcher in
  `stores/media.ts` reacting to `detectedMedia` changes): only
  effective for brother-ql and the LW 550 protocol — others always
  return `detectedMedia: undefined`. No code branching needed; the
  watcher is a no-op when the value stays undefined.

`lib/printer/registry.ts`:

```typescript
/**
 * Driver families that support periodic status polling. All three
 * supported families implement getStatus() with structured errors.
 * (Brother QL and LabelWriter 550 also report detectedMedia; LW 450
 * and LabelManager report errors only.)
 */
export const FAMILIES_WITH_STATUS_POLLING: ReadonlySet<PrinterFamily> = new Set([
  'brother-ql',
  'labelwriter',
  'labelmanager',
]);

/**
 * Per-model exclusions. A model in this set does NOT poll even if
 * its family is in FAMILIES_WITH_STATUS_POLLING. Empty in v1 —
 * architectural seam for the future case where a specific model
 * within a polling family turns out to misbehave on status queries.
 */
export const PER_MODEL_STATUS_POLLING_EXCLUSIONS: ReadonlySet<string> =
  new Set([]);
```

`shouldPoll()` returns true when the family is in the polling set
AND the model key (`${family}:${model}`) is NOT in the exclusion
set.

---

## 4. UI Surface

### 4.1 Printer Status Pill

`components/printer/PrinterStatus.vue` (or wherever the connected
printer pill renders) gains a derived state:

```typescript
type PillState = 'disconnected' | 'connecting' | 'ready' | 'warning' | 'error';
```

| Condition | State | Colour |
|---|---|---|
| disconnected | `disconnected` | grey |
| connecting | `connecting` | grey, animated |
| connected, polling-not-supported (no current family fits) | `ready` | green (no diagnostic available) |
| connected, polling, `ready === true && errors.length === 0` | `ready` | green |
| connected, polling, `ready === true && errors.length > 0` | `warning` | yellow |
| connected, polling, `ready === false` | `error` | red |

Click on pill → popover. Popover shows:
- Family + model (existing)
- Detected media name (existing)
- New: list of `errors[].message` if non-empty
- New: "Last checked: 3s ago" relative timestamp

Hover tooltip on the pill shows the first error message (truncated
if multiple) so the user gets the gist without opening the popover.

### 4.2 Print Button Guard

The print button is disabled when:
- `effectiveMedia === null` AND no detection available (existing
  guard from `amendment-canvas-resize-and-first-print.md` §7), OR
- `printJobInFlight === true` (existing), OR
- **(new)** `printer.connection.kind === 'connected'` AND
  polling is supported for this family AND
  `printer.lastStatus.ready === false || printer.lastStatus.errors.length > 0`.

When disabled by the new condition, the button shows a warning
icon (e.g. ⚠ or a custom triangle) and an inline / tooltip message
with the primary error's `message`. Multiple errors → first shown,
with "(+N more)" if applicable.

When the error condition clears (next poll returns clean), the
button silently re-enables. No "everything's fine now" toast — the
visual return to normal is the signal.

```vue
<button
  :disabled="!canPrint"
  :aria-describedby="canPrint ? undefined : 'print-blocked-reason'"
  @click="onPrint"
>
  <WarningIcon v-if="blockedByError" />
  {{ t('action.print') }}
</button>
<span v-if="blockedByError" id="print-blocked-reason" class="print__error">
  {{ primaryErrorMessage }}
</span>
```

### 4.3 First-Occurrence Toast

When a new error code appears that wasn't in the previous status's
errors array, fire one toast with `localisedErrorMessage(error, t)`. Track
recently-seen codes in a `Set<string>` keyed by error code; clear
the set when all errors clear. Avoids re-toasting `cover_open`
every 5 seconds for the duration of the cover being open.

Suppress toasts while the printer popover is open (the user is
already looking at the errors there).

### 4.5 Error Message Localisation

Drivers return both a `code` (machine-readable, mostly aligned
across families: `no_media`, `not_ready`, `cover_open`,
`paper_jam`/`cutter_jam`, `label_too_long`, `low_media`,
`media_end`, `wrong_media`, `system_error`) and a `message`
(human-readable, but inconsistent voice between drivers — e.g.
`no_media` reads as "No media", "No labels loaded", or "No tape
inserted" depending on which family).

We're already running every user-facing string through vue-i18n.
Use the error code as part of the translation key:

```typescript
// src/composables/usePrinterErrors.ts
import type { PrinterError } from '@thermal-label/contracts';

export function localisedErrorMessage(error: PrinterError, t: (k: string) => string): string {
  const key = `printer.error.${error.code}`;
  const translated = t(key);
  // vue-i18n returns the key itself when no translation exists.
  return translated === key ? error.message : translated;
}
```

The translation file holds canonical, polished strings for known
codes; unknown codes fall back to the driver's `message` so a new
code introduced by an upstream driver update doesn't blank out the
UI before we add a key.

Seed keys (en):

```json
"printer": {
  "error": {
    "no_media":       "No labels or tape loaded",
    "not_ready":      "Printer is busy",
    "cover_open":     "Cover is open",
    "paper_jam":      "Paper jam",
    "cutter_jam":     "Cutter jam",
    "media_end":      "End of roll reached",
    "label_too_long": "Label is too long for the printer",
    "wrong_media":    "Wrong media for this label — check the loaded roll",
    "low_media":      "Media is running low"
    // system_error intentionally omitted — driver messages carry
    // the specific cause (battery, fan, voltage, etc.)
  }
}
```

`system_error` is the one code where the driver's message is more
useful than a generic translation, because Brother uses it as a
catch-all for several distinct physical conditions ("Weak
battery", "Fan motor error", "High voltage adapter", etc.). The
fallback rule above covers it for free — no key, falls back to
driver message.

This applies everywhere a `localisedErrorMessage(error, t)` was going to be
displayed in §4.1, §4.2, and §4.3: status pill tooltip, popover
list entries, print-button inline reason, first-occurrence toast.

### 4.4 Paper Roll Change

When `status.detectedMedia` differs from the previous status's
`detectedMedia`, the existing watcher in `stores/media.ts:354`
already picks up the change and routes through the auto-adopt
rule from `amendment-canvas-resize-and-first-print.md`:

- Canvas untouched (`!designer.canUndo`) → silent `pickDetected()`.
- Canvas touched → auto-adopt confirmation banner.

No new code needed in this amendment for media changes — the
polling loop just keeps `printer.detectedMedia` fresh, and the
existing reactivity does the rest.

---

## 5. Edge Cases

### 5.1 Status Call Throws

Transport-level failure (USB disconnect, timeout). Existing
`refreshStatus` already catches and logs (`stores/printer.ts:151`).
The polling loop additionally backs off (§3.2). After three
consecutive failures, treat the connection as lost: emit a
disconnected event, stop the loop, let `useAutoReconnect` handle
recovery.

### 5.2 Tab Goes to Background Mid-Poll

`tick()` is in flight when `visibilitychange` fires. Let it
complete; the next `scheduleNextPoll()` check will see
`document.hidden === true` and not reschedule. No abort.

### 5.3 Driver Reports `ready: true` With Non-Empty Errors

Possible per the contract — e.g. a non-fatal warning (low battery
on a wireless model). State machine treats this as `warning`, pill
goes yellow, print button stays enabled (because `ready` is true).
First-occurrence toast still fires.

### 5.4 Error Disappears Without Polling Catching It

User opens cover → polls catch `cover_open` → user closes cover
quickly → next poll catches clean state → pill returns to green.
The 5s window is short enough that this feels live. Faster cadence
would be over-eager; slower would feel laggy.

### 5.5 Multiple Errors Simultaneously

Pill shows `error` (red, takes precedence over `warning`). Popover
lists all messages. Print button shows the first one with
"(+N more)" appended. Tooltip shows the first one truncated.

### 5.6 Print Button During Burst

Post-print burst is 2s polling for 30s. If the user clicks Print
immediately after a successful print, the burst is interrupted by
`notifyPrintStarted` → loop pauses → resumes with a fresh burst
window after the new print completes.

### 5.7 Printer Reports a New `detectedMedia` Mid-Print

Shouldn't happen physically (you can't swap a roll while printing),
but the contract allows it. Defer reaction until
`notifyPrintCompleted` fires; the next poll picks up the change
naturally.

### 5.8 Family Not in Polling List

No current family falls here — all three implement `getStatus()`.
Reserved for a hypothetical future family that genuinely lacks
status capability: `shouldPoll()` returns false, loop never starts,
pill shows `ready` (green) without diagnostics, print button uses
only the existing media guards. No regressions.

### 5.9 Driver Reports Media Detection Inconsistently

LW 450 and LabelManager always return `detectedMedia: undefined`,
but their status response is otherwise rich. The polling loop
treats this transparently: errors flow through to the UI; the
auto-adopt watcher in `stores/media.ts` is a no-op as long as
`detectedMedia` stays undefined. Users on these drivers continue to
pick media manually via the size selector — exactly as today.

LW 550 reports `detectedMedia` once a known roll is loaded;
unknown sizes still return undefined. The auto-adopt fires when a
known roll is detected for the first time; otherwise the manual
flow applies.

### 5.10 Single-Tab Limit

If two tabs are open with the same printer connected, both poll.
WebUSB exclusive-access already prevents two tabs from holding the
same device simultaneously, so in practice only one tab has
`adapter.value` non-null at a time. Not a concern.

---

## 6. Files Affected

```
src/stores/printer.ts
  - shallowRef<PrinterStatus | null> lastStatus
  - shallowRef<boolean> printJobInFlight
  - exported notifyPrintStarted / notifyPrintCompleted
  - polling loop (start, stop, schedule, tick)
  - tab-visibility wiring
  - first-occurrence error tracking (Set<string>)

src/lib/printer/registry.ts
  - FAMILIES_WITH_STATUS_POLLING set
  - PER_MODEL_STATUS_POLLING set
  - exported model-key helper

src/components/printer/PrinterStatus.vue
  - derived pill state (disconnected/connecting/ready/warning/error)
  - colour + icon
  - tooltip with primary error message
  - popover lists errors[].message
  - "last checked" relative timestamp

src/components/printer/PrinterPopover.vue
  - errors list rendering inside the popover
  - suppress first-occurrence toasts while popover is open

src/components/toolbar/CanvasActions.vue   (or wherever the orange
                                            Print button lives)
  - wire print-blocked-by-error into the disable condition
  - warning icon + inline/tooltip error reason
  - call printer.notifyPrintStarted/Completed around print()

src/composables/useAutoReconnect.ts
  - no change — printer.refreshStatus is called once on reconnect
    and the polling loop takes over from there

i18n:
  - all new toast/tooltip/aria strings
```

No designer-core changes. No schema changes.

---

## 7. Implementation Checklist

```
Polling loop:
□ Add lastStatus, printJobInFlight, error-codes-seen state to
  stores/printer.ts
□ Implement shouldPoll, scheduleNextPoll, tick, startPolling,
  stopPolling per §3
□ Hook startPolling into setAdapter completion path
□ Hook stopPolling into disconnect path
□ Tab visibility listener (mount/unmount tied to setAdapter)
□ Backoff on consecutive failures (10s/20s/60s); reset on success
□ Treat 3 consecutive transport failures as disconnect

Family + model gates:
□ FAMILIES_WITH_STATUS_POLLING in registry.ts (brother-ql,
  labelwriter, labelmanager — all three)
□ PER_MODEL_STATUS_POLLING_EXCLUSIONS in registry.ts (empty initially)
□ Helper to compute model key `${family}:${model}`

Print-job integration:
□ notifyPrintStarted/notifyPrintCompleted exported from store
□ Print path calls them around adapter.print()
□ Burst timer (Date.now() + 30_000) on print complete

Status pill UI:
□ PillState computed from connection + lastStatus
□ Colour mapping (green/yellow/red) + warning icon
□ Tooltip shows primary error message (truncated)
□ Popover renders errors list with all messages
□ "Last checked Ns ago" relative timestamp

Print button guard:
□ blockedByError computed (!ready OR errors.length > 0) AND
  family supports polling (otherwise no diagnostic basis)
□ Disabled state with warning icon and inline/tooltip reason
□ Silent re-enable when condition clears

First-occurrence toast:
□ Track seen-codes Set<string> on the store
□ On new code (not in set), fire toast with localisedErrorMessage(error, t)
□ Add code to set; clear set when errors becomes empty
□ Suppress toasts while PrinterPopover is open

Error i18n helper:
□ src/composables/usePrinterErrors.ts exporting
  localisedErrorMessage(error, t) per §4.5
□ Seed printer.error.* keys for the 8 canonical codes
  (no_media, not_ready, cover_open, paper_jam, cutter_jam,
  media_end, label_too_long, wrong_media, low_media)
□ Apply localisedErrorMessage anywhere errors are rendered:
  pill tooltip, popover list, print-button reason, toast

i18n (other strings):
□ Pill state aria-labels (Ready / Warning: {message} / Error: {message})
□ "Last checked Ns ago" string
□ "(+N more)" suffix
□ Print button blocked tooltip prefix
```

---

## 8. Tests

Polling loop (`stores/__tests__/printer.test.ts` with fake timers):
- Connect a brother-ql adapter → polling starts
- Connect a labelwriter (450 or 550) adapter → polling starts
- Connect a labelmanager adapter → polling starts
- Connect a model listed in PER_MODEL_STATUS_POLLING_EXCLUSIONS →
  polling does not start (even if its family is in the polling set)
- Tab hidden → next tick is skipped, no scheduleNext
- Tab returns visible → polling resumes
- notifyPrintStarted suspends polling; notifyPrintCompleted resumes
  with burst (interval = 2000ms for 30s)
- 3 consecutive throws from getStatus trigger backoff (10s, 20s, 60s)
- Successful tick after backoff resets to 5000ms
- 3 consecutive failures emit disconnected (or trigger reconnect path)
- Disconnect stops the loop and clears the timer

Pill state:
- disconnected / connecting / ready / warning / error mappings
  match table in §4.1
- ready=true + errors=[] → green
- ready=true + errors=[{cover_open}] → yellow + tooltip shows
  cover_open message
- ready=false → red regardless of errors length
- LW 450 reports `not_ready` → pill goes red, errors lists
  "Printer busy"; detectedMedia undefined throughout (no auto-adopt
  side effect)
- LabelManager reports `low_media` → pill goes yellow (warning),
  errors lists "Tape supply low"
- Family not polling (none today) → always green (no diagnostic
  basis)

Print button guard:
- canPrint=false when polling family + (errors non-empty OR
  ready=false)
- canPrint=true when status is clean across all three families
- LW 450 reporting `no_media` → button disabled with "No labels
  loaded"
- LabelManager reporting `not_ready` → button disabled with
  "Printer busy"
- LW 550 reporting `cover_open` → button disabled with "Cover is
  open"
- Disabled state shows warning icon and primary error message
- Silent re-enable when next poll returns clean

First-occurrence toast:
- New error code → toast fires
- Same code persists across multiple polls → only one toast
- Code clears, then reappears → toast fires again (post-clear)
- Toast suppressed while PrinterPopover is mounted

Error localisation (`composables/__tests__/usePrinterErrors.test.ts`):
- localisedErrorMessage with a known code (e.g. `no_media`) returns
  the i18n string, not the driver message
- Same `no_media` code from three different drivers (Brother,
  LabelWriter, LabelManager) all surface the same canonical string
- Unknown code (e.g. `made_up_code` from a future driver update)
  falls back to the driver's PrinterError.message
- `system_error` falls back to driver message (no canonical key)
- Empty translation in the locale file falls back to driver message

Paper roll change end-to-end:
- Status changes detectedMedia from 62mm to 29mm
- Untouched canvas (designer.canUndo=false) → pickDetected fires
  silently
- Touched canvas (designer.canUndo=true) → adopt-confirmation
  banner fires (via existing media watcher)
- Same wire-up as amendment-canvas-resize-and-first-print.md §3

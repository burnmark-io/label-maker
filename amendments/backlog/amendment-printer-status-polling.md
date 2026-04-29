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
> picked up automatically and routed through the auto-adopt gate
> change and adopt-confirmation banner introduced in §4.5.
>
> **Scope is the polling loop, the UI surface, the print guard, the
> auto-adopt-gate change, and the adopt-confirmation banner.** The
> driver-level status contract (`PrinterStatus`, `PrinterError`)
> already exists in `@thermal-label/contracts`; this amendment
> consumes it.
>
> Sibling amendments:
> - `amendment-canvas-resize-and-first-print.md` — ships alongside
>   this one. Owns the canvas resize pipeline, the overflow banner
>   mode, `fitContentToCanvas()`, the print-button auto-adopt path,
>   welcome templates, and the `resizeBehavior` schema field. This
>   amendment owns the auto-adopt-gate change (canUndo-based) and
>   the adopt-confirmation banner (§4.5); the sibling extends the
>   same banner store with an overflow mode.

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
- Auto-adopt gate change in `stores/media.ts:354` — switches from
  `source === 'detected'` to a `!designer.canUndo` ("untouched
  canvas") check. Generalises the existing first-connect rule to
  also fire mid-session when the user swaps a roll on an untouched
  canvas, regardless of how they originally arrived at the current
  size. (See §4.5.1.)
- Adopt-confirmation banner — new `useResizeBannerStore` and
  `CanvasResizeBanner.vue` for the touched-canvas case: rather
  than silently swapping the user's work, surface "Detected
  {media} on {printer}. [Use this size]   ✕". Sibling
  `amendment-canvas-resize-and-first-print.md` extends the same
  store/component with an `overflow` mode; this amendment ships
  only the `adopt` mode. (See §4.5.2.)
- Paper roll changes: handled end-to-end by the watcher + banner
  above. Untouched → silent `pickDetected()`; touched → banner.
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
  added to a driver later just need a matching i18n key (§4.4).
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
- `isPrinting === true` (existing flag; see §3.5)

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
  if (connection.value.kind !== 'connected') return false;
  if (!FAMILIES_WITH_STATUS_POLLING.has(connection.value.family)) return false;
  if (PER_MODEL_STATUS_POLLING_EXCLUSIONS.has(
    `${connection.value.family}:${connection.value.model}`
  )) return false;
  if (document.hidden) return false;
  if (isPrinting.value) return false;
  if (circuitBroken.value) return false;     // see §5.1
  return true;
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
- **Visibility listener is attached once at store init** (not per-connect)
  to avoid leak/stale-handler issues across connect/disconnect cycles.
  Handler calls `scheduleNextPoll()` when visible, `stopPolling()` when
  hidden; both gate internally via `shouldPoll()` so they're safe at
  any connection state.
- A `watch(isPrinting, ...)` triggers `stopPolling()` on `true` and
  `scheduleNextPoll()` on `false` (the latter setting `burstUntil =
  Date.now() + POLL_BURST_DURATION_MS`). No separate notify-start/
  notify-complete API is needed — the print path's existing
  `try/finally` toggle on `isPrinting` is enough.

`refreshStatus()` is extended to also assign the full status:

```typescript
async function refreshStatus(): Promise<void> {
  if (!adapter.value) return;
  const status = await adapter.value.getStatus();   // throws on transport failure
  lastStatus.value = status;                        // NEW — full status for UI
  detectedMedia.value = status.detectedMedia ?? null;
  // selectedMedia is intentionally not cleared (existing behaviour)
}
```

The `try/catch` moves into `tick()` so backoff has access to the
exception (today's `refreshStatus` swallows errors and the polling
loop can't tell a transport failure from a clean read).

### 3.5 Print-Job Hook

The store's existing `print()` already toggles `isPrinting` in a
`try/finally`. We extend the `finally` clause to set the burst
window, and the polling loop watches `isPrinting` directly:

```typescript
async function print(image: RawImageData, options?: PrintOptions): Promise<void> {
  if (!adapter.value) throw new Error('No printer connected');
  isPrinting.value = true;
  try {
    await adapter.value.print(image, effectiveMedia.value ?? undefined, bridgedOptions);
  } finally {
    isPrinting.value = false;
    burstUntil.value = Date.now() + POLL_BURST_DURATION_MS;  // NEW
  }
}

// elsewhere in the store
watch(isPrinting, busy => {
  if (busy) stopPolling();
  else scheduleNextPoll();
});
```

No separate notify-start/notify-complete API. Call sites that
already wrap `printer.print()` need no change.

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

### 4.4 Error Message Localisation

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

### 4.5 Auto-Adopt Gate & Adopt-Confirmation Banner

The watcher in `stores/media.ts:354` already calls `pickDetected()`
when `printer.detectedMedia` flips to a non-null value, gated on
`source === 'detected'`. That gate worked when first-connect was
the only event we acted on. With periodic polling, detected media
also changes mid-session (the user swaps a 62mm roll for a 29mm
one), and we want auto-adopt to behave consistently regardless of
how the user arrived at the current size.

#### 4.5.1 Gate Change — canUndo Replaces Source

The watcher's gate switches from
`if (source.value !== 'detected') return;` to:

```typescript
const touched =
  designer.canUndo && designer.document.objects.length > 0;
if (touched) {
  resizeBanner.showAdopt({ media, family, model });
  return;
}
pickDetected(media);
```

"Touched" reads as `canUndo AND non-empty objects`. The first-visit
sample loads via `loadFirstVisitDocument()` then calls
`designer.clearHistory()` (`AppShell.vue` ~ line 222), so demo
content has `canUndo === false` and counts as untouched. The moment
the user moves, edits, or adds an object, `canUndo` flips true and
stays true. The non-empty-objects clause covers the "user nuked
everything" case — an empty canvas with `canUndo === true` still
adopts silently rather than throwing a banner over a blank surface.

This rule supersedes the source-based gate from
`amendment-canvas-sizing.md §2.2`. A user with a stale
`source: 'manual'` from a previous session who hasn't started
designing yet will now auto-adopt their newly-connected printer's
media — the case the source-based gate missed.

#### 4.5.2 Adopt-Confirmation Banner

A small Pinia store + component pair, introduced here and
extended by the sibling canvas-resize amendment:

```
src/stores/resizeBanner.ts
  - mode: 'idle' | 'adopt'        (sibling adds 'overflow')
  - payload: { media, printerName }
  - showAdopt(payload), hide()

src/components/canvas/CanvasResizeBanner.vue
  - rendered as a slot at the top of the canvas
  - adopt mode: "Detected {media} on {printerName}.
                [Use this size]   ✕"
  - [Use this size] → media.pickDetected(payload.media), hide()
  - ✕ → hide(); no further nag until detectedMedia changes again
```

`printerName` is composed from `connection.family + connection.model`
(e.g. "Brother QL-820NWB") at the call site — the store carries
the resolved string so the component stays dumb.

**No auto-dismiss.** The banner stays until the user acts on it or
explicitly dismisses — a user who looks away should not silently
miss that their roll differs.

The sibling `amendment-canvas-resize-and-first-print.md` extends
this same store and component with an `overflow` mode for the
post-resize "{n} objects fall outside the label" case. The two
modes are mutually exclusive; overflow takes precedence over adopt
when both fire in the same tick (e.g. the user clicks [Use this
size] and the resulting canvas resize overflows existing content).

#### 4.5.3 Paper-Roll Change Path

When polling delivers a new `status.detectedMedia` that differs
from the previous one:

- The existing watcher fires (no new wiring at the polling site —
  `refreshStatus` continues to assign `detectedMedia`).
- Untouched → silent `pickDetected()`.
- Touched → `resizeBanner.showAdopt({ media, printerName })`.

Mid-print: the polling loop is paused via `notifyPrintStarted`
(§3.5), so detected-media changes during a print are picked up on
the next post-print tick — see edge case §5.7.

---

## 5. Edge Cases

### 5.1 Status Call Throws — Backoff & Circuit Breaker

Transport-level failure (USB disconnect, timeout). Today
`refreshStatus` swallows errors at `stores/printer.ts:152`; this
amendment moves the `try/catch` into `tick()` so backoff and the
circuit breaker can see them. Existing single-shot callers of
`refreshStatus` (e.g. `useAutoReconnect`) catch their own errors
already, so they keep working.

Behaviour:

1. **Backoff** (§3.2): consecutive throws push the next interval
   to 10 s, 20 s, 60 s. First successful tick resets to 5 s.
2. **Soft disconnect at 3 in a row**: after three consecutive
   transport failures, `stopPolling()`, mark the adapter as lost
   (clear it via `setAdapter(null)`), and let `useAutoReconnect`
   pick up recovery on its own cadence. Increment a session-level
   `pollFailCycle` counter.
3. **Circuit breaker**: if `pollFailCycle` hits 3 — i.e. polling
   has provoked three reconnect-then-fail-again cycles in this
   session — flip `circuitBroken.value = true`. Polling stays
   off for the rest of the session (`shouldPoll()` short-circuits
   on it). Connection itself is left alone; `useAutoReconnect`
   keeps working. A one-time toast surfaces "Status updates
   unavailable for this printer." Reset the counter only on a
   *manual* user reconnect (not on the auto-reconnect path), via
   a fresh `setAdapter()` from the connect flow.

Why a circuit breaker: without it, a printer whose firmware
throws on `getStatus()` (or a flaky USB cable) would re-enter the
polling/disconnect loop indefinitely, and `useAutoReconnect`
would oscillate. The breaker keeps the printer usable for
straight-print jobs even when status queries are broken.

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
but the contract allows it. Polling is paused while `isPrinting`
is true (§3.5), so any change is observed on the first post-print
tick rather than during the print itself. The watcher then routes
per §4.5.3: touched canvas → adopt banner; untouched → silent
`pickDetected`. No special handling needed.

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
  - ref<number> burstUntil
  - ref<boolean> circuitBroken (session-scoped)
  - refreshStatus extended: stores full PrinterStatus, throws on
    transport failure (try/catch lives in tick() now)
  - print() finally clause sets burstUntil
  - polling loop (start, stop, schedule, tick) with backoff
    (10s/20s/60s) and 3-cycle circuit breaker
  - watch(isPrinting) gates polling (no separate notify API)
  - visibility listener pinned at store init (single attach)
  - first-occurrence error tracking (Set<string>)

src/lib/printer/registry.ts
  - FAMILIES_WITH_STATUS_POLLING set
  - PER_MODEL_STATUS_POLLING_EXCLUSIONS set
  - exported model-key helper

src/stores/media.ts
  - watcher gate switch: source-based → canUndo-based (§4.5.1)
  - showAdopt branch when canvas is touched

src/stores/resizeBanner.ts                                  NEW
  - mode: 'idle' | 'adopt' (sibling extends with 'overflow')
  - payload: { media, printerName }
  - showAdopt(payload), hide()

src/components/canvas/CanvasResizeBanner.vue                NEW
  - adopt-mode rendering at the top of the canvas
  - [Use this size] → media.pickDetected; ✕ → hide
  - sibling extends with overflow-mode rendering

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
□ Add lastStatus, burstUntil, circuitBroken, error-codes-seen
  state to stores/printer.ts
□ Extend refreshStatus to assign lastStatus and throw on transport
  failure (try/catch moves into tick())
□ Implement shouldPoll, scheduleNextPoll, tick, startPolling,
  stopPolling per §3
□ Hook startPolling into setAdapter completion path
□ Hook stopPolling into disconnect path
□ Visibility listener attached ONCE at store init (not per-connect),
  internally gated via shouldPoll()
□ Backoff on consecutive failures (10s/20s/60s); reset on success
□ At 3 consecutive transport failures: setAdapter(null) +
  pollFailCycle++; let useAutoReconnect handle recovery
□ Circuit breaker: pollFailCycle === 3 → circuitBroken=true,
  one-time toast, polling stays off for the session; reset only
  on a manual reconnect

Family + model gates:
□ FAMILIES_WITH_STATUS_POLLING in registry.ts (brother-ql,
  labelwriter, labelmanager — all three)
□ PER_MODEL_STATUS_POLLING_EXCLUSIONS in registry.ts (empty initially)
□ Helper to compute model key `${family}:${model}`

Print-job integration:
□ Set burstUntil = Date.now() + 30_000 inside print()'s finally
  clause (before clearing isPrinting)
□ watch(isPrinting): true → stopPolling(); false → scheduleNextPoll()
□ No new exported notify API — call sites need no change

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
  localisedErrorMessage(error, t) per §4.4
□ Seed printer.error.* keys for the 9 canonical codes
  (no_media, not_ready, cover_open, paper_jam, cutter_jam,
  media_end, label_too_long, wrong_media, low_media)
□ Apply localisedErrorMessage anywhere errors are rendered:
  pill tooltip, popover list, print-button reason, toast

Auto-adopt gate & adopt banner:
□ src/stores/media.ts:354 — switch watcher gate from source-based
  (`source !== 'detected'`) to canUndo-based per §4.5.1
□ src/stores/resizeBanner.ts — pinia store with mode/payload,
  showAdopt(), hide() (adopt mode only; sibling adds overflow)
□ src/components/canvas/CanvasResizeBanner.vue — adopt-mode
  rendering, slot at top of canvas
□ Compose printerName from connection.family + connection.model
  at the showAdopt call site
□ Touched canvas + new detectedMedia → resizeBanner.showAdopt
□ Untouched canvas + new detectedMedia → silent pickDetected
□ [Use this size] calls media.pickDetected; ✕ hides without nag
□ No auto-dismiss timer on the adopt banner

i18n (other strings):
□ Pill state aria-labels (Ready / Warning: {message} / Error: {message})
□ "Last checked Ns ago" string
□ "(+N more)" suffix
□ Print button blocked tooltip prefix
□ Adopt banner: "Detected {media} on {printerName}." + "Use this size"
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
- isPrinting=true suspends polling; isPrinting=false resumes with
  burst (interval = 2000ms for 30s after print() finally clause)
- 3 consecutive throws from getStatus trigger backoff (10s, 20s, 60s)
- Successful tick after backoff resets to 5000ms
- 3 consecutive failures call setAdapter(null) and increment
  pollFailCycle (auto-reconnect picks up from there)
- Circuit breaker fires at pollFailCycle=3: circuitBroken=true,
  shouldPoll() returns false thereafter, one-time toast surfaces
- circuitBroken survives auto-reconnect cycles; only manual
  reconnect (fresh setAdapter on user action) resets it
- Visibility listener: attached once at store init; surviving
  10 connect/disconnect cycles without duplicate handlers
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

Auto-adopt gate (`stores/__tests__/media.test.ts`):
- Untouched canvas (canUndo=false) + new detectedMedia →
  pickDetected fires silently
- Touched canvas (canUndo=true, objects.length > 0) + new
  detectedMedia → resizeBanner.showAdopt fires; canvas unchanged
- Empty canvas with canUndo=true (user deleted everything) →
  silent pickDetected (no banner over a blank surface)
- Stale source: 'manual' from previous session, untouched canvas,
  printer connects → silent pickDetected (case the old source-based
  gate missed)
- detectedMedia matches current canvas → no-op (existing behaviour
  preserved)

Adopt-confirmation banner (`stores/__tests__/resizeBanner.test.ts`,
`components/canvas/__tests__/CanvasResizeBanner.test.ts`):
- showAdopt sets mode='adopt' and stores payload; hide() resets
  to mode='idle'
- Banner renders printer name (family + model) and media name in
  adopt mode
- [Use this size] calls media.pickDetected(payload.media) and hides
- ✕ hides without calling pickDetected
- No auto-dismiss timer fires after any duration

Paper roll change end-to-end:
- Status changes detectedMedia from 62mm to 29mm mid-session
- Untouched canvas → pickDetected fires silently
- Touched canvas → adopt banner shows printer + media, [Use this
  size] applies via pickDetected
- Polling pause during print: detectedMedia change observed
  during print is picked up on first post-print tick, not lost

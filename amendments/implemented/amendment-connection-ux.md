# label-maker — Amendment: Printer Connection UX

> **Status: implemented (2026-04-29).** Two-PR landing:
> - PR 1 — §5 cancel reset bug fix: `setAdapter(null)` unconditionally
>   transitions to `'disconnected'`. Regression tests for the
>   `connecting → null` and `error → null` paths.
> - PR 2 — §3 `useBrowserCapabilities` composable, §4 three-branch
>   connect-affordance UI (both / one / neither transport) with
>   browser-not-supported panel + per-browser copy + "Why this is?"
>   expander, §6 `PRINTER_HELP_URL` and inline help link in error
>   states. `useAutoReconnect` migrated to the composable; the
>   `isWebUsbAvailable` / `isWebSerialAvailable` helpers in
>   `connect.ts` remain for non-UI consumers.
>
> Out-of-scope items called out in §2 are still out: no WebBluetooth
> transport, no per-error-code help drill-down, no dynamic capability
> re-detection, no support-site content (the `PRINTER_HELP_URL`
> placeholder will 404 until the page lands).

> Three rough edges in the printer connection flow:
>
> **(a) Browsers without WebUSB / WebSerial / WebBluetooth** still
> see the "Connect printer" buttons. Today there's a small "WebUSB
> is not available" note, but the buttons themselves are still
> rendered and clickable, the user gets a confusing thrown error
> when they tap them, and there's no path forward — no hint that
> Chrome / Edge would work, no acknowledgement that Firefox is
> getting WebSerial in Nightly, nothing about why this is the case.
> Just a dead button.
>
> **(b) Connection errors surface raw exception messages** with no
> remediation path. The user sees something like "Failed to claim
> interface" and has no idea this is usually a Linux udev rule
> issue or a Windows missing-driver issue. We need a help-link
> affordance that points to documented platform-specific fixes
> (Linux udev rules, Windows Zadig). The support site doesn't
> exist yet but the link should — placeholder URL today, real
> content when the site lands.
>
> **(c) Connection cancel doesn't reset cleanly.** Real bug — the
> `setAdapter(null)` cancel path at `stores/printer.ts:106` only
> transitions to `disconnected` if the prior state was
> `connected`. After `setConnecting() → setAdapter(null)` (which
> is the cancel sequence), the conditional doesn't fire and the
> store stays stuck in `connecting`. PrinterStatus pill shows the
> animated "connecting" state forever; with the printer-status-
> polling amendment this would also leave that loop in a confused
> state.
>
> Fix all three. Pure label-maker scope; no driver or contracts
> changes.
>
> Sibling amendments:
> - `amendment-printer-status-polling.md` — the cancel-state bug
>   gets worse once polling depends on the connection-state
>   machine being clean. Fixing the bug here is a precondition
>   for that amendment landing reliably.
> - `amendment-canvas-resize-and-first-print.md` — the
>   "first-print friction" theme. This amendment is the same
>   kind of work for connect-time friction.

---

## 1. The Problem

### 1.1 Browser Capability — Buttons That Don't Work

`PrinterPopover.vue:8–22` renders the connect buttons
unconditionally for USB; the Serial button is gated on
`isWebSerialAvailable()`. There's a small `popover__note`
("WebUSB is not available") shown when WebUSB is missing — but
the USB button is **still rendered above it**. A Firefox stable
user sees a tappable Connect-USB button + a small disclaimer
note. Clicking the button throws ("WebUSB is not available in
this browser") which surfaces as the inline error. Confusing.

The user has no path forward. They don't know:
- That Chrome / Edge / Opera would work.
- That Firefox is shipping WebSerial in Nightly.
- That iOS / Safari can never support this (WebKit policy).
- That mobile Chrome on Android *does* support WebUSB.

### 1.2 Connection Errors Are Raw

`PrinterPopover.vue:78–86` catches the error and shows
`err.message` verbatim:

> "Failed to claim interface 0: Access denied (insufficient
> permissions)."

Common causes the user can't infer from this:
- **Linux:** missing udev rule for the device's VID/PID,
  requiring a one-line file in `/etc/udev/rules.d/`.
- **Windows:** missing or wrong driver — the device needs a
  WinUSB driver via Zadig for WebUSB to claim it.
- **macOS:** rare; usually a different already-running app
  has the device claimed.

There's no link from the error message to documented fixes.
Users hit this and bounce.

### 1.3 Cancel Bug

```typescript
// stores/printer.ts:88–110 (current)
function setAdapter(next: PrinterAdapter | null): void {
  adapter.value = next;
  if (next) {
    // ... transitions to 'connected' ...
  } else {
    // ... clears state ...
    if (connection.value.kind === 'connected') {  // ← BUG
      connection.value = { kind: 'disconnected' };
    }
  }
}
```

The `setAdapter(null)` branch was written assuming "we only
clear after a successful connection." But the cancel path is:

1. User clicks Connect USB → `setConnecting()` (state =
   `'connecting'`)
2. WebUSB picker opens
3. User dismisses picker → `NotFoundError` thrown
4. Catch block calls `setAdapter(null)` (state remains
   `'connecting'`)
5. State stays `'connecting'` forever; pill animates forever;
   user has to refresh the page to recover.

The fix is one line: drop the conditional, always transition
to `'disconnected'` when `next` is null.

---

## 2. Scope

In:
- **Browser-capability detection** centralised in a single
  composable (`useBrowserCapabilities`) returning reactive
  `webUsb`, `webSerial`, `webBluetooth` booleans. Replaces the
  scattered `isWebUsbAvailable()` / `isWebSerialAvailable()`
  helper calls.
- **Hide unavailable connect affordances.** When neither WebUSB
  nor WebSerial is available, the connect-buttons section is
  replaced by a calm explanation panel ("Connecting a printer
  needs Chrome, Edge, or Opera"). When only one transport is
  available, only the corresponding button is shown. Editor
  remains fully usable for design without a printer.
- **Per-browser hint copy** — soft suggestion, not a wall.
  Detect Chrome / Firefox / Safari / Edge via `navigator.userAgent`
  (best-effort, not security-critical) and show appropriate copy:
  Firefox users see a note that WebSerial is in Nightly; Safari
  users see that connection isn't supported on this engine.
- **Connection-error help link.** Errors surface a "Need help
  connecting?" link below the message that opens a configurable
  support URL in a new tab. URL lives in `src/lib/printer/help.ts`
  exported as `PRINTER_HELP_URL`. Initially points to a
  placeholder (the burnmark.io homepage or a "coming soon"
  page); production deploy can override via env var or constant
  bump when the support site ships.
- **Cancel reset bug fix.** `setAdapter(null)` always transitions
  to `'disconnected'` regardless of prior state. The conditional
  is dropped.
- **Cancel does not surface as an error.** Existing behaviour —
  `NotFoundError` is treated as a quiet cancel, not an error
  toast — is preserved and confirmed correct after the cancel-
  reset fix.

Out:
- **Bundling Chrome / building a desktop wrapper.** No PWA-as-
  desktop-app shenanigans here. We just guide users to a
  browser that supports WebUSB.
- **Adding WebBluetooth as a transport.** Detection seam exists
  but no transport landings. Brother QL-820NWB(c) speak Bluetooth
  SPP via the OS-paired serial picker; that's WebSerial, not
  WebBluetooth. WebBluetooth as its own transport is future scope.
- **Linux udev rules / Windows Zadig content.** The amendment
  links to a help URL; producing that page is a separate doc
  task on the support site.
- **Dynamic capability detection.** WebUSB / WebSerial support
  is module-load-time stable; we don't watch for them to appear
  mid-session. If a user installs a Firefox Nightly mid-session,
  they refresh.
- **Detecting failures that require very specific
  remediation.** The help link is one-shot — it points to a
  general troubleshooting page. Per-error-code drill-down
  (e.g. "Access denied → udev page" vs "Device busy → close
  other apps") is future scope.

---

## 3. Browser-Capability Detection

### 3.1 Composable

```typescript
// src/composables/useBrowserCapabilities.ts
import { computed, type ComputedRef } from 'vue';

export interface BrowserCapabilities {
  webUsb: ComputedRef<boolean>;
  webSerial: ComputedRef<boolean>;
  webBluetooth: ComputedRef<boolean>;
  hasAnyTransport: ComputedRef<boolean>;
  browser: ComputedRef<'chrome' | 'edge' | 'firefox' | 'safari' | 'opera' | 'other'>;
}

export function useBrowserCapabilities(): BrowserCapabilities {
  // Computed so they re-evaluate if module-mocked in tests.
  const webUsb = computed(() => typeof navigator !== 'undefined' && 'usb' in navigator);
  const webSerial = computed(() => typeof navigator !== 'undefined' && 'serial' in navigator);
  const webBluetooth = computed(() => typeof navigator !== 'undefined' && 'bluetooth' in navigator);
  const hasAnyTransport = computed(() => webUsb.value || webSerial.value);
  const browser = computed(() => detectBrowser());
  return { webUsb, webSerial, webBluetooth, hasAnyTransport, browser };
}

function detectBrowser(): 'chrome' | 'edge' | 'firefox' | 'safari' | 'opera' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/OPR\//.test(ua)) return 'opera';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'safari';
  return 'other';
}
```

Browser detection via UA is best-effort — not used for security,
just for messaging. False negatives mean we show generic
"unsupported" copy; false positives mean we suggest a browser
they're already on. Both are recoverable.

### 3.2 Migration

Replace direct calls to `isWebUsbAvailable()` /
`isWebSerialAvailable()` (in `connect.ts`, `PrinterPopover.vue`,
`useAutoReconnect.ts`) with the composable's reactive refs.
The helper functions in `connect.ts:40–48` stay (they're still
useful inside the connect functions themselves), but UI
consumers go through the composable for reactivity.

---

## 4. Connect-Affordance UI

### 4.1 The Three Branches

```
hasAnyTransport === true:
  - Render the existing connect buttons (USB, Serial as
    available)

hasAnyTransport === false:
  - Hide the connect buttons entirely
  - Render the "browser-not-supported" panel (§4.2)
```

When only one transport is available (WebSerial without WebUSB
— Firefox Nightly), render only that button. Today the WebUSB
button is unconditional and the WebSerial button is conditional;
swap to "render only what's supported."

### 4.2 Browser-Not-Supported Panel

```
┌──────────────────────────────────────────┐
│  Connecting a printer needs Chrome,      │
│  Edge, or Opera.                         │
│                                          │
│  You can keep designing here — printing  │
│  needs a different browser.              │
│                                          │
│  [Why this is?]                          │
└──────────────────────────────────────────┘
```

Per-browser variant copy (best-effort UA detection):

- **Firefox**: "WebSerial is shipping in Firefox Nightly. Stable
  Firefox can design but can't print to USB / serial printers
  yet — Chrome, Edge, or Opera work today."
- **Safari / iOS WebKit**: "Safari and iOS browsers don't
  support web printer connections. Use Chrome, Edge, or Opera
  on a desktop or Android."
- **Other / unknown**: "Use Chrome, Edge, or Opera to connect
  a printer."

The "Why this is?" expander reveals a brief explanation:
> "Connecting a printer from a website uses two web APIs —
> WebUSB and WebSerial — that ship in Chromium-based browsers.
> Firefox is starting to support WebSerial. Safari has chosen
> not to ship them. The editor itself works in any browser; only
> the printer-connection step needs Chromium."

Tone: factual, non-judgemental. Don't bash any browser.

The panel is part of the popover content, not a modal — users
can close the popover and continue designing without
interruption.

### 4.3 Reduced Connect Affordance When One Transport

If `webUsb` is false but `webSerial` is true (Firefox Nightly
case), render the Serial button as the primary affordance, no
USB button, and no "WebUSB unavailable" note (it's not
relevant). If `webSerial` is false but `webUsb` is true (every
common Chromium case today), render USB as primary; Serial
button hidden.

If both are true (Chrome / Edge / Opera), render both — USB
as primary, Serial as secondary with the existing Bluetooth-
hint title.

---

## 5. Cancel Reset Bug Fix

### 5.1 The Fix

`stores/printer.ts:88–110`:

```typescript
function setAdapter(next: PrinterAdapter | null): void {
  adapter.value = next;
  if (next) {
    const entry = next.device
      ? identifyByVidPid(next.device.vid ?? -1, next.device.pid ?? -1)
      : undefined;
    const fam: PrinterFamily =
      (entry?.family as PrinterFamily | undefined) ?? (next.family as PrinterFamily);
    connection.value = { kind: 'connected', family: fam, model: next.model };
    lastPaired.value = { family: fam, model: next.model };
    writeLastConnected(lastPaired.value);
  } else {
    detectedMedia.value = null;
    selectedMedia.value = null;
    lastPreview.value = null;
    connection.value = { kind: 'disconnected' };  // ← unconditional
  }
}
```

Drop the `if (connection.value.kind === 'connected')` guard.
Whenever `setAdapter(null)` is called, the state goes to
`'disconnected'`. There's no scenario where keeping a previous
non-disconnected state makes sense after the adapter is cleared.

### 5.2 Verifying the Cancel Path

After the fix:

1. `setConnecting()` — state = `'connecting'`
2. WebUSB picker opens
3. User dismisses → `NotFoundError`
4. Catch block calls `setAdapter(null)` — state =
   `'disconnected'`
5. PrinterPopover re-renders with the connect buttons; user
   can try again.

No error toast. No stuck pill. Clean reset.

### 5.3 Verifying the Error Path Still Works

For real connection errors (not user cancel):

1. `setConnecting()` — state = `'connecting'`
2. Connection attempt fails with a real error (e.g. "Failed to
   claim interface")
3. Catch block calls `printer.setError(message)` — state =
   `'error'` (with the message)
4. PrinterPopover renders the error inline with the new
   help-link affordance (§6).
5. User clicks Connect again → `setConnecting()` — state =
   `'connecting'`; cycle restarts.

The cancel fix doesn't touch the error path; both work.

### 5.4 Edge: setError → setAdapter(null) → setError

A bizarre sequence — but worth confirming. `setError` sets the
state to `'error'`. `setAdapter(null)` then transitions to
`'disconnected'`. Subsequent `setError` re-enters `'error'`.
Linear, no surprises.

---

## 6. Connection-Error Help Link

### 6.1 The Affordance

When `connection.kind === 'error'` or `connectError.value` is
set, render the error message followed by a "Need help
connecting?" link:

```
┌──────────────────────────────────────────┐
│ Couldn't connect:                        │
│ Failed to claim interface 0: Access      │
│ denied (insufficient permissions).       │
│                                          │
│ [Need help connecting? ↗]                │
└──────────────────────────────────────────┘
```

Link opens `PRINTER_HELP_URL` in a new tab (`target="_blank"`,
`rel="noopener noreferrer"`).

### 6.2 The URL

```typescript
// src/lib/printer/help.ts
export const PRINTER_HELP_URL = 'https://burnmark.io/help/connecting-a-printer';
```

Today this URL doesn't exist — it's a placeholder. Two
strategies:

- **Ship now, page later.** Land the link with the placeholder
  URL; the support site grows the page when written. The link
  404s briefly but the affordance is there. Users in this
  window aren't worse off than today (no link at all).
- **Conditional render.** Only show the link when a build flag
  / env var indicates the help page exists. Suppresses the
  affordance until ready. More accurate but requires a follow-up
  ship.

Pick **ship now**. The 404 is brief; the affordance is more
valuable than waiting for perfect content.

### 6.3 Eventual Page Content (Out of Scope)

The page itself isn't part of this amendment. For future
reference, what it should cover (per platform):

- **Linux**: udev rule one-liner for the printer's VID/PID,
  with a copy-pastable command. Group membership note for
  `plugdev` / `dialout`.
- **Windows**: Zadig walkthrough — install Zadig, replace the
  printer's driver with WinUSB. Screenshot per step.
- **macOS**: confirm no other app has claimed the device;
  occasional "did you eject and reconnect?" reset note.
- **Generic**: confirm browser is Chrome / Edge / Opera; try
  a different USB cable; try a different port (some USB-3
  hubs misbehave with bulk-only devices).

---

## 7. Edge Cases

### 7.1 Browser With WebUSB Disabled by Policy

Some enterprise Chrome installs disable WebUSB via policy. The
capability detection sees `'usb' in navigator` as true but
`requestDevice` always rejects. The error path handles this —
the user sees an error message + help link. The help page
should mention the policy case.

### 7.2 Mobile Chrome on Android

WebUSB is supported. Detection works. Users get the connect
buttons. WebSerial is not supported on mobile Chrome (only
desktop). Connection works for USB-OTG-attached printers,
which is unusual but not impossible. Don't special-case
mobile.

### 7.3 PWA Installed on iOS

iOS WebKit doesn't support WebUSB or WebSerial. PWA install
doesn't change that. Users see the browser-not-supported
panel with the Safari copy.

### 7.4 Help URL With Disabled-by-Default Telemetry

The help link is a plain external navigation; no analytics
beacon. If the support page itself adds telemetry, that's the
support site's concern.

### 7.5 User Toggles Between Browsers Mid-Session

Capability detection is module-evaluated; refresh required to
re-detect. Users switching browsers will start a fresh session
anyway (different browser = different tab / window).

### 7.6 Cancel During An In-Flight Status Refresh

Status polling (per the polling amendment) is gated by
`shouldPoll()`'s `connection.kind === 'connected'` check. With
the cancel fix landed, `setAdapter(null)` mid-status doesn't
strand the polling loop — `connection.kind` becomes
`'disconnected'` and the next `scheduleNextPoll()` sees that
and exits.

### 7.7 setError Then Connect Succeeds

User hits an error, clicks Connect again, succeeds. The error
message clears (via `connectError.value = null` at the start of
`connectUsb()` / `connectSerial()`). State transitions normally
to `'connected'`. No stale error sticking around.

---

## 8. Files Affected

```
src/composables/
  useBrowserCapabilities.ts     new — reactive capability +
                                browser detection composable
src/components/printer/
  PrinterPopover.vue            switch to the composable; render
                                the three-branch connect-affordance
                                (both / one / neither); render
                                the browser-not-supported panel;
                                wire the help link to error states
  ConnectAffordance.vue         (optional) extract the connect-
                                buttons + browser-not-supported
                                panel into its own component if
                                PrinterPopover.vue is getting long
src/lib/printer/
  connect.ts                    isWebUsbAvailable /
                                isWebSerialAvailable kept for
                                use inside connect functions; UI
                                consumers go through the composable
  help.ts                       new — exports PRINTER_HELP_URL
                                constant
src/stores/
  printer.ts                    drop the if-guard in setAdapter(null)
                                so cancel reliably resets to
                                'disconnected'
src/i18n/
  en.json + others              keys for browser-not-supported panel
                                copy (per-browser variants), help
                                link label, "Why this is?" expander
                                copy
```

No designer-core changes. No driver changes.

---

## 9. Implementation Checklist

```
Capability detection:
☑ src/composables/useBrowserCapabilities.ts — reactive webUsb,
  webSerial, webBluetooth, hasAnyTransport, browser
☑ Browser detection via UA (chrome / edge / firefox / safari /
  opera / other)
☑ PrinterPopover migrates from direct helper calls to the
  composable
☑ Other consumers (useAutoReconnect, etc.) migrate where they
  read capability state for UI purposes; internals can keep
  helper calls

Connect-affordance branches:
☑ When hasAnyTransport === false, hide buttons and render the
  browser-not-supported panel
☑ Per-browser copy variant (firefox / safari / other) in the
  panel
☑ "Why this is?" expander revealing the longer explanation
☑ When only one transport is available, show only that button
☑ Drop the unconditional WebUSB button + redundant
  "WebUSB unavailable" note

Cancel bug fix:
☑ stores/printer.ts setAdapter(null) drops the
  `if (connection.value.kind === 'connected')` guard
☑ Existing NotFoundError-as-quiet-cancel preserved in
  PrinterPopover.connectUsb / connectSerial
☑ Verify polling amendment's shouldPoll() check still works
  (it should — the gate is connection.kind === 'connected',
  not !disconnected)

Help link:
☑ src/lib/printer/help.ts exports PRINTER_HELP_URL
☑ PrinterPopover error display includes a "Need help
  connecting?" link opening PRINTER_HELP_URL in a new tab
☑ Link rel="noopener noreferrer"

i18n:
☑ printer.unsupportedBrowser.* (title, body, perBrowser.firefox/
  safari/other, whyExpander, whyExplanation)
☑ printer.helpLink ("Need help connecting?")
☑ Existing printer.noWebUsb removed — replaced by the panel
☑ Apply to en + every other locale
```

---

## 10. Tests

useBrowserCapabilities
(`composables/__tests__/useBrowserCapabilities.test.ts`):
- webUsb / webSerial / webBluetooth reflect navigator presence
- hasAnyTransport is true when at least one of webUsb / webSerial
  is true
- detectBrowser returns 'chrome' for Chrome UA, 'edge' for Edge UA,
  etc.
- Edge UA with `Edg/` prefix detected as edge (not chrome — Edge
  UA contains both)
- Opera UA with `OPR/` detected as opera
- Safari UA without `Chrome/` detected as safari (Chrome UA also
  contains `Safari/` but with `Chrome/` — distinguish)

PrinterPopover render branches
(`components/printer/__tests__/PrinterPopover.test.ts`):
- hasAnyTransport=true, both transports → both buttons visible
- hasAnyTransport=true, only USB → only USB button visible
- hasAnyTransport=true, only Serial → only Serial button visible
- hasAnyTransport=false → buttons hidden, browser-not-supported
  panel visible
- Firefox UA + no transport → "Firefox Nightly" copy
- Safari UA + no transport → "Safari / iOS WebKit" copy
- Other UA + no transport → generic copy

Cancel reset (`stores/__tests__/printer.test.ts`):
- setConnecting() then setAdapter(null) → connection.kind =
  'disconnected' (currently fails; passes after fix)
- setAdapter(adapter) (success) then setAdapter(null) →
  'disconnected' (preserves existing behaviour)
- setError(message) then setAdapter(null) → 'disconnected'

Help link
(`components/printer/__tests__/PrinterPopover.test.ts`):
- Error state renders the help link
- Link href is PRINTER_HELP_URL
- Link opens in new tab (target="_blank")
- Link has rel="noopener noreferrer"

End-to-end (manual):
- Firefox stable: open the popover → see browser-not-supported
  panel with Firefox-specific copy; no buttons
- Chrome: open the popover → see both buttons
- Click Connect USB, dismiss the picker → popover stays open with
  buttons (no stuck pill, no error)
- Click Connect USB, force a connection error → see error
  message + help link; clicking link opens the support URL in a
  new tab

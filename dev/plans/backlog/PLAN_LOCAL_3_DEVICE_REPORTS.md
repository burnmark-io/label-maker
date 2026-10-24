# Plan Local-3 — Surface device support status & solicit reports

> **Status:** Draft. Independent of Plan Local-2 (no UI dependency on
> multi-printer refactor) but reads cleaner if Local-2's connections
> panel exists; can land before, after, or alongside.
>
> **Goal:** when a paired device's `support.status` is anything other
> than `'verified'`, the user sees a calibrated, non-intrusive
> indicator and a one-click path to file a verification report (or
> read the existing quirks). Turns label-maker into a passive
> recruiter for the hardware-status corpus the contracts model is
> designed around.

---

## 0. What the contracts already give us

Each `DeviceEntry.support` carries:

- `status: 'verified' | 'partial' | 'broken' | 'untested'` (worst-case
  across transports and engines)
- `transports?: Partial<Record<TransportType, SupportStatus>>`
- `engines?: Record<string, SupportStatus>`
- `lastVerified?: string` (ISO date)
- `packageVersion?: string`
- `quirks?: string` (markdown, editorial)
- `reports?: readonly DeviceReport[]` (issue, reporter, date, result, os, notes, selfVerified)

This is enough to render every UI affordance below without further
contracts changes. Plan Local-3 adds **one** new optional field
(`reportUrl`) that is owed upstream; see §4.

---

## 1. UI — the badges

A small chip next to the model name on each connection card (Plan
Local-2) or in the single-printer status pill (today's UI), driven
purely by `device.support.status`:

| status     | colour | label             | tooltip                                                                                                                    |
| ---------- | ------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `verified` | (none) | —                 | (chip hidden)                                                                                                              |
| `partial`  | amber  | "Partial support" | `support.quirks` rendered as markdown                                                                                      |
| `broken`   | red    | "Known issues"    | `support.quirks` if present, otherwise generic copy                                                                        |
| `untested` | grey   | "Help us verify"  | "Nobody has reported back on this exact model — printing should work, but we'd appreciate a quick note on whether it did." |

Clicking the chip opens a side-sheet (`DeviceSupportSheet.vue`) with:

- Status reason (per-transport / per-engine breakdown if present).
- Last verified date and package version, if known.
- The full `quirks` markdown.
- "File a report" CTA → §3.
- Existing reports list (issue link, reporter, date, OS, result, optional notes).

Per-engine status (Local-2 + this plan together): if a slot's role is in
`support.engines` and worse than the chassis status (e.g. `support.status:
'partial'`, `support.engines.tape: 'broken'`), show the worse of the two on
that slot's chip.

---

## 2. Detection moments

The chip and sheet read live from the connected adapter — no extra
fetch. Triggers for nudging the user with a one-shot toast (not a
modal, never blocking):

- **First connect of an `untested` device in this browser.** Persist a
  `seen-untested:<family>:<model>` key in `localStorage` so the toast
  fires once per device, not every session.
- **Every connect of a `broken` device.** Worth re-warning; the user
  may have forgotten between sessions.
- **Successful first print of an `untested` device.** Soft prompt:
  "First print on a [model] looked clean — would you mind filing a
  one-line report so others see it as verified?" Same one-shot key.

Toasts always have a "don't ask again" affordance that flips a
preference (`preferences.dontAskForReports = true`) covering all
three triggers.

---

## 3. Filing a report

### 3.1 What goes in the request

A pre-filled GitHub issue URL with:

- **Title:** `verification: <family> <model> on <transport>`
- **Body** (markdown, generated):

  ```
  - Family: brother-ql
  - Model: QL-820NWBc
  - Package version: @thermal-label/brother-ql-web@0.4.0
  - Transport: bluetooth-spp (Web Serial via OS-paired SPP)
  - OS: macOS 14.5
  - Browser: Chrome 130
  - Result: ✅ printed cleanly

  Reported via burnmark label-maker. Notes:
  > [user types here]
  ```

The form lives in `DeviceReportForm.vue` — the user picks a result,
optionally types one line of notes, hits "open issue" and lands on
GitHub with the body pre-filled. We do not POST anywhere; the user
review-and-submits.

### 3.2 Diagnostic capture (optional, off by default)

A "include diagnostic snapshot" toggle that appends:

- Last `getStatus()` result (sanitized — no serials, no IPs)
- Detected media summary
- Pair-time transport (`usb` / `bluetooth-spp` / `serial` / etc.)
- The runtime-resolved `EngineDescriptor` set for this device

Store the snapshot in a `<details>` block at the bottom of the body.
Useful for reports of failure; pure noise for "it worked." Default
**off** to avoid the user accidentally over-sharing on the happy
path.

### 3.3 URL routing

This is the **one** open question. Each driver lives in its own repo
with its own issue tracker. We need a `(family) → repoUrl` table.

Two options:

#### 3.3.1 Hardcoded table in label-maker (ship now)

```ts
const REPORT_REPOS: Record<PrinterFamily, string> = {
  'brother-ql': 'https://github.com/thermal-label/brother-ql',
  labelwriter: 'https://github.com/thermal-label/labelwriter',
  labelmanager: 'https://github.com/thermal-label/labelmanager',
};
```

`reportUrl = `${REPORT_REPOS[family]}/issues/new?title=...&body=...&labels=verification`

Fast to land, brittle to repo renames or new families, lives in
label-maker only.

#### 3.3.2 `reportUrl` field on `DeviceRegistry` (ship as upstream amendment)

Add to `@thermal-label/contracts`:

```ts
export interface DeviceRegistry {
  schemaVersion: 1;
  driver: string;
  /** Optional GitHub repo for verification reports. */
  reportUrl?: string;
  devices: readonly DeviceEntry[];
}
```

Each driver's `data/devices.json` declares its own. label-maker
reads it. Gracefully falls back to 3.3.1's table when absent.

**Recommendation:** ship 3.3.1 immediately so this plan is
independent, then file the upstream amendment for 3.3.2 to migrate
to over time. Both can coexist — 3.3.1 becomes the fallback.

### 3.4 Body templates per family

The driver families differ slightly in the diagnostics they
care about. Brother QL wants firmware-bytes if the user has them;
LabelWriter wants the chassis serial-string LED suffix; LabelManager
wants whether the cartridge was genuine. Build a per-family
`buildReportBody(family, slot, status)` so the diagnostics block is
targeted, not a one-size-fits-all dump. The user-typed notes field is
shared.

---

## 4. Upstream amendment to file (drives §3.3.2)

Add to `@thermal-label/contracts`:

- `DeviceRegistry.reportUrl?: string`
- (Optional, second pass) `DeviceEntry.reportUrl?: string` for the rare
  per-device override case.

Land in contracts, then each driver's `data/devices.json` adds its own
`reportUrl`. label-maker switches its lookup to read from the
registry, with the in-app table as fallback for stale builds.

Tracker: open as a new amendment in `thermal-label/contracts/plans/`.

---

## 5. Richer media affordances (free wins from contracts unification)

Not strictly about reports, but the same release that ships the
status badges should also surface the new `MediaDescriptor` fields,
since they cost ~10 lines per affordance:

- `cornerRadiusMm`: round-corner indicator on the canvas frame for
  die-cut media. Round labels (`cornerRadiusMm = widthMm / 2`)
  collapse to a circle.
- `printMargins`: render a soft "safe area" outline on the canvas, so
  designers see the die-cut/feed-tolerance buffer without us
  re-calculating per-driver.
- `skus`: show vendor SKUs next to media name in the selector
  (`62×29 mm — DK-11209 / 30334`).
- `category`: section the media list ("Address", "Shipping",
  "Continuous", "Cartridge", "Tape").
- `targetModels`: when paired with a Duo (Plan Local-2), filter the
  media list to media whose `targetModels` matches the active engine's
  `mediaCompatibility`. For single-engine devices the list is
  unchanged.

These pieces are independently shippable and have no dependency on
the report flow.

---

## 6. Verification

Smoke matrix:

| scenario                             | expected                                                       |
| ------------------------------------ | -------------------------------------------------------------- |
| pair `verified` device               | no chip; sheet still openable from card kebab menu             |
| pair `untested` device first time    | grey chip; one-shot toast with "Help verify" CTA               |
| click "File a report"                | new tab opens GitHub issue editor with title + body pre-filled |
| pair `partial` device                | amber chip; sheet shows quirks markdown                        |
| pair `broken` device                 | red chip; toast every session; sheet shows quirks              |
| toggle "include diagnostic snapshot" | body appends `<details>` block; sanity-check no PII            |
| flip `dontAskForReports` preference  | toasts suppressed everywhere; chip + sheet still work          |

```bash
pnpm typecheck
pnpm test
```

---

## 7. Out-of-scope

- Auto-submitting reports without user review. Keeping the user in
  the loop on what gets posted to a public issue tracker is a
  feature, not a friction.
- Aggregating reports across users into label-maker (the source of
  truth stays in each driver's `hardware-status.yaml` / accepted
  issue trail; we are a router into that, not a mirror of it).
- Per-driver-version skew handling. If a paired device's
  `support.packageVersion` is older than the linked package's
  version, just label "verified against [old version]" in the sheet
  and trust the user to read it.

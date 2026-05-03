# Plan Local-4 — Unified output target menu (device + paper)

> **Status:** Draft.
>
> **Goal:** Replace today's two separate topbar controls — `LabelSizeSelector`
> (📐) and `PrinterPopover` — with a single **Output Target Menu**. Every
> output target is a first-class row: each connected thermal printer, plus
> a permanent "PDF sticker sheet" target. Paper / media selection lives
> inside the active target's expanded card, not as a separate menu.
>
> **Independent of:** any in-flight contracts work. This is a label-maker
> UI refactor on top of stores that already exist (`printer.ts`,
> `media.ts`, `print-config.ts`).

---

## 0. Why this exists

Today the topbar has two siblings:

- `PrinterPopover` (centre) — picks the active printer / slot, shows
  status + the per-slot detected/selected media as a non-clickable
  sub-line.
- `LabelSizeSelector` (left) — picks paper size, orientation, sheet
  template, custom size. Lives a fair distance from the printer pill.

Three problems fall out of that split:

1. **Cognitive distance.** Printers that don't auto-detect media (most
   LabelWriter cartridges, Brother continuous, every D1 tape) require
   the user to set paper at a *different* topbar control than the one
   where they picked the printer. Not obvious.
2. **Mobile space.** Two controls + brand + actions don't fit at
   <720px; we already hide the brand name and shrink the size button to
   140px.
3. **PDF/sheet output is a second-class citizen.** Sticker-sheet output
   is reachable only via the size menu (sheet picker), the Print popup,
   or the Output tab. Nothing on the topbar tells a disconnected user
   "you can still produce a label — pick a sheet."

`print-config.ts` already models output as
`destination: 'thermal' | 'sheet'`. The store abstraction is right;
the UI just hasn't caught up to it.

---

## 0.5 Guiding principles for execution

These constraints take precedence over any specific instruction below.
If a step appears to contradict them, follow the principle and flag the
inconsistency.

- **Sheet output is a first-class target, not a fallback.** A user who
  designs for Avery sheets and never owns a thermal printer must be
  able to do their entire job from this menu without ever feeling like
  the app is in a degraded state. The PDF target row sits in the same
  list as thermal printers, with the same affordances (active-state
  ring, expandable paper card, status-equivalent line).
- **Sheet target is a destination, NOT a pseudo-printer.** Do *not*
  introduce a fake `Connection` / `PrinterAdapter` to model it. The
  store boundary is: `printer.ts` owns connected hardware;
  `print-config.ts` owns destination + sheet template;
  `media.ts` owns canvas dimensions. The new menu is a *view* over
  all three. Anything that requires modifying a `Connection` shape to
  accommodate "the PDF one" is a wrong turn.
- **Rails not walls.** Guide with defaults; never disable, hide, or
  gate. The sheet row is always visible (even when a printer is
  connected and ready). The thermal rows are always visible (even
  when none are connected — the row becomes the connect CTA). Paper
  picks that don't match an engine's `mediaCompatibility` warn but
  proceed (existing behaviour from Plan Local-2 §0.5; preserve it).
- **1-target case must feel as light as today's UX.** When exactly
  one target is in play (one connected printer **and** sheet not in
  use, OR no printer **and** the user is in sheet mode), the menu
  collapses visually so the user doesn't see ceremony for a choice
  they aren't making. The full multi-target list only mounts when
  multiple targets are realistic. (Same shape rule as Plan Local-2
  §0.5: a one-printer user must not be able to tell the refactor
  happened.)
- **Realistic distribution still applies.** From
  `project_printer_distribution`: most users pair 1 thermal printer,
  some pair 2, effectively nobody runs Duo/Twin. Optimise polish for
  1-printer + sheet, and 2-printer + sheet. Don't gold-plate the
  many-thermal case.

## 0.6 Prerequisite spikes — do these first

Two upstream questions can invalidate the shape of this plan. Resolve
both before starting §2.

1. **Sheet picker re-entry.** `LabelSizeSelector` mounts
   `SheetPickerDialog` inline. After the merge, the sheet picker is
   launched from the PDF row inside `OutputTargetMenu`. Confirm the
   dialog is OK to be hosted from a popover (z-index, click-outside,
   focus return). If the dialog steals focus from the popover and
   collapses it on open, host the dialog at app-shell level and
   trigger via an event/store flag instead of mounting it inside the
   menu. Spike outcome: a one-line note in this plan saying which
   hosting strategy we use.
2. **Trigger label width budget.** The new trigger replaces both
   today's controls. Worst-case label is something like
   `● QL-820NWB Premium Edition · 62mm continuous`. Measure the
   widest realistic string at the topbar's actual font, decide the
   collapse breakpoints (full / printer-only / icon-only), and write
   them into §3.2 before implementation.

---

## 1. Scope

### In scope

- New component `OutputTargetMenu.vue` replacing both
  `PrinterPopover.vue` and `LabelSizeSelector.vue` on the topbar.
- New trigger that shows status + active target + active paper in
  one pill.
- Sheet template picker reachable from the menu's PDF row.
- Orientation, custom size, common-sizes list — all relocated *inside*
  the active target's expanded card.
- Mobile responsive treatment.
- Tour anchor migration (`data-tour="printer"`, `data-tour="label-size"`).
- i18n keys: rename / consolidate where it makes sense; preserve any
  shared keys that other surfaces still use.

### Out of scope

- Print popup (`CanvasActions` print dropdown). It remains the place
  for *output controls* (copies, density, range, destination toggle
  when both are possible). The new menu is *target + paper* only.
- Output tab `SaveAsFileSection` and PNG/PDF buttons. Untouched.
- Store shapes. `printer.ts`, `media.ts`, `print-config.ts` stay as
  they are; we add at most read-only computed selectors. No new
  pseudo-printer, no `kind: 'virtual'` branches.
- Adding new printer families or engines.
- Bluetooth/Web TCP transports.

### Non-goals (explicit)

- A "PDF printer" connection object. The whole point of this plan is
  to give sheet output equal *visual* status without paying the
  *architectural* cost.
- Renaming `destination: 'thermal' | 'sheet'`. The store wording is
  fine; only the UI changes.
- Removing the Print popup's destination toggle. When both targets are
  possible at print time, the Print popup still asks. The new menu
  is about *which target is active*; the popup is about *which
  destination this print run goes to*. They cooperate.

---

## 2. Conceptual model

### 2.1 What is an "output target"?

An output target is a row in the new menu. Three kinds:

| Kind | Source | Active means | Paper card contents |
|---|---|---|---|
| `thermal-slot` | every `EngineSlotState` across every `Connection` in `printer.ts` | `printer.activeSlot` matches this slot | engine-filtered media list (`getMediaForEngine`), orientation, custom size |
| `sheet` | always present, regardless of connection state | `printConfig.effectiveDestination === 'sheet'` *or* `media.source === 'sheet'` (see §2.4) | sheet picker launcher, current sheet detail, orientation, custom size |
| `connect-cta` | shown only when `printer.connections.size === 0` | n/a — this row is an action, not a target | n/a |

The `connect-cta` is *not* a target you can leave active; tapping it
opens the USB / serial picker. Once a printer is paired it disappears
and the new thermal-slot row takes its place. The sheet row is always
present and always live.

### 2.2 "Active" semantics across two stores

Today "active target" is split across two stores and the new menu has
to reconcile them:

- A thermal slot is active when `printer.activeSlot` points at it.
- The sheet target is active when the user is *designing for / printing
  to* a sheet.

Define a single derived computed in the menu (NOT in a store — see
§0.5: don't reshape stores):

```ts
type ActiveTarget =
  | { kind: 'thermal'; connectionId: string; role: string }
  | { kind: 'sheet' }
  | { kind: 'none' }; // genuinely nothing (no printer, no sheet picked)
```

**Resolution rule (read-only, derived):**

1. If `media.source === 'sheet'` → `{ kind: 'sheet' }`.
   *Rationale:* the user designed the canvas for a sheet; that's the
   strongest signal. Beats `printConfig.destination` because the
   destination toggle is for runtime overrides, not "what is this
   document about".
2. Else if `printer.activeSlot` is set → `{ kind: 'thermal', … }`.
3. Else → `{ kind: 'none' }`.

The trigger label and the active-state ring use this single value.
There is no other source of truth.

### 2.3 Activating a target

| User action | Store calls |
|---|---|
| Tap a thermal-slot row | `printer.setActiveSlot({ connectionId, role })`; if `media.source === 'sheet'`, **also** `media.clearSheet()` (or equivalent: revert canvas to detected/selected slot media). See §2.4. |
| Tap the sheet row (no sheet picked yet) | Open `SheetPickerDialog`. On select: `media.pickSheet(sheet)` + `printConfig.recordCanvasSheetPick(sheet)` (existing behaviour). |
| Tap the sheet row (sheet already picked) | Re-assert: ensure `media.source === 'sheet'` and the canvas matches `printConfig.sheetTemplate`. If `media.source` is *not* `'sheet'` because a thermal slot is currently active, call `media.pickSheet(printConfig.sheetTemplate)` to switch back. No dialog. |
| Tap "Connect printer" CTA | Existing `runConnect` flow from `PrinterPopover.vue`. |

The "switch back to a previously-picked sheet without re-opening the
picker" path is the key affordance that makes sheet output feel
first-class. Today it doesn't exist — toggling between thermal and
sheet means re-opening the size menu and re-finding the sheet entry.

### 2.4 Cross-target switching: what happens to the canvas?

This is the trickiest interaction, and the place this plan most needs
to be pinned down.

**Switching from thermal → sheet** (existing behaviour, keep): the
sheet template's label dimensions become the canvas; `media.source`
flips to `'sheet'`.

**Switching from sheet → thermal:** today, picking a printer media
entry calls `media.pickPrinterMedia(m)` which sets `source = 'manual'`.
That implicitly drops the sheet relationship from the canvas. Keep
that behaviour. But: if the user *just taps the thermal row's title*
without picking a specific media, we should *not* silently change the
canvas size — they may want to keep designing at the sheet's
dimensions and just change which device is "active" for status
purposes. **Decision:** tapping the thermal row's *title* only changes
`activeSlot`; canvas/media is untouched. Picking a *paper entry inside
the row* is the affirmative resize.

This means the active-state ring and `media.source === 'sheet'` can
diverge transiently: user has a Brother slot active **and** a sheet
on the canvas. Resolution rule §2.2 says sheet wins for the trigger
label. That's intentional — the trigger reflects what the user is
*designing for*, not which printer is selected for status polling.

When this divergence exists, the sheet row's expanded card shows a
small note: *"Status from QL-820NWB; printing to PDF sheet."* No
confusion, no walls.

### 2.5 What `effectiveDestination` does NOT do

`print-config.ts` has `effectiveDestination` which auto-falls-back
when one destination is impossible. The new menu does **not** use
`effectiveDestination` for its trigger label or active state — it
uses the raw `media.source` + `activeSlot` derivation in §2.2.
`effectiveDestination` remains the right answer for the *Print popup*
and any actual print pipeline, but the menu's job is to reflect what
the *user has chosen*, not what the system would do if asked to print
right now. Two different questions.

---

## 3. UI specification

### 3.1 Topbar layout after merge

```
[🏷 Burnmark]     [● QL-820NWB · 62mm continuous ▾]     [↶][↷][📚 Library][⇪ Share][? Help]
   left              centre — single trigger              right — actions unchanged
```

`topbar__left` keeps brand only. The merged trigger lives in
`topbar__center`. `topbar__actions` unchanged.

### 3.2 Trigger label

The trigger is a status pill + label + chevron. Content is purely
derived from `ActiveTarget`:

| ActiveTarget | Status indicator | Label |
|---|---|---|
| `thermal` | per-connection dot (green/yellow/red/gray, current logic from `PrinterPopover`'s `dotClassFor`) | `${nickname ?? model} · ${selectedMedia?.name ?? detectedMedia?.name ?? t('media.notSet')}` |
| `sheet` | 📄 glyph (no status dot) | `${sheet.brand} ${sheet.part}` (e.g. `Avery L7163`) |
| `none` (no printer + no sheet) | gray dot | `t('output.pickTarget')` ("Pick output…") |

**Width collapse breakpoints** (finalise during §0.6 spike 2):

- ≥ 900px: full label, both halves.
- 720–900px: collapse to `nickname ?? model` only (drop `· paper`),
  paper still visible inside the menu.
- < 720px: icon + chevron only (`● ▾` / `📄 ▾`); the menu carries
  the label.

Tour anchor: `data-tour="output-target"`. Migrate the two existing
anchors (`data-tour="printer"`, `data-tour="label-size"`) — search the
tour script and update both pointers to the new single anchor.

### 3.3 Menu panel — structure

```
┌─ OUTPUT TARGETS ──────────────────────────┐
│                                            │
│  ●  QL-820NWB                 ← active    │  ← thermal slot row
│     62mm continuous (detected)            │
│     ┌──────────────────────────────────┐  │
│     │ Orientation:  [▯ vertical] [▭]   │  │  ← expanded paper card
│     │                                  │  │     (only on active row)
│     │ MEDIA FROM PRINTER               │  │
│     │ ▸ 62mm continuous ✓ (detected)   │  │
│     │ ▸ 62×29mm die-cut                │  │
│     │ …                                │  │
│     │                                  │  │
│     │ Custom size: [__]mm × [__]mm     │  │
│     │                                  │  │
│     │ [Disconnect]                     │  │
│     └──────────────────────────────────┘  │
│                                            │
│  ○  LabelWriter 450                       │  ← collapsed thermal row
│     89×28mm address                       │
│                                            │
│ ─────────────────────────────────────────  │
│                                            │
│  📄 PDF sticker sheet                     │  ← sheet target row
│     Avery L7163 — change…                 │
│                                            │
│ ─────────────────────────────────────────  │
│                                            │
│  [+ Pair another printer]                 │  ← always reachable
│                                            │
└────────────────────────────────────────────┘
```

When the active target is the sheet row, *its* card expands and shows:

```
┌──────────────────────────────────┐
│ Orientation:  [▯] [▭]            │
│                                  │
│ SHEET TEMPLATE                   │
│ Avery L7163 — 21 labels per page │
│ [Change template…]               │
│                                  │
│ Custom label size:               │
│   not applicable while a sheet   │
│   is selected. Pick "Custom" in  │
│   the change-template dialog or  │
│   start from a thermal target.   │
└──────────────────────────────────┘
```

**Rails not walls reminder:** "Custom label size" inside the sheet
card is *informational*, not disabled. The user can still navigate
out (pick a thermal target, set a custom size, come back). We are
guiding, not blocking.

### 3.4 Empty / disconnected states

#### Nothing connected, no sheet picked

```
┌─ OUTPUT TARGETS ──────────────────────────┐
│                                            │
│  📄 PDF sticker sheet                     │  ← sheet always present
│     Pick a sheet template…                │
│                                            │
│ ─────────────────────────────────────────  │
│                                            │
│  [+ Connect a printer]                    │  ← USB / serial primary CTA
│                                            │
│  Why don't I see my browser? ▾            │  ← unsupported-browser path
│                                            │
└────────────────────────────────────────────┘
```

The unsupported-browser copy from today's `PrinterPopover` (lines
6–23) moves into the expander under the connect CTA. Same
i18n keys.

#### Nothing connected, sheet picked

Sheet row is active. The trigger label reads `📄 Avery L7163`. The
"+ Connect a printer" row is below the sheet row. No status pill in
the trigger because there's no printer to have status.

#### Connecting (USB/serial dialog open)

Today's `setConnecting` state surfaces as a button with a spinner.
Keep that — the connect CTA row shows a loading state until the
adapter lands or the user dismisses the OS picker.

### 3.5 Multi-slot (composite chassis) — preserve Plan Local-2 behaviour

Each `EngineSlotState` is its own row. Role suffix follows the
existing rule: `nickname ?? model` for `role === 'primary'`, else
`${nickname ?? model} — ${role}`. No special chassis-grouping
visual; matches the flat-list decision in `PrinterPopover.vue`
(`flatSlotEntries`).

### 3.6 Errors and `lastChecked`

Existing `PrinterPopover` patterns apply per-row:

- Per-row error list under the row title when `conn.status.errors`
  is non-empty.
- `lastCheckedSeconds` shown only inside the *active* row's expanded
  card (we don't need to ticker every collapsed row).
- Toast-on-fresh-error logic from `PrinterPopover.vue` lines 284–301
  moves to the new component verbatim.

---

## 4. Interaction details

### 4.1 Click affordances per row

Each thermal-slot row has:

- **Click on row body** → `setActiveSlot`. Does NOT change canvas/media
  (see §2.4). If the row is already active, clicking re-collapses
  any expanded card if that proves nicer in usability — flag for
  validation during build.
- **Click on a media entry inside the expanded card** →
  `media.pickPrinterMedia(m)`. Closes the menu (matches today's
  `LabelSizeSelector` behaviour — see line 236).
- **Click on a custom-size submit** → `media.pickCustom(w, h)`.
  Closes the menu.
- **Click on Disconnect** → `removeConnection(id)`. Stays open if
  other connections remain; closes if the last one was removed.

Sheet row:

- **Click on row body when sheet not picked** → opens
  `SheetPickerDialog`. After select: row becomes active,
  `recordCanvasSheetPick` fires, menu closes.
- **Click on row body when sheet already picked** → ensures
  `media.source === 'sheet'` (re-applies sheet if a thermal target
  was active and changed canvas dims), closes menu.
- **Click on "Change template…"** → `SheetPickerDialog`. After
  select: same as above.
- **Click on orientation buttons** → `media.setOrientation(o)`.
  Stays open (matches today's behaviour for orientation; orientation
  is not "the choice", it's a tweak).

Connect CTA:

- **Click** → `runConnect(requestUsbPrinter, additive=true)` (or
  serial fallback). Re-use the existing helper from
  `PrinterPopover.vue` — extract to `useOutputTargetActions.ts`
  composable to avoid duplicating the 30-line function across two
  components during the migration.

### 4.2 Menu open/close

- Click outside → close. Same `onDocumentClick` pattern as today.
- ESC → close. (Today's popovers don't bind ESC; add it. Cheap win.)
- Selecting a media entry / custom size / sheet template → close.
- Pairing a printer → close on success (matches `runConnect(additive=false)` today).
- Toggling orientation → stay open.
- Switching active target by tapping a row title → stay open
  (the user is exploring; let them tap around without re-opening).

### 4.3 Keyboard navigation

Tab order: trigger → first row → expanded-card controls → next row →
… → connect CTA. Each row is a button; the expanded card's controls
are individually focusable. Use `aria-expanded` on rows that have a
paper card (active thermal, sheet). Use `role="dialog"` on the panel,
`aria-label="Output target"`.

This is more than today's popover offers; it's a side benefit of the
merge. Don't gold-plate — basic Tab/Enter/Esc is enough for v1.

### 4.4 Toasts

Preserve today's two:

- `media.toast.overrodeDetected` when picking a printer media that
  isn't the auto-detected one (`LabelSizeSelector.vue` line 234).
- `media.toast.appliedSheet` when picking a sheet (line 250).

No new toasts. Switching active target without changing canvas does
not warrant a toast.

---

## 5. Component plan

### 5.1 New files

```
src/components/output/
  OutputTargetMenu.vue          ← the unified popover (replaces both)
  OutputTargetTrigger.vue       ← the topbar pill (status + label + chevron)
  OutputTargetRow.vue           ← row component for one target
                                  (slot OR sheet — discriminated by prop)
  OutputTargetPaperCard.vue     ← expanded card body
                                  (delegates to existing CustomSizeInput)
src/composables/
  useOutputTargetActions.ts     ← extracted runConnect, removeConnection,
                                  setActiveSlot, setSheet, etc.
src/stores/output-target.ts     ← OPTIONAL. Only add if the derived
                                  ActiveTarget computed is referenced
                                  from >2 places. Otherwise inline in
                                  OutputTargetMenu.vue and skip the file.
```

### 5.2 Files modified

```
src/components/layout/TopBar.vue
  - drop LabelSizeSelector import & mount
  - drop PrinterPopover import & mount
  - add OutputTargetTrigger (mounts OutputTargetMenu via slot/portal)
  - update tour anchor
  - update mobile media queries (no more two-control crowding)
```

### 5.3 Files deleted

```
src/components/printer/PrinterPopover.vue       ← replaced
src/components/printer/PrinterStatus.vue        ← absorbed into trigger
src/components/media/LabelSizeSelector.vue      ← replaced
```

`SheetPickerDialog.vue`, `CustomSizeInput.vue`,
`useBrowserCapabilities.ts`, `usePrinterErrors.ts`, all `lib/printer/*`
helpers — **untouched**, re-used by the new menu.

### 5.4 Stores

**No store changes.** Menu reads:

- `usePrinterStore` — `connections`, `activeSlot`, `isConnected`,
  `setActiveSlot`, `setAdapter`, `addConnection`, `removeConnection`,
  `disconnect`, `lastStatus`, `lastStatusAt`, `circuitBroken`,
  `seenErrorCodes`, `markErrorCodesSeen`, `clearSeenErrorCodes`,
  `family`, `model`, `detectedMedia`, `totalSlotCount`.
- `useMediaStore` — `source`, `widthMm`, `heightMm`, `orientation`,
  `sheetCode`, `pickPrinterMedia`, `pickCommonSize`, `pickSheet`,
  `pickCustom`, `setOrientation`. Plus a small new
  read-only computed: `isCanvasDrivenBySheet` (already implicit in
  `source === 'sheet'`; no new method needed).
- `usePrintConfigStore` — `sheetTemplate`, `recordCanvasSheetPick`.
  (No `setDestination` call from the menu — destination toggling is
  the Print popup's job.)

If any of the menu's logic *needs* to write to `printConfig.destination`
to make sheet-target activation feel right, that is a sign we're
modelling the wrong thing. Push back; revisit §2.2/§2.4.

### 5.5 i18n

- Keep all existing keys live until the new component ships, to avoid
  broken keys mid-migration.
- Add new keys:
  - `output.menu.title` — "Output target"
  - `output.targets.heading` — "Output targets"
  - `output.pickTarget` — "Pick output…"
  - `output.sheet.row.title` — "PDF sticker sheet"
  - `output.sheet.row.empty` — "Pick a sheet template…"
  - `output.sheet.row.changeTemplate` — "Change template…"
  - `output.sheet.row.customSizeNote` — informational text from §3.3
  - `output.connect.cta` — "Connect a printer"
  - `output.targets.statusFromOtherSlot` — for the §2.4 divergence note
- Migrate (rename, or alias):
  - `printer.*` → keep, still used inside thermal rows.
  - `media.*` → keep, still used inside paper cards.
  - `media.selector.label` → unused after merge, mark for removal.

Run `grep -r "media.selector.label\|printer.popoverTitle"` before
deleting to make sure no other surface relies on them.

---

## 6. Edge cases — explicit decisions

| Case | Decision | Why |
|---|---|---|
| Printer connects mid-design while user is in sheet mode | Sheet stays active. The new thermal row appears collapsed. Trigger label still shows the sheet. No popup, no auto-switch. | Rails not walls. Surprise auto-switches are the worst kind of wall. |
| Last printer disconnects while it was active | If `media.source === 'sheet'`, sheet target becomes active (trigger updates). If not, `ActiveTarget = none` and trigger reads "Pick output…". | Matches §2.2 resolution rule. |
| User opens a document whose canvas was sized for a sheet, no printer connected | Sheet row is active. Existing `media.source === 'sheet'` survives document load. | Existing behaviour, preserve. |
| User opens a document sized for a thermal media, with a different printer connected | Sheet row inactive; thermal row active; the active row's paper card shows the document's size, even if it's not in the engine's `mediaCompatibility`. Add a small "may not match this printer" hint. Don't disable. | Rails not walls; Plan Local-2 §0.5 already says don't gate on `mediaCompatibility`. |
| Two-of-same-model paired (no nicknames yet) | Falls back to the existing nickname/fingerprint disambiguation from Plan Local-2. Each row title shows model + last-4 of fingerprint until renamed. | Inherit, don't re-solve. |
| User picks a sheet template in the Print popup that differs from the canvas | Today: per-doc `overrideByDoc` is set; canvas unchanged; trigger label still shows the canvas's sheet. Keep that. The Print popup's "(override)" hint already exists (`sheetOverrideActive`). The menu doesn't reflect overrides — overrides are a print-time concept, not a target choice. | Honour `print-config.ts`'s existing two-level model. |
| Mobile portrait, panel taller than viewport | Panel scrolls internally (`max-height: 70vh`, same as today's `LabelSizeSelector`). Active row's expanded card auto-scrolls into view on activation. | Existing pattern; keep. |
| User has zero printers and zero sheet picked, hits Print/Export from the canvas action bar | Out of scope here — `CanvasActions` handles its own first-run CTA (today's `print-config.ts` §3.4 reference). The new menu's job is just to be a viable entry point ("Pick a sheet template" is one click away). | Don't grow scope. |

---

## 7. Migration & rollout

This is a UI-only change with no store migration, but it touches a
visible, frequently-used piece of chrome. Stage as follows:

1. **§0.6 spikes** — sheet-dialog hosting + width budget. Output: two
   short notes pinned into this plan (overwrite §0.6).
2. **Skeleton PR.** New components mounted behind a dev flag
   (`localStorage.burnmark.outputTargetMenu === '1'`) that swaps the
   topbar render. Feature-flag is dev-only — no UI for it. Lets us
   land the new code without users seeing it. Old components stay.
3. **Iterate behind the flag.** All real interaction work happens
   here. Tour anchor stays on the old controls during this phase
   (the new menu is opt-in only).
4. **Cutover PR.** Flip the flag default, swap the tour anchor,
   delete `PrinterPopover.vue` / `PrinterStatus.vue` /
   `LabelSizeSelector.vue`, drop the dead i18n keys. One commit;
   easy to revert if a regression surfaces in production.
5. **Cleanup PR (optional).** Whatever simplifications fall out of
   the merge — duplicated CSS tokens, dead helpers, etc.

No database migration, no localStorage migration. The
`burnmark.lastConnected` / `burnmark.sheetTemplate` keys keep doing
their job; only the UI that reads them changes.

---

## 8. Test plan

Vitest / Vue Test Utils where the existing components have coverage;
otherwise manual verification noted explicitly.

### 8.1 Unit / component

- `OutputTargetMenu` renders one row per slot per connection.
- Sheet row is always rendered, regardless of connection state.
- Connect CTA appears iff `printer.connections.size === 0`.
- `ActiveTarget` resolution rule (§2.2) — table-driven tests over
  the cross product of `media.source`, `printer.activeSlot`, and
  `connections.size`.
- Trigger label collapse breakpoints render at the right viewport
  widths (use ResizeObserver or a width-prop fake).
- Tapping a thermal row title sets `activeSlot` and does NOT call
  `media.pickPrinterMedia` / `media.pickCustom` / `media.pickSheet`.
- Tapping a media entry inside a thermal card calls
  `media.pickPrinterMedia` and closes the menu.
- Tapping the sheet row when no sheet is picked opens the picker.
- Tapping the sheet row when a sheet *is* picked but a thermal target
  is currently active calls `media.pickSheet(printConfig.sheetTemplate)`
  *without* opening the dialog.
- Disconnect on the last connection closes the menu.

### 8.2 Manual verification (UI / golden path)

Per CLAUDE.md guidance: start dev server, exercise in browser.

- 1 thermal printer, no sheet — single row, collapses to today's
  visual weight (§0.5 rule).
- 1 thermal + sheet picked, switching back and forth via row taps
  feels first-class (no dialog re-entry).
- 0 printers + sheet picked — trigger reads sheet, design works end
  to end.
- 0 printers + no sheet — connect CTA visible, sheet row visible,
  picking a sheet via the menu changes canvas correctly.
- Mobile (devtools 360px wide) — trigger collapses to icon, panel
  scrolls, all paths reachable.
- Two printers paired — both rows visible, `setActiveSlot` works,
  per-row error and status surface correctly.
- Tour: the printer step and the label-size step both anchor to the
  new trigger and fire correctly.

### 8.3 Regression watchlist

- Print popup (`CanvasActions`) — destination toggle still works,
  sheet override still flagged.
- Output tab — PNG/PDF buttons untouched; Print section still
  destination-aware.
- Document load — opening a sheet-sized doc still surfaces the
  sheet target as active.
- Auto-reconnect on boot — hydrated connection still appears as a
  row with the right status (recent commit `6d961f0` shouldn't
  regress).

---

## 9. Open questions

Items left for the implementer to decide with common sense, flagged
here so they don't get lost:

1. **Status dot inside the trigger.** Today the trigger pill has a
   status dot that reflects the *active connection's* status. After
   the merge, when sheet is the active target, what does the dot
   show? Decision: render `📄` instead of a dot; no status concept
   for sheet target. (Already in §3.2; flagging here in case
   usability testing wants it different.)
2. **Long row lists.** What's the panel's max height when a power
   user has 4+ thermal slots + sheet? `70vh` with internal scroll
   is fine for the realistic distribution; revisit only if anyone
   complains.
3. **"Pair another" placement when at 0 connections.** Currently
   shown as the "Connect a printer" CTA. When at ≥ 1 connection,
   it's the secondary "Pair another printer" button at the bottom.
   Two strings, same action. OK to keep two strings — they say
   different things to different audiences (first-run vs. add-more).
4. **Tour copy.** The tour step that today says "this is your
   printer" needs new copy. "This is where you pick what you're
   printing on — a connected printer or a PDF sticker sheet."
   Defer to whoever maintains tour copy; leave a TODO in the tour
   config when the anchor is migrated.
5. **Output tab parity.** The Output tab's destination row
   (`DestinationRow`) currently does its own thing. After this
   plan, should it adopt the same target-card visual? Out of
   scope here; flag for a future plan if the visual inconsistency
   bothers anyone.

---

## 10. Risks

- **Sheet-as-target conceptual leap.** Users used to "the printer
  menu" might not realise PDF sheet now lives in the same place.
  Mitigation: tour copy update (§9.4), and the trigger label clearly
  reads `📄 Avery L7163` when sheet is active.
- **Regression in single-printer feel.** §0.5 demands the
  one-printer case look like today. The merge inevitably changes
  things — expanded card replaces today's flat block. Mitigation:
  side-by-side screenshot comparison during the dev-flag phase.
- **Sheet picker dialog hosting.** Spike §0.6.1 derisks this; if
  the spike says "host at app-shell," we adapt without redesigning.
- **i18n key churn.** Mitigation: keep old keys live until cutover;
  delete only in the cleanup PR.

---

## 11. Definition of done

- Topbar mounts a single `OutputTargetTrigger` (not `PrinterPopover`
  + `LabelSizeSelector`).
- Sheet target is always reachable and behaves as first-class.
- 1-target case visually matches the spirit of today (no extra
  ceremony).
- Mobile <720px: single trigger collapses cleanly, panel scrolls.
- All `data-tour` anchors migrated and the tour passes a manual run.
- Three deleted files (§5.3) gone; no dead imports.
- `pnpm typecheck` and `pnpm test` clean. `pnpm lint` clean.
- One follow-up plan filed for any §9 item that turned non-trivial.

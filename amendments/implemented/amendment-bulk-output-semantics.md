# label-maker — Amendment: Bulk Output Semantics (CSV/Dataset Mode)

> Today's app has two output stories that disagree with each other.
>
> **Story 1 — single label, no dataset.** Click Print → it prints. Click
> Save → PDF → you get a one-page PDF. Whether the destination is a
> thermal printer or a sticker sheet, the *shape* of the interaction is
> the same: one click, output appears. ADR-001 codified this as "all
> printers are equal" — thermal and sheet are peer destinations, not
> separate modes.
>
> **Story 2 — CSV loaded.** Click Print → you get the active row only.
> The other 29 rows are silently ignored. Click Export PDF → 1-page
> PDF, same problem. The Print Batch modal is the *one* surface that
> respects the dataset, and it lives behind a separate toolbar entry.
> Worse: even within "batch", thermal and sheet diverge — thermal
> iterates rows, sheet packs them onto a template, but they reach the
> user through different paths.
>
> The fix is one unified model: a small **source selector** (Active row /
> All rows / Range) plus `copies`, applied identically across the central
> Print popup, the Output tab Print section, and the Save-as-file row.
> A **destination toggle** (Thermal / Sheet) treats those two as peer
> printers — same flow shape, different output surfaces. The button
> labels reflect the resulting count, and the popup gains a print-job-
> size indicator that shows the math. The Print Batch modal collapses
> into an inline progress toast.
>
> **Precondition:** `amendment-output-tab.md` lands first. That amendment
> establishes the Output tab's Print + Save-as-file sections, the shared
> `copies`/`density` store between the central popup and the Output tab,
> and the trimmed Save dropdown. This amendment extends that store with
> `OutputSelection` + `PrintDestination` and wires dataset-aware
> multipliers into every output surface.
>
> **Governing principle: ADR-001.** Thermal and sheet are peer
> destinations. CSV present and CSV absent are not separate modes —
> they're the same interaction with a different multiplier. If a
> section of this plan reads like it introduces a dialog wall, a mode
> switch, or a separate flow, it's wrong; rewrite it.

---

## 1. The Problem (Four Surprises)

### 1.1 Print Surprise
User imports a 30-row CSV → clicks the big orange Print button →
gets **1** label (the active row). The other 29 rows are ignored
silently. Print Batch (separate modal) is the only flow that prints
all rows; users have to know it exists.

### 1.2 Export Surprise
Same scenario → clicks Export PDF → gets a **1-page** PDF for the
active row. No multi-row export exists in the standard path. A user
expecting "PDF with one page per record" has no entry point at all.

### 1.3 Surface Disagreement
- Central Print: active row × copies.
- Print Batch modal: all rows × 1 copy.
- Export ×4: active row only, copies ignored.
- Output tab Print section (post-`amendment-output-tab.md`): inherits
  central Print = active row × copies.

Four surfaces, three different multiplier models, no obvious mental
model the user can carry between them.

### 1.4 Sheet Discoverability Gap
Post-`amendment-output-tab.md`, "Print to sheet" leaves the Save
dropdown without a replacement entry point. The only path to the
sheet picker is the central button's no-thermal fallback — which
fires only when no thermal printer is connected. A user with a
thermal connected who wants a paper sheet has no discoverable path.
This sits at the same UX seam as the dataset multipliers (both are
about "how does my output get materialised?"), so we fix it here
rather than spawning a third amendment.

---

## 2. The Source Model

A single `OutputSelection` shape, applied to every output surface
when a dataset is loaded:

```ts
type OutputSelection =
  | { kind: 'active' }
  | { kind: 'all' }
  | { kind: 'range', from: number, to: number };  // 1-indexed, inclusive
```

Combined with `copies` (existing), the resulting count is:

| Selection         | Count formula                  |
|-------------------|--------------------------------|
| Active row        | `1 × copies`                   |
| All rows          | `rows.length × copies`         |
| Range from–to     | `(to − from + 1) × copies`     |

When no dataset is loaded the selector is hidden and the count is
just `copies`.

### 2.1 Defaults

- **No dataset loaded** — `copies = 1`. Button label: `Print` /
  `Export PDF`. (No count shown when count = 1.)
- **Dataset loaded** — `OutputSelection = { kind: 'all' }`,
  `copies = 1`. Button label: `Print 30 labels` / `Export PDF
  (30 pages)`. The default reflects the user's likely intent
  ("I imported these to use them"), and the label is honest about
  what's about to happen.

### 2.2 Where the Selector Lives

Three surfaces show the selector when the dataset is active:
- **Central Print popup** — adds a Source row above Copies.
- **Output tab Print section** — same Source row, same store.
- **Output tab Save-as-file row** — small Source dropdown in the
  section header (one-per-row buttons would be too noisy).

All three bind to the same `OutputSelection` slice in the store.
Edit anywhere, all surfaces update.

### 2.3 Source and the Dataset Table's Active Row

The dataset table still has a notion of "active row" — the row whose
data populates the canvas for preview. `OutputSelection = { kind:
'active' }` uses *that* row; clicking around the dataset table
changes both the canvas preview and what `Source = Active` resolves
to. They're the same concept, not separate selections. `Source = All`
and `Source = Range` ignore the active-row pointer for output
purposes — the canvas still shows the active row's preview while
the user is editing.

### 2.4 Range UI

Two number inputs (`from`, `to`), 1-indexed, clamped to
`[1, rows.length]`. Invalid combinations (`from > to`, out of
bounds) clamp on blur with a transient inline note ("Range adjusted
to 1–30"). No separate validate-then-submit step. Empty inputs treat
the missing end as the dataset bound.

### 2.5 Selection Lifecycle

- **Persistence:** `OutputSelection` lives on the document, session-
  only. Reopening the document in a new session resets to default
  (`all` when dataset loaded). Closing and reopening the document
  within a session preserves it. Rationale: Source is about *how*
  the user wants to use the dataset on this design — that intent
  belongs with the document, but it's volatile enough that
  cross-session persistence is more confusing than helpful.
- **Dataset shrinks below the configured range:** clamp to the new
  bounds. If the range becomes empty (e.g., dataset emptied), fall
  back to `Source = active`.
- **Dataset removed entirely:** the selector hides and the count
  becomes `copies`.
- **Dataset added (was empty):** Source defaults to `all`.

---

## 3. The Destination Model

Print output has two possible destinations: **thermal** (the
connected label printer) and **sheet** (paper sticker sheet rendered
as PDF, opened in an inline viewer for browser print). Per ADR-001,
these are *peer printers*, not separate modes — clicking Print to a
sheet feels the same as clicking Print to a thermal: one click,
output appears.

```ts
type PrintDestination = 'thermal' | 'sheet';
```

### 3.1 Where the Toggle Lives

- **Central Print popup** — Destination row at the top of the popup,
  above Source / Copies / Density.
- **Output tab Print section** — same Destination row, same store.

Both bind to a `PrintDestination` slice in the store (alongside
`OutputSelection`, `copies`, `density`).

### 3.2 Toggle Visibility

The toggle is only shown when both destinations are *possible*:

| Thermal connected | Sheet template configured | Shown? | Default       |
|-------------------|---------------------------|--------|---------------|
| Yes               | Yes                       | Yes    | thermal       |
| Yes               | No                        | No     | thermal       |
| No                | Yes                       | No     | sheet         |
| No                | No                        | No     | (first-run)   |

When hidden because only one destination is possible, the
destination is implicit and the button label / behaviour follow
that destination. When both are possible, the user explicitly picks;
default is `thermal` (preserves muscle memory for thermal-connected
users — clicking Print prints to thermal as today).

When neither is possible (no thermal, no sheet template), the button
becomes a first-run setup CTA: `Set up sheet template →` opens the
sheet picker dialog (§4); confirming a template makes sheet
available and the button reverts to normal.

### 3.3 No Dialog Gate

Picking destination = sheet does **not** open a picker dialog.
The user's chosen sheet template is a configured setting (§4);
clicking Print with destination = sheet renders directly to PDF and
opens the inline viewer, the same way clicking Print with
destination = thermal sends to the thermal printer directly. One
click, output appears.

This is the explicit departure from any earlier "click Print →
sheet picker dialog → confirm → render" sketch. ADR-001's principle
(peer printers, no dialog walls) governs.

### 3.4 Removing the Legacy Fallback

`CanvasActions.vue:252-257` currently does "no thermal → emit
open-sheet". This is the implicit form of "configure a destination",
and it's removed once the destination toggle / first-run flow is
wired:

- Both possible → toggle visible, defaults to thermal.
- Only thermal → no toggle, destination = thermal.
- Only sheet → no toggle, destination = sheet, label says
  `Print to sheet`.
- Neither → first-run CTA opens the sheet picker as a setup step,
  not a per-print step.

The legacy `emit('open-sheet')` from the toast-fallback path is
deleted; the same code path is now reached deterministically through
the toggle and first-run flow.

### 3.5 Persistence

`PrintDestination` is session-only. On reload, the default is
re-derived from connection state per the §3.2 table. Thermal default
re-asserts when thermal is connected — meaning a user who explicitly
chose `sheet` last session will see `thermal` again on reload if a
thermal is connected. This is intentional: thermal is the high-
intent default for thermal-connected users; if they want sheet they
pick it each session. Cross-session persistence is more
confusing than helpful here (users hot-swap printer connections
between sessions; we don't want stale destinations to surprise
them).

### 3.6 Connection-State Transitions Mid-Session

Connection state can change mid-session: thermal disconnects, sheet
template gets cleared in settings, thermal reconnects. Behaviour
reduces to a single rule — *re-evaluate the §3.2 visibility table;
if the current `PrintDestination` became impossible, coerce it to
the available one*:

- **Thermal disconnects while a batch is in flight:** the existing
  status-guard halts the batch (§10.1). On next render, toggle
  hides; destination coerces to `sheet` if a template is configured,
  otherwise the button becomes the first-run CTA.
- **Thermal disconnects while idle:** toggle hides; if destination
  was `thermal`, coerce to `sheet` (or first-run CTA if no template).
- **Thermal re-connects:** toggle re-appears. Don't auto-flip back to
  thermal — the user's last explicit session pick stands.
- **Sheet template cleared via settings:** if destination was
  `sheet`, coerce to `thermal` if connected, otherwise first-run CTA.

---

## 4. Sheet Template as Persistent Setting

The sheet template (Avery L7160, Avery J8160, generic 21-up, etc.)
is a configured setting that persists **globally, last-picked
wins** — same way the connected thermal printer is "the printer"
until explicitly changed. The sheet picker dialog is reachable as a
setup affordance, not a per-print interruption:

- **First-run with no thermal and no sheet template:** clicking
  Print opens the sheet picker (one-time configuration); confirming
  sets the template and renders.
- **In the Print popup:** a small text link below the destination
  toggle: `Sheet: Avery L7160 — change`. Clicking `change` opens
  the picker. Same affordance in the Output tab Print section.
- **In Settings (or wherever printer prefs live):** sheet template
  is a configurable item alongside thermal printer selection.

After the first configuration, every subsequent click of Print with
destination = sheet renders directly to the configured template.

### 4.1 Sheet × Dataset

When destination = sheet and a dataset is loaded:
- Total labels = `rowsForSelection.length × copies`.
- Labels are arranged on sheets according to the configured template
  (e.g., Avery L7160 = 21 labels per page).
- Page count = `Math.ceil(labels / labelsPerPage)`.
- **Default behaviour: pack tight, leave empty slots on the last
  page.** Repeat-to-fill is *not* default — silently duplicating
  user data is a footgun.

The inline PDF viewer surfaces the page count: "30 labels × Avery
L7160 (21/page) = 2 pages."

### 4.2 Sheet × Copies (No Dataset)

When destination = sheet, no dataset, `copies > 1`: render `copies`
copies of the active label, packed onto the configured template.
`copies = 5` on a 21-up sheet = 1 page with 16 empty slots. Same
model as §4.1, just with the multiplier coming from `copies` only.

### 4.3 Empty Slot Handling

Empty slots on the last page render as transparent / white — no
border, no placeholder. The PDF page is full-size; the slots are
just empty.

---

## 5. Cut and Order Semantics

### 5.1 Cut Between Labels (Thermal)

If the connected thermal printer reports cutter capability, the
print path cuts **after each label** by default. No user setting —
automatic. This matches Brother QL default behaviour and the user
expectation that "every label is its own piece".

`copies > 1` and `Source = all`: still cut-per-label. 30 rows × 2
copies = 60 cut labels.

If the printer doesn't report cutter capability, no cuts; the label
tape is left for the user to cut manually. (Same as today.)

A future per-job override ("cut only at end of batch", "cut between
rows but not between copies") is out of scope here; default-only.

### 5.2 Print Order (Row-Major)

`Source = all`, `copies = N`: **row-major**. Print row 1 N times,
row 2 N times, …, row R N times. This matches the "give each
recipient their N identical labels" pattern (mailing labels, name
tags, party favours). Copy-major (`row 1, row 2, …, row R, row 1,
row 2, …`) is *not* supported; users who want that can workaround
by exporting PDF and printing pages in the desired order.

`Source = range from–to`: same row-major within the range.

Sheet × dataset: same row-major fill order, packed left-to-right,
top-to-bottom into the template's slot grid. Slot (1,1) = row 1
copy 1; slot (1,2) = row 1 copy 2; etc.

### 5.3 Per-Row Render Errors

If a row fails to render mid-batch (e.g., invalid barcode data
after column mapping):
- **Thermal:** stop, surface the failed row in the progress toast,
  offer Resume from row N+1 / Cancel.
- **Sheet PDF:** skip the row, render an empty slot, surface the
  skipped row in a post-render toast ("Row 17 skipped — invalid
  barcode data").
- **PDF / PNG export:** same as sheet — skip + report at end.

---

## 6. Scope

In:
- `OutputSelection` and `PrintDestination` types + slices in the
  shared print-config store (extends `amendment-output-tab.md`'s
  `copies` / `density` slice).
- Central Print popup: Destination row (when both possible) +
  Source row (when dataset active) + Copies + Density + size
  indicator + dynamic button label.
- Output tab Print section: same controls, same store, identical
  layout.
- Output tab Save-as-file row: Source dropdown in section header
  when dataset active; download handlers iterate the selected rows.
- Save dropdown (post-`amendment-output-tab.md`): PDF/PNG honour
  `OutputSelection`; .label/.bnmk hidden when Source ≠ Active.
- Multi-row PDF export: N pages, one per row.
- Multi-row PNG export: zip of N PNGs.
- Sheet template as persistent global setting; sheet picker reachable
  via `change` link / first-run flow.
- Inline PDF viewer for sheet destination (no per-print dialog).
- Automatic per-label cut on cutter-capable thermal printers.
- Row-major print order for `Source = all` × `copies > 1`.
- Threshold confirmation when count exceeds 20+ (per-session
  "don't ask again").
- Inline progress toast for batch prints (replaces Print Batch
  modal).
- Removal of legacy `emit('open-sheet')` toast-fallback branch from
  `CanvasActions.vue:252-257`.
- Removal of separate "Print Batch" toolbar entry.

Out:
- Lifting the 30-row dataset cap. If the cap rises, threshold
  confirmation defaults adjust.
- Per-row override of copies ("3 copies of row 5, 1 of every
  other"). Future scope.
- Per-row skip / disable in the selector. Range covers the common
  "skip the first rows" case.
- Sheet "repeat to fill" mode. Pack-tight + empty slots is the
  default; repeat-to-fill is future scope.
- Strip-image PNG variant (single PNG with N labels stacked).
  Default is the zip.
- Filename templating from column values
  (`{lastName}-{barcode}.png`). Future scope.
- Cut-mode override (per-job choice between cut-each, cut-end-of-
  batch, cut-between-rows). Default-only.
- Copy-major print order.
- Re-print "the last batch" / "row 17 only" affordances. Cancel +
  reconfigure suffices.
- Redesigning the sheet picker dialog itself. We repurpose its
  invocation, not its internals.
- Persistent (cross-session) "never ask" for threshold confirmation.

---

## 7. Button Labels and Print-Job-Size Indicator

### 7.1 Button Label Rule

Single rule: when `count > 1`, show the count. When `count == 1`,
show no number. Surface-specific verb stays the same. Sheet
destination shows page count parenthetically.

| Context                                              | Label                                  |
|------------------------------------------------------|----------------------------------------|
| No dataset, copies = 1, dest = thermal               | `Print`                                |
| No dataset, copies = 5, dest = thermal               | `Print 5 labels`                       |
| No dataset, copies = 1, dest = sheet                 | `Print to sheet`                       |
| No dataset, copies = 5, dest = sheet (21/page)       | `Print to sheet (5 labels, 1 page)`    |
| Dataset (30), Source = Active, copies = 1, thermal   | `Print`                                |
| Dataset (30), Source = All, copies = 1, thermal      | `Print 30 labels`                      |
| Dataset (30), Source = All, copies = 2, thermal      | `Print 60 labels`                      |
| Dataset (30), Source = Range 5–10, copies=1, thermal | `Print 6 labels`                       |
| Dataset (30), Source = All, copies=1, sheet (21/pg)  | `Print to sheet (30 labels, 2 pages)`  |
| Export PDF, dataset, Source = All                    | `Export PDF (30 pages)`                |
| Export PDF, dataset, Source = Active                 | `Export PDF`                           |

Same rule for Export PNG / .label / .bnmk. (Multi-row not applicable
to .label / .bnmk — those buttons hide when Source ≠ Active.)

### 7.2 Size Indicator in the Popup

The Print popup (and Output tab Print section) shows a compact
summary line above the action button, breaking down the math:

```
Destination: ● Thermal  ○ Sheet
Source:      ○ Active  ● All  ○ Range
Copies:      [2]
Density:     ● Normal  …
─────────────────────────────────
30 rows × 2 copies = 60 labels
[Print 60 labels]
```

For sheet destination, the line includes page count and empty-slot
count when non-zero:

```
30 rows × 2 copies = 60 labels (3 pages, 3 empty slots on page 3)
```

For `count = 1` (no dataset, copies = 1): the summary line hides;
the button reads `Print` or `Print to sheet`.

The same summary line appears in the Output tab Print section,
identically formatted. **The summary line is the print-job-size
indicator.** It is the user's confirmation that the math agrees with
their intent before they click.

### 7.3 Layout Density

The popup will hold up to 7 rows of controls (Destination, Source,
Range inputs when applicable, Copies, Density, summary, button).
Use compact patterns to keep it from feeling cramped:
- Source as a segmented control (Active | All | Range), not vertical
  radios.
- Destination as a two-button toggle.
- Density as a 3-button cluster.
- Summary line in small text, not a heading.
- Range inputs collapse into a single inline field (`Rows 5–10`,
  click to edit) when not focused.

The Output tab Print section has more horizontal real estate and can
afford a slightly more spacious layout, but the controls and order
match the popup so the two surfaces are recognisably the same UI.

### 7.4 Long Counts

At 4-digit counts (`Print 1200 labels`), the central button switches
to a compact form (`Print 1.2k labels`) with the full number in the
popup summary line. Probably moot at the current 30-row cap; pin
this convention before lifting it.

---

## 8. Threshold Confirmation

When `count` would exceed a threshold (default 20), clicking the
button shows a confirm dialog:

```
Print 60 labels?

This will send 60 print jobs to {printer model}.

[Cancel]  [Print 60 labels]   ☐ Don't ask again this session
```

For sheet destination the wording adjusts ("This will print 30
labels across 2 pages of {sheet template}").

Per-session dismissal only — a fresh session re-arms. Persistent
"never ask" is out of scope.

At the current 30-row cap, threshold-eligible scenarios are narrow:
30 rows × 1 copy = 30 (warns), 5 rows × 5 copies = 25 (warns), most
defaults below threshold.

---

## 9. Export Multi-Row Format Choices

### 9.1 PDF
N pages, one per row. Same per-row render as the existing single-row
PDF. Page order = row order. Concatenated into a single file.
Filename: `{designName}-batch.pdf`.

### 9.2 PNG
**Zip of N PNGs** — `{designName}-001.png` … `{designName}-030.png`,
zipped. Honest one-file-per-row. Single PNG (no zip) when Source =
Active or Range = single row.

(Strip-image variant — N labels stacked vertically into one PNG —
is future scope if users ask.)

### 9.3 .label / .bnmk
Single-doc formats. The dataset is already embedded in the document.
There is no meaningful "one file per row" output — that would be N
copies of the same file. **Decision: hide these buttons in the Save-
as-file row when Source ≠ Active.** The buttons are still there in
single-row mode (Source = Active or no dataset).

### 9.4 Save → Save (slot)

Clicking Save (the button itself, not the dropdown arrow) saves the
document — including the embedded dataset — to the current slot.
Source has no effect on slot save: it's a single-document operation
inherited unchanged from `amendment-output-tab.md`. Source is purely
a multiplier for *output* surfaces (Print, Save-as-file).

---

## 10. Inline Progress Toast (replaces Print Batch modal)

The Print Batch modal is removed. Long-running prints show an
inline progress toast:

```
Printing 60 labels — row 17 of 30, copy 1 of 2
[Cancel]
```

The toast persists at the existing toast surface (bottom-right or
wherever `amendment-output-tab.md` placed it), updates in place,
and:
- Shows current row + copy.
- Surfaces per-row errors per §5.3 — clicking the error opens the
  dataset table at that row.
- Offers Cancel mid-batch. Cancel halts after the in-flight label
  completes; partial progress is reported in the post-cancel toast
  ("Cancelled after 17 of 60 labels"). If the in-flight label
  doesn't complete within ~10s of Cancel (printer hung / jammed),
  abort the WebUSB transfer outright — leaves printer state awkward,
  but Cancel must always succeed.
- On success, transitions to a brief success state (`Printed 60
  labels`) and auto-dismisses after a few seconds.

For sheet destination, a `Generating sheet PDF…` toast appears only
if generation exceeds ~250ms (avoids a flash for the common <1s
render). The toast dismisses when the inline viewer opens. Sheet
generation is a single render pass; no per-row progress needed.

The "Print Batch" toolbar entry is removed. The inline toast is the
only progress surface. Users who want the per-row thumbnail view
that the old modal offered can use Export PDF (Source = All) and
scroll the inline viewer — same information, same number of clicks.

### 10.1 Mid-Batch Status-Guard Interaction

The printer-status-polling guard disables the Print button when
status reports an error. Mid-batch, if the printer errors on row
17:
- The toast surfaces the error and the row number.
- The batch halts (no further rows attempted).
- Toast actions: `Resume from row 17` (re-tries the failing row;
  user fixes printer state in between) and `Cancel`.
- If the user fixes the printer and clicks `Resume`, the batch
  picks up from row 17 with the configured copies remaining for
  that row.

---

## 11. Resolved Decisions (formerly open questions)

- **Range UI:** two number inputs, 1-indexed, clamped on blur with
  inline note (§2.4).
- **Source persistence:** per document, session-only (§2.5).
- **Destination persistence:** session-only; defaults re-derive from
  connection state on reload (§3.5).
- **Sheet template persistence:** global, persistent (last-picked).
  Reachable via `change` link in popup or first-run flow (§4).
- **Dataset shrinks/grows after Source = Range:** clamp; if range
  becomes empty, fall back to `active` (§2.5).
- **Status guard mid-batch:** stop, mark partial completion, offer
  resume from next row / cancel (§10.1).
- **Sheet template selection ergonomics:** template is a setting,
  not a per-print dialog; the existing sheet picker dialog is
  repurposed as a setup affordance, not redesigned (§4).
- **Sheet + range edge case:** "1 page, 15 empty slots" reads fine
  in the size indicator (§7.2).
- **Export progress for large counts:** reuse existing toast
  pattern; PDF generation is fast enough at the 30-row cap (§10).
- **Per-row render error in export:** skip + report at end (§5.3).
- **Print order:** row-major (§5.2).
- **Cut behaviour:** automatic per-label when cutter-capable; no
  setting (§5.1).
- **Print Batch modal disposition:** remove; replace with inline
  progress toast (§10).

No remaining open questions.

---

## 12. Files Affected

```
src/stores/
  print-config.ts (new or extended)
                                  OutputSelection + PrintDestination
                                  + copies + density + sheetTemplate
                                  slices. All output surfaces bind
                                  here. sheetTemplate persists to
                                  localStorage; OutputSelection
                                  persists to document; PrintDestination
                                  is session-only.

src/components/toolbar/
  CanvasActions.vue               - central popup gains Destination
                                    row (when both possible), Source
                                    row (when dataset active), and
                                    size indicator line above button
                                  - button label dynamic per §7.1
                                  - remove legacy emit('open-sheet')
                                    toast-fallback branch (§3.4)
                                  - "Print Batch" toolbar entry
                                    removed

src/components/output/
  PrintSection.vue                Destination row + Source row +
                                  Copies + Density + size indicator +
                                  dynamic button label. Same store as
                                  central popup, identical layout.
  SaveAsFileSection.vue           Source dropdown in section header
                                  when dataset active. PDF/PNG
                                  handlers iterate selected rows.
                                  .label / .bnmk hidden when
                                  Source ≠ Active.

src/components/sheets/
  SheetDialog.vue                 Repurposed as setup affordance.
                                  On confirm, sets sheetTemplate in
                                  store. No per-print invocation.
                                  Existing internals unchanged.

src/components/feedback/
  PrintProgressToast.vue (new)    Inline progress surface for batch
                                  prints. Shows current row/copy,
                                  cancel, error/resume. Replaces
                                  Print Batch modal.

src/components/batch/
  BatchPanel.vue                  Removed. Routes that referenced it
                                  redirect to the central Print flow.

src/services/print/
  thermal-batch.ts (new)          Iterate rowsForSelection × copies
                                  in row-major order. Drive the
                                  PrintProgressToast. Honour cutter
                                  capability for per-label cut.
                                  Mid-batch error → halt + resume
                                  contract.

src/services/export/
  pdf-batch.ts (new)              Multi-row PDF (N pages) wrapping
                                  existing per-row PDF render.
  png-batch.ts (new)              Multi-row PNG zip wrapping
                                  existing per-row PNG render.
  sheet-render.ts (new or
  extended)                       Pack rowsForSelection × copies
                                  onto configured sheetTemplate;
                                  pack-tight, leave empty slots;
                                  return single PDF for inline viewer.

src/i18n/
  en.json + others                source.* keys (active / all /
                                  range), destination.* keys
                                  (thermal / sheet), sheetTemplate.*
                                  keys (change, set up), batch.*
                                  keys (confirm, progress, resume,
                                  cancelled), button label patterns
                                  with count plural rules and page
                                  count.
```

---

## 13. Implementation Checklist

```
Store:
□ Extend print-config store with OutputSelection slice
□ Extend print-config store with PrintDestination slice
□ Extend print-config store with sheetTemplate slice
□ Persistence: OutputSelection on document, PrintDestination
  session-only, sheetTemplate global (localStorage)
□ Selectors: rowsForSelection(state), count(state),
  pageCount(state), labelText(state)

Source row (data-aware):
□ Source row in central Print popup (active/all/range)
□ Source row in Output tab PrintSection (same store)
□ Source dropdown in Output tab SaveAsFileSection header
□ Range UI: two clamped number inputs + transient inline note
□ Hide selector when no dataset
□ Default to 'all' when dataset transitions empty → loaded
□ Source = active follows the dataset table's active row
□ Clamp range when dataset shrinks; fall back to 'active' when
  range becomes empty

Destination row:
□ Destination row in central Print popup (visibility per §3.2)
□ Destination row in Output tab PrintSection (same store)
□ Default = thermal when both possible; on-reload re-derive
□ "Sheet: {template} — change" link below toggle (when sheet
  available)
□ First-run CTA when neither thermal nor sheet configured
□ Remove legacy emit('open-sheet') from CanvasActions.vue:252-257

Sheet template setting:
□ Sheet picker dialog invocation: change link + first-run only
□ On confirm, persist sheetTemplate to localStorage
□ Sheet template change reachable via the popup's change link;
  no separate settings surface required for this amendment

Counting + labels:
□ count = rowsForSelection.length × copies
□ pageCount = ceil(count / labelsPerPage) for sheet destination
□ Button labels follow §7.1 across all surfaces
□ Size-indicator line above button per §7.2 (popup + Output tab)
□ Compact form for 4-digit counts in central button

Print path — thermal:
□ thermal-batch service iterates rowsForSelection × copies
  row-major
□ Per-label cut when printer reports cutter capability;
  no-op otherwise
□ Drive PrintProgressToast (current row, copy, cancel)
□ Mid-batch error → halt + Resume from row N / Cancel
□ Threshold confirmation dialog (§8) before kicking off
  count > 20

Print path — sheet:
□ sheet-render packs rowsForSelection × copies onto
  configured template (row-major, pack-tight)
□ Empty slots on last page are transparent
□ Inline PDF viewer opens with the rendered PDF; no dialog
□ Page-count + empty-slot label in the viewer header

Progress toast:
□ PrintProgressToast component (replaces BatchPanel)
□ Generating-sheet-PDF spinner state for sheet destination
□ Cancel mid-batch (post-current-label halt)
□ Per-row error click opens dataset table at that row
□ Auto-dismiss on success after a few seconds

Export path:
□ Multi-row PDF (N pages) — pdf-batch service
□ Multi-row PNG (zip of N) — png-batch service
□ jszip (or equivalent) added as dependency for PNG zip
□ .label / .bnmk hidden when Source ≠ Active in SaveAsFileSection
□ Single PNG (not zip) when Source = Active or Range yields 1 row
□ Per-row error in export skips + reports at end
□ Reuse existing toast for export progress

Removal / cleanup:
□ Print Batch modal component (BatchPanel) deleted
□ "Print Batch" toolbar entry removed
□ "Print to sticker sheet" Save dropdown item already removed by
  amendment-output-tab.md — verify no lingering references
□ Legacy emit('open-sheet') branch deleted

i18n:
□ source.active / source.all / source.range
□ destination.thermal / destination.sheet
□ sheetTemplate.change / sheetTemplate.setup
□ button.print / button.print_n_labels /
  button.print_to_sheet / button.print_to_sheet_n_labels_n_pages
□ summary.rows_x_copies / summary.with_pages_and_empty_slots
□ batch.confirm.title / batch.confirm.body /
  batch.confirm.dont_ask_again
□ batch.progress.printing / batch.progress.row_x_of_y_copy_x_of_y
□ batch.error.row_failed / batch.error.resume / batch.cancelled
□ Plural rules for label counts in en + nl

Tests:
□ Source = All, copies = 1, dest = thermal prints rows.length
  times in row-major order
□ Source = All, copies = 2, dest = thermal prints (rows × 2)
  with row-major order
□ Source = Range from–to prints (to − from + 1) × copies
□ Threshold dialog appears at count > 20 + dismisses correctly
  (per-session don't-ask-again)
□ Export PDF with Source = All produces N-page document
□ Export PNG with Source = All produces zip with N entries
□ Export PNG with Source = Active produces single PNG, no zip
□ .label / .bnmk hidden when Source ≠ Active
□ Source mutations propagate across all three surfaces
□ OutputSelection clamps when dataset shrinks
□ OutputSelection falls back to Active when range becomes empty
□ Destination toggle hidden when only thermal possible
□ Destination toggle hidden when only sheet possible
□ Destination toggle visible + defaults to thermal when both
□ First-run CTA opens sheet picker when neither configured
□ Sheet destination + dataset opens inline viewer (no dialog)
□ Sheet page count = ceil(count / labelsPerPage)
□ Sheet PDF lays out row-major, pack-tight, empty-slot tail
□ Cutter-capable thermal printer cuts per label
□ Non-cutter thermal printer does not cut
□ PrintProgressToast shows current row/copy
□ Cancel mid-batch halts after in-flight label
□ Mid-batch printer error halts batch + offers Resume from row N
□ Resume from row N picks up correctly with remaining copies
□ Per-row render error in export skips row + reports at end
□ sheetTemplate persists across sessions (localStorage)
□ OutputSelection persists across same-session document reopen
□ OutputSelection resets to default across new sessions
□ PrintDestination resets to thermal-when-connected default
  across sessions
```

---

## 14. Status

**Ready for implementation.**

Precondition: `amendment-output-tab.md` lands first (establishes
print-config store, Output tab Print section + Save-as-file row,
trimmed Save dropdown). This amendment extends that foundation with
`OutputSelection` and `PrintDestination`, the destination toggle,
the sheet-template-as-setting model, automatic cutter handling,
row-major batch order, the inline progress toast, and dataset-aware
button labels + size indicator across every output surface.

Governing principle remains ADR-001: thermal and sheet are peer
destinations, dataset present and absent are not separate modes.
Reviewers should reject any sub-task implementation that reintroduces
a per-print dialog gate or a thermal/sheet flow asymmetry.

### 14.1 Sequencing

Shippable as a single PR or split into three independently-shippable
phases:

1. **Store + Source row everywhere.** OutputSelection slice +
   selector UI in popup, Output tab Print, Save-as-file row.
   Multi-row PDF/PNG export. Dynamic button labels + size
   indicator. No destination changes yet.
2. **Destination toggle + sheet template setting.** PrintDestination
   slice + toggle UI + sheet template as persistent setting.
   First-run flow. Removal of legacy `emit('open-sheet')`.
3. **Progress toast + BatchPanel removal.** PrintProgressToast +
   thermal-batch service. Mid-batch cancel/resume. Print Batch
   modal + toolbar entry deleted.

Each phase is observable end-to-end. Single PR is simpler if the
implementer is comfortable with the scope; phased shipping makes
each piece individually reviewable.

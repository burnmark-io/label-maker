# amendment-bulk-output-semantics — Progress Log

Tracks implementation of the bulk-output amendment.
Format: dated entries; decisions and blockers called out explicitly.

---

## Pre-flight (2026-04-29)

Verified the three concerns raised before kick-off:

1. **Sheet dialog identity — RESOLVED.** Two sheet-related dialogs exist
   in the tree:
   - `src/components/sheets/SheetDialog.vue` is the **output** dialog
     (the one referenced in §12). It opens the picker, lets the user
     export to PDF, and is wired up via `AppShell` ←
     `CanvasActions:open-sheet`.
   - `src/components/media/SheetPickerDialog.vue` is the **canvas-source**
     picker (sets canvas dimensions in `media.ts`). Different concept,
     out of scope.
   The amendment's references are correct.

2. **Sheet template ownership — RESOLVED.** `media.ts.sheetCode` =
   "design for what sheet" (canvas dimensions). New
   `print-config.sheetTemplate` = "print onto what sheet" (output).
   Conceptually distinct; may often refer to the same template but the
   slices don't overlap. No store-ownership conflict.

3. **Per-row export reuse — RESOLVED.** `exportPdfCore` and
   `exportSheetCore` from `@burnmark-io/designer-core` already accept
   a `rows: Record<string,string>[]` parameter. `exportPngCore` does
   *not* — multi-row PNG must call it N times with per-row
   `variables` (the column-mapped row data) and zip the results.

**Decision:** Proceed with phased shipping per §14.1. Each phase ends
with a gate check.

**Coordination:** Another agent owns `amendment-image-downsize-on-import`
(scope: `src/lib/image/downsize.ts`, `services/label-import.ts`,
image drop/paste handlers, `panels/ImageProperties.vue`,
`composables/useLabelImport.ts`). No file overlap with this amendment.

**Stale line reference noted:** plan §3.4 cites
`CanvasActions.vue:252-257` for the legacy `emit('open-sheet')`. Actual
location is ~261. Trivial drift; flagged for the §3.4 step.

---

## Phase 1 — Source row + multi-row export

### 1.1 Store extension — DONE

`src/stores/print-config.ts` extended with:
- `OutputSelection` type (active / all / range, 1-indexed inclusive).
- `selectionByDoc` Map<docId, OutputSelection>, session-only.
- `outputSelection` computed — falls back to `all` when a dataset is
  loaded and no explicit selection has been stored, otherwise `active`.
- `setOutputSelection`, `clearSelectionFor`, `reconcileForRowCount`
  (clamps range; falls back to `active` when dataset becomes empty).
- `rowsForSelection` (0-based indices) and `count` (rows × copies).
- A `watch` on `data.rows.length` triggers reconciliation on every
  dataset transition.

**Decision — fallback is dataset-aware.** Plan §2.1 specifies the
default-when-dataset-loaded as `all`; rather than store an entry for
every doc on first dataset load, the computed defaults to `all` when
`data.rows.length > 0` and no explicit selection exists. This keeps
the Map small (only docs whose user has *explicitly* deviated from the
default carry an entry) and gives the right behaviour when a user
opens a fresh document while a dataset is already loaded.

**Tests:** 12 cases in `src/stores/__tests__/print-config.test.ts`
cover defaults, transitions, rowsForSelection across kinds, count
multipliers, and per-document persistence.

**Touched test files** (mocks fattened to satisfy new imports):
- `src/components/output/__tests__/PrintSection.test.ts`
- `src/components/output/__tests__/SaveAsFileSection.test.ts`
- `src/components/toolbar/__tests__/CanvasActions.test.ts`

Typecheck clean. Impacted tests pass.

### 1.2 Source row UI — DONE

Reusable `src/components/output/SourceRow.vue` component:
- Segmented control: Active | All | Range.
- Range mode reveals two number inputs (1-indexed, inclusive).
- Clamp on blur via `setOutputSelection`; transient inline note
  ("Range adjusted to N–M") cleared after 3s.
- Hides entirely when no dataset is loaded.
- Reads/writes the print-config store; binds nothing locally.

Wired into:
- `src/components/output/PrintSection.vue` — top of the section, above
  Copies / Density.
- `src/components/toolbar/CanvasActions.vue` — top of the print
  options popup, above Copies / Density.

i18n keys added under `output.source.*` in `en.json` and `nl.json`.

7 component tests in `src/components/output/__tests__/SourceRow.test.ts`
cover empty-dataset hide, segment activation, range seeding,
out-of-bounds clamp, and the from > to flip.

### 1.3 SaveAsFileSection multi-row export — DONE

`src/components/output/SaveAsFileSection.vue`:
- Header gains a Source `<select>` (Active / All / Range — Range
  option label reads "Range N–M" when the slice is set; the user
  edits range bounds via the SourceRow in the Print section).
- PDF export uses `exportPdfBatch(designer, rows, mapping)` — passes
  the mapped row array so designer-core renders an N-page PDF.
- PNG export uses `exportPngBatch(designer, rows, mapping, baseName)`
  — single PNG when count = 1, JSZip-bundled `<base>-001.png` …
  `<base>-NNN.png` when count > 1. Per-row render errors collected
  and reported via toast.
- `.label` / `.bnmk` button hidden when Source ≠ Active. (Out of
  scope: the file currently only renders `.label`; `.bnmk` will
  follow the same hide rule when its button arrives.)

New services:
- `src/services/export/pdf-batch.ts`
- `src/services/export/png-batch.ts`

`jszip` was already a dependency — no package.json change needed.

Tests extended: 11 cases in
`src/components/output/__tests__/SaveAsFileSection.test.ts` cover
both single-row and multi-row paths plus the `.label` visibility rule.

**Decision — Source dropdown displays read-only Range bounds.** The
range edit affordance lives in the SourceRow in the Print section; the
Save-as-file dropdown only displays the chosen kind and switches
between Active / All / Range. Picking Range from the dropdown without
an existing range seeds 1..rowCount. This keeps the section header
compact (per §7.3 layout density) while still surfacing the slice the
buttons will act on.

**Decision — JSZip flush in tests.** vitest jsdom doesn't propagate
`generateAsync`'s internal scheduler in a single microtask flush; the
PNG-zip test loops `flushPromises` + a 5ms timer five times to let it
resolve. Documented inline.

Typecheck clean. Full suite (612 tests) green.

### 1.4 Button labels + size indicator — DONE

Per §7.1 / §7.2:

- Central toolbar Print button (`CanvasActions.vue`): label is
  `Print` when count = 1, `Print N labels` when count > 1.
- Print options popup: gains a centred summary line above the action
  area when count > 1 — `30 rows × 2 copies = 60 labels` with a
  dataset, `60 labels` without.
- Output tab `PrintSection.vue`: action button + summary line follow
  the same rule, identical wording.
- `SaveAsFileSection.vue`: PNG button reads `PNG` / `PNG (N files)`,
  PDF reads `PDF` / `PDF (N pages)`. Save-as-file ignores the
  `copies` slice (it's a print-only multiplier), so its page-count
  is just the number of selected rows.

i18n keys added: `output.button.*` (print / printNLabels / pdf /
pdfNPages / png / pngNFiles), `output.summary.*` (rowsAndCopies /
copiesOnly), in both locales.

**Decision — Save-as-file ignores `copies`.** The plan's §7.1 table
isn't explicit about copies-on-export semantics; the natural reading
is that `copies` belongs to *Print* (you don't export 5 identical
PNG files for the same row), so the PNG / PDF labels reflect *row
count* only, not row × copies. The Print path applies copies
separately. Documented in the SaveAsFileSection computed.

Tests extended: PrintSection has two new cases for the count-aware
label and summary line. SaveAsFileSection's "Source = All" case
asserts the new `PNG (10 files)` / `PDF (10 pages)` labels.

### Phase 1 gate — PASSED

- 614/614 vitest cases green.
- `vue-tsc --noEmit`: no errors.
- ESLint on touched files: no warnings.

Phase 1 ships an end-to-end Source row + multi-row export experience.
The 30-row "silent ignore" surprise is gone: imports default to
"all", labels are honest about the count, and Save → PDF / PNG
honour the same selection.

---

## Phase 2 — Destination toggle + sheet template setting

### 2.1 Store slices — DONE

Extended `print-config` with:
- `destination: PrintDestination` — `'thermal' | 'sheet'`, ref,
  session-only. Default-on-load left to consumers (they re-derive
  from connection state per §3.2).
- `sheetTemplate: SheetTemplate | null` (computed from
  `sheetTemplateCode`) plus `setSheetTemplate(template | code | null)`
  — last-picked-wins persistence to `localStorage` under
  `burnmark.sheetTemplate`. Resolution goes through
  `findSheet()` from `@burnmark-io/sheet-templates`, so a stale code
  whose template was retired returns `null` rather than crashing.

Persistence helpers (`loadSheetTemplateCode` / `saveSheetTemplateCode`)
guard against `localStorage` being unavailable so tests under jsdom
without storage shims don't blow up.

Tests (`print-config.test.ts` extended to 16 cases) cover destination
default, sheet template persist + restore, and null clear.

Typecheck clean.

### 2.2 Destination toggle UI — DONE

`src/components/output/DestinationRow.vue`:
- Toggle (Thermal | Sheet) shown only when both destinations are
  possible per §3.2.
- "Sheet: {brand} {part} — change" link below the toggle when a sheet
  template is configured (also shown standalone when only sheet is
  possible).
- First-run "Set up sheet template →" CTA shown when neither thermal
  nor sheet is configured.
- Both the change link and the CTA emit `open-sheet-picker`.

Store: added `thermalPossible`, `sheetPossible`,
`showDestinationToggle`, and `effectiveDestination` computeds. The
last one honours the user's stated preference when capable, else
falls back to the available destination — implements §3.6
mid-session coercion as a pure derivation (no watchers, no side
effects). Consumers always read `effectiveDestination`.

`PrintSection.vue` now shows when *either* thermal OR sheet is
possible (was: thermal only). `canPrint` becomes
destination-aware: thermal needs media + connection, sheet needs a
configured template.

Event plumbed up: `DestinationRow` → `PrintSection` →
`OutputPanel` → `SidePanel` → `AppShell` (which already wires
`sheetOpen = true` for the legacy `open-sheet` event from
CanvasActions; the new pathway joins the same handler). The
`CanvasActions` popup also gets the row, emitting via the existing
`open-sheet` event so AppShell needs no extra wiring on that branch.

i18n keys: `output.destination.*` (label / thermal / sheet /
sheetCurrent / setupSheet) in both locales.

Tests: 8 cases in `DestinationRow.test.ts` cover all four §3.2
visibility branches plus the toggle / change-link / CTA emits.

Full suite (626 tests) green.

**Decision — single emitted event for change + CTA + toggle popup
trigger.** AppShell already opens the SheetDialog on
`CanvasActions.open-sheet`. Reusing that event for the new pathways
(rather than introducing a parallel one) means no AppShell handler
expansion in this step; Phase 2.3 changes what the dialog *does* on
confirm (sets the template instead of immediate one-shot export).

### 2.3 SheetDialog repurpose + sheet output flow — DONE

**SheetDialog (`src/components/sheets/SheetDialog.vue`)** — internals
unchanged per plan §4. Behaviour change: primary button reads "Use
this sheet"; on click, calls `config.setSheetTemplate(selected)` and
closes. The immediate one-shot export is gone — sheet output now
flows through the regular Print flow, not this dialog.

The dialog pre-selects the currently configured template on open, so
re-entry lands on the user's last choice.

**Inline PDF viewer (`src/components/sheets/SheetViewer.vue`, new)** —
Modal with an `<iframe>` showing the sheet PDF (via blob URL) plus a
summary line per §3.3. Footer buttons: Close, Download PDF, and Print
(triggers `iframe.contentWindow.print()` for the system print dialog).
Singleton state lives in
`src/composables/useSheetViewer.ts` so any output surface can pop the
viewer without prop drilling.

**Sheet print path** — `onPrintToSheet` in both `CanvasActions.vue`
and `PrintSection.vue`:
- Uses `renderSheet()` from `src/services/export/sheet-render.ts`
  (new) to expand `rowsForSelection × copies` row-major into a flat
  list and call `designer.exportSheet()`. Pack-tight, empty slots on
  the last page (no repeat-to-fill).
- Surfaces a payload (blob, file name, sheet label, totals) to the
  shared `useSheetViewer()` state; the viewer modal in `AppShell`
  picks it up.

**Print button label** — sheet-aware per §7.1: `Print to sheet` (when
count = 1), `Print to sheet (N labels, P pages)` otherwise.
`config.pageCount` and `config.labelsPerPage` computeds added to the
store for this.

**Legacy fallback removed** — `CanvasActions.onPrint` no longer
emits `open-sheet` from the no-thermal branch (§3.4). When neither
destination is possible, the DestinationRow's first-run CTA already
walks the user into setup before they can click Print. The
`emit('open-sheet')` declaration is retained because
`onPrintToSheet` calls it as a fallback when destination = sheet but
no template is configured (a state the toggle visibility table
shouldn't allow, but worth a defensive recovery path).

**Disabled-button rule** — `canPrint` is now destination-aware:
thermal needs `printer.effectiveMedia`, sheet needs
`config.sheetPossible`. The thermal status-poll guard
(`blockedByError`) is gated on
`config.effectiveDestination === 'thermal'` so a thermal printer
error can't disable a sheet print.

i18n keys: `output.sheetViewer.*`, `output.sheetSetup.*`,
`output.button.printToSheet*` in both locales.

Full suite (626 tests) green; typecheck clean.

**Open follow-up (Phase 3 territory):** the sheet print path doesn't
yet show a "Generating sheet PDF…" toast for renders that exceed
~250ms (§10). Will be added with PrintProgressToast in Phase 3.1.

### Phase 2 gate — PASSED

Connection-state coercion (§3.6) verified by 5 new test cases on the
store (printer disconnect / reconnect, sheet template cleared,
explicit pick stands across reconnect). All transitions are pure
derivations of `effectiveDestination`, no watchers needed.

- 631/631 vitest cases green.
- `vue-tsc --noEmit`: no errors.
- ESLint on touched surfaces: no warnings.

Phase 2 ships an end-to-end Thermal | Sheet output toggle. Sheet
template is now a persistent setting, not a per-print interruption.
Sheet output renders directly from the regular Print button into the
inline viewer — one click, output appears (ADR-001 satisfied).

---

## Phase 3 — Progress toast + BatchPanel removal

### 3.1 PrintProgressToast + thermal-batch service — DONE

**`src/services/print/thermal-batch.ts` (new)** —
`runThermalBatch(designer, printer, opts)` iterates `rows × copies`
row-major, calling `printer.print(image, { copies: 1, density })` per
label so cutter-capable printers cut after every label (§5.1, §5.2).
Generator is `renderBatch` from designer-core. The service surfaces
progress via `onProgress`, supports `shouldCancel` (polled between
labels, halt after current label), and `onRowError` (resume / halt
choice). Returns a `BatchSummary` with `printed / total / cancelled /
errors / lastRowIndex` for the caller to drive UI on. `resumeFrom`
parameter lets a follow-up call pick up where a halted batch left off.

**`src/composables/usePrintProgress.ts` (new)** — module-level
singleton state for the inline progress toast: `start` /
`startSheetGeneration` / `update` / `fail(rowIndex, msg, onResume?)` /
`succeed` / `cancel` / `markCancelled` / `dismiss`. The
`isCancelRequested` getter is what the batch service polls between
labels.

**`src/components/feedback/PrintProgressToast.vue` (new)** — bottom-
right toast (singleton via the composable). Renders:
- Printing: progress bar + "Printing N labels — row X of R, copy Y of Z".
- Generating sheet: simple "Generating sheet PDF…" message.
- Error: row-failed message + Resume / Dismiss.
- Cancelled: "Cancelled after X of N labels" + Dismiss.
- Success: "Printed N labels", auto-dismisses after 4s.

Mounted in `AppShell` so the toast is global.

**Print path wiring** — `CanvasActions.vue` and `PrintSection.vue`
now route `count > 1` thermal prints through `runThermalBatch` (with
the progress toast); `count = 1` keeps the existing single-shot
`printer.print(image, { copies: 1 })` path. No-dataset + copies > 1
synthesizes a single empty row so the batch loop drives copies.

Sheet path gets a delayed "Generating sheet PDF…" toast (250ms
threshold) so common <1s renders don't flash the toast (§10).

i18n keys: `progress.*` in both locales.

**Decision — synthetic empty row for no-dataset batch.** Plan §1.3
mentions "no dataset, copies = 5 → 5 labels". Rather than treat
this as a special case in the batch service, the consumer passes
`rows = [{}]` and `copies = 5`. The renderBatch generator yields
once with empty variables, the copy loop drives the 5-print
behaviour. Single code path, accurate per-copy progress.

**Decision — count == 1 still uses `printer.print({ copies: 1 })`.**
Avoids re-architecting the trivial single-print path that already
works. The new batch path is opt-in based on `config.count > 1`.

**Touched test:** `PrintSection.test.ts`'s "Print invokes
printer.print with copies + density" updated to `copies = 1` (the
3-copy variant now goes through the batch path which doesn't expose
a single `printer.print(_, { copies: 3 })` call). The existing
single-print contract is preserved — verified by the updated case.

Full suite (631 tests) green; typecheck clean.

### 3.2 Threshold confirmation + resume — DONE

**Threshold dialog (`useThresholdConfirm.ts` + `ThresholdConfirmDialog.vue`)**:
- Default threshold = 20 labels (§8). Calls below the threshold
  short-circuit `Promise.resolve(true)`.
- Per-session don't-ask-again checkbox; the session-only flag lives in
  the composable's module-level ref (no localStorage — re-arms next
  session per §8).
- Dialog body adapts to destination: thermal includes printer model
  ("This will send 60 print jobs to {model}"); sheet includes page
  count ("This will print 30 labels across 2 pages of Avery L7160").

**Wired into print paths** — both `CanvasActions.vue` and
`PrintSection.vue` `await thresholdConfirm.confirmIfNeeded(…)` before
`runBatchPrint()` (thermal) or `renderSheet()` (sheet). Cancel
short-circuits without firing the print.

**Resume from row N** — `runBatchPrint(resumeFrom = 0)` accepts a
starting row index. On mid-batch error, the caller passes a closure
into `printProgress.fail(rowIndex, msg, () => runBatchPrint(rowIndex))`
so the toast's Resume button reruns the batch from that row. The
progress UI accounts for the already-printed labels (`completed =
resumeFrom * copiesPerRow + perRowProgress`) so the bar resumes mid-
fill instead of resetting to zero.

`thermal-batch.ts` already had `resumeFrom` support (slices the row
array; designer-core's renderBatch starts from index 0 of the trimmed
slice); the `lastRowIndex` returned in the batch summary is the
1-indexed row that the user can read in the toast's Resume label.

5 cases in `useThresholdConfirm.test.ts` cover: at-threshold short-
circuit, over-threshold prompt, cancel returns false, don't-ask-again
skips subsequent prompts, reset clears the flag.

Full suite (636 tests) green; typecheck clean.

### 3.3 Remove BatchPanel + toolbar entry — DONE

Deleted:
- `src/components/batch/BatchPanel.vue`.
- "Print Batch (count)" button in `CanvasActions.vue` popup; the
  `onPrintBatch` handler and `open-batch` emit declaration.
- "Open batch preview" button in `DataPanel.vue`; the `open-batch`
  emit declaration.
- `open-batch` event chain through `SidePanel.vue` → `AppShell.vue`.
- `BatchPanel` import + `<BatchPanel>` render in `AppShell.vue`;
  `batchOpen` ref.
- i18n keys: `actions.printBatch`, `data.batch.open`, top-level
  `batch.*` block (en + nl).

Routes that previously opened BatchPanel now land users on the
central Print flow — the Output tab and the central Print popup
both run multi-row prints through the new progress-toast path.

`src/stores/__tests__/batch.test.ts` is retained — it tests
AsyncGenerator iteration semantics (used by `runThermalBatch`), not
the deleted UI.

### Phase 3 gate — PASSED

- 636/636 vitest cases green.
- `vue-tsc --noEmit`: no errors.
- ESLint on every touched surface: no warnings.

---

## Final summary

The bulk-output amendment shipped across three phases. End-to-end:

- A single `OutputSelection` (Active | All | Range) drives every
  output surface — Print popup, Output tab Print section, Save-as-file
  row. Imports default to "all", labels are honest about the count.
- A `PrintDestination` toggle (Thermal | Sheet) makes thermal and
  sheet peer destinations. Sheet template is a persistent global
  setting, not a per-print interruption.
- Multi-row Print flows through an inline progress toast with cancel
  + resume; the BatchPanel modal is gone. Threshold confirmation
  guards counts > 20 with a per-session don't-ask-again.
- Multi-row Save → PDF / PNG honours the same selection; PDF is N
  pages, PNG is a JSZip bundle (single file when count = 1).
- Sheet output renders directly through the regular Print button into
  an inline viewer — one click, output appears (ADR-001).

Out-of-scope items per §6 stayed out: per-row copies override, per-
row skip / disable in the selector, sheet "repeat to fill", strip-
image PNG variant, filename templating, cut-mode override, copy-major
print order, re-print "the last batch" affordances, persistent
"never ask" for threshold, and dataset-cap lifting.

Open follow-ups (small UX polish, not blockers):
- Per-row error click in the progress toast doesn't yet open the
  dataset table at that row.
- Compact 4-digit count label (`Print 1.2k labels`) is unimplemented;
  moot at the current 30-row cap, will need attention if the cap
  rises.
- Cutter capability is delegated to the printer driver's default
  behaviour rather than checked explicitly. Brother QL drivers cut
  after every `print()` call by default; if a future printer family
  doesn't, the fix is a query on `printer.adapter.capabilities` in
  `runThermalBatch`.

---

## Post-merge refinement — sheet picker sync (2026-04-29)

User reported that the topbar's sheet picker
(`LabelSizeSelector` → `media.pickSheet`) and the Print popup's
sheet picker (`SheetDialog` → `print-config.setSheetTemplate`) did
not stay in sync — picking in one didn't reflect in the other,
since they tracked different concepts (canvas-source vs output
target). Documented as plan §4.0; implemented option 2 of the three
sketched options.

**Resolution chain** in `print-config.sheetTemplate`:

1. Per-document override (`overrideByDoc: Map<docId, code>`,
   session-only).
2. Canvas sheet (`media.sheetCode`).
3. Global last-picked (`localStorage`).

**Write paths:**

- `setSheetTemplate(t)` (Print popup): writes the per-doc override
  and bumps the global last-picked. Doesn't touch the canvas.
- `recordCanvasSheetPick(t)` (topbar `LabelSizeSelector.onSheet`):
  clears any per-doc override and bumps the global last-picked. The
  canvas itself is changed by the existing `media.pickSheet(t)`
  call alongside this; the resolution chain then surfaces the new
  canvas sheet via step #2.

`sheetOverrideActive` computed exposes whether the resolved
template diverges from the canvas sheet — useful for a future
"(override)" hint on the change link.

**Decision — keep both stores' concepts intact, link them via
the chain.** Option 1 (single source of truth in `media.ts`)
would have meant the Print popup's picker always resizes the
canvas, which is destructive. Option 3 (two-way sync watchers)
fights itself and loses the global last-picked persistence model.
Option 2 keeps `media.ts` as canvas-intent and `print-config` as
output-intent; the chain just makes the output picker default to
the canvas pick when the user hasn't said otherwise.

**Tests** (6 new cases, 27 total in `print-config.test.ts`):
- Canvas fallback when no override and no global.
- Per-document override beats canvas sheet.
- Canvas sheet beats global on a doc with no override.
- `recordCanvasSheetPick` clears override + bumps global.
- Override is per-document.
- `sheetOverrideActive` is false when override matches the canvas.

Full suite (642 tests) green; typecheck and lint clean on
touched files.

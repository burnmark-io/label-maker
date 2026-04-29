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

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

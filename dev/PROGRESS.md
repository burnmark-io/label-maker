# label-maker — Implementation Progress

Tracking the phase/step plan from `PLAN.md` section 22. Tick boxes as steps complete.

## Phase 1: Scaffold + Core Shell
- [x] 1. Scaffold — vite, vue, router, pinia, eslint, prettier, tsconfig
- [x] 2. Design tokens — CSS variables, base styles, typography
- [x] 3. AppShell — layout with top bar, sidebar, canvas area
- [x] 4. Pinia stores — designer (wraps composable), preferences, printer, library
- [x] 5. Gate: app runs in dev mode, sample label loaded

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 2: Design Canvas
- [x] 6. Konva canvas — stage, background layer, grid overlay
- [x] 7. Text objects — add, select, move, resize, edit inline
- [x] 8. Image objects — import (with resize), fit modes, drag
- [x] 9. Shape objects — basic shapes (rect, circle, line)
- [x] 10. Barcode objects — format picker, data input, live preview
- [x] 11. Selection — multi-select, handles, alignment guides, snapping
- [x] 12. Properties panel — text, image, barcode, shape properties
- [x] 13. Objects panel — z-order list, visibility, lock
- [x] 14. Paper direction indicator — feed arrow, cut line for continuous
- [x] 15. Keyboard shortcuts
- [x] 16. Gate: can design a label with all object types, undo/redo works

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 3: Shapes and Borders
- [x] 17. Decorative shapes — heart, star, diamond, arrow, badge, ribbon
- [x] 18. Border presets — simple, classical, playful, dotted
- [x] 19. Shape library picker in toolbar (Basic / Decorative / Borders)
- [x] 20. Gate: all shapes render correctly on canvas and in bitmap preview

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 4: Printer Integration
- [x] 21. Printer connection lib (registry, drivers, connect helpers) and refactored store
- [x] 22. "Connect Printer" button (PrinterPopover) + auto-reconnect composable
- [x] 23. Printer status indicator (connected/paired/disconnected/error)
- [x] 24. Media auto-detection from getStatus() + manual selector
- [x] 25. Print preview panel rendering createPreview() planes (incl. two-colour)
- [x] 26. Print button flow with copies/density popover and toast feedback
- [x] 27. Web Serial alongside WebUSB for Bluetooth SPP (QL-820NWB)
- [x] 28. Gate: connect→preview→print works against mocked drivers

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 5: Data and Batch
- [x] 29. Template variables — placeholder detection, substitution preview
- [x] 30. CSV import — drag-and-drop, papaparse (via designer-core)
- [x] 31. Excel import — SheetJS, first sheet, row 1 as headers
- [x] 32. Column mapper — auto-map (exact → fuzzy → positional) + manual UI, persisted per template-shape
- [x] 33. Batch preview grid — virtual-scrolled thumbnails (lazy-rendered as scrolled into view)
- [x] 34. Batch print — progress bar, per-row status, error recovery
- [x] 35. Limit banner — 30-row cap with "let us know" feedback link
- [x] 36. Gate: import CSV/Excel, map columns, preview batch, print batch

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 6: Export and Sharing
- [x] 37. Save/load — IndexedDB-backed library, 10-slot UI with editable name + description
- [x] 38. Export PNG/PDF — via designer-core composable helpers
- [x] 39. Sheet export — picker dialog (lazy-loads `@burnmark-io/sheet-templates`), visual preview, PDF download
- [x] 40. Export .label file — JSON download
- [x] 41. Export bundled .zip — design + assets, surfaces missing-asset warnings
- [x] 42. URL sharing — pako + base64url, 8KB cap with .label fallback, hash import on app load
- [x] 43. Gate: all export paths work, share URLs round-trip correctly

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 7: PWA and Docker
- [x] 44. PWA — vite-plugin-pwa, manifest, icons, install prompt (after 2nd session, 7-day "maybe later")
- [x] 45. Offline mode — IndexedDB designs, no external CDN deps; SW caches all static assets
- [x] 46. Dockerfile — two-stage build (node:24-slim → nginx:alpine), serves on port 80
- [x] 47. docker-compose.yml — app on 8080, proxy sidecar on 3000 with /dev/bus/usb mount
- [x] 48. compose.yaml published to public/ for download at burnmark-io.github.io/compose.yaml
- [x] 49. Gate: PWA manifest valid, SW registers, Docker builds and runs (smoke-tested with curl)

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 8: Polish, i18n, a11y
- [x] 50. vue-i18n setup with en/nl locales (localStorage → navigator.language → en)
- [x] 51. Dutch locale (best-effort, marked for review in PLACEHOLDERS.md); missing-locale toast for unsupported browsers
- [x] 52. a11y: ARIA labels on icon buttons, focus-visible ring, focus trap in modals, role="dialog" + aria-labelledby + Escape, ToastStack aria-live, side panel tabs (arrow keys), darker amber for text (#b45309), canvas aria-label + off-screen contents summary, prefers-reduced-motion
- [x] 53. Footer with rotating sponsor texts (per-mount, locale-aware), About + Help links
- [x] 54. About modal — name explanation, scopecreep hint, project links, funding, version
- [x] 55. Help menu — restart tour, shortcuts reference, printer compatibility, docs/report/feature links; opens via footer link, top-bar button, and `?` shortcut
- [x] 56. Onboarding tour (4 steps, first-visit auto-start, restartable, dismissable)
- [x] 57. Empty states: side panel "no objects yet" hint, library empty cards, batch "no data" prompt
- [x] 58. Error messages audited — toasts use friendly language, errors include why-then-what
- [x] 59. Transitions polished, all wrapped by prefers-reduced-motion override
- [x] 60. Responsive: tablet landscape stacks side panel under canvas (≤900px breakpoint)
- [x] 61. Performance: virtual scroll in batch grid (Phase 5), debounced renders in composable, lazy-loaded sheet templates
- [x] 62. Gate: typecheck + lint + format + test + build all clean

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

## Phase 10: Side-panel and data UX

Implementing `amendment-side-panel-and-data.md` — merge Objects+Properties into
an accordion, grow the Data tab into a real workspace with a global dataset
pool (≤10 sets, ≤30 rows each, IndexedDB-persisted, cross-design).

### Phase A: Tab structure & migration
- [x] A1. Reduce tabs to 3 (`objects` / `data` / `preview`); `SidePanelTab` type pruned; one-shot migration maps legacy `'properties'` value → `'objects'` at store init
- [x] A2. i18n — `panel.properties` kept as a string but no longer used as a tab label; locale parity preserved
- [x] A3. Onboarding tour step 3 copy updated ("Edit objects in the side panel" / "Click any object in the list to edit its properties.") in en + nl
- [x] A4. Help / shortcuts modal: no Properties-tab references; nothing to update
- [x] A5. Dropped redundant `<h2 class="panel__title">{{ t('panel.X') }}</h2>` headers from `ObjectsPanel.vue`, `DataPanel.vue`, `PrintPreview.vue`

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

### Phase B: Inline accordion
- [x] B1. ObjectsPanel grows expand state — `expandedId` computed from `designer.selection`. Component name kept (no rename) to minimise churn
- [x] B2. Selection drives expand: 0 → collapsed; ≥1 → most-recently-clicked id (`selection[selection.length - 1]`); canvas Esc / empty-area click already deselects, so the row collapses with it
- [x] B3. Per-type property forms render inline (`CommonProperties` always; `Text/Image/Barcode/ShapeProperties` by `obj.type`). Form components untouched
- [x] B4. Chevron at the row's right edge, rotates 90° when expanded; row body click toggles selection (which drives expand)
- [x] B5. Empty-state line plus a hint below the list ("Click any object to edit its details.") — new i18n key `panel.objectsHint` in en + nl
- [x] B6. a11y: each row uses `aria-expanded`; expanded form region has `role="region"` + `aria-labelledby` referencing the row header; row is keyboard-activatable via Enter / Space
- [x] B7. `PropertiesPanel.vue` deleted; SidePanel no longer imports it

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

### Phase C: Global dataset pool & persistence
- [x] C1. IDB bumped to v2; new `datasets` object store (keyPath `id`); idempotent upgrade leaves `designs` / `assets` / `meta` untouched (verified by a v1→v2 round-trip test)
- [x] C2. Storage helpers added: `listDatasets` (sorted by `updatedAt` desc), `putDataset`, `deleteDataset`, `clearDatasets`; new `StoredDataset` and `DatasetSource` exports
- [x] C3. `useDataStore` rebuilt around the global pool — `datasets[]`, `activeDataset`, `headers`/`rows`/`mapping`/`lastImport` become read-through computed proxies. New mutators: `createDataset`, `setActiveDataset`, `renameDataset`, `removeDataset`, `appendRowsToActive`, `clearActive`, `resetAll`, plus `flushPersist` for tests. Mapping is read straight from D21's placeholder-set-keyed cache; no `mapping` field on `StoredDataset`
- [x] C4. Persistence is explicit-per-mutation with a 300ms debounced flush. `snapshot()` strips Vue reactivity before structured-cloning into IDB
- [x] C5. Boot hydrate is single-flight (`Promise<void>` shared across concurrent callers); `main.ts` awaits `useDataStore().hydrate()` before mount. Stale `activeDatasetId` falls back to most-recent dataset, else null, with a `console.warn` rather than throwing
- [x] C6. Datasets are global — no document lifecycle wiring; the library deletion path is unchanged and does not cascade into data
- [x] C7. `useCsvImport` decoupled from `setData`: parses, then routes via `prefs.csvImportBehavior` (`'append'` / `'new'` / `'ask'`). The `'ask'` branch invokes an optional `onAsk` callback (Phase D wires it to `ImportChoiceDialog`); without a callback it falls back to creating a new dataset
- [x] C8. Preferences gain `csvImportBehavior: 'ask' | 'append' | 'new'` (default `'ask'`) and `activeDatasetId: string | null`
- [x] C9. Tests added — boot hydrate, IDB round-trip across store instances, eviction at the cap, manual-set eviction confirm, append semantics, stale-active fallback, resetAll. 77 tests pass overall (up from 68)

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

### Phase D: Manual rows, popup grid, dataset switcher, import dialog
- [x] D1. `DatasetSwitcher.vue` — single component used in the Data tab and in `DataEditorDialog`'s header. Renders the active set's name + row count + the "M / 10" counter. Menu lists every set (most-recent first) with set-active / rename / duplicate / delete; footer carries "+ New manual dataset", "📂 Import a file…", "Reset all data" (with confirms)
- [x] D2. `ImportChoiceDialog.vue` — fires from the dropzone via `useCsvImport.onAsk`. Three actions (append / new / cancel); a "Remember this choice" checkbox writes through to `prefs.csvImportBehavior` so the next drop skips the dialog. Reuses `Modal.vue`
- [x] D3. `DataEditorDialog.vue` — `lg` modal (≥720px) hosting an editable grid for the *active* set. Header carries a `DatasetSwitcher` so the user can hop between sets without closing
- [x] D4. Editable grid markup — sticky header row with column-name + per-column "→ {{placeholder}}" remap dropdown (writes through to D21 immediately). Body rows are text-input cells. Per-row actions: ↑ / ↓ to reorder (drag-to-reorder deferred per Risks §6), duplicate, delete
- [x] D5. "Add row" + "Add column" footer buttons — `addRowToActive` / `addColumnToActive`. "Add column" is disabled outside `source: 'manual'` to avoid drift with imported headers
- [x] D6. Caps & banners — existing `LimitBanner` reused inside the popup; "Datasets: M / 10" rendered by the switcher; row-cap message under the grid when at 30
- [x] D7. Compact inline preview — `DataPanel`'s heading row replaced with the switcher; row card shows up to 4 mapped placeholders with overflow tooltip; "Add row" + "Edit dataset ✏️" buttons next to the prev/next stepper
- [x] D8. Manual-mode bootstrap — when placeholders exist and the active set is empty, an "Or add rows by hand →" CTA seeds a manual dataset with placeholders as headers + one empty row, then opens the editor
- [x] D9. Mapping inline + popup — `ColumnMapper` continues to render below the row card; the popup grid header repeats the column ↔ placeholder remap so users don't have to bounce. Both write through `data.setColumnFor` (D21 cache) so the two surfaces stay coherent
- [x] D10. Tests — composable tests for `useCsvImport` covering each routing branch (no-active → create, append, new, ask→append, ask→cancel) plus row-level data-store tests (add / update / delete / duplicate / move row, addColumnToActive auto-numbering and dedup, duplicateDataset independence). 88 tests pass overall (up from 77)

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

### Phase E: CSV template download
- [x] E1. `services/csv-template.ts` — pure `buildCsvTemplate(placeholders, documentName)` returning `{ filename, csv }`. Headers are lowercased placeholders in order; the example row uses plausible defaults for known names (name → "Sample name", address → "123 Main St", postcode → "1234 AB", …) and a numbered `value N` fallback otherwise. Manual CSV escaping (no SheetJS) — quotes any cell containing `,` / `"` / newline, doubles embedded quotes
- [x] E2. UI — "⬇ Download template" button next to the dropzone in `DataPanel`. Disabled when `placeholders.length === 0` with the `data.template.disabledTooltip` tooltip
- [x] E3. Wire — clicks call `buildCsvTemplate(placeholders, designer.document.name)` → `Blob` → existing `downloadBlob` helper (which appends an off-DOM `<a download>` and revokes the object URL after the click)
- [x] E4. i18n — `data.template.download` and `data.template.disabledTooltip` added in en + nl; nl flagged for review in `PLACEHOLDERS.md`
- [x] E5. Tests — unit tests for `buildCsvTemplate` covering header order, plausible defaults, numbered fallback, sanitised filename. 93 tests pass overall (up from 88)

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

## Phase 11: Barcode input validation

Implementing `amendment-barcode-validation.md` — turn the barcode `data`
textarea into a guided input with per-format keystroke filter, soft
validation helper line, and an inserter button for placeholder tokens.
Never blocks save/print.

- [x] 11.1 Scaffold `src/lib/barcode/validation/` (`types.ts`, `checksums.ts`,
      `gs1.ts`, `registry.ts`, `index.ts`)
- [x] 11.2 `checksums.ts` — `ean13/ean8/upca` mod-10 + `isValidGtin`,
      pure functions, unit-tested
- [x] 11.3 `gs1.ts` — partial `AI_TABLE`, `parseGs1`, `lookupAi`
      (310/320 family fallback), `validateParsedAis`
- [x] 11.4 `registry.ts` — one `FormatRule` per format from §4 (mask,
      transform, validate, hintKey, placeholderKey); parameterised
      tests over the registry, every format has at least 1 valid + 1
      invalid example
- [x] 11.5 i18n — `properties.barcode.hint.*`, `placeholder.*`,
      `validation.*`, `insertVariable*`, `noPlaceholders` added in en
      and nl; nl flagged in `PLACEHOLDERS.md`
- [x] 11.6 `BarcodeProperties.vue` — controlled textarea, mask filter
      with `{` / `}` exception, placeholder-bypass, helper line below
      with severity variants; `aria-invalid` / `aria-describedby` /
      `aria-labelledby`; format-specific `placeholder` attribute and
      empty-state hint
- [x] 11.7 CSS — `.props__textarea--error/--warning`,
      `.props__help--info/--warning/--error` in `properties-panel.css`
- [x] 11.8 `InsertVariableButton.vue` — `{ }` trigger, popover lists
      `useDataStore.placeholders`, click inserts `{{name}}` at cursor,
      disabled with tooltip when list is empty, focus-trapped popover
      with Arrow/Escape support
- [x] 11.9 Component test for `BarcodeProperties.vue` — empty hint,
      error helper, aria-invalid, placeholder bypass, mask filter, brace
      exception, write-through with placeholders, inserter button
      disabled state, inserter wires through to update
- [x] 11.10 New decision entries in `DECISIONS.md` (D31–D34)
- [x] 11.11 Gate: typecheck + lint + format + test + build

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

## Phase 14: Library slot semantics

Implementing `amendment-library-slots.md` — surface explicit
**New label**, **Save**, and **Save as new** actions so the 10-slot
library is fully reachable, fix the empty-slot `+` button to actually
create a new entry, and ensure imports never silently overwrite an
existing slot.

- [x] 14.1 `useDocumentLifecycle` composable — `confirmDestructiveSwap`,
      `assignNewId` (app-side via `loadDocument`, no designer-core
      change), `newBlankDocument`. Shared by toolbar and library modal
- [x] 14.2 Share-URL imports get a fresh id + timestamps in
      `readDocumentFromHash` so a colliding id can never overwrite an
      existing library slot
- [x] 14.3 Toolbar Save dropdown — added **New label** above Save and
      **Save as new** below; both wired to the lifecycle composable
- [x] 14.4 `DesignLibrary` — `+` button re-bound to `onNewBlankSlot`
      (creates a fresh-id blank entry instead of overwriting the active
      slot); **Save as new** added to the footer when the current doc
      already exists in the library; `ConfirmDialog` rendered for the
      shared confirmer
- [x] 14.5 i18n — `actions.newLabel`, `actions.saveAsNew`,
      `library.saveAsNew`, `library.newSlot` (re-purposed),
      `library.newLabelToast`, `library.savedAsNew`,
      `library.cantSaveAsNew`, `library.replaceConfirmTitle`,
      `library.replaceConfirm`, `library.replaceConfirmAction`,
      `library.slotsHint` added in en + nl; nl flagged in
      `PLACEHOLDERS.md`
- [x] 14.6 Library modal header carries a one-line slots hint when the
      grid isn't full (in lieu of the optional `HelpDialog` change —
      the help menu has no natural slot for an info-only line, the
      library modal is where the user is making the slot decision)
- [x] 14.7 Tests — `useDocumentLifecycle`: confirm-skip when canUndo is
      false, confirm-prompt-and-resolve/cancel when canUndo is true,
      `assignNewId` reloads with fresh id + timestamps + clears history,
      `newBlankDocument` resets and clears history, integration test
      that save-after-`assignNewId` creates a new entry without touching
      the original. Share-encoder: `readDocumentFromHash` rewrites id +
      timestamps. 252 tests pass overall (up from 244)
- [x] 14.8 Decisions D35–D40 added in `DECISIONS.md`

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

## Phase 9: Final
- [x] 63. Verify all gate checks across phases
- [x] 64. Designed for Chrome/Edge desktop full flow; Firefox/Safari fall back to design+export only (banner via `noWebUsb` string)
- [ ] 65. Android OTG scenario — no device available in this session, see BLOCKERS.md
- [x] 66. Docker build smoke-tested in Phase 7
- [x] 67. en.json + nl.json verified at full parity (318 keys each)
- [x] 68. Keyboard-only navigation verified (Tab through topbar/toolbar/panel/dialogs, focus trap in modals, Escape closes)
- [x] 69. PWA manifest valid, install prompt wired (Phase 7)
- [x] 70. Offline-capable build (no external CDNs, IndexedDB designs, SW caches static assets)

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

## Phase 13: `.label` and `.zip` import

Implementing `amendment-label-import.md` — accept `.label` JSON files
and `.zip` bundles via a new **Import…** menu entry, full-window drag
overlay, and PWA `file_handlers` so installed apps open the formats
directly. Single shared `runImport` flow for all surfaces; bundle
assets restored via `assetLoader.set(key, bytes)`; imports always rewrite
the document `id` + timestamps so they cannot silently overwrite a
library slot.

- [x] 13.A.1 `services/label-import.ts` — `importLabelFile`,
      `ImportError`, `MAX_IMPORT_SIZE`, JSON branch, fresh-id rewrite
- [x] 13.A.2 Hidden file input + **Import…** menu entry in
      `CanvasActions.vue`. `runImport` extracted to
      `composables/useLabelImport.ts`
- [x] 13.A.3 Extend `confirmDestructiveSwap()` with optional
      `{ incomingName }`; new `library.replaceConfirmWithIncoming` i18n
      key (en + nl)
- [x] 13.A.4 Wire `runImport` to call `confirmDestructiveSwap({ incomingName: file.name })`
- [x] 13.A.5 Toast wiring (loading / success / error)
- [x] 13.A.6 i18n keys (`actions.import`, `import.*`)
- [x] 13.A.7 Tests for `importLabelFile` JSON branch
- [x] 13.A.8 Tests for the extended helper (parameterless vs.
      `incomingName` paths)
- [x] 13.B.1 `jszip` added as a direct dep of label-maker
- [x] 13.B.2 `services/label-import.bundle.ts` — `parseBundle`
- [x] 13.B.3 Bundle branch wired into `importLabelFile` —
      `assetLoader.set(key, bytes)` per asset
- [x] 13.B.4 Missing-assets toast variant
      (`import.successWithMissing`)
- [x] 13.B.5 Dev-only SHA-1 verification (`console.warn` on mismatch),
      skipped in tests + production
- [x] 13.B.6 Tests — round-trip, missing-asset case, malformed bundle,
      missing `label.json`, corrupt zip
- [x] 13.C.1 `components/layout/ImportDropOverlay.vue` with
      entry-counter logic
- [x] 13.C.2 Mounted in `AppShell.vue`; shares `useLabelImport.runImport`
- [x] 13.C.3 CSS — full-window overlay, fade-in, respects
      `prefers-reduced-motion`
- [x] 13.C.4 CSV dropzone uses `.prevent.stop` on drag handlers so the
      global overlay never activates while the cursor is inside it
- [x] 13.C.5 Test: `dataTransfer.types` filter (only show for file drags)
- [x] 13.C.6 Test: drop runs the import handler; overlay clears
- [x] 13.D.1 `share.tooLarge` updated to point users at the Import menu
- [x] 13.E.1 `ConfirmDialog` already in use (lifecycle.confirmer) —
      no `window.confirm` introduced
- [x] 13.E.2 Telemetry-free — no analytics added
- [x] 13.E.3 `nl.json` mirror complete; flagged in `PLACEHOLDERS.md`
- [x] 13.E.4 Decisions D41–D46 added to `DECISIONS.md`
- [x] 13.F.1 `file_handlers` entry added to PWA manifest in
      `vite.config.ts`
- [x] 13.F.2 `launchQueue` consumer in `AppShell.vue` drains the queue
      before share-URL hash; routes through `runImport`; replaces
      `/open` URL with `/`

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test (275 passing)
- [x] build

## Phase 12: Canvas sizing and media selection

Implementing `amendments/implemented/amendment-canvas-sizing.md` —
decouple canvas size from printer connection so users without a thermal
printer aren't locked out, and make label dimensions a first-class
design choice with overrides for wrongly-detected media.

- [x] 12.1 `lib/media/common-sizes.ts` — driver-agnostic registry of
      common label sizes (Brother QL, LabelWriter, P-touch / D1,
      generic). Format-aware (`continuous` / `fixed`)
- [x] 12.2 `stores/media.ts` — last-used size persisted in
      localStorage (`burnmark.lastLabelSize`); printer-detected media
      is a suggestion, never a lock; user-set continuous length lives
      here so the AppShell out-of-bounds watcher can react to it
- [x] 12.3 `components/media/LabelSizeSelector.vue` — persistent
      dropdown in the top bar with sections: From printer (detected)
      / Common sizes / From sticker sheet / Custom. Replaces the
      printer-popover-only `MediaSelector.vue` (deleted)
- [x] 12.4 `components/media/CustomSizeInput.vue` — free-form mm
      width/height input; leave height empty or `0` for a continuous
      label
- [x] 12.5 `components/media/SheetPickerDialog.vue` — search/filter
      over the sticker-sheet registry; pick a sheet, the canvas
      resizes to its single-label dimensions
- [x] 12.6 `components/canvas/ContinuousResizeHandle.vue` — drag the
      canvas bottom edge to set the continuous length manually
- [x] 12.7 `composables/useOutOfBounds.ts` — flag objects that fall
      outside the label after a resize. AppShell watches canvas
      dimensions + continuous length and toasts (count-aware) when
      the effective frame shrinks
- [x] 12.8 PaperBackground / DesignCanvas / useCanvasViewport /
      printer store / ObjectsPanel adjusted for the decoupled flow;
      ObjectsPanel surfaces the out-of-bounds tooltip
- [x] 12.9 i18n — `printer.detectedMedia` / `noMediaDetected` /
      `changeSizeHint`, `canvas.continuousLength` /
      `outOfBoundsTooltip` / `outOfBoundsResizeToast`, full
      `media.*` namespace (selector, fromPrinter, commonSizes,
      fromSheet, format, sheet, custom, toast). en + nl
- [x] 12.10 Tests — `stores/__tests__/media.test.ts` covers the
      selector, sheet pick, and printer-detected interaction

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

## Phase 15: Local data encryption

Implementing `amendments/implemented/amendment-local-data-encryption.md`
— ship opt-in encryption-at-rest for every user-data record we keep on
the device (designs, datasets, assets, column-mapper cache), fronted
by a footer Privacy page that explains the storage model honestly and
a one-click reset. Password gone = data gone. No recovery, no hint, no
second factor.

- [x] 15.1 `services/crypto.ts` — Web Crypto wrapper. PBKDF2-SHA-256
      @ 600k iterations (OWASP) → AES-GCM-256. Encrypt/decrypt of
      bytes and strings, verifier mechanism, base64 helpers for the
      localStorage path
- [x] 15.2 `services/storage.ts` — value-level envelope wrapping for
      `designs` / `datasets` / `assets`. Listing decrypts envelopes
      when the key is set so design names don't leak in plaintext.
      New API: `setStorageKey`, `migrateEncryption`, `countAssets`,
      `clearAllStores`
- [x] 15.3 `services/column-mapper.ts` — async hydration with
      in-memory cache; sync reads preserved (the existing computeds
      and store call-sites stay synchronous), plaintext writes go
      straight through, encrypted writes are debounced
- [x] 15.4 `stores/crypto.ts` — orchestrator. `init` /
      `setupEncryption` / `unlock` / `changePassword` /
      `disableEncryption` / `resetAllUserData`. Holds only the
      derived `CryptoKey` for the session — never the password
- [x] 15.5 `main.ts` — boot gate: read `enc.enabled` from `meta`
      before any other store hydrates. When enabled and locked, the
      AppShell renders `<UnlockScreen />` instead of the editor
- [x] 15.6 `components/layout/AppShell.vue` — `v-if`-branches the
      editor for the unlock screen when locked; AppFooter /
      AboutDialog / HelpDialog / PrivacyDialog / ResetDataDialog stay
      mounted in both states. Heavy `onMounted` body extracted into
      `bootstrapAfterUnlock()`; `watch` on `crypto.locked` re-runs it
      on the unlock transition
- [x] 15.7 `components/common/PrivacyDialog.vue` — storage explainer,
      live counters (designs / datasets / assets / storage MB),
      encryption status with inline change-password and disable
      forms, reset entry
- [x] 15.8 `components/common/EncryptionSetup.vue` — two warnings
      (irreversible + scope), password+confirm, length hint, "I
      understand" checkbox, 8-character minimum
- [x] 15.9 `components/common/UnlockScreen.vue` — full-viewport,
      password field, "Forgot password? Reset all data" escape hatch
- [x] 15.10 `components/common/ResetDataDialog.vue` — typed
      confirmation (`reset`, untranslated), wipes IDB + every
      `burnmark.*` localStorage key, reloads the app
- [x] 15.11 `AppFooter.vue` — Privacy link between Help and GitHub;
      `useUiDialogs.ts` gains `privacyOpen` / `openPrivacy()`
- [x] 15.12 i18n — `privacy.*` /
      `encryption.{setup,unlock,change,disable}.*` / `reset.*` in
      en + nl
- [x] 15.13 Tests — `services/__tests__/crypto.test.ts` (round-trip,
      wrong-key reject, IV uniqueness, verifier, KDF iteration),
      `services/__tests__/storage.test.ts` extended (encrypted
      records, listing, migration plaintext↔encrypted, change-password,
      countAssets, clearAllStores), `stores/__tests__/crypto.test.ts`
      (setup, lock/unlock, changePassword, disable, mapping
      persistence, resetAllUserData). 321 passing (up from 274)
- [x] 15.14 v2 plan committed alongside —
      `amendments/backlog/amendment-passkey-unlock.md` (WebAuthn PRF
      unlock with master-key wrapping indirection). Backlog only

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test (321 passing)
- [x] build

## Phase 16: Passkey & biometric unlock

Implementing `amendments/implemented/amendment-passkey-unlock.md` —
opt-in WebAuthn PRF unlock layered on top of the password-based
encryption shipped in Phase 15. Master-key wrapping indirection: MK
becomes random and is wrapped under one password KEK plus (optionally)
one passkey KEK derived from the authenticator's PRF result. Single-
passkey policy; password stays as the canonical recovery path.
Pre-stable codebase, so we ship the v2 wrap layout fresh — anyone with
a v1 store from Phase 15 will hit the unlock screen and use Reset all
data to start over.

- [x] 16.1 `services/crypto.ts` — `generateMasterKey` (random 32-byte
      AES-GCM key, extractable so it can be wrapped); `wrapKey` /
      `unwrapKey` (AES-GCM round-trip over the raw 32 bytes of MK);
      `importPrfKey` (32-byte WebAuthn PRF result → AES-GCM CryptoKey).
      Auth-tag failure on unwrap doubles as the wrong-KEK signal
- [x] 16.2 `services/webauthn.ts` — capability detect
      (`isWebAuthnAvailable`, `isPrfLikelySupported` — best-effort via
      `getClientCapabilities` with optimistic fall-through),
      `registerPasskeyAndDerivePrf` (create → verify `prf.enabled` →
      immediate `get` to derive the PRF result; rolls back on any
      failure so the OS keychain doesn't keep dead credentials),
      `authenticateAndDerivePrf` (single-element `allowCredentials`,
      `userVerification: 'required'`), platform detection for friendly
      button labels ('touchid' / 'windows-hello' / 'android' /
      'generic')
- [x] 16.3 `stores/crypto.ts` rewritten around the wrap-indirection
      model. New shape: `enc.format = 2`, `enc.wraps: WrapRecord[]`
      (one `kind: 'password'` + zero-or-one `kind: 'passkey'`),
      `enc.verifier` under MK, `enc.passkeyUserId` lazily-created and
      reused so re-registration replaces the OS-keychain entry
      instead of orphaning. New methods: `addPasskey()` (single-passkey
      invariant enforced; reasoned failure result), `removePasskey()`,
      `unlockWithPasskey()`. Existing `setupEncryption` / `unlock` /
      `changePassword` / `disableEncryption` reworked to operate on
      wraps — change-password is now three IDB writes, no record walk
- [x] 16.4 `components/common/UnlockScreen.vue` — passkey button above
      the password field, only rendered when a passkey is registered
      AND the browser supports WebAuthn. Platform-aware label
      ("Use Touch ID" / "Use Windows Hello" / "Use registered passkey")
- [x] 16.5 `components/common/EncryptionSetup.vue` — after a successful
      first-time setup, transitions to a second "step" inside the same
      modal that nudges the user to add a passkey. Skipped when PRF
      isn't supported on the current browser. Maps known reason codes
      to friendly i18n strings (cancelled / prf-not-supported / failed)
- [x] 16.6 `components/common/PrivacyDialog.vue` — new "Devices that
      can unlock burnmark" sub-section with the always-present
      password row plus the optional passkey row. Add/Remove buttons
      are state-aware: Add hides when a passkey is registered or PRF
      is unsupported (showing a small disabled note in that case).
      Disable-encryption confirmation grows an extra line about the
      OS-keychain orphan when a passkey is present. Honesty footnote
      about iCloud / Google Password Manager sync
- [x] 16.7 i18n — `passkey.*` namespace covering use/add labels per
      platform, unlock copy, nudge copy, privacy list copy, and error
      strings. en + nl
- [x] 16.8 Tests — `services/__tests__/crypto.test.ts` adds wrap/unwrap
      round-trip, `importPrfKey` size guard, `generateMasterKey`
      randomness; `services/__tests__/webauthn.test.ts` (new) mocks
      `navigator.credentials.create` / `get` and covers the registration
      → PRF-eval → result path, the unlock path, capability gating,
      and every reason code; `stores/__tests__/crypto.test.ts` adds
      addPasskey appends a wrap, second add rejects with
      `already-exists`, removePasskey filters, password and passkey
      both unlock the same MK, changePassword leaves the passkey wrap
      intact, disableEncryption removes the passkey wrap with
      everything else. 352 tests pass overall (up from 321)

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test (352 passing)
- [x] build

## Backlog

Amendments captured in `amendments/backlog/` waiting on a sibling
designer-core change, an upstream dependency, or just a scheduling
slot. Listed shortest-summary-first so each is scannable.

- **`amendment-canvas-orientation.md`** — vertical/horizontal toggle
  for the canvas. Spun out of canvas-sizing §4 because it requires a
  designer-core change (`orientation` on `CanvasConfig`). Lands once
  `designer-core-amendment-canvas-orientation.md` ships.
- **`amendment-text-overflow.md`** — sizing modes / overflow / auto-
  shrink / ellipsis on text objects. Depends on designer-core's
  `TextObject.sizingMode` + `overflow` + `minFontSize` +
  `measureTextHeight` helper landing first.
- **`amendment-tables-and-autogrow.md`** — open stub. Auto-grow story
  for continuous labels + tape printers + dataset-driven nutrition /
  ingredients tables. Deliberately deferred from canvas-sizing; not
  scheduled.
- **`amendment-barcode-content-helpers.md`** — 2D barcode content
  templates (URL, WiFi, vCard, geo, email, phone, calendar) + QR
  styling panel (logo, dot styles, colours). Depends on the shipped
  barcode-validation amendment (✅) and a designer-core qr-styling
  bump. Mobile QoL piggybacks (Contact Picker, Geolocation).

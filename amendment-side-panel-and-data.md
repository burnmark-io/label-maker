# Amendment — Side panel & data UX

> **Amends:** `PLAN.md` §6 (Side panels), §7 (CSV/Excel import), §10 (Storage), §22
> phases 2 / 5 / 6.
> **Companion to:** `PROGRESS.md`, `DECISIONS.md`. Existing decisions D18–D21
> stay in force; this amendment supersedes the *layout* parts of §6 only.
>
> One sentence: merge **Objects** + **Properties** into a single accordion
> panel, and grow the **Data** tab into a real workspace — manual entry,
> a global pool of up to 10 datasets (≤ 30 rows each, persisted in
> IndexedDB and shared across all designs), and a downloadable template
> CSV from detected placeholders.

---

## 1. Vision

The side panel today has four tabs (Objects, Properties, Data, Preview) and
each one only does one thing. Switching between Objects and Properties is
busywork: you click an object, then click a tab to edit it. The Data tab is
import-only — you can drop a CSV but you can't add a row by hand, and
anything you import disappears the moment you close the tab.

**Two fixes.**

**A. Objects and Properties become one panel.** A single scrollable list of
objects. Click a row to expand it inline; the form that used to live behind
the Properties tab opens right there, between the row above and the row
below. Selecting an object on the canvas auto-expands its row in the panel
and vice-versa. One open at a time — pick the thing, edit the thing.

**B. Data becomes a workspace, not a dropzone.** Datasets are **global
to the browser, not tied to a label**. Upload your guest list once, use
it on the place cards, the badges, and the thank-you tags. Clear a
label, swap to another, the dataset is still right there. The pool is
bounded at 10 sets, each capped at 30 rows. A "set" is one CSV import,
one Excel sheet, or a hand-built table; manual entry is a first-class
set type. New imports default to *appending to the active set*; the
user can choose to start a fresh set instead, and that choice is
rememberable. The column-to-placeholder mapping is computed against
the design's placeholders (existing `column-mapper` behaviour, D21,
keyed per placeholder set) — so the same dataset maps cleanly into
different designs without duplicate state. From the placeholders
detected in the current design, the user can download a starter CSV
(correct headers, one example row) so getting their data into the
right shape is one click.

The label is still the hero. The side panel exists to support the label
without ever stealing focus from it.

---

## 2. Gap Analysis

### 2.1 What changes vs. PLAN.md

| Topic | PLAN.md | Amendment |
|---|---|---|
| Side-panel tabs | Objects / Properties / Data | **Objects** (merged) / Data / Preview |
| Properties UI | Separate tab, shows form for `selection[0]` | Inline accordion under each row, single-expand |
| Object list affordances | Drag handle, type icon, name, visibility, lock | Same + chevron + inline form on expand |
| Multi-select editing | Implicit (plan never says) | **Canvas-only.** Inline form follows the *most-recently-clicked* selection only |
| Data tab | Placeholders chip list, dropzone, mapper, preview row, batch button | Same + dataset switcher + manual rows + compact row table + popup grid + template CSV download |
| Data persistence | Not specified | **Global IndexedDB pool**, auto-save on change, survives across all designs and reloads |
| Dataset model | Not in plan | **NEW.** Up to 10 sets globally, each ≤ 30 rows. New imports append to active set by default; user can start a new set (with "remember this choice"). Active set is global, persisted in preferences |
| Cross-design re-use | Not in plan | **Built-in.** All datasets are visible from every design's switcher. No clone step — same dataset *is* the one being used everywhere |
| Mapping | Not in plan | Reuses existing `column-mapper` (D21), keyed by placeholder set. Same dataset maps differently into designs with different placeholders, automatically |
| Manual data entry | Not in plan | First-class: "Add row" inline; full edit in popup grid; lives as a dataset alongside CSV-imported sets |
| Template CSV export | Not in plan | New: "Download template" button generates CSV with detected placeholder headers |
| `.label` / `.zip` / share URL | Document only | **Unchanged.** Data is *not* in the document; data exports are separate |

### 2.2 What's deeper specification (not contradictions)

- **Tab persistence migration.** `preferences.sidePanelTab` currently stores
  `'objects' | 'properties' | 'data' | 'preview'`. After the merge the union
  is `'objects' | 'data' | 'preview'`. Old `'properties'` values map to
  `'objects'`.
- **Canvas ↔ panel sync.** Selecting on the canvas expands the matching row
  and scrolls it into view; collapsing a row deselects on canvas. Selecting
  *nothing* (Esc, click empty area) collapses everything.
- **Reorder UI.** Up/down arrow buttons stay (already built). Drag-to-reorder
  is out of scope for this amendment — it's a nice-to-have, not blocking.
- **Mapping persistence (D21) stays load-bearing.** Per-placeholder-set
  mapping in localStorage is the *only* mapping store. Datasets carry
  raw `headers` + `rows` only — no per-dataset mapping field. When a
  dataset is applied to a design, the column-mapper service derives the
  mapping from the design's placeholders (auto-map → user override →
  cached for next time, all keyed by placeholder set). This is what
  makes "same dataset, multiple designs" trivial.

### 2.3 What's already built (per PROGRESS.md)

| Already there | Notes |
|---|---|
| `ObjectsPanel.vue` | Flat list with selection, visibility, lock, reorder. Reuse the row UI. |
| `PropertiesPanel.vue` + per-type forms | The forms (`Text/Image/Barcode/ShapeProperties.vue`, `CommonProperties.vue`) lift unchanged into the expand region. |
| `SidePanel.vue` (4-tab shell) | Tabs reduce to 3; arrow-key cycle and ARIA wiring carry over. |
| `DataPanel.vue` | Rebuilt around the new layout; existing dropzone, placeholder chips, mapper, preview controls are reused. |
| `useDataStore` (pinia) | Stays as the in-memory source of truth. A new persistence layer wraps it. |
| `services/storage.ts` (IndexedDB) | Add a `datasets` object store at DB version 2. Single global store, not keyed by document. |
| `useCsvImport` composable | Unchanged. Manual entry doesn't go through it. |
| `services/column-mapper.ts` | Unchanged. Used by both inline and popup. |

### 2.4 What's removed

- The standalone "Properties" tab (and its label key, ARIA wiring, default).
- The `PropertiesPanel.vue` shell component (its content lives inline now).
  The per-type property components (`TextProperties.vue` etc.) survive
  unchanged.
- The redundant `<h2 class="panel__title">` heading at the top of each
  tab's content. The tab strip is already the panel's heading (and
  `role="tabpanel"` is wired to it via `aria-labelledby`), so repeating
  the tab name inside the body is visual noise. Drop it from
  `ObjectsPanel.vue`, `DataPanel.vue`, `PrintPreview.vue`, and any new
  tab content. The `panel__title` CSS class can stay for nested
  sub-headings within a tab (e.g. "Placeholders", "Import").

---

## 3. Decisions

Numbered to slot into `DECISIONS.md` after D30.

### D31 — Side panel: 3 tabs, Objects+Properties merged into an accordion

The merged panel keeps the Objects-style row affordances (icon, name,
visibility, lock, reorder) and adds a chevron / inline expand region. Click
a row → row becomes selected, previously-expanded row collapses, the
clicked row expands and renders the per-type property form below the row
header. Canvas selection drives the same behaviour from the other side.

**Why single-expand:** multi-expand makes the list scroll like a wall of
forms; single-expand keeps the list scannable. Multi-select on canvas is
preserved for moves/deletes/group ops; the inline editor just follows the
most-recently-clicked id. (Matches existing behaviour where
`PropertiesPanel` only ever rendered `selection[0]`.)

**Tab name:** `objects` stays. The plan, codebase, and i18n keys all use
"Objects" — no rename.

### D32 — Datasets are a global pool, decoupled from documents

Datasets are **shared across the whole app**, not bound to any
particular `LabelDocument`. Upload a guest list once and use it on
every label that has a `{{name}}` placeholder. Clear or delete a label,
the data is still there. Open a fresh document, the active dataset is
already loaded and driving the preview.

**Why global:**
- Real-world reuse: one CSV, multiple labels (badges + place cards +
  thank-you tags from the same guest list).
- The mental model "data belongs to the design" is what premium
  multi-tenant apps need; for a free, browser-local tool it's friction.
  Anything per-design can come later as a premium feature without
  breaking this model.
- Mapping (D21) is already keyed by placeholder set, not by document
  id. The infrastructure for "same data, different mappings" is in
  place.

**Why separate from the `LabelDocument`:**
- A `.label` file is a template. Bundling data would conflate template
  and data, and bloat share URLs.
- The 8KB share-URL cap (D22) stays clean.
- Privacy: data never leaves the browser unless the user explicitly
  exports it.

**Schema:**
```typescript
interface StoredDataset {
  id: string;                              // uuid
  name: string;                            // user-editable; defaults to filename or "Manual entry"
  source: 'csv' | 'tsv' | 'xlsx' | 'manual';
  fileName: string | null;                 // null for manual sets
  headers: string[];                       // column order
  rows: Record<string, string>[];          // ≤ 30
  createdAt: string;                       // ISO
  updatedAt: string;                       // ISO
}
```

No `mapping` field. Mapping is **derived** at apply-time from the
current design's placeholders via `services/column-mapper.ts` (D21).
Same dataset → different design → different mapping, automatically.

No `documentId` field. No `activeDatasetId` per document.

**Global state (pinia + persisted):**
- `datasets: StoredDataset[]` — the pool. Stored as one row per dataset
  in the new `datasets` IDB object store (keyed by `id`).
- `activeDatasetId: string | null` — which dataset drives preview /
  canvas substitution / batch print right now. Persisted to
  `localStorage` via `useStorage` (small, no IDB needed). Survives
  reloads.

`currentIndex` and `previewEnabled` stay in pinia only (UI state).

**Bounds:**
- ≤ 10 datasets globally. The 11th import drops the
  least-recently-updated set (with a confirm if it's `source: 'manual'`
  to avoid losing hand-typed work).
- ≤ 30 rows per dataset (D20 unchanged). Excess truncated with the
  existing limit banner.

**Active set semantics:** exactly one dataset is active at a time.
Switching is one click in the dataset switcher. The currently-open
design re-renders preview against the new set. If the active dataset
is deleted, fall back to the most-recent remaining set, else null.

**Import behaviour (default + override):** when the user drops a CSV:
1. **No active set OR active set has 0 rows:** create a new set, make
   it active.
2. **Active set has rows:** open an import dialog with three options:
   - **Append to "<active set name>"** (default; merge headers, append
     rows up to the 30-row cap)
   - **Start a new dataset** (creates and activates a fresh set;
     existing set kept in the pool)
   - **Cancel**
   Dialog has a "Remember this choice" checkbox that writes to
   `prefs.csvImportBehavior: 'ask' | 'append' | 'new'`. When the pref
   is `'append'` or `'new'`, the dialog is skipped on subsequent
   imports (until manually changed via the dataset switcher menu).

**Append semantics:** new headers from the import are added to the end
of the active set's `headers`; missing columns in incoming rows become
empty strings.

**Where saved:** new `datasets` IDB object store at `DB_VERSION = 2`.
Auto-saved (debounced ~300ms) on any change. Auto-loaded once on app
boot. No per-document load/save lifecycle — the data is just *there*.

**Document delete does NOT touch datasets.** Deleting a design from the
library leaves all datasets intact. This is the explicit user
expectation.

**Reset / clear:** "Clear active dataset" deletes the active set with a
confirm. "Reset all data" (in the dataset switcher menu) deletes
everything with a confirm.

### D33 — Data editor: compact inline + popup grid, both with a dataset switcher

**Inline (in the Data tab):**
- Placeholder chips (existing).
- **Dataset switcher** at the top: a dropdown showing the active dataset
  by name, with a row count badge. Clicking opens a menu listing **all
  datasets** (most-recent first — the pool is global, so this is the
  whole list), each with a rename / delete / duplicate context menu.
  Footer of the menu: "+ New manual dataset", "📂 Import a file…"
  (just the dropzone trigger), and "Reset all data".
- Dropzone (existing) — fires the import flow described in D32 (dialog
  with append / new / cancel + remember).
- **NEW** "Download template" button next to the dropzone (D34).
- Compact row preview: `{header_1: value, header_2: value, …}` for the
  active dataset's current preview row. **Only the first 2–4 mapped
  placeholders shown**; the rest overflow-hidden behind a "…" with
  title-attribute tooltip.
- Prev/next stepper (existing) and "Edit data ✏️" button → opens popup.
- Column mapper section (existing) when `placeholders.length > 0` and
  `activeDataset.headers.length > 0`. Mapping changes write through
  D21's placeholder-keyed store, so they persist for this design and
  any other design with the same placeholder set.
- "Add row" button below the stepper for quick one-off entry without
  opening the popup. Inserts an empty row into the active dataset and
  steps preview to it.

**Popup (new `DataEditorDialog.vue`):**
- Modal, large (≥ 720px wide on desktop, full-screen on mobile).
- **Dataset switcher in the header** mirrors the inline one — pick which
  set you're editing without closing the dialog. The switcher shows the
  full global pool.
- Editable grid: rows × headers. Each cell is a text input.
- Per-row actions: delete, duplicate, drag to reorder.
- Footer: "Add row", row count, "Showing first 30 of N" banner if
  imported set was capped (D20), and a "Datasets: M / 10" indicator
  (global count).
- Header row shows column name + the placeholder it's mapped to in the
  *current design* ("address → `{{address}}`"), with a dropdown to
  remap inline. Unmapped columns show `(unused)`. Mapping is a
  property of the design's placeholder set, not the dataset (D21).
- "Add column" allowed but only useful in manual mode (no CSV imported).
  In manual mode the columns default to the current design's
  placeholders; the user can rename them but they remain raw column
  names — mapping into other designs happens automatically via D21.
- Closes via Escape, click backdrop, or "Done" button. No "Cancel" — every
  edit auto-saves (with the debounce). This matches the rest of the app
  (live edits, no save-and-discard cycle).

**Why both surfaces:**
- Sidebar is ~280px wide. A real grid does not fit. Compact inline is for
  glance + quick tweak; popup is for serious data work.
- Mirrors the canvas philosophy: most edits happen in the small surface
  next to the work, big edits get a focused workspace.

### D34 — Template CSV download from detected placeholders

Reduces friction at the highest-friction moment: "I have placeholders,
what columns does my CSV need?".

**Behaviour:** a "Download template" link/button next to the dropzone,
visible whenever `placeholders.length > 0`. Clicking generates a CSV in
memory and triggers a download:

```csv
name,address,city
John Doe,123 Main St,Amsterdam
```

- Headers: each detected placeholder, lowercase, in document-order.
- One example row, populated with plausible defaults (or `value 1`,
  `value 2` … if no plausible defaults exist for the placeholder name).
- Filename: `<document-name>-template.csv`.

**CSV only, not Excel.** SheetJS is already lazy-loaded for parsing
(D18) but bundling it for export grows the eager bundle by ~430KB.
CSV opens in Excel, Numbers, Sheets, Notepad — universal. If the user
needs Excel they can open the CSV in Excel and save-as.

**Where it lives:** the Data panel, next to the dropzone. Not in the
popup grid — the popup is for editing data that already exists.

### D35 — Data is not part of `.label` / `.zip` / share URL

Confirming D32's contract from the export side. Existing exports
(PNG, PDF, sheet PDF, .label, .zip, share URL) emit the *current
preview row's substituted output* (rendered bitmap) but the file
contents themselves carry only the template. Batch print and sheet
export already iterate `data.rows` at print/render time — no change.

If a user wants to ship "filled labels" they use **batch sheet export**
(generates a multi-page PDF with one label per row) — which already
exists in Phase 6.

---

## 4. Open questions resolved

(All confirmed in the pre-write conversation. Listed for the record.)

- **Multi-select in merged panel:** option (b), single-expand follows
  most-recently-clicked. Bulk-edit form deferred.
- **Data persistence target:** IndexedDB, **global pool** decoupled
  from documents (D32). Not the `.label` file.
- **Document → dataset binding:** none. Datasets live alongside designs,
  not inside them. Premium per-design data scoping deferred to a future
  amendment.
- **Data editor surface:** compact inline + popup grid (D33).
- **Template download format:** CSV only (D34).
- **CSV-on-existing-data behaviour:** dataset switcher (D32). New imports
  default to *append to active set*; user can choose *new set* in the
  import dialog with a "remember choice" preference.
- **Cross-design re-use:** built into the global model — no separate
  "recent imports" surface needed; the dataset switcher *is* the
  cross-design view.

---

## 5. Realisation

Five short phases. Each phase is independently shippable; each ends with
the four-gate check (`typecheck`, `lint`, `test`, `build`). Targeting
PROGRESS.md style — add a section at the bottom under "Phase 10:
Side-panel and data UX" with these as steps.

### Phase A — Tab structure & migration

A1. **Reduce tabs to three.** Update `SidePanel.vue` tabs computed list:
    drop `properties`. Update `SidePanelTab` type in `preferences.ts` to
    `'objects' | 'data' | 'preview'`. Add a one-shot migration: at store
    init, if persisted value is `'properties'`, write `'objects'`.

A2. **i18n.** Remove unused `panel.properties` *tab label* references
    (the string can stay for ARIA on the merged panel header). Update
    `nl.json` to match. Run `pnpm test` — locale-parity test must still
    pass.

A3. **Update onboarding tour** (`src/composables/useOnboardingTour.ts` or
    wherever tour steps live): step 3 anchor was the Properties tab —
    re-anchor to the merged Objects tab. Update tour copy: "Click any
    object in the list to edit its properties."

A4. **Update keyboard help / shortcuts modal** if it referenced the
    Properties tab.

A5. **Drop redundant tab-name headers in panel bodies.** Remove the
    `<h2 class="panel__title">{{ t('panel.X') }}</h2>` line from the
    top of `ObjectsPanel.vue`, `DataPanel.vue`, and `PrintPreview.vue`.
    The tab strip already labels the panel; the body header was
    duplicate chrome. Sub-section headings inside a tab body (e.g.
    `data.placeholders.title`, `data.import.title`) stay as-is.

**Gate A:** typecheck, lint, test, build. App still runs; merged tab is
empty for now (just the existing Objects content + a TODO for the form
slot).

### Phase B — Inline accordion

B1. **Rename `ObjectsPanel.vue` → `ObjectsTab.vue`** (or keep name; the
    component grows). Add expand state: a single ref holding the expanded
    object id, or `null` when none.

B2. **Drive expand from selection.** Watch `designer.selection`:
    - Length 1 → expand that id, scroll into view.
    - Length 0 → collapse all.
    - Length ≥ 2 → expand the *most recently added* selection id (track
      in the designer store as `selection[selection.length - 1]`, which
      is already how multi-select toggle order works in this codebase).

B3. **Render forms inline.** Inside the row template, when expanded:
    ```vue
    <CommonProperties :object="obj" />
    <TextProperties v-if="obj.type === 'text'" :object="obj" />
    <ImageProperties v-else-if="obj.type === 'image'" :object="obj" />
    <BarcodeProperties v-else-if="obj.type === 'barcode'" :object="obj" />
    <ShapeProperties v-else-if="obj.type === 'shape'" :object="obj" />
    ```
    The form components don't change. They already accept `object` as a
    prop and call `designer.updateObject` directly.

B4. **Chevron affordance.** Add a chevron icon at the row's right edge
    (after the existing visibility / lock / reorder buttons). Rotate
    on expand. Click the row body (excluding action buttons) to toggle.

B5. **Empty state copy update.** "No objects yet — pick a tool to add
    one" stays. Add a hint below: "Click any object to edit its details."

B6. **a11y.** Each row uses `aria-expanded`. The expanded form region
    uses `role="region"` with `aria-labelledby` referring to the row
    header. Tab order: row header → expand toggle → form fields →
    next row header. Verify focus-trap composable does not interfere.

B7. **Delete `PropertiesPanel.vue`** and its import from `SidePanel.vue`.
    Run `pnpm typecheck` to find stragglers.

**Gate B:** typecheck, lint, test, build. Manual smoke: click an object
on canvas → row expands and form is editable. Click another → previous
collapses, new one expands. Click empty canvas → all collapse.

### Phase C — Global dataset pool & persistence

C1. **Bump IDB version.** In `services/storage.ts`, set `DB_VERSION = 2`,
    add a `datasets` object store in the `upgrade` callback (keyPath
    `id`). Define type `StoredDataset` (D32 schema). Idempotent upgrade
    — does not touch existing `designs`, `assets`, `meta` stores.

C2. **Storage helpers.**
    - `listDatasets(): Promise<StoredDataset[]>` (sorted by `updatedAt`
      desc)
    - `putDataset(dataset: StoredDataset): Promise<void>`
    - `deleteDataset(id: string): Promise<void>`
    - `clearDatasets(): Promise<void>` (used by "Reset all data")

C3. **Refactor `useDataStore` around the global pool.** The store grows:
    - `datasets: Ref<StoredDataset[]>` — the global pool (≤ 10).
    - `activeDatasetId: Ref<string | null>` — persisted via
      `useStorage` (`burnmark.activeDatasetId`).
    - Computed `activeDataset` (currently active set or null).
    - `headers`, `rows`, `lastImport` become **computed proxies** of
      `activeDataset` (read) plus mutators that write back to the
      right dataset in the array. Existing call-sites (canvas preview,
      batch print, sheet export, `currentVariables`) keep their API
      surface; the change is purely internal.
    - The previous `mapping` ref is removed — mapping is read straight
      from `column-mapper.ts`'s placeholder-set-keyed cache (D21) at
      apply time, given `designer.getPlaceholders()`. `setColumnFor`
      delegates to D21's mutator.
    - New mutators: `createDataset(seed: Partial<StoredDataset>)`,
      `setActiveDataset(id)`, `renameDataset(id, name)`,
      `removeDataset(id)`, `appendRowsToActive(headers, rows)`,
      `clearActive()`, `resetAll()`.

C4. **Auto-save on change.** Watch `datasets`, debounce 300ms, persist
    each modified dataset via `putDataset`. Watch deletions and call
    `deleteDataset(id)`. `activeDatasetId` is handled by `useStorage`
    (writes-through automatically).

C5. **Boot-time hydrate.** Once on app boot (in the data store
    factory), call `listDatasets()` and populate `datasets`. If
    `activeDatasetId` references a missing id, fall back to the
    most-recent set, else null.

C6. **No document lifecycle wiring.** Datasets are global — there is
    nothing to load or save when the user switches between designs in
    the library, imports a share URL, or clears the canvas. The data
    store does not watch `designer.document.id`. The library
    deletion path also no longer cascades into data.

C7. **CSV import behaviour.** `useCsvImport.importFiles` no longer
    calls `data.setData` directly. It returns parsed
    `{ headers, rows, summary }` and the caller (the dropzone handler
    in `DataPanel.vue`) decides:
    - If no active set or active set is empty → `createDataset(...)` +
      `setActiveDataset(...)`.
    - Else, consult `prefs.csvImportBehavior`:
      - `'append'` → `appendRowsToActive(...)`
      - `'new'` → `createDataset(...)` + activate
      - `'ask'` → emit an event to open the import dialog (Phase D).

C8. **Preferences.** Add `prefs.csvImportBehavior: 'ask' | 'append' | 'new'`
    via `useStorage`. Default `'ask'`. Add
    `prefs.activeDatasetId: string | null` (mentioned above; the same
    `useStorage` instance the data store reads/writes).

C9. **Tests.**
    - Boot hydrate: pre-seed `datasets` store, init data store →
      reactive list matches.
    - Round-trip: create 3 datasets → reload → 3 datasets, same
      active id, same rows.
    - Bound enforcement: pushing an 11th dataset evicts the
      least-recently-updated non-active set.
    - Append semantics: new headers merged, missing columns become "".
    - Use `__resetForTests()` between cases.

**Gate C:** typecheck, lint, test, build. Manual smoke: import CSV in
Document A → save / open Document B → switcher shows the same dataset,
preview substitutes against B's placeholders. Import a second CSV with
`prefs.csvImportBehavior = 'new'` → two datasets visible globally.
Delete Document A → datasets unchanged.

### Phase D — Manual rows, popup grid, dataset switcher, import dialog

D1. **`DatasetSwitcher.vue`** — small component used in two places
    (sidebar Data tab, popup grid header). Renders the active dataset
    name + row count + chevron. Clicking opens a menu listing **all
    datasets in the global pool** with rename / delete / duplicate /
    set-active per row. Footer: "+ New manual dataset", "📂 Import a
    file…" (dropzone trigger), "Reset all data" (with confirm).

D2. **`ImportChoiceDialog.vue`** — fires from `useCsvImport` when
    `prefs.csvImportBehavior === 'ask'` AND the active set has rows.
    Three actions: append / new / cancel. Footer checkbox: "Remember
    this choice" — writes to `prefs.csvImportBehavior` on confirm.
    Reuses the existing `Modal.vue` shell.

D3. **`DataEditorDialog.vue`** — modal with an editable grid for the
    *active* dataset. Reuse `Modal.vue`. Header includes the
    `DatasetSwitcher` so the user can hop between sets without closing.

D4. **Grid markup.** A `<table>` inside the dialog. Header row = column
    headers, each with the placeholder it maps to and a remap dropdown
    (`(unused)` for unmapped columns). Body rows = text-input cells.
    Per-row "actions" column with delete + duplicate. Reorder via a
    drag handle on the leftmost cell — HTML5 native drag if simple,
    fallback to up/down buttons (Risks §6).

D5. **"Add row" / "Add column".** Buttons in the popup footer.
    - "Add row" appends an empty row to the active dataset.
    - "Add column" adds a new header (default `column_N`); only enabled
      when the active dataset is `source: 'manual'` to avoid drift with
      imported headers.

D6. **Caps & banners.** "30 of 30 rows" banner when at cap. "Datasets:
    M / 10" indicator. The existing `LimitBanner` component is reusable
    for both.

D7. **Compact inline preview.** In `DataPanel.vue`:
    - Replace the current heading row + raw count line with the
      `DatasetSwitcher` at the top of the data section.
    - Compact row card: each mapped placeholder of the active dataset
      shows `placeholder: value`. First 2 always visible, up to 4 if
      they fit, rest collapse to `… (+N more)` with a tooltip.
    - "Edit data ✏️" button below the card → opens `DataEditorDialog`.
    - Inline "Add row" button next to the prev/next stepper for quick
      one-off entry without opening the popup.

D8. **Manual-mode bootstrap.** When `placeholders.length > 0` and the
    pool has no datasets (or the active set is empty), show a CTA
    next to the dropzone: "Or add rows by hand →". Clicking calls
    `createDataset({ source: 'manual', headers: placeholders, rows: [{}] })`,
    activates it, and opens `DataEditorDialog`. The created dataset
    joins the global pool.

D9. **Mapping inline + popup.** `ColumnMapper.vue` continues to render
    in the Data tab. The popup grid repeats the mapping UI in its
    table header (`column ↔ placeholder` dropdowns) so users don't have
    to bounce. Both write through `data.setColumnFor` on the active
    dataset — single source of truth.

D10. **Tests.** Component tests for the popup: add row, edit cell,
    delete row, reorder, mapping change, switch dataset. Component
    tests for the import dialog: each action + remember-choice
    pref write. Component tests for the dataset switcher: rename,
    delete (with confirm if not empty), duplicate.

**Gate D:** typecheck, lint, test, build. Manual smoke: design with
placeholders, no CSV → "Add rows by hand" → enter 3 rows → close popup
→ data persists across reload. Drop a CSV with active set non-empty →
import dialog appears → "New dataset" + "Remember" → second CSV import
skips the dialog and starts a fresh set.

### Phase E — Template CSV download

E1. **`services/csv-template.ts`.** Pure function:
    `buildCsvTemplate(placeholders: string[], documentName: string): { filename: string; csv: string }`.
    Headers = lowercase placeholders. One example row with placeholder
    names as values prefixed with their key (e.g. `name → "Sample name"`).
    No external deps — manual CSV escaping (quote any value containing
    `,`, `"`, or newline; escape `"` as `""`).

E2. **UI.** "Download template" button next to the dropzone in
    `DataPanel.vue`. Disabled when `placeholders.length === 0` with a
    tooltip: "Add a `{{placeholder}}` to your design first."

E3. **Wire download.** Click → `buildCsvTemplate` → `Blob` →
    `URL.createObjectURL` → temporary `<a download>` click. Revoke the
    URL after download. (Same pattern as existing `.label` export — see
    `useShareUrl.ts` or wherever the download helper lives; reuse if a
    helper exists.)

E4. **i18n.** New keys:
    - `data.template.download` ("Download template")
    - `data.template.disabledTooltip` ("Add a {{placeholder}} to your design first.")
    - Both locales updated; `nl.json` flagged for review in
      `PLACEHOLDERS.md`.

E5. **Tests.** Unit test for `buildCsvTemplate`: correct headers,
    escaping edge cases (placeholder names with commas — unlikely but
    the function should handle it).

**Gate E:** typecheck, lint, test, build. Manual smoke: drop a
`{{name}}` text on a blank label → "Download template" → opens
`untitled-template.csv` containing `name\nSample name`.

---

## 6. Risks & open items

- **Drag-to-reorder rows in the popup grid.** HTML5 drag-and-drop on
  table rows is fiddly cross-browser. If it costs more than half a day,
  ship up/down arrow buttons and revisit. Not blocking.

- **Append-merge edge cases.** When appending a CSV to an active set
  with different headers: extra incoming columns are added; missing
  columns become empty strings. If the user appends a *very* different
  CSV by accident, the result is a wide, sparse table. Mitigation:
  the import dialog (D2) is the recovery point — they can choose
  "New dataset" instead. The active set is also one click away from
  rename/delete in the switcher.

- **Eviction confirms.** Pushing an 11th dataset evicts the
  least-recently-updated non-active one. If that set is
  `source: 'manual'` (hand-typed work), confirm before evicting.
  CSV imports re-droppable from the original file are evicted
  silently — they're cheap to recreate.

- **Stale `activeDatasetId`.** If the persisted active id no longer
  resolves (manually edited storage, data corruption), fall back to
  the most-recent dataset on boot, else null. Logged + recoverable,
  not a hard error.

- **Mapping leakage across designs (intended, but worth flagging).**
  Because mapping is keyed by placeholder set (D21) and datasets are
  global, two designs that happen to have the *same* placeholder set
  share a mapping. That's by design — same data, same shape, same
  mapping. If a user wants different mappings for designs with
  identical placeholders, they can remap in either design and the
  cache updates. Not a bug; documented in the column-mapper hint
  string.

- **DB migration safety.** Going from v1 → v2 needs to not blow away
  the existing `designs`, `assets`, `meta` stores. Idiomatic `idb`
  upgrade callbacks handle this; double-check by booting against a v1
  IDB in a manual smoke test before merging Phase C.

- **Tab arrow-key cycle.** The existing left/right arrow cycle wraps
  through `tabs.value`. Going from 4 → 3 entries should "just work" but
  re-verify with keyboard-only nav.

- **Future: per-design data binding.** When a premium feature later
  needs "this dataset belongs to this design only", the migration
  path is: add a `documentId?: string | null` field to `StoredDataset`
  (null = global, set = bound). The current global pool becomes the
  free-tier behaviour. No schema break; just a new optional field.

---

## 7. Out of scope for this amendment

- Drag-to-reorder objects in the merged panel (separate amendment if
  wanted).
- Bulk-edit form for canvas multi-select (mentioned as future option in
  D31 — defer).
- **Per-design data binding.** Datasets are global in this amendment;
  scoping a dataset to a single design is reserved for a future
  premium feature (migration path noted in §6).
- Per-row formatting in the popup grid (e.g. mark a row as "skip on
  print"). The 30-row cap and current-index preview cover the use cases
  we know about.
- Rich-cell editing (newlines, formulas). Cells are plain strings.
- Cross-device sync of datasets. IndexedDB is local-only — the dataset
  pool reflects this browser.
- Versioning *within* a dataset (cell-level undo across sessions). The
  10-set pool covers between-import iteration; cell-level history is
  overkill at 30-row scale.
- Excel-format template download. CSV only (D34).

---

**Total surface area:** ~8 new/changed components (`SidePanel`,
`ObjectsTab`, `DataPanel`, `DatasetSwitcher`, `ImportChoiceDialog`,
`DataEditorDialog`, `ColumnMapper` tweaks, removed `PropertiesPanel`);
1 new service (`csv-template`); 1 IDB schema bump (v1 → v2, single
new `datasets` store); 2 new preferences (`csvImportBehavior`,
`activeDatasetId`); ~16 new i18n keys; no new runtime dependencies.
Estimate: phases A and B in one sitting; C is the heaviest refactor
(data store grows from flat → pool-of-datasets); D is the bulkiest
UI; E is an afternoon. Roughly four working days end-to-end.

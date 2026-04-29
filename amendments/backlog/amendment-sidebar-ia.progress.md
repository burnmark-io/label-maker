# Sidebar IA — Implementation Progress

Companion to `amendment-sidebar-ia.md`. Tracks step status, decisions made
during implementation, and any blockers discovered.

---

## Pre-flight findings (codebase reality vs. amendment text)

- **Tabs today are 3, not 4.** `SidePanelTab = 'objects' | 'data' | 'preview'`.
  This amendment adds `'properties'`. The Output rename lives in
  `amendment-output-tab.md` — keep `'preview'` here.
- **There used to be a `'properties'` tab.** `preferences.ts` has a
  one-shot migration that maps stored `'properties'` → `'objects'`. Need
  to remove that migration since `'properties'` is valid again.
- **No MobileDrawer component.** Mobile collapse is CSS-driven on
  `SidePanel.vue` via `prefs.sidePanelOpen` + a `@media (max-width: 900px)`
  block. No separate component to extract; mobile drawer work happens
  inside `SidePanel.vue`.
- **"Accordion" today is per-row inline expansion** in `ObjectsPanel.vue`,
  not a generic accordion component. Each row's chevron expands a form
  region containing `CommonProperties` + the type-specific component.
  This amendment removes that inline form and moves it to the new
  PropertiesPanel.
- **TopBar has no name input.** Doc says "name lives in TopBar" but it's
  actually only set programmatically (init + library save). DocumentProperties
  will be the **first** in-app editable surface for `document.name`.
  TopBar is unchanged.
- **No tool-mode state.** Tap-on-canvas always means "deselect" (no
  shape-creation tool that would conflict). The §7.3 "tap canvas to
  collapse" gesture has no tool-mode carve-out concern.
- **designer-core schema confirmed.** `LabelDocument` already has
  `description?: string`, `createdAt`, `updatedAt`, `canvas.background`.
  No designer-core changes needed.
- **`useShiftKey` is a singleton ref pattern.** Will mirror it for
  Cmd/Meta in a `useBuildingModifier` composable.
- **Test runner: Vitest + Pinia + happy-dom.** Existing tests in
  `src/**/__tests__/`. Designer-core's render functions need mocking
  (canvas backend not present).

---

## Decisions (smaller-things judgements)

- **§4.5 Esc-cancels-auto-switch within 500ms — SKIP.** Doc itself calls
  it "unlikely to be needed." Adds hidden timer state for marginal value.
- **§6.3 "Change in Media selector" link — render as static hint, not a
  deep-link.** LabelSizeSelector is a topbar popover with local `open`
  state; deep-linking requires lifting that state to a shared store.
  Outside the IA scope. Render as `"Change via the size picker in the
  toolbar"` text below the canvas-size readout. Proper deep-link is a
  follow-up polish.
- **`selectedObjectIds` helper.** Per my own concern (sentinel-id safety):
  add a `selectedObjectIds` computed in the designer store that filters
  out `'$document'` so consumers iterating regular-object selection
  can't accidentally call `find(o => o.id === '$document')`.
- **Existing per-type properties don't assume accordion context.**
  Verified: `CommonProperties`, `TextProperties`, `ImageProperties`,
  `BarcodeProperties`, `ShapeProperties` all take `:object="obj"` and
  emit changes via `designer.updateObject`. Safe to render in the new
  PropertiesPanel as-is.
- **Selection-count badge on Properties tab — use a CSS pill, not the
  `③` glyph.** ASCII art used `③` for clarity in the doc but the actual
  UI should be a real circular badge (filled accent colour, white text).
  Simpler styling on both desktop and mobile.
- **TopBar name input** — does not exist. The amendment's "TopBar input
  stays" line is moot; nothing to keep in sync. DocumentProperties is
  the only in-app editor.

---

## Steps

Each step is a self-contained commit. Gate per step: typecheck + tests
+ lint pass before commit.

- [x] **Step 1 — Designer store: selection model + helpers** ✓
  - `DOCUMENT_SELECTION_ID` + `isDocumentSelected` exported
  - `selectedObjectIds` computed exposed on store
  - `setDocumentInfo({ name?, description? })` action — mutates raw +
    bumps `updatedAt` + triggers ref. **Decision:** background colour
    keeps using existing `setCanvas({ background })`; no new helper
    needed. Name/description edits do NOT participate in undo (mirrors
    `setDocumentMetadata`); documented inline.
  - `select()` wrapped on the store side: drops sentinel when combined
    with regular ids (last user action wins).
  - Tests added (10/10 pass).

- [x] **Step 2 — Preferences: re-introduce 'properties' tab** ✓
  - `SidePanelTab` union: `'objects' | 'properties' | 'data' | 'preview'`
  - Removed the `'properties' → 'objects'` migration
  - Existing migration test rewritten to assert acceptance instead.

- [x] **Step 3 — useBuildingModifier composable** ✓
  - Singleton-pattern composable returning a `ComputedRef<boolean>`
  - True while Shift OR Cmd (macOS) OR Ctrl is held
  - Composes existing `useShiftKey` for the Shift bit; adds its own
    Meta/Control listeners.

- [x] **Step 4 — useTabAutoSwitch composable** ✓
  - Watches selection length + buildingHeld; applies the §4 rules
  - Modifier-held suppresses; release re-evaluates against current tab
  - 8/8 tests pass (incl. Cmd/Meta as building modifier, Data-tab
    no-hijack, document-selection treated as non-empty).

- [x] **Step 5 — SidePanel: 4 tabs + Properties badge** ✓
  - Tabs: Objects | Properties | Data | Preview
  - Circular CSS pill badge on Properties tab when ≥1 regular objects
    selected; document selection contributes 0 (it's a state, not a count)
  - `useTabAutoSwitch` wired via composable call in `setup()`
  - i18n keys added in en.json + nl.json (`panel.selectionBadge`,
    `selection.*`, `document.*`, `properties.empty`)
  - Stub PropertiesPanel.vue created (empty-state only); content fills
    in step 6

- [x] **Step 6 — PropertiesPanel component** ✓
  - Three branches (empty / document / object) gated by a single
    computed; sticky selection header with the Deselect button
  - **Multi-select rendering rule (interim):** type-specific components
    only render when `selectedObjects.length === 1`. Multi-select shows
    `CommonProperties` only. Per the amendment, a richer multi-select
    rendering ships with `amendment-multi-select-fixes.md`.
  - 7/7 tests pass

- [x] **Step 7 — DocumentProperties component** ✓
  - Editable name (text), description (textarea), background (colour input)
  - Read-only canvas size (mm-derived from dots/dpi, hint text points
    at the toolbar size picker), created/updated (locale-formatted),
  - object count
  - Wires to `setDocumentInfo` and `setCanvas({ background })`.
  - Combined into one commit with PropertiesPanel — they're inseparable
    for the document branch to render.

- [x] **Step 8 — ObjectsPanel: drop inline expansion + add document root** ✓
  - Removed chevron, expanded form region, expandedId watcher, all
    per-type property imports
  - Document row renders above the layer list with separator beneath,
    document icon, name (falling back to "Untitled label"), and the
    canvas-size subtitle
  - Click always replaces selection (no shift handling for the doc row)
  - Reflects selected state via `aria-pressed`
  - 7/7 tests pass

- [ ] **Step 9 — Mobile drawer: persistent tab bar + full-width**
  - Below 900px (the existing breakpoint), keep the tab bar visible in
    the collapsed state too (today it's `display: none`)
  - Below 768px AND coarse-pointer: drawer is `width: 100vw`, flush bottom corners
  - Tap inactive tab while collapsed → expand + switch
  - Tap active tab while expanded → collapse
  - 56px tab bar height on coarse-pointer
  - Selection-count badge visible on collapsed Properties tab

- [ ] **Step 10 — i18n keys + final wiring**
  - Add new keys to `en.json` + `nl.json`:
    `panel.properties` (already exists), `properties.empty`,
    `properties.documentLabel`, `selection.headerSingle`,
    `selection.headerMulti`, `selection.deselect`,
    `document.name`, `document.description`, `document.background`,
    `document.created`, `document.updated`, `document.objectCount`,
    `document.canvasSizeChange`
  - Final `npm run typecheck && npm run lint && npm run test`

---

## Blockers

(none yet)

---

## Notes / open questions

- `composable.designer` is a `LabelDesigner` instance from designer-core.
  Mutating `raw.name = newName` directly works (mirrors `setDocumentMetadata`)
  but bypasses any internal events the LabelDesigner might want to fire.
  If I find a `setName`/`setDescription` API on the LabelDesigner I'll use
  that; otherwise mutate-and-trigger like `setDocumentMetadata`.
- The amendment defers multi-select Properties rendering to
  `amendment-multi-select-fixes.md`. For now: multi-select shows only
  `CommonProperties` (no type-specific). Mixed values in BaseObject fields
  (e.g. different x positions) will display whatever the existing
  CommonProperties does today — likely the first object's value. Not
  perfect, but matches the amendment's "this is just IA, not content."

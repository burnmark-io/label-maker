# Properties Tab Content — Implementation Progress

Companion to `amendment-properties-content.md`. Tracks step status,
decisions made during implementation, and any blockers discovered.

---

## Pre-flight findings (codebase reality vs. amendment text)

- **IA amendment has landed.** Selection header, `$document` sentinel,
  `selectedObjectIds`, document root row are all in `PropertiesPanel.vue`
  / `ObjectsPanel.vue` / `designer.ts`. This amendment can build on top.
- **`addObject` is a single funnel.** All add paths (toolbar, ShapeLibrary,
  shapes/insert, sample-label, useKeyboardShortcuts duplicate) call
  `designer.addObject` in the store. Auto-naming hooks there in one
  place.
- **`EditableText.vue` exists in common/** with the exact pattern the
  amendment describes (display + pencil → input on click; Enter/blur
  commits, Esc cancels; tooltip + aria-label). Reusable directly for
  inline rename — no new component needed.
- **No opacity input today.** Opacity isn't currently editable in any
  properties surface. The new Appearance section introduces this.
- **Shape strokeWidth uses `<input type="range">` 1–40.** Amendment
  classifies it as "not ranged" → plain number input. Will switch to
  plain number input under step 4 (or step 9 — pick one).
- **Barcode `scale` is 1–12 range slider.** Treat as a ranged value
  → HybridNumberInput.
- **Existing tests:**
  - `panels/__tests__/PropertiesPanel.test.ts` checks `Name` is rendered
    on multi-select (CommonProperties shows it). Step 5 drops the name
    input → that assertion changes to "no name input on multi-select".
  - `panels/__tests__/ObjectsPanel.test.ts` checks document row.
  - `panels/__tests__/BarcodeProperties.test.ts` (will read in step 8).
- **i18n locales: en, nl.** Both files updated for any new keys.

---

## Decisions

- **Vue prop naming.** vue-tsc strict prop checking does not normalise
  `:aria-label` → `ariaLabel`; bind in camelCase (`:ariaLabel="..."`)
  in templates that pass to HybridNumberInput. Surfaced in step 4.



- **Auto-naming kicks in only when `input.name` is undefined.** If a
  caller (e.g. duplicate via Cmd+D) passes a name, that name wins —
  duplicates preserve source name; sample-label keeps custom names if
  any. Sites that don't pass a name (toolbar, shape library) start
  auto-naming. Avoids per-call-site changes.
- **Use `EditableText.vue` for inline rename, not a new component.**
  The amendment's `InlineRename.vue` is satisfied by what already
  exists; both ObjectsPanel rows and the selection header bind to the
  same component with their own `value` + `update` handler.
- **Pencil affordance on Object list rows is the touch default for
  rename** (per amendment §9.6, until the context-menu amendment
  resolves long-press).
- **Sub-section persistence keying.** localStorage keys of the form
  `properties.collapsible.<typeLabel>.<sectionKey>` (e.g.
  `properties.collapsible.text.style`). Per-type, not per-object.
- **Section reorder owns dropping the name input** (step 5), so
  CommonProperties stays a single composable component throughout.

---

## Step status

- [x] Step 1 — Auto-naming infrastructure (commit 4db1c1e)
- [x] Step 2 — HybridNumberInput component
- [x] Step 3 — CollapsibleSection component
- [x] Step 4 — Swap range sliders → HybridNumberInput
- [x] Step 5 — Section reorder + Appearance + drop name input
- [x] Step 6 — TextProperties WYSIWYG + Style sub-section
- [x] Step 7 — ImageProperties thumbnail + Thermal sub-section
- [ ] Step 8 — BarcodeProperties data prominent + Encoding sub-section
- [ ] Step 9 — ShapeProperties visual picker + conditional fields
- [ ] Step 10 — Inline rename in ObjectsPanel + selection header

---

## Blockers

_None._

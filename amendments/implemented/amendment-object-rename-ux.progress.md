# Object Rename UX — Implementation Progress

Companion to `amendment-object-rename-ux.md`. Tracks step status,
decisions made during implementation, and any blockers discovered.

---

## Pre-flight findings (codebase reality vs. amendment text)

- **`ObjectsPanel.vue:49–55`** wraps each row's name in
  `<EditableText>` exactly as the amendment describes — clicking the
  name area lands on the EditableText `<button>` (which calls
  `.stop` internally), so the row's `onClickRow` never fires for
  clicks on the label. Misclick trap confirmed.
- **`PropertiesPanel.vue:9–16`** uses `<EditableText>` for the header
  with the pencil hover-revealed via `.editable__pencil { opacity: 0 }`
  and `:hover { opacity: 1 }` (`EditableText.vue:127–138`). On touch
  the pencil never appears.
- **`EditableText.vue` is general-purpose** — used elsewhere
  (DataPanel column headers, dataset name, `autoEdit` flow). Stays
  as-is per amendment §5.
- **i18n locales: en, nl.** `selection.rename` already exists
  ("Rename" / "Hernoemen"); fits the [✎] button aria-label
  perfectly. Added `selection.confirmRename` for the [✓] button.
- **Existing tests:**
  - `ObjectsPanel.test.ts` has an "inline rename" describe block
    (lines 153–202) — replaced wholesale with tests proving the
    rename UI is absent and row clicks select the object.
  - `PropertiesPanel.test.ts:197–223` exercises the header rename
    via the EditableText component — replaced with the new
    [✎] flow (display state, click to enter rename, Enter/Escape
    semantics, hide Deselect, multi/document hides [✎]).

---

## Decisions

- **Reuse `selection.rename` for the [✎] aria-label / tooltip.** It
  already reads "Rename" in en and "Hernoemen" in nl — the amendment
  asked us to check for reuse; reuse it. Saves a redundant key.
- **Added `selection.confirmRename`** ("Save" / "Opslaan") for the
  [✓] button's aria-label. "Confirm" felt clinical; "Save" matches
  what the action does (writes the new name).
- **[✓] vs Enter-only.** Going with both: the [✎] swaps to a [✓]
  button while in rename state (per the amendment ASCII mockup,
  line 141). Enter still commits, Escape cancels, blur commits —
  the [✓] is a touch-friendly explicit affordance.
- **Blur/Escape race.** `commit()` guards on `renaming.value` — if
  Escape already set `renaming = false`, the subsequent blur's
  commit early-returns. No `cancelling` flag needed.
- **[✓] click without focus loss.** Used `@mousedown.prevent` on the
  confirm button so the input doesn't blur first; the button's
  `@click` runs `commit()` directly. Otherwise the blur would fire,
  commit, hide the button, and the click would be lost on touch.
- **Muted auto-name placeholder.** Per §4.1, when an object has no
  custom name, the header displays its type in muted style. Used
  `--color-text-muted` on a `--auto` modifier of the header context.
- **Selection-change resets rename state.** `watch(renameTarget)` —
  whenever the rename target identity changes (different object,
  multi-select, document), `renaming.value = false`. Same effect
  when the target becomes null.
- **No keyboard shortcut for rename (e.g. F2).** Out of scope per
  amendment §2; can be added later.

---

## Step status

- [x] Step 1 — Pre-flight + progress file
- [x] Step 2 — ObjectsPanel: remove inline rename
- [x] Step 3 — PropertiesPanel: explicit rename button + state
- [x] Step 4 — i18n keys (en + nl)
- [x] Step 5 — Tests updated (ObjectsPanel + PropertiesPanel)
- [x] Step 6 — Gate (typecheck, lint, tests) and commit

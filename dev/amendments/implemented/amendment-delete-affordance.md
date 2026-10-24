# label-maker — Amendment: Object Delete Affordance

> Today the only way to delete an object from the editor UI is the
> Delete / Backspace keyboard shortcut. Power users discover it
> quickly; everyone else hunts. The right-click context menu plan
> (`amendment-canvas-context-menu.md`) covers the gesture-based
> path, but adds nothing for users who don't think to right-click.
> A persistent visual affordance — a `[Delete]` button at the
> bottom of the Properties tab content — closes the gap with
> almost no surface area.
>
> **Scope is one button.** No new components, no schema changes,
> no behavioural changes around deletion itself. Just a visible
> affordance for the existing delete path.
>
> Sibling amendments:
> - `amendment-canvas-context-menu.md` — right-click → Delete in
>   the object-mode menu. Complementary, not competing.
> - `amendment-properties-content.md` — currently cooking. The
>   delete button lives at the bottom of the Properties tab
>   content alongside the use-ordered sections defined there.
>   This amendment is structured to land independently of
>   properties-content shipping (just appends a button at the
>   end of whatever section structure the panel renders), but
>   ships better after.
> - `amendment-sidebar-ia.md` (implemented) — established the
>   Properties tab as its own surface; this amendment fills the
>   bottom of it.

---

## 1. The Problem

The keyboard shortcut works (`useKeyboardShortcuts.ts:118` —
Delete / Backspace removes selection) but is invisible. New
users:

- Expect a delete button somewhere obvious. Object panels in
  Figma, Affinity, even Word's drawing canvas have one.
- Try right-click first. Today gets the browser context menu,
  which is unhelpful. (The context-menu amendment fixes that
  separately.)
- Eventually drag the object off-canvas as a workaround, which
  the out-of-bounds visual treatment from
  `amendment-canvas-sizing.md` §7 actively discourages.

The fix isn't a UX redesign — just give them a button.

**Object list rows are NOT a viable home for a delete control.**
Considered and rejected: a small `×` on each Object list row would
get cramped (rows already carry visibility and lock toggles plus
the name and an icon), and on touch (44px hit-target rule) it
would be a misclick magnet next to the lock and visibility
buttons. Properties-tab button is the right surface.

---

## 2. Scope

In:
- A `[Delete]` button at the bottom of the Properties tab content.
- Visible only when there's a regular object selection
  (`selection.length >= 1` and not `'$document'`).
- Label varies by selection:
  - Single object → `"Delete {name}"`
  - Multi-object → `"Delete {N} items"`
- Click invokes the same delete handler the keyboard shortcut
  uses (`useKeyboardShortcuts.ts`'s `deleteSelection` —
  factor to a shared composable if it isn't already).
- No confirm dialog. The keyboard shortcut doesn't confirm; the
  button shouldn't either. Undo (Cmd+Z) covers regret. Consistent.
- Destructive visual treatment (red text or warning icon) so the
  button reads as the consequential action it is.

Out:
- `×` on Object list rows. Considered and rejected per §1.
- Confirm dialog. Undo is the safety net.
- A trash-can icon in the toolbar. The Properties tab button
  surfaces the action exactly when an object is selected; a
  permanent toolbar icon would just be in disabled state most
  of the time.
- Bulk delete from the document level (i.e. "delete all
  objects"). Not a common request; can be added later if it
  surfaces.
- Delete confirmation when the object is locked. The keyboard
  shortcut already lets locked objects be deleted (lock affects
  geometry edits, not deletion). Match that.

---

## 3. Layout

The button sits at the very bottom of the Properties tab content,
below all the editing sections (type-specific, Appearance,
Position & Size). Visually separated by a divider so it doesn't
read as part of the last section.

```
┌──────────────────────────────────┐
│ Hello world ✎       [Deselect]   │
├──────────────────────────────────┤
│ ... (type-specific section) ...  │
├──────────────────────────────────┤
│ Appearance ...                   │
├──────────────────────────────────┤
│ ▸ Position & Size                │
├──────────────────────────────────┤
│                                  │
│         [⚠ Delete Hello world]   │  ← bottom; destructive treatment
│                                  │
└──────────────────────────────────┘
```

Padding above the button is generous so it doesn't crowd the
last collapsible section's expand chevron. On mobile it stays
within the drawer's normal scroll — no special sticky handling
(deletes are infrequent enough that scrolling to find the button
is fine).

---

## 4. Visual Treatment

- Red text or `--color-danger` foreground (existing token if
  there's one in the design system).
- Optional warning icon (⚠ or trash) prefixing the label.
- Hover/focus states match other destructive buttons in the app
  (e.g. the existing "Replace" confirm button styling that
  `useConfirm.ts` uses with `tone: 'danger'`).
- Disabled state when `selection.length === 0` is irrelevant
  because the button isn't rendered then.

---

## 5. Edge Cases

### 5.1 Document Selection

When `selection === ['$document']`, the document fields render in
the Properties tab. The delete button does NOT show — the
document can't be deleted from here (that's a library-level
operation, handled in `DesignLibrary.vue`).

### 5.2 Locked Objects in Selection

The delete handler removes locked objects same as unlocked ones
(matches existing keyboard behaviour). No special UI.

### 5.3 Mid-Edit Text Object

If a TextObject is being edited inline (`InlineTextEditor.vue`
mounted), the Delete keyboard key removes characters in the
editor, not the object. The Properties tab's `[Delete]` button
unambiguously deletes the object regardless of inline-edit
state — clicking it commits any pending text edit and then
removes the object. Avoids the "Delete key did the wrong thing"
trap.

### 5.4 Group Object

Selecting a group and clicking Delete removes the whole group
including its children. Matches keyboard behaviour. The label
reads `"Delete {N} items in group"` if we want to be explicit,
or just `"Delete Group 3"` using the group's name. Pick the
shorter form for v1; clarity comes from the immediate
removal + undo affordance.

### 5.5 Auto-Switch After Delete

After delete, `selection` becomes empty. The IA amendment's
auto-switch rule fires: if currentTab is Properties, switch
back to Object. Falls out of existing rules; no special
handling needed here.

### 5.6 Long Object Names

Single-object label is `"Delete {name}"`. If the name is long
(near the 80-char limit from auto-naming + inline rename), the
button would balloon. Truncate the name with ellipsis at ~30
characters: `"Delete Greeting on the front of the…"`. Tooltip
shows the full name.

---

## 6. Files Affected

```
src/components/panels/
  PropertiesPanel.vue           append the [Delete] button at
                                the bottom of the object-selection
                                render branch; hidden for document
                                or empty selection

src/composables/
  useObjectActions.ts (new, or extend useKeyboardShortcuts)
                                expose a shared deleteSelection()
                                that the keyboard shortcut and the
                                new button both call. If the
                                context-menu amendment already
                                introduces this, reuse it.

src/i18n/
  en.json + others              keys for "delete-single" (with
                                {name} param), "delete-multi"
                                (with {n} param), tooltip for
                                truncated names
```

No designer-core changes. No schema changes. No store changes
beyond exposing the existing delete handler if it isn't already
shared.

---

## 7. Implementation Checklist

```
Shared delete handler:
□ Factor deleteSelection out of useKeyboardShortcuts into
  useObjectActions (or similar) if the context-menu amendment
  hasn't already done so
□ Both keyboard shortcut and the new button call the shared
  handler

Button placement:
□ PropertiesPanel renders [Delete] at the bottom when
  selection has at least one regular object
□ Hidden when selection is empty or === ['$document']
□ Divider separates the button from the last editing section
□ Generous top padding so it doesn't crowd collapsibles

Label rendering:
□ Single-object: "Delete {name}" with ellipsis at ~30 chars
□ Multi-object: "Delete {N} items"
□ Tooltip shows full name when truncated

Visual treatment:
□ Destructive tone (red text / warning colour)
□ Optional warning icon prefix
□ Hover/focus states consistent with other danger buttons

Mid-edit text handling:
□ Clicking the button while a text object is being edited
  inline commits any pending edit then deletes
□ Verify Delete keyboard key remains a character-delete inside
  the inline editor (no regression)

i18n:
□ properties.delete.single (param: name)
□ properties.delete.multi (param: n)
□ properties.delete.tooltipFullName (when truncated)
□ Apply to en + every other locale
```

---

## 8. Tests

PropertiesPanel render:
- Selection empty → button not rendered
- Selection === ['$document'] → button not rendered
- Selection of one regular object → button rendered with
  "Delete {name}" label
- Selection of three objects → button rendered with
  "Delete 3 items" label
- Long name (>30 chars) → label truncated; tooltip carries
  full name

Click handler:
- Click → calls shared delete handler → selection cleared,
  objects removed from document
- Undo restores the deleted objects exactly
- Click while Cmd-Z available → button still functional after
  undo restores

Mid-edit text:
- Object being edited inline + click [Delete] → inline edit
  commits, then object is removed
- Inline edit's character-delete via Delete key still works
  (no regression)

Locked object:
- Locked object selected + click [Delete] → object removed
  (matches keyboard behaviour)

Group:
- Group selected + click [Delete] → entire group + children
  removed; one history entry

Auto-switch interaction:
- Delete clears selection; if on Properties tab, IA's
  auto-switch returns user to Object tab (existing rule)

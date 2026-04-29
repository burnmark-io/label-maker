# label-maker — Amendment: Object Rename UX

> The inline rename in the Object list is a misclick trap. Each row
> embeds an `EditableText` button that activates on click — but the
> user's intent when clicking a row is almost always "select this
> object and open its properties", not "rename it". The pencil icon
> is hidden until hover, so nothing signals the rename is there; yet
> it intercepts clicks anyway. The result is accidental renames and
> frustrated users.
>
> Remove rename from the Object list entirely. It doesn't belong on
> a selection-and-navigation surface. Move the entire rename flow to
> the Properties tab, where it already exists, and make the affordance
> explicit: a visible icon button next to the name that the user
> deliberately clicks to enter rename mode.
>
> **Scope is the two surfaces — Object list and Properties header.**
> No changes to how rename works internally (same `designer.rename`
> call), no changes to auto-naming, no changes to the dataset column
> header rename (unrelated `EditableText` use in DataPanel).

---

## 1. The Problem

### 1.1 Object List — Accidental Rename

`ObjectsPanel.vue` embeds `<EditableText>` inside each list row.
`EditableText` renders a `<button>` that calls `.stop` on click,
absorbing the event before the row's `@click="onClickRow"` fires.
Clicking the name area activates rename. Clicking the small pencil
(visible only on hover) also activates rename.

The user's intent when clicking a row is overwhelmingly to select
the object and navigate to its Properties. Rename is a rare,
deliberate action that should require a deliberate gesture.

The `×`-on-list-row pattern was already rejected for the delete
affordance (`amendment-delete-affordance.md §1`) for exactly the
same reasons — cramped rows, easy misclicks, wrong surface. The
same logic applies to rename.

### 1.2 Properties Header — Hidden Affordance

`PropertiesPanel.vue` renders an `EditableText` as the selection
header for single-object selection. The pencil is opacity-0 until
hover; first-time users have no indication the name is editable.
Touch users (mobile drawer) never get a hover state, so the
pencil never appears — the rename is entirely invisible on mobile.

Replacing the hover-reveal trigger with a persistent icon button
fixes discoverability on both desktop and touch.

---

## 2. Scope

In:
- **Object list rows**: replace `<EditableText>` with a plain
  `<span>` for the object name. Clicking the name (or anywhere
  on the row) selects the object as before. No rename affordance
  on this surface.
- **Properties header**: replace `<EditableText>` with a static
  name display + a persistent `[✎]` icon button. Clicking the
  icon button enters rename mode (shows the input). The icon is
  always visible (not hover-only), always reachable on touch.
- Rename mode in the Properties header: same input behaviour as
  today — Enter commits, Escape cancels, blur commits. No
  behavioural change, just how the trigger is presented.

Out:
- Right-click → Rename in a context menu. That's
  `amendment-canvas-context-menu.md`'s territory; if it adds a
  Rename item, it would call the same `designer.rename` path.
- Renaming from the canvas (double-click on the object name chip
  or similar). Not a current feature; out of scope.
- Renaming the document. Document name lives in
  `DocumentProperties.vue` (separate from this header); unchanged.
- Dataset column headers. `EditableText` is used there too
  (DataPanel) but that surface has no misclick problem — column
  headers are not inside a row with a competing click target.
  Leave it alone.
- Keyboard shortcut for rename (e.g. F2 while a row is focused).
  Could be added later; not blocking this change.

---

## 3. Object List — Static Name

Replace the `<EditableText>` in each row with a plain `<span>`:

```html
<!-- before -->
<EditableText
  class="objects-list__label"
  :value="obj.name ?? ''"
  :edit-label="t('selection.rename')"
  :placeholder="labelFor(obj.type)"
  @update="renameObject(obj.id, $event)"
/>

<!-- after -->
<span class="objects-list__label">{{ obj.name || labelFor(obj.type) }}</span>
```

The `renameObject` function and the `EditableText` import are
removed from `ObjectsPanel.vue`. The `renameObject` composable
logic (`designer.rename(id, next)`) is now only called from the
Properties panel.

Row click behaviour is unchanged — the row's `@click="onClickRow"`
fires normally since there's no longer a child button absorbing
the event.

---

## 4. Properties Header — Explicit Rename Button

The current structure:

```html
<EditableText
  v-if="renameTarget"
  :value="renameTarget.name ?? ''"
  :edit-label="t('selection.rename')"
  :placeholder="renameTarget.placeholder"
  @update="renameSelected"
/>
<span v-else>{{ headerText }}</span>
```

Replace with a two-state header that is self-contained in the
panel's header slot:

```
┌──────────────────────────────────────────┐
│ Hello world                    [✎] [×]   │
│                                           │
│ (in rename mode:)                         │
│ [_Hello world_________________] [✓] [×]  │
└──────────────────────────────────────────┘
```

### 4.1 Display state (default)

- Object name (or auto-name placeholder in muted style if no
  custom name set).
- A small `[✎]` pencil icon button to the right. Always visible,
  not hover-gated. `aria-label="Rename"`.
- The existing `[×]` Deselect button stays as-is.

Clicking the name itself does NOT enter rename mode —
only the `[✎]` button does. This makes the affordance
explicit and prevents accidental edits. Touch users tap the
icon; keyboard users Tab to it.

### 4.2 Rename state (after clicking `[✎]`)

- Input replaces the name display, pre-filled with the current
  name, all text selected.
- A small `[✓]` confirm button replaces `[✎]` (or Enter to
  commit).
- Escape / blur cancels; Escape restores the previous value.
- Empty submit reverts to the previous name (existing behaviour).
- After commit or cancel, header returns to display state.
- `[×]` Deselect button is hidden in rename state to avoid
  accidental deselect while typing.

### 4.3 Multi-select and document selection

Unchanged behaviour — `renameTarget` is null for multi-select
and document selection, so neither gets the `[✎]` button. The
header shows the existing static text (`"3 items"`, `"Document"`).

---

## 5. No New Component Needed

The current `EditableText.vue` component is general-purpose and
stays for its other uses (dataset column headers, `autoEdit`
flow). The Properties header rename state can be implemented
directly inside `PropertiesPanel.vue` with a `ref<boolean>` for
`renaming` and a `ref<string>` for `draft`. That's three refs and
four event handlers — no abstraction warranted.

```typescript
// PropertiesPanel.vue additions
const renaming = ref(false);
const renameDraft = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);

function startRename(): void {
  if (!renameTarget.value) return;
  renameDraft.value = renameTarget.value.name ?? '';
  renaming.value = true;
  nextTick(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  });
}

function commitRename(): void {
  renaming.value = false;
  const next = renameDraft.value.trim();
  if (next && next !== renameTarget.value?.name) renameSelected(next);
}

function cancelRename(): void {
  renaming.value = false;
}
```

Reset `renaming` to `false` when `renameTarget` changes (i.e.
the user selects a different object while in rename mode):

```typescript
watch(renameTarget, () => { renaming.value = false; });
```

---

## 6. Files Affected

```
src/components/panels/
  ObjectsPanel.vue              replace <EditableText> with <span>;
                                remove renameObject function and
                                EditableText import

  PropertiesPanel.vue           replace <EditableText> in header
                                with display-state + [✎] button +
                                rename-state input; add renaming,
                                renameDraft, renameInputRef refs;
                                startRename / commitRename /
                                cancelRename handlers; watch to
                                reset on selection change; hide
                                Deselect in rename state

src/i18n/
  en.json + others              key: selection.renameLabel (tooltip
                                for the [✎] button, if distinct
                                from the existing selection.rename
                                key — check for reuse)
```

No designer-core changes. No store changes. No schema changes.
`renameObject` in `ObjectsPanel.vue` is removed; the underlying
`designer.rename()` call is already present via
`PropertiesPanel.vue`'s `renameSelected`.

---

## 7. Implementation Checklist

```
Object list:
□ Remove <EditableText> from ObjectsPanel row template
□ Replace with <span class="objects-list__label"> (name or placeholder)
□ Remove renameObject function from ObjectsPanel
□ Remove EditableText import from ObjectsPanel
□ Verify row @click still fires on the name area (no .stop blocking it)

Properties header — display state:
□ Object name rendered as plain text (muted style for auto-name
  placeholder where no custom name is set)
□ [✎] pencil icon button always visible; aria-label="Rename"
□ Clicking [✎] enters rename state
□ Clicking name text does NOT enter rename state
□ [×] Deselect button present

Properties header — rename state:
□ Input pre-filled with current name, text selected on open
□ Enter commits; Escape cancels; blur commits
□ Empty submit reverts to previous value
□ [✎] replaced by [✓] or commit is just Enter (decide in impl)
□ [×] Deselect hidden in rename state
□ Header returns to display state after commit or cancel
□ watch(renameTarget) resets renaming state on selection change

i18n:
□ Check if selection.rename key covers the [✎] tooltip or a
  new selection.renameLabel key is needed
□ Apply to en + every other locale
```

---

## 8. Tests

ObjectsPanel:
- Row click on name area selects the object (no rename triggered)
- No EditableText rendered in any row
- Name text shown; placeholder shown when name is absent

PropertiesPanel header:
- Single object selected → [✎] button visible
- Click [✎] → input appears, pre-filled with name, all selected
- Clicking the name text → no rename triggered
- Enter in input → name updated; display state restored
- Escape in input → name unchanged; display state restored
- Blur commits the value (same as Enter)
- Empty input + Enter → name unchanged (reverts)
- Multi-select header → no [✎] button
- Document selection header → no [✎] button
- Select a different object while in rename mode → rename state
  resets to display state; input gone
- [×] Deselect hidden during rename state
- [×] Deselect present in display state
- Touch: [✎] button reachable and triggers rename

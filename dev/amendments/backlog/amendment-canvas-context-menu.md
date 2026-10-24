# label-maker — Amendment: Canvas Context Menu

> Right-click on the canvas surface today does nothing useful — the
> browser context menu pops up with "Inspect", "Save image as", and
> other shell affordances that don't belong in a design editor.
> Same on touch: long-press gets the OS text-selection magnifier or
> nothing.
>
> Replace it with a proper editor context menu — the universal
> convention from Figma / Affinity / Sketch / Inkscape. Two
> distinct intents, both surfaced through the same mechanism:
>
> - **Right-click on empty canvas** → "Add here" + "Paste here" at
>   the click position.
> - **Right-click on an object (or selection)** → object actions
>   (cut / copy / paste / duplicate / delete / reorder / lock /
>   group).
>
> Mobile parity via long-press; same menu, same actions, native
> touch ergonomics.
>
> **Scope is the canvas surface only.** Sidebar inputs, panels, and
> browser chrome keep their native context menus. A
> `Shift+right-click` escape hatch on the canvas reveals the
> browser menu for the rare moment a user genuinely wants it
> (matches Figma).
>
> Sibling amendments:
> - `amendment-rotation-pivot.md` — touches the same canvas-node
>   handlers but in a different concern. Independent.
> - `amendment-text-resize-handles.md` — same surface, no overlap.
> - `designer-core-amendment-transactional-history.md` — paste of
>   multiple objects benefits from one history entry per paste;
>   not a blocker, but ships better with it.

---

## 1. The Problem

Three concrete frictions, all rooted in the missing canvas context
menu:

**(a) Adding objects always means crossing the editor.** To add a
text or barcode at a specific spot, the user clicks the toolbar
add-button (top of the editor), the object lands in the canvas
centre, and they drag it to where they wanted it. That's three
gestures for "put a thing here."

**(b) Paste lands at a fixed offset, not where the user is
looking.** `useKeyboardShortcuts.ts:36–44`'s `pasteAtOffset(12, 12)`
shifts pasted objects 12 dots from the original position. If the
user wants to paste *over there*, they paste, then drag.

**(c) Common per-object actions live in scattered surfaces.** Bring
to front, send to back, duplicate, lock, delete — keyboard
shortcuts exist (`Cmd+]`, `Delete`, ...) and some are in panels,
but there's no single "right-click → here are all the actions for
this object" surface that's standard in every other design tool.

The browser default context menu is actively unhelpful on a canvas
surface. Overriding it is expected behaviour — the doubt about
breaking native conventions is reasonable but the loss is
negligible (`Shift+right-click` keeps the escape hatch) and the
gain is large.

---

## 2. Scope

In:
- A single `<CanvasContextMenu>` component, opened by:
  - Right-click on the canvas surface (mouse) — `contextmenu` event
    on the Konva stage container, default prevented.
  - Long-press on touch devices — pointer-down + 500ms hold without
    movement on the canvas surface.
- Two menu modes:
  - **Empty-canvas** mode when the click hits no object: positional
    add-actions + Paste here.
  - **Object** mode when the click hits an object (or any object in
    the current multi-selection): per-object actions.
- Mode autodetect on open: a Konva `getIntersection()` check at
  the click point picks the targeted object, falling back to
  empty-canvas mode if nothing is there.
- Context-menu actions perform their work at the click point in
  canvas-dot coordinates — accounts for zoom and pan via the
  existing viewport composable.
- Shift+right-click escape hatch: bypasses the editor menu and
  lets the browser show its native context menu.
- Mobile haptic feedback on long-press open
  (`navigator.vibrate(20)`).
- Lift the clipboard from `useKeyboardShortcuts.ts:12` (private)
  into a shared `useClipboard` composable so the context menu and
  keyboard shortcuts both see the same state.
- Click-outside / `Esc` / scroll dismisses the menu.
- Menu position auto-flips to keep within viewport bounds.
- Internationalised labels for every action.

Out:
- A general application-wide command palette (Cmd+K). Different
  surface, different concern.
- Per-object property editing inside the menu (e.g. inline font
  size). Properties belong in the side panel; the menu is for
  one-shot actions.
- Customisable / extensible menu (e.g. plugin hooks). Static menu
  with a fixed action set.
- Cross-app clipboard (system clipboard for "Copy as PNG"). Future;
  not in this amendment.
- Right-click on the canvas frame edge / handles (rotation handle
  etc.). The handles are part of the transformer overlay and
  don't intercept the context menu — falls through to the canvas
  surface beneath.

---

## 3. Empty-Canvas Mode

Triggered when the click hits no object.

```
┌─────────────────────────┐
│  Add text here          │
│  Add image here         │
│  Add shape here     ▸   │
│  Add barcode here   ▸   │
│  ─────────────────────  │
│  Paste here    Cmd+V    │
│  ─────────────────────  │
│  Select all    Cmd+A    │
└─────────────────────────┘
```

Sub-menus on hover (or tap on touch) for the multi-option entries:

- **Shape**: Rectangle / Ellipse / Line
- **Barcode**: QR Code / Code 128 / EAN-13 / (recently used at top)

Defaults:
- New objects appear with their **centre at the click point**, not
  the top-left. Click where you want the thing to be, get the
  thing there.
- New objects use the same defaults as the toolbar add path —
  same fontSize, same QR options, same shape stroke. Nothing
  about the right-click path changes the defaults.
- The newly created object is selected on creation so the user
  can drag-tweak immediately.

`Paste here` uses the click point as the centre of the pasted
group. If multiple objects were copied, their relative positions
are preserved with the group's centroid at the click point.

---

## 4. Object Mode

Triggered when the click hits an object (or hits one of the
objects in the current multi-selection — right-clicking a member
of a multi-select keeps the selection rather than collapsing to
one).

```
┌─────────────────────────┐
│  Cut          Cmd+X     │
│  Copy         Cmd+C     │
│  Paste        Cmd+V     │
│  Duplicate    Cmd+D     │
│  ─────────────────────  │
│  Bring forward Cmd+]    │
│  Send backward Cmd+[    │
│  Bring to front ⇧Cmd+]  │
│  Send to back  ⇧Cmd+[   │
│  ─────────────────────  │
│  Lock                   │  (⇄ Unlock if already locked)
│  Hide                   │  (⇄ Show if already hidden)
│  ─────────────────────  │
│  Group        Cmd+G     │  (only if 2+ selected)
│  Ungroup      ⇧Cmd+G    │  (only if a group is selected)
│  ─────────────────────  │
│  Delete       ⌫         │
└─────────────────────────┘
```

Selection rules on right-click:
- Right-click on an unselected object → that object becomes the
  selection, then the menu opens.
- Right-click on a selected object (single or multi) → selection
  is preserved, menu opens with multi-aware copy.
- Modifier behaviour (Shift / Cmd) on right-click does NOT
  modify selection — it's a contextual gesture, not a selection
  gesture. (Click without modifier is the way to change selection.)

Action notes:
- **Cut**: copy + delete in one transaction (one history entry).
- **Paste** (in object mode): pastes at the **click point**, same
  as empty-canvas mode. Existing selection is replaced by the
  pasted objects.
- **Duplicate**: copy + paste with a small offset (matches the
  current `Cmd+D` behaviour from
  `useKeyboardShortcuts.ts:101–106`).
- **Group / Ungroup**: rely on existing `GroupObject` support in
  designer-core. Group requires ≥2 selected.
- **Lock / Hide**: toggle — label flips depending on current
  state. Locked objects can still be selected via the layer panel
  and have their lock toggled back here.

---

## 5. Long-Press on Touch

Touch devices substitute long-press for right-click.

### 5.1 Gesture

- `pointerdown` on the canvas with `pointerType === 'touch'` starts
  a 500ms timer.
- During the hold, if the pointer moves more than ~6 dots the
  timer is cancelled (it was a drag, not a long-press).
- If the timer fires, `navigator.vibrate(20)` (no-op where
  unsupported), the touch is consumed, and the menu opens at the
  pointer's last known position.
- `pointerup` after the timer fires does NOT trigger a click on the
  underlying object — the long-press supersedes it.
- `pointerup` before the timer fires lets the normal click /
  selection / drag behaviour run.

Standard iOS Safari / Android Chrome long-press behaviour (text
magnifier, image save) is suppressed via `touch-action: none` on
the canvas container plus `e.preventDefault()` in the
`contextmenu` handler — Safari does fire a `contextmenu` event on
long-press for non-input elements; we catch it and open our menu
the same way as desktop right-click.

### 5.2 Why a Manual Timer?

Browser-fired `contextmenu` on touch is inconsistent across
platforms (Chrome Android fires it on long-press; some Safari
versions don't). The manual timer gives consistent behaviour and
lets us add haptic feedback. The browser's `contextmenu` event is
still listened to on desktop; the manual timer is touch-only.

### 5.3 Mobile Layout

Same menu, larger hit targets on touch (CSS via
`@media (pointer: coarse)`): row height 44px instead of 32px,
more padding. Sub-menus expand inline rather than fly out
sideways to fit narrow viewports.

---

## 6. Position Math

The menu opens at screen coordinates (mouse / pointer event's
clientX, clientY). The actions need canvas-dot coordinates to
place objects.

The existing `useCanvasViewport` composable provides the zoom
factor and pan offset. The translation:

```typescript
function screenToCanvasDots(stage: Konva.Stage, sx: number, sy: number): { x: number; y: number } {
  const tr = stage.getAbsoluteTransform().copy();
  tr.invert();
  const p = tr.point({ x: sx, y: sy });
  return { x: p.x, y: p.y };
}
```

(Konva exposes the inverse transform directly. We don't need to
hand-roll the math.)

Use cases:
- **Empty-canvas add**: place new object's centre at the
  translated point. Top-left = `(x - width/2, y - height/2)`.
- **Empty-canvas paste**: translate point, place pasted group's
  centroid there.
- **Object-mode paste**: same as empty-canvas paste — click point
  is authoritative.

Off-canvas clicks (the user right-clicks outside the canvas
rectangle but within the canvas DOM container — possible at high
zoom-out) are still valid; objects can be placed at negative or
beyond-canvas coordinates, where the existing out-of-bounds
visual treatment from `amendment-canvas-sizing.md` §7 takes over.

---

## 7. Shared Clipboard

The clipboard currently lives in
`useKeyboardShortcuts.ts:12`'s closure, inaccessible to other
composables. Lift it into a shared composable:

```
src/composables/
  useClipboard.ts          new — module-scoped state shared across
                           the app; getters and setters; no-op
                           outside browser environments
```

```typescript
const items: LabelObjectInput[] = [];

export function useClipboard() {
  return {
    copy(objects: LabelObject[]) { /* strip ids, store */ },
    cut(objects: LabelObject[]) { /* copy + remove */ },
    paste(at?: { x: number; y: number }) { /* return new ids */ },
    canPaste: computed(() => items.length > 0),
    items: readonly(items),
  };
}
```

Both `useKeyboardShortcuts` and `<CanvasContextMenu>` import this
composable. No more divergent state.

Future: hook into the system clipboard (`navigator.clipboard`) for
Copy as PNG / Paste image-from-clipboard. Out of scope for this
amendment; the in-app clipboard is what right-click uses.

---

## 8. Escape Hatch

`Shift+right-click` on the canvas surface skips our menu and lets
the browser's native context menu through. Implementation:

```typescript
function onContextMenu(e: MouseEvent) {
  if (e.shiftKey) return;        // let the browser handle it
  e.preventDefault();
  openMenu(e.clientX, e.clientY);
}
```

Documented in the help / shortcuts surface. Power users (devs
inspecting the canvas, anyone reaching for "Save image as" on a
WebGL preview) get the native menu when they ask for it.

No mobile equivalent — touch users don't typically need the
native menu, and adding a four-finger gesture or modifier key
would be overkill.

---

## 9. Edge Cases

### 9.1 Right-Click on a Locked Object

Same menu as for an unlocked object, but Lock entry reads
"Unlock", and Cut / Delete are disabled (greyed) with a tooltip
explaining why. Bring forward / send backward stay enabled —
locked-ness is about geometry edits, not z-order.

### 9.2 Right-Click on a Hidden Object

Hidden objects are not click-targets in the canvas (Konva
`listening: false`). So this case can only arise via the layer
panel. Out of scope here; the panel handles its own context
menu (future).

### 9.3 Right-Click During an Active Drag

Discard. If the user is mid-drag, their primary mouse button is
held; right-click is a malformed gesture. Cancel the drag
gracefully (`cancelTransaction()` from
`designer-core-amendment-transactional-history.md`) and don't
open the menu.

### 9.4 Right-Click With Nothing Selected, Inside an Object

Object mode. Right-click selects that object first (the standard
behaviour from §4), then opens the object-mode menu.

### 9.5 Sub-Menu Hover on Touch

`@media (pointer: coarse)` shows sub-menus inline (row expands
into rows below) rather than as a fly-out. Avoids the "hover"
gesture which doesn't exist on touch.

### 9.6 Menu Open + Tab Loses Focus

`blur` event on the window closes the menu. Standard.

### 9.7 Menu Open + Resize Window

Recompute position on `resize` to keep within viewport. If menu
no longer fits anywhere reasonable, close it.

### 9.8 Paste With Nothing in Clipboard

Paste entries (in either mode) are disabled when
`useClipboard().canPaste === false`. Greyed, no tooltip.

### 9.9 Group / Ungroup Visibility

- Group: shown only when ≥2 objects selected. Disabled when only
  1 selected.
- Ungroup: shown only when at least one selected object is a
  GroupObject. Disabled when no group selected.

(Showing-only-when-applicable beats showing-but-disabled here —
the menu reads cleaner without dead entries.)

### 9.10 Click-Through After Menu Close

When the user clicks outside the menu to close it, that click
should NOT also fall through to the canvas (selecting an object
unintentionally). Standard pattern: `pointerdown` on a backdrop
captures the click, closes the menu, and stops propagation.

---

## 10. Files Affected

```
src/components/canvas/
  CanvasContextMenu.vue        new — the menu component
  DesignCanvas.vue             listen to contextmenu on stage
                               container; open the menu component;
                               long-press timer for touch

src/composables/
  useClipboard.ts              new — shared clipboard state
  useKeyboardShortcuts.ts      switch from private clipboard
                               closure to useClipboard
  useLongPress.ts              new — touch long-press detection

src/components/canvas/
  ObjectActions.ts (or similar) optionally factor object actions
                               (cut/copy/paste/duplicate/reorder/
                               lock/hide/group/ungroup/delete) into
                               a small helper module so the menu
                               and keyboard shortcuts share one
                               implementation each

src/components/toolbar/
  CanvasActions.vue            existing @contextmenu.prevent on the
                               options button stays — different
                               surface; unaffected

src/i18n/
  en.json + others             menu labels and accelerator hints
                               (e.g. "menu.add.text", "menu.paste")
                               + sub-menu group headings
```

No designer-core changes. No schema changes.

---

## 11. Implementation Checklist

```
Shared clipboard:
□ src/composables/useClipboard.ts — module-scoped state, copy/cut/
  paste/canPaste/items
□ paste(at?) — when `at` provided, place pasted group with
  centroid at the canvas-dot coordinate
□ Update useKeyboardShortcuts to consume useClipboard
□ Verify Cmd+C/V/X/D continue to work end-to-end

Position math:
□ Helper screenToCanvasDots(stage, sx, sy) using stage's inverse
  transform (Konva built-in)
□ Helper canvas-position-for-new-object(point, defaultSize) →
  top-left for centre-at-point placement

Long-press composable:
□ src/composables/useLongPress.ts — hooks pointerdown/pointermove/
  pointerup/pointercancel on a target element
□ 500ms timer; cancel on >6dot movement
□ Fires a callback with {x, y} of the long-press
□ navigator.vibrate(20) on fire (no-op where unsupported)
□ Suppresses subsequent click if timer fired

Context menu component:
□ src/components/canvas/CanvasContextMenu.vue
□ Mode prop: 'empty' | 'object'
□ Position prop: viewport (clientX, clientY)
□ Auto-flip to stay within viewport
□ Sub-menu support (Shape / Barcode)
□ Coarse-pointer styling: 44px row height, inline sub-menus
□ Esc / scroll / blur / click-outside dismissal
□ Click-through suppression on close

Canvas integration:
□ DesignCanvas.vue listens to contextmenu on stage container
□ Shift+right-click → return early (let browser handle)
□ Konva getIntersection(point) decides empty vs object mode
□ Right-click on unselected object → select first, then open
□ Right-click on selected object → keep selection, open
□ Long-press composable wired to the same handler

Object actions module:
□ Factor cut/copy/paste/duplicate/reorder/lock/hide/group/
  ungroup/delete into helpers callable from both menu and
  keyboard shortcuts
□ Cut wraps in transactional-history begin/commit when available
□ Paste places at click point when called from menu, at
  ±12dot offset when called from Cmd+V (current behaviour)

Mobile:
□ touch-action: none on the canvas container so OS long-press
  behaviour (text magnifier) is suppressed
□ Verify Safari iOS, Chrome Android both suppress native menu
  and open ours

Edge cases:
□ Locked-object actions (Cut/Delete disabled with tooltip)
□ Group/Ungroup conditional visibility
□ Drag + right-click cancels drag
□ Menu close on resize / blur
□ Click-through suppression

i18n:
□ Menu label keys (menu.add.text/image/shape.rectangle/etc.)
□ Sub-menu headings
□ Accelerator hint text (e.g. "Cmd+C", "Cmd+V") via existing
  shortcut-formatting helper if present
□ Tooltip for disabled-locked actions
```

---

## 12. Tests

Position math:
- screenToCanvasDots round-trips through zoom + pan (e.g. zoom
  2x, pan -100,-100, click at screen 200,200 → canvas 150,150)
- New-object centre-at-point places top-left at point - half-size

useClipboard:
- copy then paste(at) places centroid at provided point
- copy then paste() (no point) uses ±12dot offset (legacy)
- cut copies and removes selection
- canPaste reflects items state

Long-press composable:
- pointerdown then pointerup within 500ms → no fire
- pointerdown, hold 500ms without movement → fires with start
  coords
- pointerdown, hold + move >6 dots → cancels
- pointercancel during hold → cancels
- click suppressed when long-press fired

Context menu:
- Right-click on empty canvas → empty-mode menu opens at click
- Right-click on object → object-mode menu, object selected if
  it wasn't
- Right-click on member of multi-selection → multi-selection
  preserved, object-mode menu
- Shift+right-click → no menu opens, default not prevented
- Esc / click-outside / scroll dismisses
- Auto-flip when click is near right or bottom edge of viewport
- Sub-menu opens on hover (desktop) and on tap (touch)
- Menu actions invoke the right object-actions helpers

Object-actions integration:
- Cut produces one history entry (delete + clipboard write)
- Paste at click point places centroid at point
- Group disabled with 1 selected; enabled with 2+
- Ungroup enabled only when a GroupObject is in selection
- Lock toggles; second toggle restores; one history entry each

Touch (with pointer events emulation):
- Long-press on canvas opens menu at long-press coords
- Subsequent touch click after long-press is suppressed
- touch-action: none prevents native long-press magnifier

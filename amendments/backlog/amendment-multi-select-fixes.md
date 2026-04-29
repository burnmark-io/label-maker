# label-maker — Amendment: Multi-Select Fixes

> Multi-selection works in the data model — `designer.selection` is
> already a `string[]` and Shift+click on an object or in the
> Objects panel adds / removes from it. What's missing is the
> canvas-side interaction polish: there's no marquee select,
> dragging a multi-selection on the canvas can desync, and
> resizing/rotating the bounding box doesn't preserve the relative
> layout cleanly.
>
> The first impulse — "scrap multi-select altogether" — would lose
> a feature that's table-stakes in every adjacent design tool.
> Real label workflows need it: shifting a layout, deleting test
> elements, grouping. The specific frictions are well-known in the
> design-tool world and have well-trodden solutions. Fix, don't
> remove.
>
> **Scope is the canvas-side multi-select interactions** — marquee
> select, group-relative transformer math, and group-drag autoHeight
> consistency. The properties-panel multi-select view that earlier
> drafts of this plan included is now handled cleanly by
> `amendment-sidebar-ia.md`'s Properties tab — see §7 here for
> the cross-reference. The selection state model stays as it is.
> No designer-core changes, no schema changes.
>
> Sibling amendments:
> - `amendment-rotation-pivot.md` (implemented) — established the
>   centre-pivot per node. Multi-select transformer math here
>   builds on that.
> - `amendment-sidebar-ia.md` — **must land before this amendment.**
>   Its Properties tab is the natural home for multi-select
>   common-fields editing; this plan deliberately doesn't reinvent
>   that surface and assumes IA is in place.
> - `amendment-text-resize-handles.md` — corner-vs-edge convention
>   needs to compose with multi-select correctly. Notes in §4.
> - `amendment-canvas-context-menu.md` — the right-click menu
>   already accounts for multi-selection (preserves it on
>   right-click). No conflict.
> - `designer-core-amendment-transactional-history.md` — multi-
>   object drag/transform produces N mutations. With transactional
>   history those collapse into one undo entry. Not a blocker.

---

## 1. What's Actually Broken

The data model isn't the problem. `designer.selection: string[]`
is well-designed. The friction is at three canvas-side
interaction seams (the fourth historical issue — the properties
panel — is now addressed by `amendment-sidebar-ia.md` and
deferred to it; see §7).

**(a) No marquee / rubber-band select.** Every adjacent tool
(Figma, Affinity, Sketch, Inkscape, even MS Word's drawing
canvas) lets you drag a rectangle on empty canvas to select
everything inside it. We don't. The only way to multi-select
today is Shift+clicking each object one at a time. For five
objects that's nine clicks; for a screen full of small icons
it's tedious enough that users give up.

**(b) Multi-select transformer math doesn't preserve relative
layout.** When you select 3 objects and drag the bounding box's
corner handle to scale, the transformer applies the same `sx, sy`
to each underlying node. Each node's `onTransformEnd` reads its
own `node.x()`, `node.y()`, and recomputes its own width/height
— so each object scales relative to its own centre (after the
rotation-pivot amendment) rather than relative to the **group's
centre**. The visual bounding box ends up consistent, but the
per-object positions drift apart because each one anchored
itself.

(Context: this is a known pattern. Konva exposes the active
anchor and the transformer's centre — the fix is computing each
object's new position relative to the group bounds, not its
own.)

**(c) Move-as-group during drag is unreliable.** Konva's
transformer translates each selected node by the same delta on
drag. Per-node `onDragEnd` handlers emit their new positions
correctly *if* the per-object render uses the centre-pivot
convention from the rotation-pivot amendment. But for
TextObjects with `autoHeight: true`, the height is computed at
render time, not stored — and the un-offset math
(`node.y() - newHeight / 2`) reads the rendered height, which
may differ from the stored height. Group drag desyncs subtly
on autoHeight text.

---

## 2. Why Not Scrap

A label editor without multi-select fails at common workflows:

- "Shift this whole layout 3mm right because the top got cropped
  on print" → without multi-select, that's N drag operations,
  each one introducing layout drift.
- "Delete these test elements" → without multi-select, N click +
  delete cycles.
- "Group these icons + label into one unit so I can move them
  around together" → not possible without multi-select.
- "Align these three labels to the same left edge" → a feature
  this amendment doesn't add but is a natural follow-up that
  *requires* multi-select.

Removing multi-select would push label-maker behind every adjacent
tool's table-stakes feature set. The four issues above are
specific, well-understood interaction problems with known fixes.
Fix them.

---

## 3. Scope

In:
- **Marquee select**: drag from empty canvas → rubber-band
  rectangle → all objects whose AABB intersects the rectangle on
  release become the selection. Shift held = add to existing
  selection rather than replace.
- **Group-relative transformer math**: when ≥2 objects are
  selected and the user resizes/rotates the transformer, each
  object's new position and size is computed relative to the
  group bounds, not each object's own centre. Per-object
  `onTransformEnd` handlers gain a "group context" code path
  for the multi-select case.
- **Group drag**: a multi-select drag moves every selected
  object by the same delta. Per-object `onDragEnd` handlers
  read and emit the new positions correctly, including when
  some objects are autoHeight text.
- **Selection visuals**: existing transformer wraps the group;
  individual selection halos hidden during multi-select. (May
  already be the case; verify.)
- **Keyboard nudge / arrow keys**: existing multi-object nudge
  in `useKeyboardShortcuts.ts` works. Verify it still works
  after the group-relative changes (it should — nudge is a per-
  object delta, not a group transform).

Out:
- **Alignment / distribution actions** (align lefts, distribute
  vertically, etc.). Natural follow-up amendment that benefits
  from this fix; explicitly out of scope here so the plan stays
  focused.
- **Selection groups as first-class document objects.** Today
  `GroupObject` already exists in the schema; "group selection
  to a real GroupObject" is wired through Cmd+G in the keyboard
  shortcuts. Not changing how group creation works here — just
  fixing how multi-select-without-grouping behaves.
- **Lasso / freehand select.** Marquee rectangle only.
- **Cross-canvas multi-select.** N/A — there's only one canvas.
- **Marquee select in the ObjectsPanel.** That panel is a list;
  shift+click range select would be nice but is a separate
  concern.

---

## 4. Marquee Select

### 4.1 Trigger

A `pointerdown` on the canvas stage where the click target is
**not** an object (i.e. on the paper rect or empty stage) starts
a marquee. Held + moved beyond a small threshold (~3 dots) →
rubber-band rectangle renders from the start point to the
current pointer position.

If the user releases without moving past the threshold, treat
it as a click — the existing `onStageClick` deselect behaviour
runs.

### 4.2 Rendering

Konva `Rect` with stroke `#f59e0b` (matching the transformer
colour from `SelectionTransformer.vue:26`), stroke width
`1.5 / zoom` (visually constant across zoom levels), dashed,
fill `#f59e0b22` (subtle tint).

Rendered into a marquee layer above objects, below the
transformer.

### 4.3 Selection on Release

On `pointerup`:
- Compute the rectangle in canvas-dot coordinates (using the
  same `getAbsoluteTransform().invert()` math from the context-
  menu amendment).
- For every visible, non-locked object in
  `designer.document.objects`, test if its AABB **intersects**
  the rectangle (not "fully contained" — most tools use
  intersect for marquee).
- If `event.shiftKey` was held → union with existing selection;
  else → replace.
- `designer.select(matchedIds)`.

### 4.4 Shift+Marquee (Add to Selection)

Hold Shift before / during marquee → resulting selection is the
union of pre-marquee selection and the marquee hits. Standard
Figma/Sketch behaviour.

### 4.5 Locked / Hidden Objects

Hidden objects are not click-targets; they're also not marquee-
targets. Locked objects are selectable via the Objects panel
but the marquee skips them (consistent with how Konva's
`listening: false` already excludes them on click).

### 4.6 Alt+Marquee (Subtract) — Out of Scope

A common addition is Alt-drag to subtract from selection. Park
it; not blocking and adds a third modifier path.

---

## 5. Group-Relative Transformer Math

### 5.1 The Problem

Per-object `onTransformEnd` reads `node.x()`, `node.y()`,
`node.width() * sx`, etc. — all relative to that node's own
state. With multi-select, every selected node gets the same
`scaleX`, `scaleY`, and rotation from Konva's transformer, but
their pre-transform positions differ. A scale of 2x applied
to each node individually keeps each node's centre fixed and
doubles their size — so two objects at (10,10) and (50,10)
become two objects of double size still centred at (10,10) and
(50,10), the bounding box doesn't double; the layout collapses.

### 5.2 The Fix

When multiple nodes are bound to the transformer, per-object
transformend should compute new geometry relative to the
**group bounds**, not the per-object position.

Approach:
- On `transformstart`, `SelectionTransformer.vue` captures the
  group bounds (axis-aligned bounding box of all selected
  objects' pre-transform AABBs) and the current scale/rotation
  origin (centre of group bounds).
- Each per-object node component, on `transformstart`, also
  captures its **offset** from the group's pre-transform
  centre and its pre-transform width/height/rotation.
- During `transform`, Konva continues to render the visual
  transform.
- On `transformend`, the per-object handler reads:
  - The active scale (`sx`, `sy`) and rotation delta (`dθ`)
    applied by the transformer.
  - The pre-transform group-relative offset and own size.
  - Computes new position as: `groupCentre +
    rotate(offset * scale, dθ)`.
  - Computes new size as: `oldSize * scale`.
  - Computes new rotation as: `oldRotation + dθ`.

This keeps each object's relationship to the group preserved
under any scale/rotation. The math is the same one every design
tool implements; not novel.

### 5.3 Single-Select Path Unchanged

When `selection.length === 1`, the transformer's group bounds
collapse to the single object's bounds, the offset is (0,0),
and the math reduces to the existing per-object centre-pivot
behaviour. No regression — just a generalisation that handles
both cases through one formula.

### 5.4 Group Context

The cleanest implementation is to push the group context onto
each per-object node component as a prop or via a shared
composable read on `transformstart`:

```typescript
// composables/useTransformContext.ts (sketch)
const ctx = ref<{
  groupCentre: { x: number; y: number };
  perObject: Map<string, {
    offsetFromGroupCentre: { x: number; y: number };
    width: number;
    height: number;
    rotation: number;
  }>;
} | null>(null);
```

Set at `transformstart`, read at `transformend` per-object,
cleared after. Simpler than threading props through every
node component.

### 5.5 Composition With Text Resize Handles

`amendment-text-resize-handles.md` proposes corner-vs-edge
behaviour for single text-box resize. With multi-select:
- The transformer scales the **group** uniformly on corner drag
  (default Konva keepRatio behaviour for groups).
- Per-text-object commit math respects its own `resizeBehavior`
  (`keep-size` for text means font stays constant on group
  resize too).
- Edge-handle drags on a multi-select are unusual but should
  apply only the relevant axis scale to each object's position
  and (for non-text) size.

This composes cleanly: the group-relative math from §5.2 takes
the active scale; the per-object commit decides what to do with
it based on type (text keeps font, image scales, shape scales).

---

## 6. Group Drag

### 6.1 The Problem

Konva translates each selected node by the same delta on drag —
that's correct as a visual transform. The desync happens when
per-object `onDragEnd` reads the node's stage position and
un-offsets it back to AABB top-left for storage:

```typescript
emit('dragend', t.x() - props.object.width / 2, t.y() - props.object.height / 2);
```

For autoHeight text, the rendered height differs from the
stored height. The un-offset uses `props.object.height`, which
might not match what Konva sees. Subtle but catches in real
use.

### 6.2 The Fix

In each node component's `onDragEnd`, derive the un-offset from
the **same height that was used to render**, not the stored
property:

```typescript
function onDragEnd(event: { target?: Konva.Node }): void {
  const t = event.target;
  if (!t) return;
  const renderedWidth = t.width();
  const renderedHeight = props.object.autoHeight ? t.height() : props.object.height;
  emit('dragend', t.x() - renderedWidth / 2, t.y() - renderedHeight / 2);
}
```

Apply consistently across `TextNode`, `ShapeNode`, `ImageNode`,
`BarcodeNode`. `autoHeight` is text-specific, but the principle
("read what Konva used, not the stored value") catches similar
issues if other types add computed dimensions later.

---

## 7. Properties Panel — Deferred to Sidebar IA Amendment

This amendment **does not** ship a Properties-panel multi-select
view. That work happens inside `amendment-sidebar-ia.md`, which
promotes Properties to its own tab with selection-aware
rendering. By the time multi-select fixes land here, the
Properties tab already handles the three rendering branches
(empty / document / object selection) and the multi-object case
falls naturally out of the third branch.

The rule the IA amendment lands:
- Selection homogeneous (all same type) → render the type's
  property sections plus the BaseObject sections, with mixed-
  value placeholders where values differ across the selection.
- Selection heterogeneous (mixed types) → render only the
  BaseObject common sections (Position / Size / Appearance);
  type-specific sections hide.
- Editing any field applies to all selected objects in one
  transaction.

This amendment's scope is purely the **canvas-side** interactions:
marquee, group-relative transformer math, group drag. The
sidebar takes care of itself.

If for some reason the IA amendment is delayed, this amendment
still ships value standalone — the canvas behaviours are
independent of the panel rendering. But the natural sequencing
is IA first, then this.

---

## 8. Edge Cases

### 8.1 Marquee Crosses a Locked Object

Locked objects are skipped (consistent with not being click-
targets). The marquee passes through visually.

### 8.2 Marquee During an Active Transformer

If the user has a selection and the transformer is active,
clicking on an empty area normally deselects (existing
`onStageClick`). With marquee, the rule shifts: pointerdown on
empty area starts a marquee; pointerup-without-drag still
deselects (same outcome as before). Drag-past-threshold opens
a marquee that replaces (or extends, with shift) the selection.

### 8.3 Single-Object Drag in a Multi-Select

User has 3 objects selected, drags one. Konva default
behaviour: the dragged node moves; the others stay. With group
drag enabled, all three move by the same delta. Verify Konva
transformer's `dragstart` propagates to all bound nodes — it
does by default; the per-node `onDragEnd` handlers each fire
with their own deltas applied.

### 8.4 Multi-Select Containing a Group Object

`GroupObject` is a single selectable unit; its children move
with it. A multi-select containing a group treats the group as
one item (its AABB is the group's AABB). Existing behaviour;
no special handling needed.

### 8.5 Multi-Select All Locked

If every selected object is locked, the transformer should
hide (or be visible but not interactive). Today it likely
shows; verify and either suppress or pass `listening: false`
to it.

### 8.6 Multi-Select Across Different Object Types

The sidebar IA's Properties tab (§7) handles this — common
BaseObject sections only on heterogeneous selection. No special
canvas-side handling needed; the transformer wraps every
selected object regardless of type.

### 8.7 Marquee in Editing Mode (Text Edit Active)

If a TextObject is being edited (focus in the inline editor),
stage clicks/drags should not start a marquee. Existing edit
mode already swallows pointer events on the stage; verify and
fix if not.

### 8.8 Performance

Marquee hit-testing on every object on `pointerup` is O(N)
where N is object count. For label-sized documents (typically
< 30 objects) this is fine; no spatial index needed. Note for
future high-object-count scenarios.

---

## 9. Files Affected

```
src/components/canvas/
  DesignCanvas.vue              marquee start/move/end on stage
                                pointerdown/move/up; renders the
                                rubber-band rect; computes hits on
                                release; modifier handling
  SelectionTransformer.vue      capture group bounds and per-object
                                offsets on transformstart; expose
                                a transform-context shared composable
  TextNode.vue                  group-relative transformend math;
                                autoHeight-aware dragend
  ShapeNode.vue                 group-relative transformend math
  ImageNode.vue                 group-relative transformend math
  BarcodeNode.vue               group-relative transformend math

src/composables/
  useTransformContext.ts        new (or shared with text-resize-
                                handles amendment if it ships
                                first) — group-bounds/offsets state
                                for the transformer cycle, plus
                                activeAnchor when text-resize lands
  useMarquee.ts (optional)      new — marquee state machine if the
                                logic in DesignCanvas.vue grows;
                                otherwise inline

src/composables/
  useKeyboardShortcuts.ts       (no change — existing
                                deleteSelection / nudgeSelection /
                                copySelection already iterate
                                designer.selection correctly)
```

No properties-panel work in this amendment — that's the sidebar
IA amendment's territory (§7).

No designer-core changes. No schema changes.

---

## 10. Implementation Checklist

```
Marquee select:
□ Stage pointerdown on empty area starts a marquee
□ Pointermove past 3-dot threshold → render rubber-band Rect
□ Pointerup computes canvas-dot rectangle, finds intersecting
  visible non-locked objects, sets selection
□ Shift+marquee unions with existing selection
□ Pointerup without movement falls back to existing deselect

Group-relative transform math:
□ useTransformContext composable: group bounds, group centre,
  per-object offsets, captured on transformstart
□ SelectionTransformer captures and stores context
□ Per-node TextNode/ShapeNode/ImageNode/BarcodeNode
  onTransformEnd reads context when selection.length >= 2;
  computes new position/size/rotation relative to group
□ Single-select case unchanged (context offset = 0)

Group drag:
□ Per-node onDragEnd un-offsets using rendered height when
  autoHeight, stored otherwise
□ Verify Konva transformer propagates drag to all selected
  nodes (default behaviour; smoke test)

Properties panel:
□ No work in this amendment — handled by amendment-sidebar-ia.md
  before this lands

Verification:
□ Drag-marquee selects 3 objects
□ Drag the group → all move together; positions stored correctly
□ Resize the group corner → relative layout preserved
□ Rotate the group → all objects orbit group centre, not their own
□ autoHeight text included in multi-select drag → no position drift
□ Multi-edit colour from Properties tab → all change colour
  (this works because the IA amendment landed first; smoke-test
  it after this amendment lands too)

i18n:
□ Marquee select has no new strings
□ Properties-panel multi-select strings live in the IA amendment
```

---

## 11. Tests

Marquee (`components/canvas/__tests__/marquee.test.ts`):
- Pointerdown on empty stage + pointerup without movement → no
  marquee, deselect happens (existing path)
- Pointerdown + drag > 3 dots → rubber-band rect renders
- Release with rect intersecting 2 objects → those 2 ids end
  up in designer.selection
- Locked objects skipped
- Hidden objects skipped
- Shift held during marquee → union with prior selection
- Marquee ignored while a text object is being edited

Group-relative transform (`components/canvas/__tests__/group-transform.test.ts`):
- Two objects at (10,10,20,20) and (50,10,20,20). Select both.
  Resize the group bounding box to 2x. Expect:
  - Object A at (10, 10, 40, 40)
  - Object B at (90, 10, 40, 40)
  (Group centre stays put; each object's offset from centre
  doubles; sizes double.)
- Rotate the group 90°. Expect each object's rotation += 90°
  and position rotated around group centre.
- Single-select case behaves identically to pre-amendment.

Group drag:
- Multi-select drag of 3 objects emits 3 dragend events with
  consistent deltas
- AutoHeight text in multi-select drag — final stored y matches
  visual position (no drift)

Properties panel (smoke test, not this amendment's primary
responsibility):
- Selection of 3 objects renders the IA amendment's selection-
  aware Properties tab without crashing
- Mixed-value placeholder appears for fields that differ
- Editing applies to all selected (test relies on the IA
  amendment's logic; just confirm the multi-select changes here
  don't break the panel's existing behaviour)

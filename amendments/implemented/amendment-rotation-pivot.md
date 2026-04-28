# label-maker — Amendment: Unified Rotation Pivot

> Two rotation controls, two different behaviours. The sidebar
> rotation slider in the properties panel rotates an object around its
> top-left corner — the object visually swings outward as the angle
> changes. The on-canvas rotate handle (Konva transformer) rotates
> around the visual centre, which is what users expect from every
> design tool. Same conceptual action, two divergent results,
> depending on which control the user reaches for.
>
> Make both controls rotate around the visual centre. The fix is at
> the Konva node setup level — once the rendered node's pivot is
> centred, both code paths converge automatically because they both
> just patch `rotation` and let Konva render.
>
> **Scope is rendering and interaction.** No document schema change.
> `BaseObject.x`, `y`, `width`, `height` continue to describe the
> unrotated axis-aligned bounding-box top-left and dimensions; only
> the visual pivot moves.
>
> Sibling concerns (separate amendments):
> - `amendment-text-resize-handles.md` — corner vs edge handle behaviour
>   for text font scaling. Same general "make canvas controls match
>   user intent" theme but a different surface.
> - `designer-core-amendment-transactional-history.md` — undo a full
>   slider drag in one step. Independent.

---

## 1. The Problem

Open any object in the editor. Rotate it via the sidebar slider —
the object pivots around its top-left corner and swings outward.
Rotate the same object via the on-canvas rotate handle — it pivots
around the centre and stays put visually. Same `rotation` value
ends up stored, but the visible motion mid-drag and the post-rotation
position differ wildly.

Why this happens:
- `TextNode.vue`, `ShapeNode.vue`, `ImageNode.vue`, `BarcodeNode.vue`
  all configure their Konva nodes with `x: object.x, y: object.y,
  rotation: object.rotation` and **no `offsetX`/`offsetY`** set.
  Konva rotates a node around its own (0, 0), which sits at
  (object.x, object.y) — the AABB top-left. The slider's
  `update('rotation', n)` patches only the rotation value, so the
  node stays anchored at top-left.
- `SelectionTransformer.vue` (Konva's `Transformer`) rotates the
  underlying node around the bounding-box centre by default. To
  preserve that centre visually, the transformer adjusts the node's
  position as it rotates and emits a new `(x, y, rotation)` triple
  in `onTransformEnd` (e.g. `TextNode.vue:100–116`). Different
  pivot, different math, different result.

Two paths, divergent semantics. Pick one and unify.

---

## 2. Scope

In:
- All canvas object renderers (`TextNode`, `ShapeNode`, `ImageNode`,
  `BarcodeNode`, and any others under `components/canvas/`) configure
  their Konva nodes with `offsetX = width/2`, `offsetY = height/2`
  and render position `x + width/2, y + height/2` so rotation pivots
  around the visual centre.
- The transformer's existing centre-rotation behaviour is now
  redundant — the underlying node already rotates around centre.
  Confirm `transformend` math still yields the correct unrotated
  AABB top-left.
- The sidebar slider's `update('rotation', n)` continues to patch
  rotation only. No x/y compensation needed because the rendered
  node's pivot is already at centre.
- Keep the document schema's `x, y, width, height` semantics
  unchanged: the **unrotated** AABB top-left and dimensions. All
  serialisation, snapping, alignment, and resize math continues to
  use the unrotated coordinates.

Out:
- Schema changes. No new pivot field, no anchor stored per object.
- A user-configurable rotation pivot. (PowerPoint and some other
  apps let you move the pivot point; deferred — the centre default
  is universal and covers nearly every case.)
- Multi-object rotation around group centre. Existing transformer
  behaviour for multi-selection is unchanged; this amendment is
  about the per-object pivot only.
- Rotated AABB (the visual axis-aligned bounding box of a rotated
  object) — stays computed at render time from unrotated values.
  Any tools that need it (snapping, alignment) compute it locally;
  not stored.

---

## 3. The Fix

### 3.1 Render Pivot at Centre

For each canvas node, change the Konva config from:

```typescript
x: props.object.x,
y: props.object.y,
width: props.object.width,
height: props.object.height,
rotation: props.object.rotation,
```

to:

```typescript
x: props.object.x + props.object.width / 2,
y: props.object.y + props.object.height / 2,
offsetX: props.object.width / 2,
offsetY: props.object.height / 2,
width: props.object.width,
height: props.object.height,
rotation: props.object.rotation,
```

Konva interprets a node's `offset` as the pivot point in the node's
own coordinate system, and the node's `(x, y)` as where that pivot
is placed on the stage. So setting offset to (w/2, h/2) and position
to (object.x + w/2, object.y + h/2) places the rendered rectangle
exactly where it was, but with the pivot at its centre.

### 3.2 Transformer Math Changes

`onTransformEnd` in each canvas node currently reads `node.x()` and
`node.y()` directly and emits them. With centred offset, `node.x()`
returns the pivot's stage position, not the AABB top-left. Update
the math:

```typescript
function onTransformEnd(): void {
  const node = nodeRef.value?.getNode();
  if (!node) return;
  const sx = node.scaleX();
  const sy = node.scaleY();
  const newWidth = Math.max(8, node.width() * sx);
  const newHeight = Math.max(8, node.height() * sy);
  node.scaleX(1);
  node.scaleY(1);
  emit('transformend', {
    x: node.x() - newWidth / 2,
    y: node.y() - newHeight / 2,
    width: newWidth,
    height: newHeight,
    rotation: node.rotation(),
  });
}
```

The `- newWidth / 2` and `- newHeight / 2` un-offset the centre back
to the AABB top-left for storage.

### 3.3 Drag Math Changes

`onDragMove` and `onDragEnd` similarly read `t.x()` and `t.y()` —
which now return centre coordinates. Subtract half-dimensions before
emitting:

```typescript
function onDragEnd(event: { target?: { x?: () => number; y?: () => number } }): void {
  const t = event.target;
  if (!t?.x || !t?.y) return;
  emit('dragend', t.x() - props.object.width / 2, t.y() - props.object.height / 2);
}
```

### 3.4 Sidebar Slider — No Change Needed

`CommonProperties.vue:60–67`'s slider continues to patch only
`rotation`. With centred pivot rendering, the visual centre stays
fixed and the slider behaves identically to the canvas handle. No
extra x/y adjustment in the slider's `update()` call.

---

## 4. Edge Cases

### 4.1 Resize-Then-Rotate

A user resizes a box (changing `width`/`height`) and then rotates.
Pivot is `(width/2, height/2)` *of the new dimensions* — correct.
The pivot tracks size; rotating after a resize pivots around the
new centre, not the original.

### 4.2 Rotate-Then-Resize

Konva's transformer accumulates rotation and scale. When the user
rotates first then resizes a corner, the transformer adjusts both
rotation-pivot-relative coordinates and scale. The post-transform
emit returns the new AABB top-left in unrotated coordinates,
because `transformend` always converts back via the centre-offset
inverse. Same path, no special case.

### 4.3 Group Objects

`GroupObject` from designer-core has `x, y, width, height` describing
its own AABB; children store positions in canvas-space (current
behaviour). Group rendering applies the same centre-offset pattern.
Children inside a rotated group continue to render at their
canvas-space positions because the group's transform is a *render*
transform, not a coordinate-change.

(Confirm with a manual test once group editing is exercised — group
support is currently limited.)

### 4.4 Rotation = 0

When rotation is 0, the centre-offset still applies but is
visually a no-op. No conditional needed.

### 4.5 Snap to Stage Bounds

Existing snapping to canvas edges and other objects uses the
unrotated AABB top-left from the document. Unchanged. Visual
snapping during a rotated drag would need a rotated-AABB calculation
— deferred; rotated objects don't snap perfectly today, this
amendment doesn't make that worse.

---

## 5. Files Affected

```
src/components/canvas/
  TextNode.vue                offset + position; transformend / dragend math
  ShapeNode.vue               same
  ImageNode.vue               same
  BarcodeNode.vue             same
  GroupNode.vue (if exists)   same; verify children render path

src/components/canvas/SelectionTransformer.vue
                              no change expected — Konva Transformer
                              already rotates underlying node around its
                              own offset point, which is now centre

src/components/canvas/DesignCanvas.vue
                              owner of the patch handler at line 370.
                              Receives unrotated x/y from transformend
                              (post-fix); no change.

src/components/panels/CommonProperties.vue
                              no change — slider patches rotation only
```

No designer-core changes. No store changes. No schema changes.

---

## 6. Implementation Checklist

```
Canvas node renderers:
□ TextNode.vue: set offsetX/offsetY to half-dims; render position
  shifts by half-dims
□ TextNode.vue: onTransformEnd subtracts half newWidth/newHeight
  from node.x()/y() before emit
□ TextNode.vue: onDragMove/onDragEnd subtract half-dims from
  t.x()/t.y() before emit
□ ShapeNode.vue: same three changes
□ ImageNode.vue: same three changes
□ BarcodeNode.vue: same three changes
□ Verify autoHeight TextObject still handles missing height gracefully
  (offset uses computed render height, not stored height when
  autoHeight is true)

Verification:
□ Slider rotation visual centre stays put (manual test on each
  object type)
□ Canvas rotate-handle rotation visual centre stays put (regression
  check; should be unchanged)
□ x/y stored after rotate is the unrotated AABB top-left (read back
  via copy/paste or document inspection)
□ Drag a rotated object — final position matches the visual position
□ Resize a rotated object — final geometry matches the visual
  geometry
□ rotation = 0 still works (no visual displacement vs pre-amendment)
□ Multi-select rotation via transformer — visual centre of selection
  stays put

i18n:
□ No string changes
```

---

## 7. Tests

Canvas-renderer (`components/canvas/__tests__/`):
- TextNode places its underlying Konva node at
  `(object.x + width/2, object.y + height/2)` with offset (w/2, h/2)
- TextNode.onTransformEnd emits AABB top-left (un-offset from centre)
- TextNode.onDragEnd emits AABB top-left (un-offset from centre)
- Same expectations for ShapeNode, ImageNode, BarcodeNode

Slider rotation:
- Updating object.rotation through the store while pivot is centred
  produces no x/y change
- Visual position after rotation patches matches before, modulo
  rotation angle (pixel-comparison snapshot if the test infra
  supports it; otherwise compute expected centre and assert)

Round-trip:
- Set rotation to 45° via slider, save via share-encoder, reload —
  rotation and position match
- Set rotation via canvas handle to the same angle, save, reload —
  same x/y/width/height/rotation as the slider path

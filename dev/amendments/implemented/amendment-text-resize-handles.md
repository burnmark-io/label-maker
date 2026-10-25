# label-maker — Amendment: Text-Box Resize Handle Behaviour

> Drag the corner of a text box on the canvas. While dragging, the
> font visually scales with the box. Release the mouse — the font
> snaps back to its original size, leaving you with a bigger box and
> the same small text. The preview lies. That alone is a bug worth
> fixing, regardless of which "correct" final behaviour you pick.
>
> This amendment fixes the snap-back **and** introduces the
> universal corner-vs-edge convention from Figma / Illustrator /
> PowerPoint: corner handles scale the font with the box (intent =
> "make this bigger"), edge handles change box dimensions only
> (intent = "give the text more room").
>
> **Scope is text-box resize interaction.** Other object types
> (image, shape, barcode) keep their current resize semantics. No
> document schema changes; only handler logic and live-render
> behaviour change.
>
> Sibling concerns:
> - `amendment-rotation-pivot.md` (implemented) — established the
>   centre-pivot transform-end math this amendment builds on.
>   Already shipped, no longer a "if not yet" branch.
> - `designer-core-amendment-transactional-history.md` — independent.
>   The current resize emits once at transformEnd, so this
>   amendment doesn't change history-entry counts; transactional
>   history would still help drag-move which already over-emits,
>   but it's not a precondition for this work.
> - `amendment-text-overflow.md` (backlog, separate amendment) —
>   covers shrink-to-fit / auto-fit text. Orthogonal: that handles
>   "text doesn't fit in box, do something"; this handles "user
>   resized the box, what does that mean".

---

## 1. The Problem

Today's flow when a user drags a text-box corner handle:

1. `SelectionTransformer.vue` (Konva's Transformer) starts
   accumulating `scaleX` / `scaleY` on the underlying Konva.Text node.
2. While dragging, Konva renders the text with the accumulated scale
   — the visual font and dimensions both grow.
3. On release, `onTransformEnd` in `TextNode.vue:100–116` reads the
   final scale, computes `newWidth = node.width() * sx`, sets
   `scaleX(1)`, and emits a transform with the new width/height —
   **but never touches `fontSize`**.
4. The store updates `width` and `height` only. Font snaps back to
   its stored value because nothing changed it.

Users see the font visually scale through the entire drag, which
sets the expectation that release will commit that scaled font.
It doesn't. The lie.

Beyond the snap-back, the broader question: when a user resizes a
text box, what should happen to the font? Two valid intents:

- **"Make the whole thing bigger"** — corner-drag in every major
  design tool. Font should scale with the box.
- **"Give the text more room to wrap"** — edge-drag. Box gets wider
  or taller, font stays, text re-flows.

A single always-scale or always-don't-scale rule is wrong half the
time. The corner-vs-edge convention isn't a custom Burnmark choice;
it's the universal mental model from Figma, Illustrator, PowerPoint.
Adopt it.

---

## 2. Scope

In:
- TextObject corner handles: scale font proportionally with the box
  on drag commit.
- TextObject edge handles: change box dimensions only; font
  unchanged.
- Live render during drag matches commit behaviour — no more
  snap-back.
- Single-modifier override: holding `Shift` swaps the behaviour
  (corner+Shift = dimension-only; edge+Shift = proportional). Mirrors
  Figma. The modifier state is read at drag-end, not drag-start, so
  users can decide mid-drag.
- Apply the same corner-vs-edge split to text-only properties that
  scale alongside font: `letterSpacing`, `lineHeight` are absolute
  values that should scale on corner drag too.
- One history entry per drag (delegated to
  `designer-core-amendment-transactional-history.md`; this amendment
  notes the dependency).

Out:
- Image, shape, barcode resize behaviour. They already scale visually
  in a sensible way (image stretches per its `fit`, shape scales,
  barcode scales modules). This amendment doesn't touch them — but
  see `designer-core-amendment-burnmark-package-format.md` and
  `amendment-canvas-resize-and-first-print.md` for related per-object
  scaling concerns at the canvas level.
- A "Fit text to box" / "Shrink to fit" mode. That's
  `amendment-text-overflow.md`'s territory. Orthogonal — corner-drag
  here scales the font as a one-off; auto-fit-mode there ties font
  to the box size continuously.
- Free-aspect corner drag. Corner = always proportional (uniform
  scale). The edge handles are the way to break aspect ratio. Same
  as Figma and friends.
- A user setting to invert the corner/edge convention. The defaults
  are universal and don't need a preference.

---

## 3. The Fix

### 3.1 Identify the Handle Type

Konva's `Transformer` exposes the active anchor name during a
transform via `transformer.getActiveAnchor()`. Anchor names are
fixed: `top-left`, `top-right`, `bottom-left`, `bottom-right`,
`top-center`, `bottom-center`, `middle-left`, `middle-right`.

Corners: ends with `-left` AND starts with `top-/bottom-`, or
`-right` AND starts with `top-/bottom-`. (Equivalently: the four
that contain both an X and a Y position descriptor.)

Edges: contains exactly one of `top`, `bottom`, `middle-left`,
`middle-right`, etc.

```typescript
function isCornerHandle(anchorName: string): boolean {
  return (
    anchorName === 'top-left' ||
    anchorName === 'top-right' ||
    anchorName === 'bottom-left' ||
    anchorName === 'bottom-right'
  );
}
```

### 3.2 Track Drag Start State

On `transformstart`, capture the original geometry and font size on
the TextNode component. The active anchor name comes via a prop
plumbed from `SelectionTransformer.vue` rather than a stage
lookup — reaching across components with
`stage.findOne('Transformer')` works but couples this component
to the layer hierarchy. Cleaner is for the transformer to track
its own active anchor and pass it down.

```typescript
// SelectionTransformer.vue exposes the active anchor as a ref/prop.
// Konva fires `transformstart` on the Transformer; the handler
// reads transformer.getActiveAnchor() and stores it on a shared
// composable (useTransformContext or similar) that node components
// read.

let dragStartWidth = 0;
let dragStartHeight = 0;
let dragStartFontSize = 0;
let dragStartLetterSpacing = 0;
let dragStartLineHeight = 0;
let dragStartAnchor = '';

function onTransformStart(): void {
  const node = nodeRef.value?.getNode();
  if (!node) return;
  dragStartWidth = props.object.width;
  dragStartHeight = props.object.height;
  dragStartFontSize = props.object.fontSize;
  dragStartLetterSpacing = props.object.letterSpacing;
  dragStartLineHeight = props.object.lineHeight;
  dragStartAnchor = transformContext.activeAnchor.value;
}
```

### 3.3 Live Render — Match Commit Behaviour

The single most important rule: **`onTransform` and
`onTransformEnd` must read the same inputs and reach the same
decision.** If `onTransform` ignores Shift but `onTransformEnd`
respects it, we re-introduce the snap-back bug we're trying to
kill, just in a different shape (Shift+edge drag would show no
font scale during drag, then commit with one).

The decision both handlers need:

```typescript
function isProportional(): boolean {
  const corner = isCornerHandle(dragStartAnchor);
  return corner !== shiftKey.value;   // shift inverts
}
```

Read `shiftKey.value` (the reactive ref from `useShiftKey`)
inside both `onTransform` and `onTransformEnd`. The result
flips live as the user holds/releases Shift mid-drag.

**Corner uniform-scale enforcement.** Konva's transformer has
`keepRatio: false` (`SelectionTransformer.vue:37`). For corner
handles, we want uniform scale regardless. Rather than toggling
`keepRatio` per anchor (Konva applies it to corners only when
`true`, but flipping mid-session gets ugly), enforce uniformity
in our own code: compute `scale = min(sx, sy)` and apply it to
both axes.

```typescript
function onTransform(): void {
  const node = nodeRef.value?.getNode();
  if (!node) return;

  const sx = node.scaleX();
  const sy = node.scaleY();
  const proportional = isProportional();
  const corner = isCornerHandle(dragStartAnchor);

  // Reset scale immediately so Konva text renders by layout,
  // not by visual scaling. Smoke-test note in §3.7.
  node.scaleX(1);
  node.scaleY(1);

  let newWidth: number;
  let newHeight: number;

  if (corner && proportional) {
    // Corner + proportional: uniform scale on both axes,
    // font scales live.
    const s = Math.min(sx, sy);
    newWidth = Math.max(8, dragStartWidth * s);
    newHeight = Math.max(8, dragStartHeight * s);
    node.fontSize(Math.max(4, dragStartFontSize * s));
  } else if (corner && !proportional) {
    // Corner + Shift: corner becomes free-aspect dimension-only;
    // both axes change, font stays.
    newWidth = Math.max(8, dragStartWidth * sx);
    newHeight = Math.max(8, dragStartHeight * sy);
  } else if (!corner && proportional) {
    // Edge + Shift: edge becomes proportional. Use the active
    // axis's scale and apply uniformly.
    const isHorizontalEdge =
      dragStartAnchor === 'middle-left' || dragStartAnchor === 'middle-right';
    const s = isHorizontalEdge ? sx : sy;
    newWidth = Math.max(8, dragStartWidth * s);
    newHeight = Math.max(8, dragStartHeight * s);
    node.fontSize(Math.max(4, dragStartFontSize * s));
  } else {
    // Edge default: dimension-only on the active axis.
    newWidth = Math.max(8, dragStartWidth * sx);
    newHeight = Math.max(8, dragStartHeight * sy);
  }

  node.width(newWidth);
  // Don't fight autoHeight — let Konva measure when the object
  // is in autoHeight mode. See §4.1.
  if (!props.object.autoHeight) {
    node.height(newHeight);
  }
}
```

Now the live render matches what will commit:
- Corner drag: box and font scale together, uniformly.
- Corner+Shift: box scales (free aspect), font stays.
- Edge drag: box grows on the active axis, font stays.
- Edge+Shift: box and font scale proportionally on the active axis.

### 3.4 boundBoxFunc Alternative (Considered, Rejected)

Konva's transformer accepts a `boundBoxFunc` that intercepts
each tick to clamp/transform the new bounding box. It's a
cleaner-feeling place to enforce uniform scaling on corners.
Rejected because:
- The decision depends on Shift state, which `boundBoxFunc`
  has no clean way to read.
- Font scaling needs to mutate the node directly, which
  `boundBoxFunc` doesn't do — we'd still need an `onTransform`
  listener for that.
- One handler in one place is easier to reason about than a
  bound-box clamp + a scale mutator + a final commit.

### 3.5 Commit on transformEnd

`onTransformEnd` reads the same `isProportional()` decision.
The node's current width/height already reflect what the live
render committed (we mutated them in `onTransform`), so commit
just reads them out.

```typescript
function onTransformEnd(): void {
  const node = nodeRef.value?.getNode();
  if (!node) return;

  const proportional = isProportional();
  const newWidth = node.width();
  const newHeight = props.object.autoHeight ? props.object.height : node.height();

  let patch: Partial<TextObject> = {
    x: node.x() - newWidth / 2,                // centre-pivot per
    y: node.y() - newHeight / 2,                //   amendment-rotation-pivot.md
    width: newWidth,
    rotation: node.rotation(),
  };
  if (!props.object.autoHeight) {
    patch.height = newHeight;
  }

  if (proportional) {
    // Use the live-rendered fontSize directly — onTransform
    // already enforced uniform scale and the minimum clamp.
    patch.fontSize = node.fontSize();
    const fontScale = patch.fontSize / dragStartFontSize;
    patch.letterSpacing = Math.max(0, dragStartLetterSpacing * fontScale);
    // lineHeight is a ratio on fontSize, not an absolute distance —
    // leave it alone; effective line gap scales naturally with fontSize.
  }

  emit('transformend', patch);
}
```

`letterSpacing` clamps at 0 to avoid absurdly negative values
on aggressive shrink.

### 3.6 Shift Modifier

Read window-level shift state at transform-end via a plain `keydown`
listener that flips a flag:

```typescript
let shiftHeld = false;
window.addEventListener('keydown', e => { if (e.key === 'Shift') shiftHeld = true; });
window.addEventListener('keyup', e => { if (e.key === 'Shift') shiftHeld = false; });

function isShiftPressed(): boolean { return shiftHeld; }
```

Listener lifecycle managed in a small composable
(`composables/useShiftKey.ts`) so we don't double-register across
components. Exposes a reactive ref so `onTransform` and
`onTransformEnd` both react to live changes.

### 3.7 Minimum Font Size and letterSpacing

Clamp post-scale `fontSize` to ≥4 dots (well below any useful
value but above zero) — applied in both live render and commit.
Clamp `letterSpacing` to ≥0 so aggressive shrink can't drive
inter-character spacing into nonsense negative values.

### 3.8 Mutating Scale Mid-Transform — Smoke Test Required

The `node.scaleX(1); node.scaleY(1)` pattern inside `onTransform`
is documented in Konva examples and works, but it does mutate
state that Konva's Transformer is also reading from on the same
tick. Race-prone in theory; reliable in every Konva sample using
this approach.

Verify before committing:
- Drag a corner slowly across many ticks — does the bounding
  box snap or jitter?
- Drag a corner aggressively in/out — does the resulting size
  match the visual?
- Drag a corner past the minimum (8) and back out — does the
  clamp behave?

If issues surface, the fallback is to keep scale on the node
during `onTransform` (no live width/height mutation) and apply
the dimensional commit only at `onTransformEnd`. The trade-off:
font visually scales with Konva's default behaviour during
edge drags too, which would re-introduce the snap-back. Worth
flagging if needed.

---

## 4. Edge Cases

### 4.1 autoHeight Text

If `object.autoHeight === true`, height is derived from text
content at render time, not stored. Two implications:

**Live render (§3.3):** Don't call `node.height(newHeight)` —
Konva re-derives height from content; setting it explicitly
fights the autoHeight path and pingpongs. The code branches on
`props.object.autoHeight` and skips the height set.

**Commit (§3.5):** Don't include `height` in the patch — let
the autoHeight render pipeline compute it from the new
fontSize/width on next render. The patch reads `props.object.height`
into the un-offset math (rather than `node.height()`) because
the rendered Konva height may not match the stored height yet.

**Transformer anchors:** Edge-handle vertical drags don't make
sense on autoHeight text (height is derived). Restrict
`enabledAnchors` to the four corners +
`middle-left`/`middle-right` only via per-object transformer
config. Corner drag in autoHeight mode scales width and font;
height re-derives from the new font + new wrap width.

### 4.2 wrap = false Text

When `wrap` is false, Konva renders text on a single line. Box
height is a hint, not a constraint. Edge drag still works (box
grows / shrinks), font stays; corner drag scales font.

### 4.3 Rotated Text

`amendment-rotation-pivot.md` (implemented) established the
centre-pivot convention. The commit math (`node.x() - newWidth / 2`)
assumes that.

### 4.4 Multi-Selection (Mixed Types)

A multi-selection containing a mix of text and non-text objects
gets the same Konva transformer wrapping the group. The text-
specific live override here only fires on `TextNode.onTransform`;
other types' nodes use Konva's default scale-based transform.

Smoke test the mixed case: select one text + one image, corner-
drag. Expected behaviour: image scales visually as Konva does
its scale thing; text scales font + dimensions per this
amendment's logic. Both commit correctly at transform-end. If
the group transformer math from `amendment-multi-select-fixes.md`
hasn't shipped, individual objects may anchor to their own
centres rather than the group centre — pre-existing behaviour,
not introduced here.

### 4.5 Tiny Boxes

A drag that produces width or height less than the per-axis minimum
(8 dots) clamps to the minimum. Font scale in that case uses the
*visual* (clamped) dimensions, not the unclamped target — so a user
shrinking aggressively doesn't drive the font below the 4-dot
minimum.

### 4.6 Zoom Level

Drag commit math uses object-space coordinates (post-scale-reset),
so zoom level doesn't affect font scaling. Verified by Konva's
default behaviour.

---

## 5. Files Affected

The patch shape emitted by `transformend` widens to include
`fontSize` and `letterSpacing`. Every component along the emit
chain needs its TypeScript types and forwarding code updated —
**this is not just a TextNode change.**

```
src/components/canvas/
  TextNode.vue                handler rewrite per §3 —
                              onTransformStart capture, onTransform
                              live override, onTransformEnd commit
                              math; emit signature widens
  CanvasObject.vue            line ~70/82: emit type widens to
                              include optional fontSize and
                              letterSpacing on the transformend
                              patch; forward unchanged to parent
  DesignCanvas.vue            line ~370 (onObjectTransformEnd): the
                              update built from the patch must
                              include the new optional fields when
                              present, so they flow into
                              designer.updateObject
  SelectionTransformer.vue    track active anchor on transformstart
                              and expose via shared composable;
                              accept enabledAnchors override
                              (corners + horizontal edges only when
                              the selected text object has autoHeight)

src/composables/
  useShiftKey.ts              new — small composable, single window
                              keydown/keyup listener, exports a
                              reactive ref<boolean>
  useTransformContext.ts      new (or extend the one from
                              amendment-multi-select-fixes.md if it
                              ships first) — exposes
                              activeAnchor: Ref<string> set by
                              SelectionTransformer on transformstart
                              and read by node components
```

No store changes. No designer-core changes. No schema changes.
The `fontSize`/`letterSpacing` fields already exist on
`TextObject`; this amendment just widens the patch shape that
carries them through the emit chain.

---

## 6. Dependency Order

- `amendment-rotation-pivot.md` — **already implemented** (commit
  3339561). The centre-pivot math is in place; the un-offset
  formulas in §3.5 land on top of it directly.
- `designer-core-amendment-transactional-history.md` —
  **independent.** The current resize emits exactly once at
  `transformEnd`, so adding `fontSize` to the same emit doesn't
  multiply history entries. Transactional history would still
  benefit drag-move (which over-emits) and slider scrubbing, but
  is not a precondition for this amendment.

---

## 7. Implementation Checklist

```
Composables:
□ src/composables/useShiftKey.ts — reactive ref<boolean> set by
  window keydown/keyup; single shared instance
□ src/composables/useTransformContext.ts — reactive
  activeAnchor: Ref<string>, set by SelectionTransformer on
  transformstart, read by node components

Transformer setup:
□ SelectionTransformer captures activeAnchor via
  transformer.getActiveAnchor() on transformstart and writes to
  useTransformContext
□ Per-object enabledAnchors override when the selected single
  object is a TextObject with autoHeight=true → corners +
  middle-left + middle-right only

Emit chain (signature widens):
□ TextNode emits transformend with patch that may include
  fontSize and letterSpacing (Partial<TextObject>)
□ CanvasObject.vue line ~70/82: widen the emit type to allow
  the new optional fields; forward through unchanged
□ DesignCanvas.vue line ~370 onObjectTransformEnd: forward the
  optional fields into designer.updateObject when present

TextNode handler rewrite:
□ Track dragStartWidth/Height/FontSize/LetterSpacing/LineHeight
  + dragStartAnchor on transformstart
□ onTransform: reset scaleX/Y to 1, compute dimensions per the
  four-branch decision (corner+proportional, corner+shift,
  edge+proportional, edge+default); set width always, height
  only when !autoHeight; mutate node.fontSize live in
  proportional branches
□ onTransformEnd: read same isProportional() decision; build
  patch from the live-rendered node state; include height only
  when !autoHeight
□ Clamp fontSize to ≥4 (live and commit); letterSpacing to ≥0

Verification:
□ Edge drag: box grows, font stays, text re-wraps. Live and
  commit match.
□ Corner drag: box and font scale together uniformly. Live and
  commit match. (Confirm uniform-scale enforcement against
  keepRatio: false.)
□ Corner+Shift held throughout: box scales free-aspect, font stays.
□ Corner+Shift toggled mid-drag: live render flips between
  proportional and dimension-only as Shift is held/released.
□ Edge+Shift: active axis scales proportionally on both axes,
  font scales with it.
□ autoHeight text: only corner + horizontal-edge handles
  available; corner drag scales font and width, height
  re-derives; height not in commit patch.
□ Aggressive shrink: fontSize clamps at 4, letterSpacing at 0.
□ Mixed selection (text + image) corner drag: text scales per
  this amendment, image scales per existing default — both
  commit cleanly.
□ Smoke test §3.8: scale-reset-mid-transform doesn't snap or
  jitter on slow drags or aggressive in/out drags.

i18n:
□ No string changes (interaction-only)
```

---

## 8. Tests

TextNode handlers (`components/canvas/__tests__/TextNode.test.ts`):
- `onTransformStart` captures width, height, fontSize,
  letterSpacing, lineHeight, anchorName
- Corner-drag commit: width and height scaled uniformly by
  `min(sx, sy)`, fontSize scaled by the same factor,
  letterSpacing scaled likewise
- Corner-drag commit: when sx and sy differ (hypothetical),
  uniform scale is enforced (not free-aspect)
- Edge-drag commit: width or height changed on active axis
  only, fontSize unchanged, letterSpacing unchanged
- Shift+corner: behaves like edge — both axes scale by their
  own sx/sy, font stays
- Shift+edge: behaves like corner — uniform scale applied,
  font scales with it
- Live render and commit produce the same fontSize value (no
  snap-back) for every combination of corner/edge × shift/no-shift
- Shift toggled mid-drag flips proportional state on the next tick
- fontSize clamp at 4 dots; letterSpacing clamp at 0
- autoHeight=true: enabledAnchors excludes top-center and
  bottom-center; corner drag scales width and font but height
  is not in the commit patch
- Mixed selection: text and image both selected; text emits
  per this amendment, image emits per existing default

Emit chain types
(`components/canvas/__tests__/CanvasObject.test.ts`,
`components/canvas/__tests__/DesignCanvas.test.ts`):
- transformend patch with fontSize / letterSpacing flows
  through CanvasObject's emit unchanged
- DesignCanvas.onObjectTransformEnd builds a designer.updateObject
  call that includes fontSize / letterSpacing when present in
  the patch

Live-render parity (manual or e2e):
- Drag a corner halfway, mid-drag font visible matches the
  font that commits on release
- Drag an edge halfway, font visually unchanged through the
  whole drag
- Hold Shift mid corner-drag: live font scaling stops; release
  commits at the un-scaled font
- Smoke test: slow corner drag doesn't snap; aggressive
  in/out doesn't jitter (validates §3.8)

useShiftKey:
- Single instance across multiple component mounts
- Reads `true` while shift held, `false` otherwise
- Reactive: a watcher on the ref fires on press/release
- Cleans up listeners on app teardown

useTransformContext:
- activeAnchor written by transformstart is observable from
  consuming node components

---

## 9. Implementation Postmortem

Spec was correct on the *what*; the *how* hit several Konva quirks
that aren't covered in §3. Captured here so the next person to touch
resize behaviour doesn't have to rediscover them.

### 9.1 keepRatio default — we'd flipped it the wrong way

`SelectionTransformer.vue` had `keepRatio: false` from before this
amendment. Konva's default is **true**. With it true, corners scale
uniformly natively, *and* Konva auto-toggles to free-aspect when
Shift is held — exactly our amendment's convention. Setting
`keepRatio: true` removed an entire branch of "compute uniform
scale ourselves" code and made the proportional pivot stay pinned
without any explicit math.

**Lesson:** check Konva attribute defaults before writing
compensating logic. We had the right behaviour available natively.

### 9.2 `node.scaleX()` after a reset is incremental, not absolute

Spec §3.3 wrote `dragStartWidth * sx` for live width. That's wrong
because after `node.scaleX(1)` each tick, Konva computes the next
tick's `scaleX` relative to the *current* node state — the scale
needed to go from current width to target width, not from drag-start
to target. Using `dragStart * sx` made the box oscillate near
`dragStart` and explode on release.

Two equivalent fixes:
- `node.width() * sx` (canonical Konva pattern shown in their
  docs).
- Track `cumulativeScaleX` by multiplying each tick's reported
  scale, derive width from `dragStart * cumulative`.

We used the cumulative approach because it composes cleanly with
the four-branch mode-toggle logic and the floor-clamping rules.

### 9.3 `flipEnabled: false` doesn't stop anchor re-targeting

`flipEnabled: false` prevents the visual flip (no negative scale
rendered), but Konva *still* re-targets the active anchor when the
pointer crosses the pivot. Once that happens it starts reporting
"growth" relative to the new anchor, our cumulative grew the wrong
way, and the box "danced" upward past the pivot.

Fix: read `transformer.getActiveAnchor()` every tick. If it differs
from `dragStartAnchor`, the user has crossed the pivot — peg
cumulative at the floor and skip Konva's scale signal for the rest
of the drag in that direction.

### 9.4 Per-axis floors desync the cumulatives

`MIN_DIM / dragStartWidth` and `MIN_DIM / dragStartHeight` differ
when the box isn't square. Clamping each axis at its own floor lets
one axis hit floor while the other keeps shrinking; the cumulatives
diverge, recovery on the way back uses the wider axis's "wasted"
cumulative and ends up smaller than the user's pre-floor scale.

Fix: in proportional mode, share a single floor —
`max(minScaleX, minScaleY)` — for both axes. They clamp together,
stay locked at the limiting axis's floor, recover together. In
free-aspect mode (Shift+corner), keep independent floors.

### 9.5 Anchor-swap peg must be active-axis-only on edges

First implementation pegged both `cumulativeScaleX` and
`cumulativeScaleY` to their floors on swap. For corner drags
that's correct (both axes are active). For edge drags only one
axis is active — the other stays at 1 throughout. Pegging the
inactive axis's cumulative to its floor collapsed the inactive
dimension to MIN_DIM (the "10×10 square" bug when dragging
bottom-center past the top).

Fix: branch on whether the active anchor is a corner or an edge.
Edge swap pegs only the relevant axis.

### 9.6 Konva can spike a single huge per-tick scale post un-swap

Right after the anchor un-swaps (user drags back across the
pivot), Konva's internal anchor reference is stale relative to our
floor-state mutations and it can report a one-tick `scaleX` signal
in the dozens. Cumulative *= that → font went to 1000+ pt on
recovery.

Fix: clamp per-tick scale to `[0.1, 10]` defensively. 10× per-tick
is plenty for any real drag. Plus a sanity ceiling on cumulative
(50×) so even compounded weirdness can't run away.

### 9.7 autoHeight + corner drag needs explicit pivot math

For autoHeight text Konva positions `node.y` based on its
*anticipated* height (`dragStart * scale`), but the actual rendered
height is auto-derived from font/width and differs. Pivot drifts
on Y if we use Konva's positioning.

Fix: capture `pivotWorldX/Y` at transformstart (rotation-aware,
using `localPivotOffset` for the anchor-opposite point), and
override `node.x/node.y` every tick from `pivot - rotate(off)`.
The override is unconditional in the final code — same math is
correct for the cases Konva would have handled too, so simpler to
always override than to branch.

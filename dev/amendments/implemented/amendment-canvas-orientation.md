# label-maker — Amendment: Canvas Orientation (Vertical / Horizontal)

> Spun out of `amendment-canvas-sizing.md` §4. Orientation is the only
> piece in the original sizing amendment that requires designer-core
> changes — keeping it separate lets canvas-sizing ship as pure
> label-maker work and orientation lands once
> `designer-core-amendment-canvas-orientation.md` is published.
>
> Sibling: `designer-core-amendment-canvas-orientation.md` (the
> `orientation` field on `CanvasConfig`).

---

## 1. The Issue

A 12mm D1 tape label is 12mm tall and however long the user wants it.
In the default vertical orientation (feed direction = down), the
canvas is 12mm wide and very tall — a thin vertical strip. Awkward
to design on.

Rotating to horizontal makes it 12mm tall and however wide — a
natural ribbon that reads left to right. Much better for tape labels.

Conversely, a 62mm Brother QL label is naturally vertical — 62mm wide
and growing downward. Horizontal would make it 62mm tall and growing
rightward, which is unusual.

---

## 2. Orientation Control

A toggle near the canvas (or in the media selector from
`amendment-canvas-sizing.md`):

```
Orientation: [↕ Vertical] [↔ Horizontal]
```

Or a rotate button: 🔄 that swaps the displayed axes.

**For fixed-size labels (die-cut)**, the displayed frame swaps:
- 29×90mm vertical → looks 90×29mm on screen in horizontal

**For continuous labels**, this changes the feed/growth direction:
- Vertical: fixed width, grows downward (default for QL, LabelWriter)
- Horizontal: fixed height, grows rightward (default for D1 tape)

In both cases the underlying document is unchanged (see §4).

---

## 3. Smart Default

When the user selects a media size, auto-pick the most sensible
orientation:

```typescript
function defaultOrientation(media: MediaDescriptor): 'vertical' | 'horizontal' {
  if (!media.heightMm) {
    // Continuous — decide by across-roll width.
    // Narrow tape (≤19mm) → horizontal (it's a ribbon)
    // Wide roll (>19mm) → vertical (it's a label)
    return media.widthMm <= 19 ? 'horizontal' : 'vertical';
  }
  // Die-cut — taller than wide = vertical, wider than tall = horizontal
  return media.heightMm >= media.widthMm ? 'vertical' : 'horizontal';
}
```

The 19mm breakpoint: D1 tapes are 6/9/12/19mm — all ribbon-like,
naturally horizontal. Brother QL starts at 29mm — naturally vertical.
The breakpoint sits between the two worlds.

The user can always override. The smart default just saves a click for
the common case.

---

## 4. What Orientation Actually Does

Orientation is a **display-frame swap from the user's perspective**,
not a rotation of the design. Toggling vertical ↔ horizontal swaps
which axis is shown as horizontal vs vertical *on screen*. The
underlying document is unchanged: `widthDots` is always across-feed,
`heightDots` is always along-feed. Objects keep their absolute
coordinates. Text always reads upright.

The user is choosing how much horizontal vs vertical room they have
to work with — not rotating the artwork.

Consequences:

- The feed direction indicator updates (arrow points right for
  horizontal, down for vertical).
- The cut line and its drag handle (continuous labels, see
  `amendment-canvas-sizing.md` §3.3) move to the growth edge — bottom
  for vertical, right for horizontal.
- Objects that fall outside the visible frame after the toggle light
  up via `amendment-canvas-sizing.md` §7.5 (out-of-bounds shading +
  toast). The user drags them back; we don't auto-relocate.

This is the same operation as a manual canvas resize from the user's
perspective — same toast, same out-of-bounds handling, same lack of
surprises.

---

## 5. Print Behaviour (D47)

Orientation is design-time. The renderer in `@burnmark-io/designer-core`
produces a bitmap at the canvas dimensions in render-axis. **Drivers
are responsible for accepting an arbitrary-dimension bitmap and
rotating it to their physical feed direction** when
`canvas.orientation === 'horizontal'`.

This contract is recorded in `DECISIONS.md` D47. If a registered
driver doesn't currently rotate, we either patch the driver or insert
a rotation step in label-maker's print pipeline before sending — to
be decided per driver during the verification step in §7.

---

## 6. State + Persistence

### 6.1 Editor state

`orientation: 'vertical' | 'horizontal'` is added to label-maker's
canvas store, mirroring `CanvasConfig.orientation` from designer-core.
Writes flow to designer-core via `setOrientation()`.

```typescript
interface CanvasState {
  // existing — see amendment-canvas-sizing.md §6.1
  widthMm: number;
  heightMm: number | null;
  source: 'detected' | 'manual' | 'sheet' | 'custom';
  sheetCode?: string;

  // new
  orientation: 'vertical' | 'horizontal';
}
```

Persistence in localStorage: last orientation per session, alongside
the last media size from `amendment-canvas-sizing.md`.

### 6.2 Share-encoder

The encoder must round-trip `canvas.orientation`. Old documents
without the field default to `'vertical'` (handled in designer-core's
`mergeCanvas`). No version bump required as long as the on-the-wire
shape stays a strict superset of the previous one.

### 6.3 Sample document

`src/services/sample-label.ts` and the IndexedDB seed: set
`orientation: 'vertical'` explicitly on the sample document for
documentation value. Don't rely on the backfill.

---

## 7. Driver / Print Pipeline Audit

**Resolved — trust the 0.3.0 drivers.** All three families
(`brother-ql`, `labelmanager`, `labelwriter`) ship `pickRotation` +
`ROTATE_DIRECTION` in 0.3.0 (per `UPDATE_DEPENDENCIES.md` §3.2 / §6.4).
label-maker pre-swaps the bitmap axes when
`canvas.orientation === 'horizontal'` and passes `rotate: 'auto'`;
the driver's `pickRotation` consults `media.defaultOrientation`
(contracts ≥0.2.0) to land on the correct angle for each family.
Implemented in `src/stores/printer.ts` and recorded under D47 in
`DECISIONS.md`. No per-driver patch needed.

---

## 8. Implementation Checklist

```
Depends on:
□ designer-core-amendment-canvas-orientation.md shipped
  (CanvasConfig.orientation field exists)
□ Bumped @burnmark-io/designer-core dep in label-maker

State + persistence:
□ Add `orientation` to label-maker canvas store
□ Wire to designer-core via setOrientation()
□ Share-encoder: round-trip the field
□ localStorage: persist last orientation alongside last media size
□ Sample document: explicit `orientation: 'vertical'`

UI:
□ Orientation toggle component (in media selector or near canvas)
□ Smart default on media selection (≤19mm continuous → horizontal,
  die-cut wider-than-tall → horizontal, otherwise vertical)
□ Feed direction indicator updates with orientation
□ Cut-line + drag handle move to growth edge per orientation

Out-of-bounds on toggle:
□ Toggle uses the same code path as manual resize
□ Out-of-bounds objects: §7.5 of amendment-canvas-sizing.md applies

Driver audit (D47):
□ Audit each driver in src/lib/printer/registry.ts
□ Patch the driver or pipeline-rotate per driver
□ Record per-driver decision under DECISIONS.md D47

i18n:
□ Orientation labels (Vertical / Horizontal)
□ Toggle button copy
□ Smart-default toast (if any)
```

---

## 9. Out of Scope

- **Rotated rendering in designer-core.** Render is orientation-
  agnostic. See `designer-core-amendment-canvas-orientation.md` §3.
- **Per-object orientation.** Objects keep absolute coordinates in
  the render-axis frame.
- **Auto-detect orientation from connected printer.** Smart default
  uses the chosen media's intrinsic geometry. We don't ask the
  printer about orientation.
- **Auto-grow continuous labels.** See
  `amendment-tables-and-autogrow.md`.

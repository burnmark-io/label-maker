# label-maker — Amendment: Canvas Resize Behaviour and First-Print Friction

> Two related new-user pain points sharing one mechanism. Today, switching
> label sizes during design is "infuriating" — content stays put while
> the canvas changes, so objects fall off the edge. And a first-time
> user who connects a printer and clicks the big orange Print button
> hits a "no media selected" error, with no guidance on where the size
> picker even lives. When they finally find it and pick the printer's
> size, the design they were building gets clipped.
>
> This amendment makes canvas resize behave like a layout, not a clip;
> auto-adopts the printer's detected media on first connect; tailors
> the welcome content to the connected printer family; and stops the
> Print button from dead-ending users who never knew they had to pick
> a size.
>
> **Scope is purely UX flow + light schema.** Designer-core grows one
> optional field on `BaseObject` (`resizeBehavior`); everything else is
> label-maker store and component work. No new file format support,
> no new printer integrations, no margins on the canvas, no styled-text
> runs. Those are noted as adjacent future work and parked.
>
> Sibling amendments:
> - `amendment-canvas-sizing.md` (implemented) — established the media
>   selector, `source` field, auto-adopt-when-`source === 'detected'`
>   watcher, and out-of-bounds visual treatment. This amendment builds
>   on those primitives.
> - `amendment-canvas-orientation.md` (backlog) — orientation is
>   display-only via `getRenderDoc()`; resize logic ignores orientation
>   toggles entirely.
> - `amendment-text-overflow.md` (backlog) — text auto-shrink is
>   orthogonal: the `keep-size` default here means font size is held
>   constant on canvas resize, regardless of which fit mode the text
>   amendment lands.
>
> File format compatibility note: both DYMO and Brother LBX store font
> size, barcode module width, and shape stroke width as absolute units
> and have per-object fit-mode enums (`<TextFitMode>`, `<text:textStyle
> control>`). The defaults in §4 align with that — text and barcodes
> keep size, shapes/images scale — so future format import/export
> round-trips cleanly.

---

## 1. The Problem

Three sharp edges, all hit by the same fresh-from-the-tour user:

**(a) Print dead-ends on first try.** The user clicks the orange Print
button after connecting their printer and sees "no media selected"
(`PrinterPopover.vue:29` references `printer.noMediaDetected`; the print
flow refuses without `effectiveMedia`). They didn't know media selection
was a step. Nothing in the UI told them. The single most prominent
action in the app errors out on the first try.

**(b) Picking the printer's size after-the-fact destroys the design.**
They eventually find `LabelSizeSelector`, pick the printer's media, and
their content gets clipped because the canvas shrank under it. The
out-of-bounds treatment (toast + striped overlay from
`amendment-canvas-sizing.md` §7) tells them what's wrong but doesn't
fix it. They have to drag every object back manually.

**(c) Mid-design size switching is "infuriating."** Even past the
first-print barrier, switching label sizes during design has the same
problem — content stays at absolute coordinates while the canvas
changes around it. There's no scale-with-canvas behaviour, no fit-to-label
action, no obvious "make this work on the new size" path.

The current resize policy is "allow, warn, clip" (§7.5 of the canvas-sizing
amendment). That policy is right for *unintentional* overflow ("I dragged
this past the edge"). It's wrong for the *systemic* overflow that happens
every time the canvas changes size.

---

## 2. Scope

In:
- Per-object `resizeBehavior` field on `BaseObject` (designer-core).
- Resize logic that reflows content when canvas dimensions change:
  position rescaled proportionally always, size rescaled per object's
  `resizeBehavior`, edge-anchored shapes recompute inset to new edges.
- Canvas-resize feedback banner — two modes (overflow, auto-adopt
  confirmation).
- `fitContentToCanvas()` action behind the overflow banner button.
- Auto-adopt detected media broadens to also fire on first connect with
  an untouched canvas, even when `source !== 'detected'`.
- Print button guard — if a printer is connected, the print flow
  assumes the printer's detected media instead of erroring.
- Two welcome templates (tape vs die-cut) selected by printer family
  at instantiation; pre-printer fallback = die-cut at default size.

Out (parked):
- Per-object `resizeBehavior` UI override (right-click menu). v2.
- Format import/export — DYMO `.label`/`.dymo`, Brother `.lbx`. The
  `resizeBehavior` field is *prepared* for these formats' fit-mode
  enums but no parser/writer ships in this amendment.
- Canvas margins (Brother LBX `marginLeft/Top/Right/Bottom`).
- Multi-run styled text within a single TextObject.
- Auto-scale-content-up offer when the canvas grows. Relative
  repositioning already gives "more room"; an explicit scale action
  is overkill and was dropped from the banner design.
- Modal asking "scale content with canvas?" — replaced by
  per-object behaviour driving sensible defaults.

---

## 3. Auto-Adopt on Connect

### 3.1 The Current Watcher

`stores/media.ts:354–369` already watches `printer.detectedMedia` and
calls `pickDetected()` when:
- The detected media is non-null,
- AND `source === 'detected'`,
- AND the dimensions actually differ from what's already on the canvas.

This handles the case where the user has never touched the size selector
(`source === 'detected'` from `applyLastUsedOrDefault()` at line 327 or
339). It does NOT fire when:
- The user has explicitly picked a size (`source === 'manual' | 'sheet'
  | 'custom'`) — correctly suppressed; detection is a suggestion.
- The user landed on a non-default size via the loaded last-used value
  with `source: 'detected'` but then started designing on it — also
  correctly suppressed because the resulting state has them happy with
  what they have.

The gap: a fresh user, **canvas untouched, with `source === 'manual'`
because they picked something once before**, connects a printer. We
suppress the auto-adopt to respect their pick — but in this case they
haven't actually started designing, and the previous pick was probably
not meaningful. They click Print → error.

### 3.2 The Refined Rule

Auto-adopt fires when *both* are true:

1. `printer.detectedMedia` is non-null and differs from the canvas, AND
2. The canvas is **untouched** — interpreted as: `designer.canUndo === false`
   AND no objects exist that the user authored. Demo content counts as
   untouched (it was placed by us, not by them).

Rule (2) replaces "`source === 'detected'`" as the gating condition.
The watcher in `stores/media.ts` updates accordingly.

How "untouched" is detected:
- `designer.canUndo` reflects whether any history-producing action has
  fired since the last `clearHistory()`. The first-visit sample loads
  via `loadFirstVisitDocument()` then calls `designer.clearHistory()`
  in `AppShell.vue:222` — so demo content has `canUndo === false`.
- Once the user does anything (move, edit, add), `canUndo` flips to
  true and stays true until `clearHistory()` is called again. From
  that point on, auto-adopt is suppressed and we surface the connect
  banner instead (§5).

### 3.3 First-Connect Banner When Touched

When the user has been designing (canvas touched) and a printer connects
with detected media that differs from the current canvas, we don't
silently swap their work. Instead we show the **auto-adopt confirmation
banner** (§5):

```
Detected 62mm continuous on QL-820NWB.   [Use this size]   ✕
```

Click `[Use this size]` → applies `pickDetected(media)`. Their existing
content goes through the resize pipeline (§4) and the fit-to-label
banner (§5) follows up if anything overflowed.

Dismiss → keeps their current size, the printer is connected but the
canvas stays. No further nag — until they hit Print, where the print
guard (§7) prompts them.

---

## 4. Per-Object Resize Behaviour

### 4.1 New Field

```typescript
// designer-core/packages/core/src/objects.ts
export type ResizeBehavior =
  | 'scale-with-canvas'  // position AND size scale proportionally
  | 'keep-size'          // position scales, size unchanged
  | 'anchor-to-edges';   // recompute inset to new canvas edges

export interface BaseObject {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  name?: string;
  color: string;
  resizeBehavior?: ResizeBehavior;  // new — defaulted at resize time
}
```

The field is **optional on the schema** but **defaulted at resize time**
based on object type if absent. This keeps existing documents
forward-compatible (no migration needed) and makes the v2 per-object
override a small UI addition without a schema change.

### 4.2 Default by Type

| Object type | Default `resizeBehavior` | Reasoning |
|---|---|---|
| `text` | `keep-size` | Font size is intentional. DYMO/Brother store font as absolute pt. |
| `barcode` | `keep-size` | Module width is scanner-critical; both formats store it absolute. |
| `image` | `scale-with-canvas` | Images cramped at edges look worse than slightly resized. |
| `shape` (general) | `scale-with-canvas` | Decorative bars, accents — proportional to layout. |
| `shape` (canvas-spanning, see §4.3) | `anchor-to-edges` | A frame should stay a frame at any size. |
| `group` | inherit per-child | The group container has no intrinsic geometry to scale. |

The defaulting happens in a single helper:

```typescript
// label-maker/src/services/resize-behavior.ts (new)
export function defaultResizeBehavior(o: LabelObject, canvas: { widthDots; heightDots }): ResizeBehavior {
  if (o.resizeBehavior) return o.resizeBehavior;
  if (o.type === 'text' || o.type === 'barcode') return 'keep-size';
  if (o.type === 'shape' && isCanvasSpanning(o, canvas)) return 'anchor-to-edges';
  return 'scale-with-canvas';
}
```

### 4.3 Edge-Anchor Detection

A shape qualifies as canvas-spanning (and therefore edge-anchored) when:

- It's a rectangle or ellipse (lines never anchor).
- Its bounds cover ≥ 90% of canvas width AND ≥ 90% of canvas height.
- Its inset is approximately uniform — `|x − (widthDots − x − width)| < 0.05 × widthDots`
  AND the same for vertical.

This catches the "border" pattern (rectangle near canvas edges with a
stroke and no fill) without flagging a wide-but-short banner shape or
an off-centre accent. The check is geometric, not semantic — there's
no "is this a border?" flag stored on the object.

Note for future format import: Brother LBX paper definitions include
`marginLeft/Top/Right/Bottom`; a "border" in a Brother file lives at
`(marginLeft, marginTop)` not `(0, 0)`. When canvas margins land
(`amendment-canvas-margins.md`, future), the inset comparison should
use printable area, not raw canvas. For now we don't have margins, so
the simpler check is fine.

### 4.4 Continuous Tape Special Case

When `heightMm === null` (continuous), the height axis is meaningless
for proportional scaling. Resize logic:

- Width axis: applies normally (reposition + per-object size scaling).
- Height axis: positions are **unchanged**, sizes are unchanged. The
  canvas grows or shrinks vertically but the layout's vertical layout
  is preserved as authored.

A `setContinuousLength` change (`media.ts:304`) doesn't trigger the
scale logic at all — it's a bare canvas-bounds change, not a media
swap. Existing behaviour preserved.

---

## 5. Canvas-Resize Banner

A single banner component slot at the top of the canvas, mode-driven.

### 5.1 Two Modes

**(a) Overflow** — fires after a resize when one or more objects
extend beyond the new canvas edges (computed against in-canvas portion
post-resize):

```
⚠ 2 objects fall outside the label.   [Fit to label]   [Dismiss]
```

`[Fit to label]` calls `fitContentToCanvas()` (§5.3). `[Dismiss]` hides
the banner; the existing per-object out-of-bounds visual (striped
overlay from `amendment-canvas-sizing.md` §7.2) remains so the user
can still see and address it.

**(b) Auto-adopt confirmation** — fires when a printer connects on a
*touched* canvas and the detected media differs:

```
Detected 62mm continuous on QL-820NWB.   [Use this size]   ✕
```

`[Use this size]` calls `pickDetected(media)`. The (a) banner takes
over after if anything overflowed.

### 5.2 Banner Slot

Single component, single slot. State lives in a small Pinia store
(`useResizeBannerStore`) so the slot is a passive reader. Modes are
mutually exclusive — overflow takes precedence over confirmation.

```
src/
  components/
    canvas/
      CanvasResizeBanner.vue   the banner UI
  stores/
    resizeBanner.ts            mode + payload + actions
```

### 5.3 `fitContentToCanvas()`

Shrinks all out-of-bounds content by a uniform factor anchored at the
canvas top-left. Algorithm:

1. Compute the bounding box of all objects: `bx, by, bw, bh`.
2. If `bx + bw <= widthDots && by + bh <= heightDots`, no-op.
3. Compute scale: `s = min(widthDots / (bx + bw), heightDots / (by + bh), 1)`.
4. For each object: `x *= s`, `y *= s`, `width *= s`, `height *= s`.
   Text font size scales by `s` too in this *explicit user action* —
   unlike the automatic resize logic, this is the user opting into "fit
   my work to the new size".

One history entry per call. Reversible via undo.

### 5.4 What the Banner Doesn't Do

No "Resized to 62mm × 100mm. Scale content?" offer. With per-object
behaviour driving sensible defaults and proportional repositioning,
upsize-to-bigger-canvas already produces "more room" without asking.
A user who genuinely wants everything bigger uses an explicit "Scale
all content" menu action (out of scope here; future).

No silent confirmation banner for resizes that didn't overflow and
weren't auto-adopts. Silent success is fine.

---

## 6. Resize Logic

### 6.1 The Pipeline

When the canvas changes from `(oldW, oldH)` to `(newW, newH)`, run:

```
for each object o in document:
  behaviour = defaultResizeBehavior(o, oldCanvas)
  switch (behaviour):
    case 'scale-with-canvas':
      sx = newW / oldW
      sy = newH / oldH  // or 1 if continuous (oldH null)
      o.x *= sx
      o.y *= sy
      o.width *= sx
      o.height *= sy
    case 'keep-size':
      sx = newW / oldW
      sy = newH / oldH  // or 1 if continuous
      o.x *= sx
      o.y *= sy
      // size unchanged
    case 'anchor-to-edges':
      // preserve uniform inset
      insetL = oldX
      insetR = oldW - (oldX + oldWidth)
      o.x = insetL  // assumes inset preserved as absolute dots
      o.width = newW - insetL - insetR
      // same for y / height
```

Continuous tape (`heightMm === null`): `sy = 1` for all objects;
height axis is identity.

After applying, recompute the overflow banner. If anything overflows,
fire mode (a). One history entry for the whole resize.

### 6.2 Where It Hooks In

The resize pipeline runs inside `applySize()` in `stores/media.ts` —
the single chokepoint that every `pickDetected/pickPrinterMedia/pickCommonSize/pickSheet/pickCustom`
call goes through. Before calling `designer.setCanvas()`, capture the
old canvas dimensions; after, run the resize transform across all
objects in `designer.document`.

Orientation toggles (`setOrientation`) use the existing
display-only swap via `getRenderDoc()` (`stores/designer.ts:140`) and
do NOT trigger the resize pipeline. The canonical document dimensions
don't change on orientation flip.

---

## 7. Print Button Guard

The current path: user clicks Print, the print flow checks
`printer.effectiveMedia` (priority `selectedMedia > detectedMedia >
null`), and if null, errors with "no media detected".

The fix:

1. If `effectiveMedia` is non-null → proceed as today.
2. If `effectiveMedia` is null AND `printer.detectedMedia` was ever
   non-null → adopt it via `pickDetected()` and proceed (the resize
   pipeline runs, fit-to-label banner fires if needed, the print
   continues).
3. If `effectiveMedia` is null AND no detection → open the
   `LabelSizeSelector` dropdown inline. Don't error. The Print button
   becomes a "pick a size to print" affordance instead of a dead-end.

Path (2) covers the most common new-user case. Path (3) covers users
on drivers without media detection (`labelmanager`, `labelwriter` —
see `FAMILIES_WITH_DETECTION` in `lib/printer/registry.ts:45`).

The guard lives in the print entry point — wherever the orange Print
button's click handler dispatches today. Search for usages of
`effectiveMedia` and `noMediaDetected` to find the slot.

---

## 8. Welcome Content by Printer Family

### 8.1 Two Templates

| Family | Template |
|---|---|
| `labelmanager` (Dymo D1 tape) | tape — single styled line, modest icon. Sized to fit a typical 12mm tape; works on 24mm too. |
| `brother-ql` (DK die-cut + 62mm continuous) | die-cut — current `loadFirstVisitDocument` content (frame, greeting, QR). Sized for ~62×40mm. |
| `labelwriter` (Dymo die-cut + continuous) | die-cut — same template as above. |
| (no printer connected) | die-cut — at last-used or default canvas size. |

The tape template is new content; the die-cut template is the existing
`loadFirstVisitDocument()` body, lightly factored.

### 8.2 Selection Logic

`loadFirstVisitDocument(designer, family?)` becomes family-aware:

```typescript
export function loadFirstVisitDocument(
  designer: DesignerStore,
  family: PrinterFamily | null = null,
): void {
  if (family === 'labelmanager') {
    loadTapeTemplate(designer);
    return;
  }
  loadDieCutTemplate(designer);  // current body
}
```

`AppShell.vue` passes the connected family if available at first-visit
time (typical: not yet connected → die-cut fallback).

### 8.3 Family Swap on Connect

When a printer connects on an **untouched** canvas (`canUndo === false`)
and the connected family doesn't match the current welcome template's
family, swap the template:

- Clear current objects.
- Apply `pickDetected(media)` to set the canvas.
- Load the family-appropriate template.
- `clearHistory()` so the new template is also "untouched".

If the user has touched the canvas, no swap. The auto-adopt
confirmation banner (§5) fires instead.

### 8.4 Pre-Printer Fallback

First app load with no printer connected: `loadFirstVisitDocument(designer, null)`
→ die-cut template at the persisted default canvas size (current
behaviour). Most users with a thermal printer have a die-cut/wider
device; the tape template is reserved for the LabelManager case
specifically.

---

## 9. Implementation

### 9.1 Schema Change (designer-core)

`packages/core/src/objects.ts`:

```typescript
export type ResizeBehavior = 'scale-with-canvas' | 'keep-size' | 'anchor-to-edges';

export interface BaseObject {
  // ... existing fields ...
  resizeBehavior?: ResizeBehavior;
}
```

Optional, additive, no migration. Ship as a minor designer-core bump.
The share-encoder accepts old documents (field absent) without
modification — defaulting happens at resize time, not at load time.

### 9.2 Stores

```
src/stores/
  media.ts           extend applySize() with resize pipeline; broaden
                     auto-adopt watcher gating from source-based to
                     canUndo-based
  resizeBanner.ts    new — mode + payload + actions for the banner
```

`media.ts`:
- New helper `runResizeTransform(oldW, oldH, newW, newH)` that walks
  `designer.document.objects`, applies the per-object transform from §6,
  and uses one combined history entry. Called inside `applySize()`
  after the canvas update.
- New helper `fitContentToCanvas()` exported for the banner button.
- Watcher at line 354 changes its gate from
  `if (source.value !== 'detected') return;` to:
  `if (designer.canUndo && designer.document.objects.length > 0) return;`
  — so a touched canvas is suppressed (banner takes over via §5),
  but a still-default canvas with an old `source: 'manual'` from a
  previous session adopts the new media.

`resizeBanner.ts` (new): pinia store with `mode: 'overflow' | 'adopt'
| 'idle'`, `payload`, `show()`, `hide()`. Read by the banner
component, written by `media.ts` resize hook and the auto-adopt path.

### 9.3 Services

```
src/services/
  resize-behavior.ts   new — defaultResizeBehavior(), isCanvasSpanning()
  sample-label.ts      add loadTapeTemplate(); rename existing body to
                       loadDieCutTemplate(); top-level
                       loadFirstVisitDocument() takes optional family
  fit-to-canvas.ts     new — fitContentToCanvas(designer) implementation
```

### 9.4 Components

```
src/components/
  canvas/
    CanvasResizeBanner.vue   new — banner at top of canvas
  layout/
    AppShell.vue             pass detected family to loadFirstVisitDocument;
                             on family change with untouched canvas, swap
                             template
  printer/
    PrinterPopover.vue       remove "no media detected" hard-error path;
                             defer to print guard
  toolbar/
    CanvasActions.vue        wire up the print guard at the orange Print
                             button click handler (path 2/3 from §7)
```

### 9.5 Composables

```
src/composables/
  useAutoReconnect.ts      no change — still calls printer.refreshStatus(),
                           which fires the watcher in media.ts
```

### 9.6 i18n

```
en.json (and all other locales):
  banner.overflow.title          "{n} object falls outside the label" (pluralised)
  banner.overflow.fitAction      "Fit to label"
  banner.adopt.title             "Detected {media} on {printerName}."
  banner.adopt.useAction         "Use this size"
  banner.dismiss                 "Dismiss"
  print.pickSizeFirst            "Pick a label size to print"
  welcome.tape.greeting          "Hello, world"  (or similar tape demo content)
```

---

## 10. Affected Plan Sections

- `amendment-canvas-sizing.md §2.2` — auto-resize-on-connect rule
  refines from "fires only when `source === 'detected'`" to "fires
  when canvas is untouched (`canUndo === false`)". The toast is
  replaced by the banner (§5b) when canvas has content.
- `amendment-canvas-sizing.md §7.5` — "When canvas resize puts objects
  out of bounds" replaces the toast with the overflow banner (§5a)
  and adds the [Fit to label] action.
- `PROGRESS.md` Phase 4 (printer integration) — print button guard
  becomes part of the integration scope.
- `PROGRESS.md` Phase 2 (canvas setup) — resize pipeline ships with
  the canvas work.
- `amendment-canvas-orientation.md` (backlog) — explicitly unaffected:
  orientation is display-only, doesn't touch the resize pipeline.
- `amendment-text-overflow.md` (backlog) — explicitly unaffected: text
  `keep-size` default holds the user's font size constant; whatever
  fit mode the text amendment introduces operates orthogonally.

---

## 11. Implementation Checklist

```
Schema (designer-core):
□ Add ResizeBehavior type and BaseObject.resizeBehavior optional field
□ Bump designer-core minor version
□ Re-export type from package index

Resize logic (label-maker):
□ src/services/resize-behavior.ts — defaultResizeBehavior() with the
  per-type table from §4.2
□ src/services/resize-behavior.ts — isCanvasSpanning() with the ≥90%
  + uniform-inset check from §4.3
□ src/services/fit-to-canvas.ts — fitContentToCanvas() per §5.3
□ src/stores/media.ts — runResizeTransform(oldW, oldH, newW, newH)
  applying §6.1 to all objects (including group children via
  walkObjects); single history entry
□ src/stores/media.ts — wire runResizeTransform() into applySize()
  before/after the designer.setCanvas() call
□ Continuous-tape sy = 1 path tested (heightMm === null)
□ Group objects: recurse into children for the transform; group
  container itself uses 'scale-with-canvas' bounds

Auto-adopt watcher:
□ src/stores/media.ts:354 — gate changes from source-based to
  canUndo-based per §3.2
□ Untouched canvas + connect with mismatched media → silent adopt
□ Touched canvas + connect with mismatched media → banner mode (b)

Banner:
□ src/stores/resizeBanner.ts — mode/payload/show/hide
□ src/components/canvas/CanvasResizeBanner.vue — UI for both modes
□ Slot the banner above the canvas in the editor view
□ Overflow mode: [Fit to label] calls fitContentToCanvas()
□ Adopt mode: [Use this size] calls media.pickDetected(payload.media)
□ Auto-dismiss adopt mode after ~10s; overflow stays until acted on

Print guard:
□ Locate the orange Print button click handler (CanvasActions.vue or
  print flow entry point)
□ If effectiveMedia null + detectedMedia non-null → adopt and proceed
□ If effectiveMedia null + no detection → open LabelSizeSelector inline
□ Remove the "no media detected" error toast for the connected case
□ src/components/printer/PrinterPopover.vue — drop the hard "no media"
  message; the print path now handles it

Welcome content:
□ src/services/sample-label.ts — extract current body to
  loadDieCutTemplate()
□ src/services/sample-label.ts — add loadTapeTemplate() (single
  styled line + modest icon, sized for 12mm tape)
□ src/services/sample-label.ts — top-level loadFirstVisitDocument()
  takes optional family, dispatches to the right template
□ src/components/layout/AppShell.vue:230 — pass connected family if
  available at first-visit time
□ AppShell — on printer-connect with untouched canvas + family
  mismatch, swap template (clear objects, pickDetected, load template,
  clearHistory)

i18n:
□ All new banner strings in en.json + every other locale
□ Tape welcome greeting localised
□ Print "pick a size first" affordance string
```

---

## 12. Tests

Resize behaviour (`stores/__tests__/media.test.ts`,
`services/__tests__/resize-behavior.test.ts`):
- `defaultResizeBehavior` returns the per-type defaults from §4.2
- `isCanvasSpanning` returns true for a centred rectangle covering
  ≥ 90% of canvas with uniform inset
- `isCanvasSpanning` returns false for a banner shape (wide but short),
  off-centre rectangles, lines
- `runResizeTransform` on a 100mm → 60mm canvas:
  - text object at (80, 10) becomes (48, 10) with font size unchanged
  - scale-with-canvas image at (40, 20, 40w, 30h) becomes (24, 12, 24w, 18h)
  - anchor-to-edges rectangle preserves its 4mm uniform inset
- Continuous tape: `heightMm === null` resize doesn't move objects
  vertically
- Group with children: each child transforms per its own
  `resizeBehavior`; group container scales as a wrapper
- One history entry per resize, regardless of object count

Auto-adopt gating (`stores/__tests__/media.test.ts`):
- Untouched canvas (canUndo false, no objects or only sample objects),
  printer connects with mismatched media → `pickDetected` fires
- Touched canvas (canUndo true), same printer connect → no
  `pickDetected`; `resizeBanner` enters adopt mode
- Adopt-mode banner [Use this size] calls `pickDetected(media)`
- Same media already on canvas → no banner, no churn

Banner (`components/canvas/__tests__/CanvasResizeBanner.test.ts`):
- Overflow mode renders pluralised string for n=1, n=2+
- [Fit to label] calls `fitContentToCanvas()` and dismisses the banner
- Adopt mode renders printer name and media name
- [Dismiss] hides without state change

Fit-to-canvas (`services/__tests__/fit-to-canvas.test.ts`):
- No-op when content fits
- Uniform shrink anchored at top-left when content overflows right
  or bottom
- Text font size scales with the factor (explicit user action, unlike
  automatic resize where font size holds)
- Single history entry; undo restores exact prior state

Print guard (`components/toolbar/__tests__/CanvasActions.test.ts` or
the print flow test):
- effectiveMedia non-null → proceeds normally
- effectiveMedia null + detectedMedia non-null → adopts and proceeds
- effectiveMedia null + no detection → opens LabelSizeSelector,
  does not throw

Welcome content (`services/__tests__/sample-label.test.ts`):
- `loadFirstVisitDocument(designer, 'labelmanager')` loads tape template
- `loadFirstVisitDocument(designer, 'brother-ql')` loads die-cut template
- `loadFirstVisitDocument(designer, null)` loads die-cut template at
  default size
- AppShell flow: family swap on connect with untouched canvas swaps
  template; on touched canvas, does not swap

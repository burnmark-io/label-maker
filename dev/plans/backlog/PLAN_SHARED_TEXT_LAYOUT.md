# Plan — Shared text layout (editor renders what print renders)

> **Status:** Draft. Backlog.
>
> **Goal:** Give text one layout engine. `@burnmark-io/designer-core`
> computes where every line and glyph goes; both its own `renderText`
> (print / PNG / PDF) and label-maker's canvas paint that same layout.
> The editor then matches print by construction, not by compensation.
>
> **Builds on:** `designer-core-amendment-text-measurement.md` (extracts
> `layoutText` from `renderText`). This plan extends that layout to
> return *positioned* lines and to own every text-layout decision.
>
> **Unblocks:** `designer-core-amendment-text-overflow.md` and
> `dev/amendments/backlog/amendment-text-overflow.md`. Overflow modes
> (auto-shrink, ellipsis, clip) get implemented once, in the shared
> layout, instead of once per renderer.
>
> **Context:** PR #2 (WYSIWYG text fix) correctly diagnosed the vertical
> mismatch and fixed it by offsetting the Konva node. This plan is the
> structural alternative; see §7.

---

## 0. Why this exists

The editor draws text with Konva's `Text` node
(`src/components/canvas/TextNode.vue`). Print draws it with
`renderText` in `designer-core` (`packages/core/src/render/text.ts`).
They are two independent layout engines, and they disagree:

| Concern | Konva (editor) | designer-core (print) |
|---|---|---|
| First-line anchor | `textBaseline: 'middle'` at `lineHeight·fontSize/2` | `textBaseline: 'alphabetic'` at `fontSize` |
| `letterSpacing` | Applied per glyph | **Ignored** (dead field) |
| Whitespace | Preserved | Collapsed (`split(/\s+/)`) |
| Word longer than box | Broken per character | Kept whole, overflows |
| Content taller than box | **Truncated** at `height` | All lines drawn, never clipped |
| `invert` | **Not drawn** (toggle exists in Properties) | Fills box, draws text white |

The vertical offset grows with `fontSize` (≈6 dots at 50, ≈43 at 350;
measured in PR #2). The others change line breaks, line counts or
whole-object appearance, so a label can look right in the editor and
print differently.

Fixing these in the editor one by one means each fix adds a translation
between "where Konva draws" and "where the document says". Every
coordinate conversion (drag, transform start/end, inline editor,
snapping, bounds checks) must then undo it. PR #2's first fix already
needed two follow-ups for exactly this reason (resize drift, and Konva
keeping a stale `height` after resize).

---

## 1. Scope

### In scope

- **designer-core:** a public, pure `layoutText` producing positioned
  lines; `renderText` reduced to painting a layout; `letterSpacing`
  honoured; a deliberate wrap policy (whitespace, long words).
- **label-maker:** text objects drawn by a `Konva.Shape` that paints the
  shared layout; removal of every text-specific y-correction and of the
  reliance on Konva's measuring for `autoHeight`.
- **Tests:** cross-renderer pixel test (editor paint vs `renderFull`),
  ported from PR #2.

### Out of scope

- Overflow modes / `sizingMode` (the overflow amendments). This plan
  keeps today's print behaviour: lay out all lines, never clip. It only
  makes the editor agree with that.
- Rich text, per-run styling, hyphenation, RTL/bidi.
- The inline text editor's own DOM layout beyond aligning it (§4.4).

### Non-goals

- Changing where existing labels print. Apart from the deliberate
  changes listed in §2.4, print output must stay byte-identical.

---

## 2. designer-core

### 2.1 API

Extends the text-measurement amendment's `layoutText` (which returns
only `lines`/`height`) to return positions:

```typescript
export interface LaidOutLine {
  text: string;
  /** Left edge of the line's ink box, in object-local dots. */
  x: number;
  /** Alphabetic baseline, in object-local dots. */
  baselineY: number;
  /** Advance width including letterSpacing. */
  width: number;
}

export interface TextLayout {
  /** The exact `ctx.font` string to paint with. */
  font: string;
  letterSpacing: number;
  lineHeight: number;      // fontSize × obj.lineHeight, in dots
  lines: LaidOutLine[];
  /** lines.length × lineHeight; what autoHeight resolves to. */
  contentHeight: number;
}

export function layoutText(ctx: CanvasContextLike, obj: TextObject): TextLayout;
export function paintText(ctx: CanvasContextLike, obj: TextObject, layout: TextLayout): void;
```

- `renderText(ctx, obj)` becomes `paintText(ctx, obj, layoutText(ctx, obj))`.
- The amendment's `measureText` / `measureTextObject` become thin
  wrappers returning `{ lines, lineCount, height }` from `layoutText`, so
  that amendment's API is preserved.
- `paintText` owns invert (box fill + white text) and, later, clipping.
- `paintText` draws with `textBaseline = 'alphabetic'` and
  `textAlign = 'left'` at `(line.x, line.baselineY)`. Alignment is
  resolved in layout, not by the context.

### 2.2 First-line anchor

Keep designer-core's current rule (first baseline at `fontSize` for
`top`; existing formulas for `middle`/`bottom`). Print is the source of
truth and existing labels must not move.

Open question for later: the CSS half-leading model (line centred in
its line box) is what Konva and the DOM inline editor use, and makes
`lineHeight` affect the first line consistently. Switching would move
printed text and needs a document migration (`migration.ts`). Keep it
out of this plan; record it as a separate decision.

### 2.3 letterSpacing

Use the Canvas 2D `ctx.letterSpacing` property (string, e.g. `"2px"`).
It is supported by `@napi-rs/canvas` (checked: 0.1.99 types) and by
current Chromium, which is the browser label-maker targets for printing.

- Layout measures with `letterSpacing` applied, so wrap points account
  for it.
- **Spike first:** confirm Firefox/Safari support for design-only use.
  If missing, fall back to per-glyph `fillText` in `paintText` and
  per-glyph measuring in `layoutText`. The fallback lives in one place.

### 2.4 Wrap policy (deliberate print changes)

Decide and document. Proposed:

- **Whitespace:** preserve runs of spaces within a line; collapse only at
  wrap points. (Changes print where content has double spaces.)
- **Words longer than the box:** break per character, as Konva does
  today. (Changes print for such words: they no longer overflow sideways.)
- **Hard newlines:** unchanged.

These are the only intended print changes; call them out in the
designer-core changelog.

### 2.5 Measurement context and fonts

As in the text-measurement amendment: OffscreenCanvas → detached
`<canvas>` → injected (`setMeasurementContext`). Layout depends on font
metrics, so consumers must re-layout when a font finishes loading
(§4.3).

---

## 3. Release order

1. designer-core: text-measurement amendment (if not already done), then
   §2 of this plan. Minor bump (0.x). Changelog lists §2.4 changes and
   letterSpacing now rendering.
2. label-maker: bump designer-core, then §4.
3. Overflow amendments, now against one layout.

---

## 4. label-maker

### 4.1 Rendering

Replace `<v-text>` in `TextNode.vue` with `<v-shape>`:

- `sceneFunc(context, shape)`: get the native 2D context, call
  `paintText(ctx, obj, layout)`. No Konva text logic involved.
- `hitFunc`: a rect covering the object box (`width × renderHeight`), so
  selection works on empty parts of the box as it does today.
- `width` / `height` on the shape = object box (`renderHeight` for
  `autoHeight`), so the Transformer outline is the document box.
- `layout` is a `computed` keyed on the object fields + resolved
  template text (`applyTemplate(content, currentVariables)`), not
  recomputed per frame.

### 4.2 Coordinates

With the shape drawing exactly the document box, node position =
object position (plus the existing centre/offset convention for
rotation). Remove any y-correction; drag/transform conversions stay as
they are on `main` today.

### 4.3 autoHeight and fonts

- `autoHeight` height = `layout.contentHeight`. Drop the
  `watchPostEffect` that reads `node.height()` back from Konva.
- During transform, recompute layout from the live width/fontSize and
  use its `contentHeight` for the pivot math (the text-measurement
  amendment's §3 use case).
- Re-layout and redraw when fonts load: listen to
  `document.fonts` `loadingdone` and bump a reactive font epoch that the
  layout computed depends on.

### 4.4 Inline text editor

`InlineTextEditor.vue` is a DOM overlay using CSS line boxes. Align its
first baseline with `layout.lines[0].baselineY` by computing the CSS
half-leading baseline for the same font and offsetting `padding-top` by
the difference. Small sub-dot differences while editing are acceptable;
the canvas is the authority once editing ends.

### 4.5 Clean-up

- Remove the Konva-only props (`align`, `verticalAlign`, `wrap`,
  `letterSpacing`, `lineHeight`, `fontStyle` mapping) from the text config.
- Remove `textFontStyle()` if nothing else uses it.

---

## 5. Tests

**designer-core**
- `layoutText` → `paintText` produces the same pixels as today's
  `renderText` for fixtures without §2.4 cases (refactor guard).
- letterSpacing: line width grows by `(chars − 1) × spacing`; wrap points
  move accordingly.
- Whitespace runs preserved; long word broken per character.
- `measureText` wrappers still return the amendment's shape.

**label-maker**
- Cross-renderer test (ported from PR #2): render one `TextObject` via
  `renderFull` and via `TextNode`'s paint function on `@napi-rs/canvas`;
  compare pixels, not just the first ink row. Cover
  top/middle/bottom, left/center/right, letterSpacing ≠ 0, invert,
  multi-line overflow.
- `TextNode`: autoHeight height equals `layout.contentHeight`; resize
  keeps the opposite anchor fixed (existing pivot tests).

---

## 6. Risks and open questions

- **Performance:** custom `sceneFunc` loses Konva's text caching. Layout
  is memoised per object; painting a few `fillText` calls per frame is
  cheap. Check on a label with many text objects during drag.
- **Hit detection:** Konva hit canvases call `hitFunc`, not `sceneFunc`;
  keep it a plain rect.
- **letterSpacing browser support** (§2.3 spike).
- **Font metrics differ between browser and `@napi-rs/canvas`:** layout
  uses whatever context it is given, so editor and print agree within a
  platform. Cross-platform pixel equality is not a goal.
- **Anchor convention** (§2.2): kept as-is here; separate decision.

---

## 7. Relationship to PR #2

PR #2 offsets the Konva node by
`fontSize − lineHeight·fontSize/2 − (ascent − descent)/2` and passes
`height: undefined` to Konva for top-aligned text. It fixes the vertical
anchor and truncation symptoms, but leaves letterSpacing, wrap and
invert divergent, and adds a correction every coordinate path must
undo.

Keep from PR #2: the root-cause analysis and the cross-renderer test
(basis for §5). Supersede: the y-correction and `konvaTextHeight`.

---

## 8. Checklist

```
designer-core
□ text-measurement amendment landed (layoutText extracted)
□ LaidOutLine / TextLayout types; layoutText returns positions
□ paintText; renderText = paintText(layoutText(...))
□ invert moved into paintText
□ letterSpacing via ctx.letterSpacing (+ fallback if spike says so)
□ wrap policy: whitespace runs, per-character break for long words
□ measureText / measureTextObject as wrappers
□ exports from index.ts; changelog notes print changes
□ tests (§5)

label-maker
□ bump designer-core
□ TextNode: v-text → v-shape with sceneFunc = paintText, rect hitFunc
□ layout computed (object + template vars + font epoch)
□ autoHeight from layout.contentHeight; drop node.height() read-back
□ transform pivot uses live layout height
□ fonts: redraw on document.fonts loadingdone
□ InlineTextEditor baseline alignment
□ remove Konva-only text config
□ cross-renderer pixel test (ported from PR #2)
```

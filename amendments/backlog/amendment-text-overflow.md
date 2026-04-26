# label-maker — Amendment: Text Overflow Handling

> The current text object collapses two unrelated decisions into one knob:
> "does the box auto-grow to fit content?" and "what happens when content
> doesn't fit?". That makes long-text and CSV-batch scenarios unpredictable —
> rows look perfect at design time and get cut off at print time. This
> amendment exposes the new sizing-mode / overflow model from
> `@burnmark-io/designer-core` in the label-maker UI.
>
> Depends on `designer-core-amendment-text-overflow.md`. This amendment
> assumes `TextObject.sizingMode`, `TextObject.overflow`,
> `TextObject.minFontSize`, the `text.autoShrinkFloor` / `text.truncated`
> warning codes, and the `measureTextHeight` helper are all shipped in
> `@burnmark-io/designer-core`. Everything below is what label-maker has to
> wire up to expose them.

---

## 1. The Scenarios We're Solving

**Scenario A — design time:** user types a long text, it wraps to a second
line but the text object isn't tall enough. The second line exists but
isn't visible. Resizing the object makes the text bigger (scaling), not
the box bigger (revealing). The user never sees their second line.

**Scenario B — CSV batch:** a `{{description}}` placeholder that fits for
"Blue widget" but overflows for "Extra large premium deluxe blue widget
with extended warranty." Some rows look perfect, some are cut off. The
user might not notice until they've printed 200 labels and the shipping
company can't read half the addresses.

The two sizing modes (`fixed` vs `scale`) plus four overflow strategies
(`auto-shrink`, `ellipsis`, `clip`, `visible`) cover both. The label-maker
job is to put a sensible UI on top of them and make the resize behaviour
match the mode.

---

## 2. Properties Panel

In `src/components/panels/TextProperties.vue`:

- **Remove** the `autoHeight` and `wrap` toggles. Those fields are gone
  from `TextObject`.
- **Add** a sizing-mode segmented control:

  ```
  Sizing: [📦 Fixed box] [🔤 Scale with box]
  ```

  Bound to `object.sizingMode`. Default for new objects is `fixed`
  (designer-core's factory already sets this).

- **Add** an overflow dropdown — visible only when
  `sizingMode === 'fixed'`:

  ```
  Overflow: [Auto-shrink ▾]
    ├── Auto-shrink    shrink font until it fits, minimum 6pt
    ├── Ellipsis       truncate with "…"
    ├── Clip           hard cut at box edge (silent)
    └── Visible        render beyond the box edge (no clipping)
  ```

  Bound to `object.overflow`. Auto-shrink is the default and the
  recommended choice for any data-bound text — the address-label
  scenario fixes itself.

- **Add** a `minFontSize` numeric input — visible only when
  `overflow === 'auto-shrink'`. Default 6, min 4, max
  `object.fontSize`. Bound to `object.minFontSize`.

- **Add** a "rendered at Npt" read-out — visible only when
  `overflow === 'auto-shrink'` and the rendered size differs from
  `fontSize`. Source: call `measureTextHeight` from designer-core
  with the current content/width/fontSize and walk down to find the
  fitting size, mirroring what the renderer does. (Don't use the
  warning channel for happy-path display — it's for failure cases.)

i18n keys to add under `properties.text.*`:

```
sizingMode, sizingModeFixed, sizingModeScale,
overflow, overflowAutoShrink, overflowEllipsis, overflowClip, overflowVisible,
minFontSize,
renderedAt    // "Rendered at {size}pt"
```

i18n keys to remove: `autoHeight`, `wrap`.

---

## 3. Object-List Warning Badges

In `src/components/panels/ObjectsPanel.vue`:

Subscribe to `designer.renderWarning` (already exposed by the store).
For any text object whose id matches a warning with code
`text.autoShrinkFloor` or `text.truncated`, render a `⚠` next to its
row.

Tooltips:
- `text.autoShrinkFloor` → "Text doesn't fit even at the minimum font
  size — increase the box, lower the minimum, or accept the clip."
- `text.truncated` → "Text was truncated to fit — N lines hidden."

The warning channel emits per render, so the badge is a function of
the *most recent* render. When the user widens the box and the next
render comes back clean, the badge clears.

---

## 4. Canvas Resize Behaviour

In `src/components/canvas/TextNode.vue` and the transformer commit
path (`SelectionTransformer.vue` / `DesignCanvas.vue`).

Today the Konva transformer applies a scale to the node, and the
commit handler writes back `width`/`height` (and effectively scales
the displayed font size with them). After this amendment, branch on
`props.object.sizingMode`:

- **Fixed mode:** on transform end, write the new `width`/`height`
  and reset `scaleX`/`scaleY` to 1. **Do not** multiply `fontSize`
  by the scale. Designer-core reflows the text at the original font
  size; auto-shrink (if active) recalculates.
- **Scale mode:** unchanged from today. Multiply `fontSize` by the
  average scale, reset scale to 1, write new dimensions.

This is the only behavioural change to the Konva layer — the node's
visual representation still comes from designer-core's bitmap, the
transformer just commits different deltas depending on mode.

---

## 5. Inline Text Editor — Auto-Fit on Edit

In `src/components/canvas/InlineTextEditor.vue`:

When the user finishes editing, the box should grow to fit the new
content if (and only if) the user hasn't manually pinned its height
yet — the "I just typed something, let me see all of it" affordance
that `autoHeight=true` used to provide.

Implementation: after each commit, call `measureTextHeight` from
designer-core with the new content and `width`. Write the result into
`height` *only* while the box is still in auto-fit. The box leaves
auto-fit the moment the user drags the resize handles.

Tracking auto-fit: an `_autoFit` UI-only flag on the object is the
clean way. It lives on the document but isn't part of the rendered
output. Default `true` for new text objects; set to `false` on first
manual resize.

---

## 6. Batch Preview Indicators

In `src/components/batch/BatchPanel.vue` (and the per-row preview
wherever it's rendered).

Each row's render returns its own warnings. Collect them keyed by
`objectId` and surface a per-row badge that lists affected objects:

```
Row 14: ⚠ {{address}} truncated at 6pt
Row 27: ⚠ {{description}} truncated at 6pt
```

The user can widen the box, lower the minimum, accept the clip, or
shorten the data — all visible decisions.

The "smallest font across the batch" summary from earlier drafts is a
nice-to-have. Defer unless cheap.

---

## 7. Sample Document

`src/services/sample-label.ts` — set `sizingMode`, `overflow`, and
`minFontSize` explicitly on the sample text objects rather than
relying on factory defaults. The sample doubles as documentation;
making the new fields visible there is worth the few extra lines.

---

## 8. Defaults

New text objects come out of designer-core's factory with:

- `sizingMode: 'fixed'`
- `overflow: 'auto-shrink'`
- `minFontSize: 6`

Label-maker doesn't override these. Every new text object Just Works
for the address / shipping / data-bound case; the user only switches
modes when they specifically want decorative scaling, hard clipping,
or ellipsis truncation.

---

## 9. Affected Plan Sections

- Section 6.2 (text properties) — add sizing mode and overflow strategy
- Phase 2 (text objects) — fixed vs scale mode, overflow strategies
- Phase 5 (batch) — auto-shrink per row, overflow warnings in preview grid

---

## 10. Implementation Checklist

```
Text overflow (assumes designer-core amendment shipped):
□ Bump @burnmark-io/designer-core dependency
□ TextProperties.vue: replace autoHeight/wrap toggles with sizing-mode
  segmented control + overflow dropdown + minFontSize input
□ TextProperties.vue: "Rendered at Npt" read-out for auto-shrink
□ ObjectsPanel.vue: ⚠ badges driven by text.autoShrinkFloor /
  text.truncated render warnings
□ TextNode.vue / SelectionTransformer.vue: branch transform-commit on
  sizingMode (fixed = write box, scale = write font)
□ InlineTextEditor.vue: auto-fit on edit-end via measureTextHeight,
  with _autoFit flag on the object
□ BatchPanel.vue: per-row warning badges keyed by objectId
□ sample-label.ts: set sizingMode/overflow/minFontSize explicitly
□ i18n: add new keys, drop autoHeight/wrap

i18n:
□ All overflow-related strings and tooltips
```

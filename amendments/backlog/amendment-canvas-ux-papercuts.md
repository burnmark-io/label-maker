# label-maker — Amendment: Canvas UX Papercuts

> Three small, unrelated UX papercuts. Each is noticeable in normal
> use but none are load-bearing. Bundled here because they're each a
> one-or-two-file change and don't deserve their own amendment
> overhead.
>
> 1. **Inline text editor doesn't match the canvas text it replaces.**
>    Double-click a text object to edit it — the textarea that pops up
>    has a different size, line height, and metrics than the Konva text
>    behind it. The text visually "jumps" on entry and exit, and lines
>    wrap at different widths in edit mode vs render mode.
> 2. **Zoom controls hide behind the print/safe bar on small screens.**
>    The bottom-right zoom widget lives in the canvas overlay, but on
>    mobile widths the bottom toolbar overlaps it. Zoom buttons are
>    inaccessible until the user scrolls or rotates.
> 3. **The "Save" dropdown is a junk drawer.** Only 2 of its 11
>    items are actually save actions; the rest are New / Library /
>    Import / four Export formats / Print Sheet / Share. The label on
>    the menu's trigger lies, and users hunt for unrelated actions
>    inside a Save menu.

---

## 1. Inline Editor / Canvas Text Parity

### Today

`src/components/canvas/InlineTextEditor.vue` overlays a `<textarea>`
on top of the Konva text node during edit. The style is computed from
the `TextObject` props — fontSize, fontFamily, fontWeight, fontStyle,
textAlign, color, lineHeight — scaled by `props.scale` (zoom).

Visually it doesn't match. Konva text and HTML text disagree on:

- **Line height interpretation.** Konva treats `lineHeight` as a
  multiplier on `fontSize` and computes baselines from font metrics.
  HTML/CSS `line-height: 1.2` produces a slightly different total line
  box height because the browser includes leading differently. Net
  effect: a multi-line text object that's exactly tall enough in Konva
  overflows by a few pixels in the editor.
- **Letter spacing.** The canvas Konva config sets `letterSpacing` in
  dots; the editor's CSS `letter-spacing: inherit` falls back to 0
  unless the parent specifies it. Result: characters spread out
  differently in edit mode.
- **Box model.** Konva text has no padding/border. The editor has a
  2px border + scroll-bar reservation. Width-wise, the wrap point
  shifts by ~4–6px, so a line that fits in render mode wraps to two
  lines in edit mode (or vice versa).
- **Vertical alignment.** Konva supports `verticalAlign: 'top' |
  'middle' | 'bottom'`; the textarea is always top-aligned. Text that
  visually centred in the canvas snaps to the top of the editor.
- **Baseline offset.** First line position differs by a few pixels
  even when everything else lines up — Konva's first baseline starts
  at `fontSize * lineHeight - descent`, the textarea uses the
  browser's first-line metrics.

### What good looks like

The textarea is visually indistinguishable from the canvas text
underneath it. Switching in/out of edit mode produces no visual jump.
Wrap points match exactly so a line never reflows on entry/exit.

### Approach

The robust path is to render text the same way in both modes. Two
variants:

**A. Replace `<textarea>` with `contenteditable`.** A `<div>` with
`contenteditable="plaintext-only"` handles font metrics like a
regular HTML element but you control the box model exactly — no
border/padding inherited from textarea defaults, no scrollbar
reservation. Box-shadow handles the editing affordance. The
remaining Konva-vs-HTML metric drift is bounded by the system font
metrics, not by textarea quirks.

**B. Compute the textarea's box-sizing from Konva's measurement.**
Use `Konva.Text.prototype.measureSize()` (or the existing
`measureHeight` helper in designer-core if exposed) to compute the
exact rendered height/width at the current font/wrap settings, and
size the textarea to match. Absorbs the metric drift by sizing to
Konva's truth.

A is simpler and more conventional (Figma, Sketch use
contenteditable for in-place text editing). Recommend A.

Either way, fix `letter-spacing: inherit` → `letter-spacing:
${object.letterSpacing * scale}px` so the spacing actually matches.
Fix `vertical-align` by using flex layout on a wrapper to place the
contenteditable per `object.verticalAlign`.

### Files

```
src/components/canvas/
  InlineTextEditor.vue   replace textarea with contenteditable div;
                         set letter-spacing explicitly; honour
                         verticalAlign; remove the 24px minHeight
                         hack on line 43 (let height come from
                         object.height directly)
```

No store / schema changes.

### Verification

- Type a multi-line text object. Switch in/out of edit mode — no
  visual jump.
- Set letterSpacing > 0 in properties. Edit. Spacing matches.
- Set verticalAlign = 'middle'. Edit. Caret starts in the middle.
- Type past the right edge with wrap=true. Wrap point matches the
  rendered Konva position.

---

## 2. Zoom Controls Behind Print/Safe Bar on Small Screens

### Today

`DesignCanvas.vue` (`canvas-zoom` div) positions the zoom controls
absolutely at the bottom-right of the canvas viewport. On mobile
widths the bottom toolbar (print / batch / sidebar fold buttons —
introduced in commit 32aef33 "feat(canvas): add zoom buttons and
mobile sidebar fold") sits at the bottom of the screen and overlaps
the zoom widget. The zoom buttons are still in the DOM but covered
and tap events go to the toolbar.

### What good looks like

Zoom controls always reachable. Either above the bottom bar, or
folded into it on small screens.

### Approach

Two reasonable options:

**A. Bottom-stack on small screens.** Move zoom controls into the
bottom toolbar's flex row when viewport width < some breakpoint
(e.g. 640px). Reuse the existing toolbar's button styling so they
look native to the bar.

**B. Lift above the bar.** Keep the absolute-positioned widget but
shift it up by the toolbar's height on small screens (`bottom:
calc(toolbar-height + 16px)`). Simpler, but produces a column of
floating widgets that gets crowded.

Recommend A — fewer floating widgets on mobile, the zoom controls
end up next to other canvas-level controls where users will look for
them. Slightly more work because the zoom widget has to know about
the toolbar's existence (or vice versa), but it's the right model.

### Files

```
src/components/canvas/DesignCanvas.vue          remove inline
                                                .canvas-zoom div on
                                                small screens; expose
                                                zoomIn/Out/reset and
                                                zoomPercent via the
                                                viewport composable
                                                or props
src/components/layout/<bottom-toolbar>.vue      consume the zoom
                                                handlers and render
                                                the buttons as part
                                                of the toolbar's flex
                                                row, conditionally on
                                                breakpoint
```

(Replace `<bottom-toolbar>.vue` with the actual filename — find via
`grep -rn "canvas-zoom\|fitZoom" src/components/layout`.)

No store / schema changes.

### Verification

- Resize browser to <640px width. Zoom controls visible and
  tappable. No overlap with print/batch/sidebar buttons.
- Resize to desktop width. Zoom controls back in their original
  position (bottom-right of canvas).
- Tap each zoom button. Behaviour unchanged.

---

## 3. "Save" Dropdown Is a Junk Drawer

### Today

`src/components/toolbar/CanvasActions.vue` line 70–166 renders the
"Save" split-button. The dropdown contains:

| Item | Actually a save action? |
|---|---|
| New label | No (creates a fresh document) |
| Save current | Yes |
| Save as new | Yes |
| Library | No (opens the library browser) |
| Import | No (the opposite of save) |
| Export PDF | No (export ≠ save) |
| Export PNG | No |
| Export Label | No |
| Export Zip | No |
| Print Sheet | No (print) |
| Share | No (share) |

2 of 11. The trigger button is labelled `topbar.save` with a save
icon. Everything else is squatting because the toolbar has no other
home for document-level actions.

### What good looks like

The Save button does what its label says. Other actions live where
users expect them: a separate File menu (or split into smaller
purpose-built menus) for New / Open / Import / Export, and Share
gets its own button (it's already an `emit('open-share')`, not a
menu action — half-promoted already).

### Approach

Two reasonable shapes; both are real refactors, not a 5-minute fix:

**A. Split into a File menu and a Share button.** Keep the Save
button as a one-click save (current primary action). Add a "File"
dropdown next to it with: New, Open Library, Import, Export ▸
(submenu with PDF/PNG/Label/Zip), Print Sheet. Promote Share to a
top-level button. Save-as-new can live in the File menu or stay as
a Save split-button option (one menu item, not eleven).

**B. Reorganise inside the existing dropdown but rename the
trigger.** Trigger label becomes "File" with a generic file icon.
Save remains the primary one-click action of the split button. The
dropdown contents are unchanged but at least the label doesn't lie.

A is the right answer long-term — the menu is genuinely too long
and a submenu for Export reduces visual noise. B is the cheap path
if we want to ship the label fix without restructuring.

Recommend A. The split should fall out cleanly from the existing
emit handlers (`emit('open-share')`, `emit('open-library')`,
`emit('open-sheet')` already exist — same pattern for the new
buttons).

### Files

```
src/components/toolbar/CanvasActions.vue   restructure: keep Save
                                           as primary; add File
                                           dropdown with New /
                                           Library / Import /
                                           Export submenu / Print
                                           Sheet; promote Share to
                                           top-level button
src/locales/<all>.json                     add file/export labels;
                                           rename actions.saveOptions
                                           if it stays
```

No store / schema changes. No emit signature changes — same handlers,
re-grouped.

### Verification

- Save button does only Save (one click → toast).
- File menu surfaces New / Library / Import / Export / Print Sheet
  with a nested Export submenu (PDF / PNG / Label / Zip).
- Share button is top-level, opens the share dialog.
- Existing keyboard shortcuts (Ctrl+S etc.) still trigger save.

---

## 4. Dependency Order

All three items independent of each other and of any in-flight work.
Each can ship in isolation.

## 5. i18n

Items 1 and 2: no string changes. Item 3: new keys for the File menu
trigger / submenu labels; existing `actions.saveCurrent`,
`actions.saveAsNew`, `actions.exportPdf` etc. carry over unchanged.

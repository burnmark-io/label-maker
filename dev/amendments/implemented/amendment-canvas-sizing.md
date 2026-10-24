# label-maker — Amendment: Canvas Sizing and Media Selection

> The current plan ties canvas size to a connected printer's detected media.
> That locks out everyone who doesn't have a thermal printer — the exact
> audience we said we'd treat as equals. This amendment decouples canvas
> sizing from printer connection and makes label dimensions a first-class
> design choice.
>
> Also addresses: continuous-label manual length, custom dimensions for
> users who don't fit the standard media registry, and visual treatment
> for out-of-bounds content / dead zones / rounded corners.
>
> **Pure label-maker scope.** Designer-core's `CanvasConfig` is unchanged
> by this amendment. Millimetres live in label-maker's editor state; the
> document persists `widthDots`/`heightDots`/`dpi` as today. See §6.1.
>
> Sibling amendments:
> - `amendment-canvas-orientation.md` — vertical/horizontal toggle, smart
>   default, driver D47 audit. Pairs with
>   `designer-core-amendment-canvas-orientation.md`.
> - `amendment-text-overflow.md` — sizing modes, auto-shrink, ellipsis.
> - `amendment-tables-and-autogrow.md` — deferred auto-grow story.

---

## 1. The Problem

The current flow:

```
Connect printer → getStatus() → detectedMedia → canvas resizes
No printer → ??? → default 62mm continuous → stuck
```

This fails for:
- Sheet/inkjet users who never connect a thermal printer
- Users who know what label size they want before connecting
- Users who want to design for a specific media without hardware present
- Users who want a weird custom size (logo design, craft projects)
- Tape label users (D1, P-touch) without a printer connected — same
  gap as above. Orientation for tape is handled separately in
  `amendment-canvas-orientation.md`.

---

## 2. Media Selection — Always Available

### 2.1 The Media Selector

A persistent, accessible control in the top bar or near the canvas —
NOT hidden inside the print dialog. The user can change label dimensions
at any time, regardless of printer connection.

```
┌─────────────────────────────────────────────────────────┐
│ 🏷️ burnmark    [📐 62mm continuous ▾]   🟢 QL-820NWB   │
└─────────────────────────────────────────────────────────┘
```

Clicking the media selector opens a dropdown/panel:

```
Label Size
├── From printer (when connected)
│   └── 62mm continuous (detected)      ← auto-selected when printer connects
│
├── Common sizes
│   ├── 62mm continuous (Brother QL)
│   ├── 29×90mm die-cut (Brother QL)
│   ├── 62×29mm die-cut (Brother QL)
│   ├── 89×28mm address (LabelWriter)
│   ├── 89×36mm large address (LabelWriter)
│   ├── 56mm continuous (LabelWriter)
│   ├── 12mm tape (LabelManager / P-touch)
│   ├── 9mm tape (LabelManager / P-touch)
│   └── ...more common sizes
│
├── From sticker sheet
│   └── [Pick a sheet...] → opens sheet picker
│       → selects single label dimensions from the sheet
│       → e.g. Avery L7160 → 63.5 × 38.1mm
│
└── Custom
    └── Width: [___] mm   Height: [___] mm   (leave empty or 0 for continuous)
```

### 2.2 Interaction with Printer Connection

When a printer connects and media is detected:

- If the user has not manually picked a size, the canvas resizes to the
  detected media. Toast: "Canvas resized to match your printer — 62mm
  continuous."
- If the user *has* manually picked a size and the printer can't handle it,
  snap to the closest available size on that driver and toast:
  "Resized to 62mm continuous to match your printer — some objects may
  need repositioning." Out-of-bounds objects light up via §7.5; the user
  drags them back. We don't try to auto-relocate.
- The user can always override after auto-resize by re-picking from the
  selector. Detection is a suggestion, never a lock.

When no printer is connected:

- The media selector shows the last used size, or 62mm continuous on first visit
- All sizes are available — common, sheet-derived, custom
- No "connect a printer first" gatekeeping

The "last used size" is persisted in `localStorage` under a single
global key (not per-document). New documents start at the last-used
size; opening an existing document uses whatever size is in the
document.

### 2.3 Sheet-Derived Label Size

When the user picks a sticker sheet (Avery L7160), extract the single
label dimensions from the sheet template:

```typescript
const sheet = findSheet('avery-l7160');
// labelWidthMm: 63.5, labelHeightMm: 38.1
setCanvasSize(sheet.labelWidthMm, sheet.labelHeightMm);
```

Now the user designs at the exact label size for that sheet. When they
print → sticker sheet, the sheet is pre-selected. The canvas size and
the print target are consistent.

### 2.4 Custom Dimensions

For users who don't fit any standard size — or who are using burnmark
for something unexpected (logo design, craft labels, custom die-cuts):

```
Custom size
  Width:  [40] mm
  Height: [25] mm     (leave empty or 0 for continuous)
```

Free-form input. No validation beyond positive numbers. The canvas
resizes immediately. This is the escape hatch for every use case we
didn't anticipate.

**Custom dimensions are best-effort at print time.** Off-the-beaten-track
sizes won't match any driver's media list. The driver does what it can
(closest media on the roll, scaling, clipping) and the user accepts
whatever the printer produces. We don't add special handling, fallbacks,
or compatibility shims for custom sizes — these users are explicitly
opting out of the curated path.

---

## 3. Continuous Labels — Manual Length

### 3.1 Model

Continuous labels (`heightMm === null`) show a canvas with a dashed cut
line at the growth edge and a feed direction indicator. The user sets
the length explicitly by dragging the cut line. **No auto-grow** —
auto-grow makes the canvas length a side effect of every object move,
which churns history and confuses undo. Manual sizing is more
predictable and the affordance is obvious.

### 3.2 Starting Length

When a continuous media is first selected (or a fresh document opened),
the canvas opens at **`widthMm × 4 / 3`**:

- 12mm tape → 16mm
- 29mm continuous → ~39mm
- 62mm continuous → ~83mm

A 4:3 ratio reads as a recognisable label shape on first glance and
sits well below the "this is a huge label" feeling that fixed defaults
like 100mm give for narrow tapes.

### 3.3 Drag to Resize

A drag handle on the cut line (dashed bottom edge) lets the user set
the label length:

```
              ┌────────────────────┐
              │                    │
              │   [design]         │
              │                    │
              ├ ─ ─ ─ ─ ═══ ─ ─ ─ ┤  ← drag handle on cut line
              │                    │     drag down to extend
              └ (faded extension)  ┘     drag up to shorten
```

The drag handle is a visible affordance — a small grab bar centred on
the cut line. Cursor changes to `ns-resize` on hover. Drag snaps to
grid. Each drag commit is one history entry.

The right-edge variant (cut line on the right, `ew-resize` cursor)
ships with `amendment-canvas-orientation.md` when horizontal lands.

### 3.4 Minimum Length

Don't let the user drag shorter than the content. The minimum canvas
length is the bottom edge of the lowest object + margin. Attempting to
drag shorter shows a subtle resistance (snap back to minimum). If the
user wants to shrink past the content, they delete or move the
offending objects first.

---

## 4. Orientation

Lifted to `amendment-canvas-orientation.md`. The vertical/horizontal
toggle, smart default, frame-swap semantics, and driver D47 audit
all live there. This amendment assumes a single orientation
(vertical) for the canvas — the orientation amendment layers on top
without changing any of the sizing/media-selection behaviour
described here.

---

## 5. Updated Layout

The media selector sits in the top bar, always visible:

```
┌────────────────────────────────────────────────────────────────┐
│ 🏷️ burnmark   [📐 62mm continuous ▾]   🟢 QL-820NWB    [Help] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│               ┌─ toolbar ─────────┐                            │
│               │[T] [🖼] [▣] [⬡]   │                    ┌─────┐│
│               │                   │                    │props││
│               └───────────────────┘                    │     ││
│               ┌──────────────┐                         │     ││
│               │              │                         │     ││
│               │  62mm roll   │                         │     ││
│               │  growing ↓   │                         │     ││
│               │              │                         │     ││
│               ├ ─ ─ ═══ ─ ─ ┤  ← drag handle on cut line     ││
│               └──────────────┘                         │     ││
│                                                        └─────┘│
│               [⎙ Print]  [💾 ▾]                                │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ 🏷️ Every label tells a story · [About] [Help]                  │
└────────────────────────────────────────────────────────────────┘
```

(Horizontal orientation for tape labels is shown the same way with
the cut line on the right edge — see
`amendment-canvas-orientation.md` §4 for the toggle UI.)

---

## 6. Implementation

### 6.1 New State

```typescript
interface CanvasState {
  widthMm: number;
  heightMm: number | null;        // null = continuous
  source: 'detected' | 'manual' | 'sheet' | 'custom';
  sheetCode?: string;             // if derived from a sheet template
}
```

**`source` semantics:**

- `'detected'` — set by us, either from printer auto-detect or as the
  first-visit default (62mm continuous, or last value from
  localStorage). Not the user's deliberate choice.
- `'manual'` — user explicitly picked from "Common sizes".
- `'sheet'` — user picked from "From sticker sheet"; `sheetCode`
  identifies which.
- `'custom'` — user entered free-form dimensions.

Auto-resize-on-printer-connect (§2.2) fires only when
`source === 'detected'`. Once the user touches the selector the
choice replaces detection until they revisit.

**mm lives in the editor, dots live in the document.** Designer-core's
`CanvasConfig` keeps `widthDots`/`heightDots`/`dpi` as today — this
amendment doesn't change designer-core. mm is what the user picks and
what the UI displays; dots is what gets persisted.

- On every mm change in the editor, derive
  `widthDots = round(widthMm × dpi / 25.4)` and call designer-core's
  `setCanvas`.
- On document load, recover mm from
  `widthMm = widthDots × 25.4 / dpi` using the document's stored DPI
  (not the connected printer's). The user designed at that DPI.
- For the continuous sentinel: `heightMm: null` ↔ `heightDots: 0`.

This is **slightly lossy** for non-grid-aligned sizes — 28.6mm
authored at 300dpi rounds to 338 dots, which read back as 28.6107mm.
The printed output is determined by dots either way; only the
displayed mm readout drifts. Acceptable until 1.0 (when we may
revisit and store mm canonically across the whole document including
object positions).

**Persistence defaults for old documents** (saved before this amendment):

- `source` missing → `'manual'`
- `sheetCode` missing → `undefined`
- `widthDots` / `heightDots` / `dpi` are already on every prior
  document — `widthMm` / `heightMm` are derived from them on load.

The share-encoder loads any prior schema by filling these defaults.
Bump the encoder version only if the on-the-wire shape changes.

> Sibling: `amendment-canvas-orientation.md` adds an `orientation`
> field to both designer-core's `CanvasConfig` and label-maker's
> editor-side `CanvasState`. Lifted out so this amendment ships
> without a designer-core dependency.

### 6.2 Components

```
src/
  components/
    media/
      LabelSizeSelector.vue       top-bar dropdown — common / sheet / custom
      CustomSizeInput.vue         width + height number inputs
      ContinuousResizeHandle.vue  drag handle on the cut line
```

The new `LabelSizeSelector` reads from a designer-side media store and
*observes* `printer.detectedMedia` to render a "From printer (detected)"
section at the top when a printer is connected. Two stores, one
component — separation of concerns intact, single control for the user.

The existing `components/printer/MediaSelector.vue` is **retired**.
Anywhere the printer panel needs to show "what we're printing on," it
reads `designer.labelSize` directly (or shows the detected media as
read-only text). The dropdown lives in one place.

### 6.3 Starting Length for Continuous

```typescript
function defaultContinuousLength(mediaWidthMm: number): number {
  return Math.round(mediaWidthMm * 4 / 3);
}
```

The argument is the **media's across-roll width** — the fixed
dimension of the roll (12mm for D1 tape, 62mm for QL continuous).
Not the canvas's current width or the display width.

Used when:
- The user picks a continuous media for the first time in the session
- A fresh document is opened
- The user toggles a fixed-size media to continuous via Custom

Existing documents with a saved `heightMm` keep that value — we don't
overwrite a user's manual length.

---

## 7. Out-of-Bounds Objects

### 7.1 Policy: Allow, Warn, Clip

Don't prevent users from placing objects outside the canvas. Sometimes
you want a shape to bleed off the edge. But make it visible that parts
will be cut off on print.

### 7.2 Visual Treatment

Objects extending beyond the canvas edge:

```
┌──────────────────┐
│                   │
│   [text object]   │
│                   │
│         [image obj├──── out-of-bounds portion
│                   │     dimmed + diagonal stripe overlay
├ ─ ─ ─ ─ ─ ─ ─ ─ ┤
└──────────────────┘
```

- In-bounds portion renders normally
- Out-of-bounds portion renders with reduced opacity (~30%) and a subtle
  diagonal stripe overlay — clearly "this won't print" without being ugly
- The object is still fully selectable, movable, resizable
- Objects panel shows ⚠️ next to objects that are partially or fully
  out of bounds
- Tooltip on the ⚠️: "This object extends beyond the label edge —
  the outside part won't print"

### 7.3 Fully Out-of-Bounds

An object entirely outside the canvas (e.g. dragged way off):

- Still visible in the objects panel with ⚠️
- Rendered on the canvas at reduced opacity so the user can find it
- Not rendered in print output at all

### 7.4 On Print/Export

Clip to canvas bounds. Standard behaviour — Illustrator's artboard clips,
Figma's frame clips. What's outside doesn't exist in the output.

### 7.5 When Canvas Resizes

When the user picks a smaller media size and objects become out-of-bounds:

- Don't auto-move or auto-delete objects
- Show a toast: "2 objects are now outside the label edge"
- The user decides: move them, resize them, or accept the clip

### 7.6 Border Radius

Die-cut labels have rounded corners (Brother DK address labels ~2mm,
Avery stickers vary). The editor shows these as a visual guide:

- The canvas edge draws with the corner radius from the media descriptor
  (`cornerRadiusMm` from `SheetTemplate` or `MediaDescriptor`)
- Content behind the rounded corner area gets the same dimmed/striped
  treatment as out-of-bounds content — it's physically cut off by the die
- The radius is a visual guide only — not rendered in designer-core,
  not in PNG/PDF export. The printer prints a full rectangle, the
  physical die cuts the shape.

**Missing `cornerRadiusMm` → no rounded corners drawn.** No fallback,
no "best guess" radius, no warning to the user. Continuous labels,
tape, custom dimensions, and any descriptor without the field render
square corners. If the radius matters, the descriptor needs to declare
it.

Today only `SheetTemplate` exposes `cornerRadiusMm`; the per-driver
`MediaDescriptor` types don't yet. Die-cut Brother labels render
square in the editor until the field is added — planned via the
`media-catalog` work, out of scope here.

### 7.7 Dead Zones

Some printers have non-printable margins — the print head physically
can't reach the edges. Brother QL has 12-pin left/right margins.
LabelWriter has margins. These are already in the driver's media
descriptor (`leftMarginPins`, `rightMarginPins` on extended types).

The editor shows dead zones as subtle shaded strips along the edges:

```
┌──────────────────────────┐
│░░│                    │░░│
│░░│   printable area   │░░│
│░░│                    │░░│
└──────────────────────────┘
  ^                      ^
  dead zone              dead zone
  (non-printable)
```

- Lighter treatment than out-of-bounds — a subtle warm grey tint, not
  the striped overlay. It's not wrong to have content here, it just
  won't print.
- **Missing margin data → no shading.** No fallback margins, no
  warning, no nag. If `leftMarginPins` / `rightMarginPins` aren't on
  the media descriptor, the canvas shows clean edges. Same rule as
  border radius — descriptor declares it or it doesn't exist for
  the editor.
- Content in the dead zone does NOT get a ⚠️ warning — it's too subtle
  to nag about. The visual shading is enough.
- Dead zones are editor-only — not in designer-core, not in exports.
  The renderer produces the full canvas; the printer physically clips.

---

## 8. Affected Plan Sections

- Section 3.3 (media detection) — detection is now a suggestion, not a lock
- Section 14.1 (first visit) — canvas starts at a default size, not blank
- Section 14.3 (layout) — media selector in top bar
- Section 14.4 (designing flow) — auto-grow removed; continuous labels
  use manual drag-to-resize (see §3)
- Phase 2 (canvas setup) — add media selector, out-of-bounds visual
  treatment, drag-to-resize handle for continuous
- Phase 4 (printer integration) — auto-detection updates media selector,
  doesn't override if user has manually selected
- Orientation toggle is split into `amendment-canvas-orientation.md`
  and lands separately

## 9. Implementation Checklist

```
State + persistence:
□ Editor-side canvas store: widthMm, heightMm, source, sheetCode
□ mm in editor → dots derived (round(widthMm × dpi / 25.4)) before
  every setCanvas call to designer-core
□ On document load, recover mm from stored widthDots × 25.4 / dpi
  using the document's stored DPI
□ Share-encoder: load old docs with default source/sheetCode
□ Persist last used media size in localStorage

Media selection:
□ LabelSizeSelector component in top bar (replaces printer/MediaSelector.vue)
□ Retire components/printer/MediaSelector.vue (used in PrinterPopover.vue —
  switch that slot to read-only "detected media" text or remove)
□ "From printer (detected)" section appears when printer is connected
□ Common sizes list (hardcoded, covers all current driver families)
□ Sheet-derived size (pick sheet → extract label dimensions)
□ Custom size input (free-form width/height in mm; "leave empty or 0
  for continuous")
□ Printer detection updates media selector (suggestion, not lock)
□ Connect-after-manual: snap to closest available size + repositioning toast
□ Toast on auto-resize: "Canvas resized to match your printer"

Continuous labels:
□ Drag-to-resize handle on cut line
□ Starting length = round(mediaWidthMm × 4 / 3)
□ Minimum length constraint (can't drag shorter than content)

Out-of-bounds:
□ Dimmed + stripe overlay on out-of-bounds object portions
□ ⚠️ in objects panel for partially/fully out-of-bounds objects
□ Tooltip explaining the warning
□ Clip to canvas bounds on print/export
□ Toast when canvas resize puts objects out of bounds

Border radius and dead zones:
□ Canvas edge draws cornerRadiusMm when present; missing → square corners
□ Content behind rounded corners gets dimmed/striped treatment
□ Dead zone shading when the driver's media descriptor exposes
  non-printable margins (e.g. Brother QL leftMarginPins/rightMarginPins);
  missing → no shading, no warning. Field naming is driver-specific
  for now — generalise to a unit-neutral descriptor field when a
  second driver grows the same need.
□ Both are editor-only visual guides — not in designer-core or exports

i18n:
□ All media selector UI strings
□ Out-of-bounds warning strings
□ Connect-after-manual repositioning toast
```

---

## 10. Tests

State + persistence (`stores/__tests__/designer.test.ts`,
`services/__tests__/share-encoder.test.ts`):
- mm → dots round-trip preserves grid-aligned values exactly
- mm → dots round-trip is lossy for non-grid values; doc store remains
  dots-canonical
- Loading a pre-amendment doc fills `source: 'manual'` and recovers
  mm via stored DPI (not connected printer's DPI)
- localStorage round-trips last-used size; new docs honour it,
  existing docs ignore it
- `source` transitions: `'detected'` → `'manual'` on selector pick,
  `'manual'` stays `'manual'` on printer connect

Media selector (`components/media/__tests__/`):
- "From printer" section appears when printer connected, hides
  otherwise
- Picking a sheet sets `source: 'sheet'`, `sheetCode`, and the
  derived dimensions
- Custom input accepts empty or 0 height as continuous
- Auto-resize-on-connect fires only when `source === 'detected'`
- Connect-after-manual snap toast appears with "may need
  repositioning" copy

Continuous drag-to-resize:
- Starting length = `round(mediaWidthMm × 4 / 3)` for fresh continuous
- Minimum length = bottom edge of lowest object + margin
- Drag commit produces exactly one history entry
- Existing `heightMm` not overwritten on media reselect

Out-of-bounds:
- Object partly outside renders in-bounds normally; out-of-bounds
  portion dimmed + striped
- Object fully outside still appears in objects panel with ⚠️
- ⚠️ tooltip text matches i18n key
- Print/export bitmap is clipped to canvas bounds
- Resizing canvas smaller emits "N objects are now outside" toast
  with correct N

Border radius and dead zones:
- `cornerRadiusMm` drawn when present on `SheetTemplate`; missing →
  square
- Margin shading drawn when descriptor exposes margins; missing →
  clean edges, no warning
- Both visual guides absent from designer-core render output

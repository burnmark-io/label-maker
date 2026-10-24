# label-maker — Amendment: Properties Tab Content

> The Properties tab today is technically-ordered: every field
> the schema defines gets its own labelled row, in roughly the
> order the code declares them. Position lands at the top because
> `BaseObject` declares `x, y, width, height` first; type-specific
> content like text content or barcode data ends up further
> down. Sliders are the only control for ranged values, which
> makes precise rotation (e.g. exactly 45°) a chore. Names show
> as a top-of-panel input that most users never touch — and
> never customise, because new objects all land with the same
> generic display label ("Text", "Text", "Text"...) so the
> Object list becomes unscannable.
>
> Re-order by frequency of use. Cluster controls the way a
> real rich-text editor or image editor would — a formatting
> toolbar adjacent to the content it formats, not as a list of
> labelled rows. Replace plain sliders with hybrid input+slider
> pairs for precision. Auto-name new objects monotonically per
> type. Move name editing inline (list row + selection header),
> matching the DataPanel rename pattern.
>
> **Scope is the Properties tab content, plus auto-naming and
> inline rename.** This amendment depends on the sidebar IA
> amendment landing first (Properties tab as a sibling tab,
> selection header, document-as-root row). It doesn't change
> tab structure, auto-switch, mobile drawer, or selection model.
>
> Sibling amendments:
> - `amendment-sidebar-ia.md` — **must land first.** Establishes
>   the Properties tab and selection header surface this
>   amendment fills with content.
> - `amendment-multi-select-fixes.md` — its §7 properties story
>   is already deferred to the Properties tab; the use-ordered
>   layout in this amendment is what multi-select selection-
>   aware rendering uses.
> - `amendment-text-overflow.md` (backlog) — overlaps with the
>   Text section's "Style" sub-fold. When that amendment ships,
>   any new text-fitting modes go into the Style sub-section
>   the same way letterSpacing/lineHeight do here.

---

## 1. The Problem

**Properties order is technical, not workflow-based.** The first
section a user sees when they open Properties on a text object
is the position fields — X, Y, Width, Height. None of those
are typically edited from the panel; they're handled by drag-
on-canvas. The thing the user is actually in the panel to edit
(the text content, font, colour) is buried below.

**Sliders alone are imprecise.** The rotation slider in
`CommonProperties.vue` snaps to integer degrees but its drag
resolution is ~5° on typical screens. Setting exactly 45° or
90° requires multiple drag-tweak cycles. Same problem for
opacity, threshold, line height — every ranged field.

**Names are a wasted top-of-panel input.** The name field
appears prominently as the first input in current properties
panels, but most users never customise it. Combined with the
generic default ("Text", "Text", "Text"...) the Object list
becomes unscannable when there are more than two objects of
the same type. Users either ignore the name field entirely
(which keeps the list unscannable) or treat it as a chore
(which puts a UI papercut on every new object).

**Type-specific controls don't cluster naturally.** Text content
sits in one row; bold/italic/underline are separate
checkboxes/buttons elsewhere; alignment is yet another row;
colour another. None of them visually relate to the content
they format. Compare to any rich-text editor where the toolbar
is *right there* above the textarea.

---

## 2. Scope

In:
- **Section reordering by use frequency** in the Properties
  tab. Type-specific section leads; Appearance below;
  Position & Size collapsed by default at the bottom.
- **WYSIWYG-style type-specific layouts** for each object
  type — formatting toolbars adjacent to content, visual type
  pickers, conditional fields based on subtype.
- **Hybrid input+slider** as a single component (`HybridNumberInput.vue`),
  used for every ranged numerical field: rotation, opacity,
  threshold, letter spacing, line height, corner radius. Plain
  number inputs (no slider) for X / Y / W / H — those are not
  ranged values.
- **Auto-naming new objects** as `<TypeLabel> <N>`, where `N`
  is `max(parsed N from existing object names of that type) + 1`.
  Computed at creation time — no stored counter, no load-time
  seeding. Numbers may be reused after deletion of the highest-
  numbered object (acceptable — see §9.3).
- **Inline rename** on Object list rows and the selection
  header. Click the name → it becomes a focused text input.
  Enter or blur commits; Esc cancels. Same store action drives
  both surfaces.
- **Removing the name input from Properties content.** Name no
  longer lives as a labelled row at the top of the type-specific
  section — it lives in the selection header (where the user is
  already looking) and the Object list row (where they
  reference it).

Out:
- **Tab structure / IA / auto-switch / mobile drawer.** All in
  `amendment-sidebar-ia.md`.
- **Selection model changes.** `'$document'` sentinel and
  selection state shape stay as the IA amendment defines them.
- **Document Properties layout.** The IA amendment defines what
  fields appear; this amendment doesn't restyle them
  (document properties is small enough that the use-ordered
  reordering doesn't change anything substantial).
- **New schema fields.** No additions to `BaseObject` or any
  per-type object. The hybrid input+slider only changes how
  existing fields are *edited*, not what's stored.
- **Cross-document name uniqueness.** Each document is named
  independently; copying an object across documents (future)
  gets re-numbered against the destination's existing names.
- **Renaming during Cmd+D duplicate.** Duplicates inherit the
  source object's name + " copy", or get a fresh
  auto-numbered name (decision punted to implementation —
  whichever feels right; both are conventional).

---

## 3. Section Order

Three sections, every object type, in this order top to bottom:

1. **Type-specific section** — what is this thing? Its content
   and visual definition. Most edited.
2. **Appearance** — opacity, visible, locked. Frequently
   adjusted.
3. **Position & Size** — collapsed by default. Power users
   expand for exact numerical positioning. Most users drag on
   the canvas.

The selection header (sticky, owned by the IA amendment) sits
above all three. Multi-selection of mixed types hides the
type-specific section; Appearance and Position & Size remain.

---

## 4. Type-Specific Layouts

### 4.1 Text — WYSIWYG Layout

```
┌──────────────────────────────────┐
│ Hello world ✎       [Deselect]   │  ← from IA amendment
├──────────────────────────────────┤
│ Inter ▾    24pt ↕                │  ← font + size, inline
│ [B] [I] [U]   [⤄ L] [⤄ C] [⤄ R]  │  ← formatting toolbar
│ ▣ #1c1917   [    invert]         │  ← colour + invert
│ ┌──────────────────────────────┐ │
│ │ Hello world                  │ │
│ │                              │ │  ← content textarea
│ │                              │ │     (grows with content)
│ └──────────────────────────────┘ │
│ ▸ Style                          │  ← collapsed by default
├──────────────────────────────────┤
│ Appearance …                     │
├──────────────────────────────────┤
│ ▸ Position & Size                │
└──────────────────────────────────┘
```

The toolbar sits above the content textarea — visually mirrors
a rich-text editor. Bold / italic / underline / alignment /
colour are all adjacent to "what's about to change."

The textarea grows with content (existing autoHeight wiring
applies; the textarea isn't trying to render the styled output,
just to provide an editable text source).

The "Style" sub-section, collapsed by default, holds:
- `letterSpacing` (with hybrid input+slider)
- `lineHeight` (hybrid input+slider, displayed as a multiplier)
- `wrap` (checkbox)
- `autoHeight` (checkbox)

These are real controls users sometimes need but rarely; out
of the lead.

### 4.2 Image

```
┌──────────────────────────────────┐
│ Image ✎             [Deselect]   │
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │   (thumbnail preview)        │ │
│ │                              │ │
│ │   [Replace image…]           │ │
│ └──────────────────────────────┘ │
│ Fit  [Contain ▾]  [    invert]   │
│ ▸ Thermal                        │  ← collapsed
├──────────────────────────────────┤
│ Appearance …                     │
├──────────────────────────────────┤
│ ▸ Position & Size                │
└──────────────────────────────────┘
```

Thumbnail + Replace at the top — that's almost always why a
user opens image properties.

The "Thermal" sub-section, collapsed, holds:
- `threshold` (hybrid input+slider, 0–255)
- `dither` (checkbox)

Critical for actual print output but rarely tweaked once set.

### 4.3 Barcode / QR

```
┌──────────────────────────────────┐
│ QR Code 1 ✎         [Deselect]   │
├──────────────────────────────────┤
│ Type    [QR Code ▾]              │
│ ┌──────────────────────────────┐ │
│ │ https://example.com          │ │  ← data textarea
│ └──────────────────────────────┘ │
│ ▸ Encoding                       │  ← collapsed
├──────────────────────────────────┤
│ Appearance …                     │
├──────────────────────────────────┤
│ ▸ Position & Size                │
└──────────────────────────────────┘
```

Data textarea is the most-edited field. Type stays at the top
because changing format is rare but high-impact.

The "Encoding" sub-section, collapsed, holds the per-format
options: ECC level (QR), checksum, padding, options that vary
by symbology. Some of these are required for valid output but
have sensible defaults.

### 4.4 Shape

```
┌──────────────────────────────────┐
│ Rectangle 1 ✎       [Deselect]   │
├──────────────────────────────────┤
│ Type  [▢ Rect] [○ Ellipse] [/ Line] │  ← visual picker
│ ☑ Fill   ▣ #1c1917               │
│ Stroke   [2]px ↕                 │
│ Corner radius  [4]   [────●─]    │  ← rectangle only
│ [    invert]                     │
├──────────────────────────────────┤
│ Appearance …                     │
├──────────────────────────────────┤
│ ▸ Position & Size                │
└──────────────────────────────────┘
```

Three-button visual picker for shape type — recognisable by
icon, faster than a dropdown for three options.

Conditional fields:
- `cornerRadius` shown only for rectangle
- `lineDirection` shown only for line

### 4.5 Group

Group object's properties section is sparse — there's not much
to edit on a group itself beyond appearance and position. The
type-specific section just shows "Group of {N} items" with a
small "Ungroup" button. Children are visible in the Object
list (indented under the group).

---

## 5. Position & Size

Expanded:

```
┌──────────────────────────────────┐
│ ▾ Position & Size                │
│   X  [12]px       Y  [10]px      │
│   W  [80]px       H  [40]px      │
│   Rotation  [12]° [────●──]      │  ← hybrid input + slider
└──────────────────────────────────┘
```

X / Y / W / H are plain number inputs. They aren't ranged; a
slider would mislead.

Rotation gets the hybrid treatment — its range (-180 to 180)
suits a slider, but precision matters too.

For multi-selection: X / Y / W / H show mixed-value placeholders
when values differ across the selection. Editing a field
applies to all selected (one transaction).

---

## 6. Hybrid Input + Slider Component

```
Field name  [42]   [─────●────]
            ^^^^   ^^^^^^^^^^^
            input  slider, both bound to the value
```

Single component, `HybridNumberInput.vue`, used for every
ranged numerical field across the properties tab.

Behaviour:
- Number input is the source of truth for precision; type a
  value, blur or Enter commits.
- Slider is the coarse companion; drag for quick adjustment.
- Editing either updates the other live (two-way binding to
  the same model value).
- Step / min / max defined per usage (rotation: -180 to 180,
  step 1; opacity: 0 to 1, step 0.01 displayed as 0–100%; etc.).
- Slider keyboard arrows nudge by step.
- Input keyboard arrows also nudge by step (native browser
  behaviour for `<input type="number">`).
- Disabled state and mixed-value placeholder both supported
  for multi-select.

Used by:
- Rotation (Position & Size)
- Opacity (Appearance)
- Threshold (Image / Thermal)
- Letter spacing (Text / Style)
- Line height (Text / Style)
- Corner radius (Shape)

Plain `<input type="number">` for fields that aren't ranged:
X / Y / W / H, font size, stroke width, barcode quiet-zone
padding values.

---

## 7. Auto-Naming New Objects

Today new objects often land with a placeholder display name
("Text", "Rectangle", "QR Code") or no name at all. The Object
list shows them by display name, so a label with five text
elements ends up as five identical "Text" rows.

On creation (toolbar add button, right-click → Add here, paste,
duplicate, drag-import — every code path that produces a new
object) assign a default name of the form `<TypeLabel> <N>`.
`N` is computed at creation time as `max(parsed N for that
type from current object names) + 1`. If no existing object
matches the pattern, `N` starts at 1.

```
Text 1
Text 2          ← user creates two text objects
Text 3          ← user creates a third
                  user renames Text 2 → "Greeting"
Text 4          ← next text → max(1, 3) + 1 = 4
```

Naming rules:
- **Computed from current names, not stored.** No counter
  metadata, no seeding step on load — every creation just reads
  what's there. This handles undo/redo correctly out of the box
  (redoing the create of "Text 5" re-yields "Text 5" because
  the parsed max is unchanged by undo/redo), works for
  pre-amendment documents with no migration, and naturally
  reflects renames (renamed objects drop out of the pool).
- **Per-type, per-document.** Each type's name pool is
  independent.
- **Numbers may be reused after deletion** of the highest-
  numbered object — see §9.3. Acceptable: auto-names are
  starting values, users rename if they care.
- **User can rename anytime.** Inline rename (§8) edits
  auto-named objects exactly the same as user-named ones.

Type labels (the human-readable prefix) are localised. English
defaults:
- `text` → "Text"
- `rectangle` → "Rectangle"
- `ellipse` → "Ellipse"
- `line` → "Line"
- `image` → "Image"
- `barcode` → "Barcode" (or specific subtype: "QR" for QR codes)
- `group` → "Group"

Mapping lives in a single helper so other locales can override
each label.

Locale switch: parsing happens against the *current* locale's
label. Opening a document with English-named "Text 1" while
the UI is set to a locale with a different prefix means the
new locale's pool starts fresh — existing names are untouched
and just don't influence the new pool. Acceptable; names are
user-replaceable.

---

## 8. Inline Rename

Names are editable in two places:

- **Object list rows** — click the name text on a row → it
  becomes a focused text input. Enter / blur commits. Esc
  cancels. Same pattern as `DataPanel` dataset rename.
- **Selection header** — click the name text or the small
  pencil affordance next to it → same in-place edit.

Both surfaces edit `object.name` through the same store action,
so they stay in sync via reactivity. No separate code path for
each surface.

Editing rules:
- Empty name on commit → discard the edit, restore the prior
  name. (No empty names; the name field is the user's
  reference label.)
- Whitespace-only name → trim; if empty after trim, treat as
  empty (discard).
- Long names (> 80 chars) clamp at 80 to keep list rows from
  blowing up.

The name is **not** rendered as an input field at the top of
the Properties content. It lives in the list and the header,
where the user actually references it.

---

## 9. Edge Cases

### 9.1 Hybrid Input — Out-of-Range Typed Value

Number input accepts any value the user types. On commit
(blur or Enter), clamp to min/max. Slider position updates to
match.

### 9.2 Hybrid Input — Mixed Value in Multi-Select

When values differ across the selection, the input shows a
"—" placeholder; the slider thumb hides (no meaningful
position to render). Typing a value commits to all selected
objects in one transaction.

### 9.3 Auto-Name Reuse After Deletion

Because `N` is computed as `max(parsed N) + 1` at creation,
deleting the highest-numbered object of a type frees that
number for the next creation. Deleting "Text 2" from
{Text 1, Text 2} and adding a new text yields "Text 2" again.
This is by design — auto-names are starting values, not
stable identifiers, and users who care rename. Undo/redo
behaves intuitively: redoing the create of "Text 5" re-yields
"Text 5" because the parsed max is unchanged by the undo/redo
cycle.

If a user *manually* renames an object to clash with an
existing auto-name (e.g. renames a third object to "Text 2"
while "Text 2" still exists), we don't intervene. Users can
name things however they want.

### 9.4 No Counter Seeding on Load

Naming reads existing names directly at creation time, so no
load-time seeding is needed. Pre-amendment documents work
without migration; documents created in one locale and opened
in another start the new locale's pool fresh (see §7).

### 9.5 Inline Rename Discard on Tab Switch

User starts renaming, then switches tabs (e.g. via auto-switch
on a different selection event). Pending rename commits as if
blur fired — its current value is committed (or discarded if
empty). Doesn't lose work and doesn't strand a rename in an
ambiguous state.

### 9.6 Inline Rename Conflict with Drag-Reorder and Long-Press

Object list rows are drag-reorderable. Click-to-rename and
drag have different gestures (click vs drag-past-threshold)
but on touch they can race. Two viable touch affordances for
rename:
- Long-press → enter rename, short tap → select, drag → reorder.
- Dedicated pencil-icon hit target on the row → enter rename;
  tap selects; drag reorders.

**Default for this amendment is the pencil affordance**, since
it doesn't conflict with any other gesture and works regardless
of how the context-menu story shapes up.

**Note for `amendment-canvas-context-menu.md` (lands later).**
That amendment plans to use long-press as the touch trigger
for the context menu, which would collide with option (a)
above and with any future "long-press to rename" idea on
Object list rows. Since this Properties amendment lands first,
the long-press collision is left for the context-menu
amendment to resolve. Options it has: (i) exempt Object-list
rows from long-press context menu, (ii) keep rename on the
pencil affordance only and route long-press to context menu
everywhere, (iii) some other split. Pencil affordance is the
safe default until that decision is made.

### 9.7 Sub-Section Persistence

The collapsed/expanded state of "Style" / "Thermal" /
"Encoding" / "Position & Size" sub-sections persists per
object type to localStorage. User who expands "Position &
Size" once expects it to stay expanded for the next text
object too. Per-object would be too granular; per-type is
the right grain.

### 9.8 Toolbar Buttons in Multi-Select

Bold / italic / underline buttons in the text formatting
toolbar: when all selected text objects share the same value
they show as on/off; when they differ they show as
indeterminate (mixed). Tapping commits to all selected. Same
rule as checkboxes elsewhere.

### 9.9 Replace Image in Multi-Select

The Replace Image button on a multi-select of image objects
is hidden — replacing an image is per-object, and "replace
all selected images with the same file" is a niche operation.
Multi-select shows Fit, Thermal, Appearance, Position & Size
only.

---

## 10. Files Affected

```
src/components/panels/
  PropertiesPanel.vue           reorder sections per §3 (type
                                first, Appearance, Position &
                                Size collapsed)
  TextProperties.vue            rework into the WYSIWYG layout
                                per §4.1 — formatting toolbar
                                above the content textarea;
                                "Style" sub-section collapsed
  ImageProperties.vue           thumbnail + Replace at top;
                                "Thermal" sub-section collapsed
  BarcodeProperties.vue         data textarea prominent;
                                "Encoding" sub-section collapsed
  ShapeProperties.vue           visual type picker; conditional
                                cornerRadius / lineDirection
  CommonProperties.vue          rotation slider replaced with
                                HybridNumberInput; opacity too;
                                drop the name field (it's in the
                                selection header now)

src/components/common/
  HybridNumberInput.vue         new — input + slider pair
                                with two-way binding
  CollapsibleSection.vue (or extend existing)
                                for the Style / Thermal /
                                Encoding / Position & Size
                                sub-sections; persist state per
                                object type to localStorage
  InlineRename.vue (if not already a component from DataPanel)
                                inline rename input pattern;
                                used by both Object list rows
                                and the selection header

src/components/panels/
  ObjectsPanel.vue              wire up InlineRename on rows
                                (the IA amendment lands the row
                                shape; this amendment lands the
                                rename behaviour)

src/stores/designer.ts
                                addObject computes next name as
                                max(parsed N for type from current
                                object names) + 1; no stored
                                counter, no load-time seeding

src/i18n/
  en.json + others              type-label keys (objectTypes.text,
                                objectTypes.rectangle, etc.) for
                                auto-naming;
                                section headings (text.style,
                                image.thermal, barcode.encoding,
                                position.heading) for collapsibles
```

No designer-core changes and no schema changes — naming is
derived from existing object names at creation time.

---

## 11. Implementation Checklist

```
Section reordering:
□ PropertiesPanel reorders to: type-specific → Appearance →
  Position & Size
□ Position & Size renders collapsed by default
□ Sub-sections (Style / Thermal / Encoding) render collapsed
  by default
□ Collapsed/expanded state of sub-sections persists per object
  type to localStorage

Type-specific layouts:
□ TextProperties: formatting toolbar (B / I / U / align /
  colour / invert) above the content textarea
□ TextProperties: "Style" sub-section with letterSpacing,
  lineHeight, wrap, autoHeight
□ ImageProperties: thumbnail + Replace at top
□ ImageProperties: "Thermal" sub-section with threshold +
  dither
□ BarcodeProperties: type picker first; data textarea
  prominent
□ BarcodeProperties: "Encoding" sub-section with ECC,
  checksum, padding
□ ShapeProperties: three-button visual type picker
□ ShapeProperties: conditional cornerRadius (rectangle) and
  lineDirection (line)

HybridNumberInput:
□ HybridNumberInput.vue with input + slider, two-way bound
□ Step / min / max props
□ Mixed-value (multi-select) state — placeholder + hidden thumb
□ Out-of-range typed value clamps on commit
□ Replace rotation slider in CommonProperties with
  HybridNumberInput
□ Replace opacity slider with HybridNumberInput
□ Apply HybridNumberInput to threshold (image), letterSpacing
  + lineHeight (text), cornerRadius (shape)
□ Plain number inputs (no slider) for X / Y / W / H, font size,
  stroke width

Auto-naming:
□ designer.addObject computes next name as max(parsed N for
  type from current object names) + 1; falls back to 1 when no
  existing object matches
□ Type-label localisation map (text → "Text", barcode subtype
  → "QR" / "Barcode", etc.)
□ Per-type, computed at creation — no stored counter, no
  seeding, no migration

Inline rename:
□ InlineRename component (or reuse DataPanel's if reusable)
□ Wire into ObjectsPanel rows
□ Wire into selection header (the IA amendment provides the
  header surface)
□ Empty / whitespace-only on commit → discard
□ Clamp at 80 chars
□ Esc cancels; Enter / blur commits
□ Pending rename commits on tab-switch (treat like blur)

Drop the old name input:
□ Remove the name <input> from CommonProperties (or whichever
  component currently renders it)
□ Confirm no other surface relies on it

i18n:
□ Type-label keys for auto-naming
□ Sub-section heading keys
□ Hybrid input formatted-value keys (e.g. "%" for opacity)
```

---

## 12. Tests

Section ordering
(`components/panels/__tests__/PropertiesPanel.test.ts`):
- Type-specific section renders first
- Position & Size is collapsed by default
- Sub-section state persists across mounts via localStorage

Type-specific layouts:
- TextProperties renders the formatting toolbar above the
  content textarea
- TextProperties' "Style" sub-section is collapsed initially
- ImageProperties shows the thumbnail and Replace control at
  the top
- ShapeProperties' type picker switches conditional fields
  (rectangle → cornerRadius shown; line → lineDirection shown)

HybridNumberInput
(`components/common/__tests__/HybridNumberInput.test.ts`):
- Typing in the input updates the slider position
- Dragging the slider updates the input value
- Step / min / max enforce bounds
- Out-of-range typed value clamps on commit
- Mixed-value state shows the placeholder and hides the slider
  thumb

Auto-naming (`stores/__tests__/designer.test.ts`):
- New text object gets name "Text 1"; next text "Text 2"
- Add Text 1 / Text 2 / Text 3, rename Text 2 → "Greeting";
  next new text → "Text 4" (max parsed is still Text 3)
- Add Text 1 / Text 2; delete Text 2; next new text → "Text 2"
  again (reuse after deletion is acceptable, see §9.3)
- Loading a document with existing "Text 5" — next new text
  → "Text 6"
- Loading a document with non-numbered names (custom rename)
  → next text starts at "Text 1"
- Per-type — adding a Rectangle doesn't influence the text pool
- Undo of an add removes the object; redo re-yields the same
  name because parsed max is unchanged

Inline rename:
- Click name on an Object list row → input becomes editable
- Click name in selection header → same behaviour
- Enter commits; blur commits; Esc cancels
- Empty / whitespace-only name on commit reverts to prior
- Long names clamp at 80
- Both surfaces stay in sync via the store

End-to-end (manual or e2e):
- Drag rotation slider — coarse adjustment works
- Type 45 in the rotation input — exactly 45° committed
- Add three text objects — list shows Text 1, Text 2, Text 3
- Rename Text 2 to "Greeting" inline on the Object list
- Selection header shows "Greeting" with a pencil affordance
- Add another text — named Text 4 (not Text 2)

# label-maker — Amendment: Sidebar Information Architecture

> The sidebar today consolidates Object selection and per-object
> properties into a single accordion, with one section per object.
> The consolidation reduced tab count from the older Objects +
> Properties split, but it boxed multi-select into a corner —
> there's no natural way to render "edit common properties of N
> selected objects" in an accordion that's modelled as one-section-
> per-object.
>
> Re-introduce Properties as its own surface — but as a sibling
> tab, not a stacked panel. Same tabs on every breakpoint:
> `Object | Properties | Data | Output`. Auto-switch from Object
> to Properties on selection-stable transitions; auto-return on
> deselect. A selection header on the Properties tab gives stable
> "what am I editing" context plus a one-tap deselect, removing
> the need for any detail-screen back-button pattern.
>
> Also: introduce the document itself as a root row in the Object
> list, so document-level fields (name, description, background)
> have a natural home in the Properties tab. Currently those fields
> are scattered across TopBar, Media selector, and not-editable-
> anywhere.
>
> **Scope is the sidebar IA, the auto-switch behaviour, the
> selection header, and the document-as-root row.** No designer-
> core changes. No schema changes (a sentinel selection id is
> added on the label-maker side; the document model is unchanged).
>
> Sibling amendments:
> - `amendment-properties-content.md` — **layered on top of this
>   amendment.** Reworks the Properties tab content (use-ordered
>   sections, WYSIWYG type-specific layouts, hybrid input+slider,
>   auto-naming, inline rename). Lands after this amendment because
>   it fills the Properties tab surface this amendment introduces.
> - `amendment-multi-select-fixes.md` — its §7 "Properties Panel
>   Multi-Select View" simplifies dramatically once Properties is
>   its own tab. After this amendment, multi-select Properties is
>   "render the common BaseObject sections; mixed-value
>   placeholders where values differ" — no MultiSelectProperties
>   component, just selection-aware rendering inside the existing
>   Properties tab.
> - `amendment-canvas-context-menu.md` — independent. Right-click
>   menu doesn't depend on sidebar layout.

---

## 1. The Problem

**The accordion can't model multi-select.** Today's sidebar treats
the Objects list and per-object properties as one collapsible
unit per object. That works for single selection — you click an
object, its accordion section expands, you edit. With multi-
select there's no clean rendering: do you expand all selected
objects' sections? Show only the first? Hide the panel entirely?
Each option is awkward.

**Document-level fields have no home.** Label name lives in the
TopBar. Canvas dimensions live in the Media selector. Background
colour and description aren't editable from the UI at all
(`CanvasConfig.background` and a not-yet-existent description
field). Created/updated timestamps surface only in the library
modal. There's no "edit the document itself" path that maps to
how design tools usually expose page/artboard/document
properties.

**Single-IA-everywhere is achievable and worth it.** The
auto-switch behaviour on a tabbed sidebar is light enough that
desktop users don't suffer from "having to click a tab" — it's
one tap to a tab that auto-actives on selection anyway. In
exchange, mobile and desktop share a single layout, single set
of components, single mental model. Lower maintenance, fewer
breakpoint-specific bugs, simpler onboarding.

**Caveat — single-IA may not stay the right goal.** A tabbed
layout on desktop loses what the accordion did natively:
showing the Object list and the selected object's properties
*at the same time*. Comparing properties across several layers
becomes a tab-swap loop. We're shipping single-IA anyway because
the consistency and maintenance wins outweigh that loss for the
common cases — but if post-launch feedback shows the
simultaneous-view flow was load-bearing, revisit with a
desktop-only split (Object rail + Properties pane) rather than
reverting to the accordion. Not a blocker now; flagged so we
recognise the signal if it shows up.

---

## 2. Scope

In:
- Sidebar tabs unified to `Object | Properties | Data | Output`
  on every breakpoint. No more accordion; no stacked
  Objects+Properties layout; no breakpoint-specific IA
  divergence.
- **Mobile drawer behaviour fixes** (§7): full-viewport-width
  drawer when expanded; persistent tab bar visible in both
  expanded and collapsed states; multiple expand/collapse
  gestures including tap-tab-to-expand-and-switch;
  auto-switch from §4 expands the drawer when fired while
  collapsed.
- **Auto-switch on selection-stable transitions:**
  - 0 → 1+ selected, currently on Object tab → switch to Properties
  - 1+ → 0 selected, currently on Properties tab → switch to Object
  - Manual tab choice (user is on Data or Output) is respected;
    no auto-switch hijack.
- **Modifier-held defer:** while Shift / Cmd / Meta is held during
  a selection-building gesture, defer auto-switch until release.
  Re-evaluate at modifier-up: if selection became non-empty and
  user was on Object tab at gesture start, switch then.
- **Selection header on Properties tab:** sticky strip at top of
  Properties content showing `{name} [Deselect]` (single) or
  `{N} items selected [Deselect]` (multi). Replaces the need for
  any detail-screen back-button pattern.
- **Empty state on Properties tab when nothing is selected:**
  short instruction "Pick an object to edit it." Tab is reachable
  but empty; not disabled.
- **Document as a root row in Object list:** fixed row at the top
  of the Objects list representing the document itself. Click to
  "select" → Properties tab renders document-level fields.
- **Selection model widens:** introduce a `'$document'` sentinel
  id used only when the document root is selected. Stays inside
  the existing `selection: string[]` shape; no migration.
- **Document-level Properties fields:** Name (editable), Description
  (new optional field), Background colour (editable), Created /
  Updated / Object count (read-only). Canvas dimensions display
  read-only with a "Change in Media selector" link.

Out:
- **Properties tab *content*.** The Properties tab is created here
  but its content layout, type-specific WYSIWYG ergonomics,
  hybrid input+slider for ranged values, auto-naming, and inline
  rename all live in `amendment-properties-content.md`. This
  amendment ships the surface; that one fills it. In the
  intermediate state (this amendment landed, content amendment
  not yet), the Properties tab uses today's existing per-type
  components rendered straight — they just live in a tab now
  instead of an accordion.
- Renaming / refactoring tabs beyond the Properties promotion.
  `amendment-output-tab.md` renames Preview → Output and folds the
  Save dropdown's export/print-sheet/share actions into it; that
  rename is tracked there, not here. Object and Data labels are
  unchanged.
- Per-object accordion in the Object list. The Object list goes
  back to a flat layered list of items; properties move to the
  Properties tab entirely.
- Migrating the TopBar's name input. Document name remains
  editable from the TopBar **and** from document Properties — both
  surfaces stay in sync via the same store. (Removing the TopBar
  input is a polish call; deferred.)
- Detail-screen / push-pop navigation pattern. Tabs only.
- Resizable divider between sidebar sections. Tabs don't need it.
- Custom tab ordering / hidable tabs. Static order, all tabs
  visible.
- A new "document description" rendering anywhere outside
  Properties (e.g. in the library modal preview). Description is
  edited in document Properties, persisted on `LabelDocument`,
  displayed where the library already shows it.

---

## 3. Tab Structure

```
┌────────────────────────────────────────────────┐
│  [Object]  [Properties ③]  [Data]  [Output]    │  ← tabs
├────────────────────────────────────────────────┤
│                                                │
│           tab content area                     │
│                                                │
└────────────────────────────────────────────────┘
```

Properties tab carries a small circular notification badge
showing the selection count when ≥1 — a filled coloured circle
with the number, visually distinct from the tab label so it
reads as state, not chrome. Hidden entirely when selection is
empty. Same styling on desktop and mobile.

This badge is the **primary discoverability cue** for "you have
something editable" across all breakpoints. On desktop it tells
a user on the Data or Output tab that there's a selection
waiting in Properties. On mobile-collapsed (§7) it's the *only*
indication the drawer holds editable content — replacing the
earlier idea of auto-expanding the drawer on selection (which
would interrupt canvas gestures). The user controls when to
engage; the badge does the inviting.

### 3.1 Object Tab

```
Objects
┌──────────────────────────────┐
│ 📄 Untitled label            │  ← document root row
│    62×100mm                  │     (clickable, "selects" doc)
├──────────────────────────────┤
│ ▢ Frame                      │
│ T Hello world                │  ← per-object rows; click to select
│ ◫ QR Code                    │
│ ▢ Background bar             │
└──────────────────────────────┘
```

The root row:
- Renders at the top with a small separator beneath
- Clickable: sets selection to `['$document']`
- **Not** drag-reorderable, deletable, hideable, or lockable
- Slightly different styling so it's clearly not a regular layer
  (lighter background, document icon, dimension subtitle)

Per-object rows behave as today — click to select, Shift+click to
add to selection, drag to reorder, lock/visible toggles.

### 3.2 Properties Tab

The Properties tab has three rendering branches:

- **No selection** — empty state ("Pick an object to edit it.")
- **`['$document']` selected** — document fields per §6.3.
- **Object selection (1 or N regular objects)** — the existing
  per-type property components rendered through the new tab
  surface.

The selection header (§5) always renders when selection is
non-empty.

This amendment **does not** restructure the per-type property
components — it relocates them from the accordion into a tab.
`amendment-properties-content.md` reworks their internal layout
(use-ordered sections, WYSIWYG type-specific layouts, hybrid
input+slider, auto-naming, inline rename). In the intermediate
state where this amendment lands without the content one, users
get the existing properties UX in a tab — already a real
improvement over the accordion-can't-handle-multi-select status
quo.

For multi-selection of mixed types, the type-specific section
hides; common BaseObject properties remain. The Properties-content
amendment defines exactly what that looks like; this amendment
defers the rendering rule to it.

The selection header always renders when selection is non-empty
(both single and multi cases). On `'$document'` selection it
reads `"Document [Deselect]"`. Single-object selection shows the
object's name. Multi-object selection shows
`"3 items selected [Deselect]"` with no rename affordance.

(The Properties-content amendment adds click-to-rename pencil
affordances; this amendment ships the static-name version of
the header.)

### Removed sub-sections

The detailed per-type WYSIWYG layouts (Text formatting toolbar,
Image thumbnail-and-replace, Barcode data textarea, Shape
visual type picker), the hybrid-input+slider pattern, the
auto-naming counters, and the inline rename interaction all
live in `amendment-properties-content.md`. Earlier drafts of
this amendment included them inline; they've since moved to
their own plan to keep this one focused on IA shape.

### 3.3 Data Tab

Unchanged from today.

### 3.4 Output Tab (was Preview)

Replaces the Preview tab. Detailed in
`amendment-output-tab.md`. Brief: live preview at the top, plus
sections for Print (visible when connected), Print to sheet,
Save as file (PNG / PDF / .label / .bnmk), and Share. Folds the
existing scattered output actions into one tab. Does NOT
participate in auto-switch — explicit user navigation only.

---

## 4. Auto-Switch Behaviour

### 4.1 The Two Rules

```
Selection 0 → 1+ AND currentTab === 'object'    → switch to 'properties'
Selection 1+ → 0 AND currentTab === 'properties' → switch to 'object'
```

Symmetric, scoped, respects manual tab choice. If the user
manually navigated to Data or Output, neither rule fires —
they stay where they are. The Properties tab badge reflects
the selection count regardless, so they have a visual hint
that editable content is available.

### 4.2 Modifier-Held Defer

During gestures that build up a multi-selection, auto-switch
must NOT fire on each Shift-click. The user wants to keep
adding; yanking them to Properties between additions breaks
the gesture.

Defer rule: while a "selection-building modifier" (Shift, Cmd,
Meta on macOS, Ctrl on others) is held during a pointer
interaction, suppress auto-switch. On modifier-up, re-evaluate:

```typescript
const buildingModifierHeld = ref(false);  // updated by useShiftKey + useMetaKey

watch(buildingModifierHeld, (held, wasHeld) => {
  if (wasHeld && !held) {
    // Modifier just released — re-evaluate auto-switch state.
    maybeAutoSwitch(designer.selection.value);
  }
});
```

`maybeAutoSwitch` applies the §4.1 rules using the current tab
and selection, but also remembers whether the user was on Object
tab at the start of the gesture (so we don't switch them if
they manually changed tabs mid-modifier — unlikely but defensive).

### 4.3 Marquee Select End

A marquee gesture (per `amendment-multi-select-fixes.md` §4)
is its own selection-stable event — the user releases the mouse
when their selection is complete. On marquee-up:
- Selection is finalised.
- No modifier held → auto-switch fires per §4.1.
- Shift held during marquee → defer per §4.2; release fires
  the switch.

### 4.4 Object Tab List Interactions

Clicks on rows inside the Object tab list:
- Single click on a row → selection becomes `[id]`. Auto-switch
  to Properties fires per §4.1 (assuming user was on Object tab,
  which they are — they're clicking inside it).
- Shift-click → modifier held, defer.
- Click on the document root row → selection becomes
  `['$document']`. Same auto-switch rule.

This means clicking a single item in the Object list immediately
takes you to Properties. Build a multi-selection via Shift-click;
release Shift; auto-switch fires.

### 4.5 Cancel Auto-Switch via Esc

If the user presses Esc immediately after auto-switch fires
(within a short window, e.g. 500ms), revert to the prior tab.
Unlikely to be needed in practice; minor polish.

---

## 5. Selection Header

Sticky strip at the top of Properties tab content. Visible
whenever `selection.length > 0` or selection is `['$document']`.

```
┌──────────────────────────────┐
│ {context}        [Deselect]  │
├──────────────────────────────┤
```

Context text:
- 1 regular object → `"{object.name}"` (or display label if
  unnamed)
- N regular objects → `"{N} items selected"`
- `'$document'` → `"Document"`

Deselect button:
- Clears selection (`designer.deselect()`)
- Triggers auto-return to Object tab via §4.1 rule
- Keyboard shortcut: Esc (already wired today)
- 44px hit target on `(pointer: coarse)`

The header replaces the detail-screen back-button pattern we
considered earlier — gives stable "you're editing X" context
plus a one-tap escape, without introducing a second navigation
paradigm.

`amendment-properties-content.md` adds the click-to-rename
affordance (pencil icon, inline edit on click) as part of its
inline-rename work. This amendment ships the static-name
header; that one makes the name editable.

---

## 6. Document Selection

### 6.1 Selection Model

`designer.selection: string[]` stays as a string array. Reserve
the special id `'$document'` for the document root.

```typescript
const DOCUMENT_SELECTION_ID = '$document';

function isDocumentSelected(selection: string[]): boolean {
  return selection.length === 1 && selection[0] === DOCUMENT_SELECTION_ID;
}
```

Pros of this approach over a discriminated union
(`'document' | string[]`):
- Existing code that iterates `designer.selection` keeps working.
- Selection length checks (`selection.length >= 2`) work
  correctly — document selection is always exactly 1 item.
- No migration of stored selection state.

Cons:
- Code that does `designer.document.objects.find(o => o.id ===
  selectedId)` will return `undefined` for `'$document'` —
  consumers must filter or branch. Acceptable; a small helper
  hides the cost.

### 6.2 What Cannot Multi-Select With Document

`'$document'` cannot be combined with regular object ids in the
selection. If the user Shift-clicks a regular object while doc is
selected, replace selection with `[objectId]`. Same direction:
clicking the document root while a regular object is selected
replaces with `['$document']`. Documents and objects are
mutually exclusive selection scopes.

### 6.3 Document Properties Fields

```
Document
├── Name              [Untitled label             ]
├── Description       [                           ]
│                     [                           ]
│                     (multi-line text area)
├── Background        [▣ #ffffff]
├── Canvas size       62 × 100 mm  [Change in Media…]
├── Created           2026-04-29 14:32
├── Updated           2026-04-29 14:50
└── Objects           5
```

| Field | Editable | Storage |
|---|---|---|
| Name | yes | `LabelDocument.name` (existing) |
| Description | yes | `LabelDocument.description` (already optional in schema) |
| Background | yes | `LabelDocument.canvas.background` (existing, no current UI) |
| Canvas size | display-only | derived from `canvas.widthDots`/`heightDots`/`dpi`; "Change in Media…" link opens Media selector |
| Created | display-only | `LabelDocument.createdAt` |
| Updated | display-only | `LabelDocument.updatedAt` |
| Objects | display-only | `document.objects.length` |

Editing a document field uses `designer.setDocumentMetadata` (or
equivalent) — the same store path used elsewhere for document-
level state.

### 6.4 TopBar Name Input

The TopBar's name input stays. Both surfaces edit
`document.name` through the same store; reactivity keeps them in
sync. Removing the TopBar input is a polish call — deferred.

---

## 7. Mobile Drawer Behaviour

The single-IA approach means tab structure and auto-switch
behaviour are identical across breakpoints. But the *container*
that holds the tabs differs: desktop has a fixed rail; mobile
has a slide-up drawer. Two issues with the current drawer:

**(a) Drawer isn't full-width.** On phone-sized screens the
drawer leaves margin around it, making it feel like a floating
panel rather than the primary editing surface. Phone real estate
is precious; the drawer should claim 100% of the viewport width
when expanded.

**(b) Collapsed state is just a drag-lip.** When the drawer is
collapsed, only a small handle is visible. Users have to know
about the lip and aim for it. Worse: there's no indication of
*which* tab they'd land on, or that the editing UI is even still
reachable. The drawer might as well be gone.

Fix both with a persistent tab bar.

### 7.1 Drawer Width

On `(pointer: coarse)` and `max-width: 768px` (the sidebar-rail
breakpoint), the drawer's expanded width is 100vw. Border-radius
flattens to 0 on the bottom edges so it sits flush against the
viewport sides — feels like the primary surface, not a floating
sheet.

Tablet portrait (768px – ~1024px) keeps a small inset and rounded
corners — still drawer-like, but with breathing room around it.
Above that, the desktop fixed rail takes over.

### 7.2 Persistent Tab Bar

The mobile drawer has two states (expanded / collapsed) and the
tab bar is **visible in both**. Layout:

```
Expanded:                       Collapsed:
┌─────────────────────────┐    ┌─────────────────────────┐
│                         │    │                         │
│      canvas area        │    │      canvas area        │
│                         │    │                         │
│                         │    │                         │
├─────────────────────────┤    │                         │
│ ━━━━━ (drag handle)     │    │                         │
│                         │    │                         │
│   tab content area      │    ├─────────────────────────┤
│                         │    │ ━━━ (drag handle)       │
│                         │    │ Object|Props|Data|Prev  │
│                         │    └─────────────────────────┘
├─────────────────────────┤
│ Object|Props|Data|Prev  │
└─────────────────────────┘
```

In both states the tab bar sits at the bottom of the drawer,
which is at the bottom of the viewport — within thumb reach.
The drawer's height is what changes between states:
- **Expanded** — content area + tab bar; drawer occupies ~70%
  of viewport height (configurable; user can drag to adjust).
- **Collapsed** — tab bar only + drag handle; drawer occupies
  the height of those two strips (~80px total).

The tab bar in collapsed state still shows the active tab and
the selection-count badge. When the user taps an inactive tab,
the drawer expands AND switches to that tab — same gesture, two
effects. Tap the active tab when expanded → collapse. Tap the
active tab when collapsed → no-op (already on it; expansion
happens via dedicated gestures below).

### 7.3 Expand / Collapse Gestures

Multiple ways to toggle the drawer:

| Gesture | Effect |
|---|---|
| Tap an inactive tab while collapsed | Expand + switch to that tab |
| Tap the active tab while expanded | Collapse |
| Drag the handle up | Expand |
| Drag the handle / drawer down | Collapse |
| Tap on canvas (outside drawer) while expanded | Collapse |
| Auto-switch fires while collapsed | Active tab silently changes in the (visible) tab bar; Properties badge updates with selection count. **Drawer does NOT auto-expand.** |

The auto-switch interaction with collapse: if the drawer is
collapsed when the §4 auto-switch rule fires, the active tab
silently updates in the tab bar (which is always visible per
§7.2) and the Properties badge updates with the selection
count. The drawer does **not** auto-expand. Tapping the
now-active Properties tab expands directly into editing. This
preserves the canvas gesture context — auto-expanding a drawer
mid-gesture would interrupt the user — while still surfacing
"there's something editable here" via the badge.

### 7.4 Tab Bar Height and Active-Tab Hint

Tab bar height: 56px on `(pointer: coarse)` (44px hit target +
padding). Active tab visually distinct (top border accent +
filled icon, optional label colour shift). Collapsed-state tap
on the active tab is intentionally inert; if the user wants to
expand without changing tabs, they drag the handle.

Selection count badge on the Properties tab visible in both
states — important affordance for "you have stuff to edit"
when collapsed.

### 7.5 Collapsed Default

After a fresh app load on mobile, the drawer starts collapsed
so the canvas has full screen room. Selection does **not**
auto-expand the drawer — the Properties tab badge appears with
the selection count, inviting a tap. Persisted state
(localStorage) remembers the user's preferred drawer state
across sessions.

### 7.6 Other Mobile-Aware Details

- **Tab labels on narrow screens:** under ~380px width, labels
  collapse to icons + tooltip on long-press. Tabs stay tappable.
- **Selection header on touch:** `[Deselect]` button has a 44px
  hit target on `(pointer: coarse)`. Aligns with the context-
  menu amendment's coarse-pointer rule.
- **Drag-handle as collapse affordance:** still present, still
  draggable, still labelled (aria) as "Resize drawer". The tab
  bar handles discoverability; the lip handles fine-grained
  resize.

---

## 8. Edge Cases

### 8.1 Manual Tab Switch During Modifier-Hold

User Shift-clicks twice (selection grows to 2), then taps the
Data tab while still holding Shift. They're now on Data with
Shift held. On modifier release we'd otherwise auto-switch to
Properties, hijacking them. Suppress: the §4.2 re-evaluation
checks the *current* tab at modifier-up, not just at gesture
start. If they're on Data, leave them alone.

### 8.2 Selection Cleared by External Action

A delete operation (Cmd+Backspace) clears the selection. The
0 → 0 transition is a no-op for auto-switch; the 1+ → 0 rule
fires only on a real transition. After delete, the user might be
on Properties showing the now-deleted object; the empty-state
fallback renders cleanly.

### 8.3 Document Selected → Object Created

User selects the document, then drags a new shape onto the
canvas. The new object becomes selected (replacing
`'$document'` per §6.2). The 1 → 1 transition isn't covered by
§4.1's 0 → 1+ rule, but the *content* of the Properties tab
changes (from document to the new object). No tab switch needed
— user is already on Properties.

### 8.4 Multi-Select Containing Mixed Types

Properties tab shows the common BaseObject sections only; type-
specific sections (Font / Barcode / Image) hide unless every
selected object shares a type. Heterogeneous selection
behaviour is documented in `amendment-multi-select-fixes.md` §7.

### 8.5 Document Root and Locking / Hiding

The document root row in the Object list does not show lock or
visibility toggles. Visibility / lock concepts don't apply to
the document container. Other tools handle this the same way
(Figma's page row, Sketch's artboard row).

### 8.6 Drag-Reorder of the Document Root

Suppressed. The root row is fixed at the top.

### 8.7 Selecting From a Tab That Has Properties Open

User is on Properties (looking at object A). They click object B
in the Object tab — selection changes to `[B]`. Properties
content updates to show B. No auto-switch needed (already on
Properties).

### 8.8 Drawer Collapsed With Active Selection

User has a selection, drawer is collapsed (manually). Properties
tab badge shows the selection count — discoverable without
expanding. The selection header content is hidden until
expanded; that's fine — the tab bar carries enough context (the
badge "③" on the Properties tab) to know it's there.

### 8.9 Drawer Expanded With No Selection

Empty state on Properties tab is visible if user is on
Properties when selection clears. They can swipe to Object tab
or tap the canvas to collapse.

### 8.10 Auto-Switch Race With Manual Drag

User drags the handle to collapse while a selection-stable
event is firing auto-switch. Order of operations:
- Auto-switch sets the active tab (e.g. Properties).
- Drag continues; collapse completes.
- Result: drawer collapsed, Properties tab is active in the tab
  bar. Next tap on Properties tab expands directly into the
  right state.

No conflict — auto-switch and collapse are orthogonal (one
selects a tab, the other changes drawer height).

### 8.11 Esc on Document Selection

Esc clears selection (existing behaviour). On document selection,
Esc clears to empty selection, triggering the §4.1 auto-return
rule.

---

## 9. Files Affected

```
src/components/layout/
  Sidebar.vue (or wherever the tab container lives)
                              promote Properties to a tab; render
                              the four tabs; auto-switch logic;
                              modifier-defer logic
  MobileDrawer.vue (or the existing drawer container)
                              full-viewport-width on coarse-
                              pointer + narrow viewports; persistent
                              tab bar in both expanded and
                              collapsed states; expand/collapse
                              gestures per §7.3; localStorage
                              persistence of expanded/collapsed state
                              (auto-switch does NOT auto-expand —
                              badge does discovery)
  AppShell.vue                hook up modifier-tracking composable
                              if not already wired

src/components/panels/
  ObjectsPanel.vue            add document root row at top;
                              click handler sets selection to
                              ['$document']; suppress lock/visible/
                              reorder for the root row
  PropertiesPanel.vue         new (or rename existing per-object
                              property containers) — three render
                              branches per §3.2 (empty, document,
                              objects); selection header sticky at
                              top
  DocumentProperties.vue      new — the document-fields view
                              (name, description, background,
                              read-only metadata)

src/composables/
  useShiftKey.ts              already proposed in
                              amendment-text-resize-handles.md;
                              extend if needed for Cmd/Meta tracking
                              or add a sibling useBuildingModifier
  useTabAutoSwitch.ts         new — encapsulates the §4 logic;
                              watches selection + currentTab and
                              fires switches per the rules;
                              owns the modifier-defer evaluation

src/stores/designer.ts
                              add DOCUMENT_SELECTION_ID constant;
                              isDocumentSelected helper;
                              ensure selection-mutating actions
                              treat '$document' as exclusive
                              (Shift-add of a regular object
                              replaces, doesn't merge)
                              add description? to document model
                              if not already there

src/components/layout/
  TopBar.vue                  no change — name input stays; reads
                              and writes the same document.name
                              that DocumentProperties does

src/i18n/
  en.json + others            new keys: properties.empty,
                              properties.documentLabel,
                              selection.headerSingle,
                              selection.headerMulti,
                              selection.deselect,
                              document.name, document.description,
                              document.background, document.created,
                              document.updated, document.objectCount,
                              document.canvasSizeChange
```

No designer-core changes — `LabelDocument.description` is already
optional on the document model. If it isn't, that's a one-line
schema addition.

---

## 10. Implementation Checklist

```
Tab structure:
□ Sidebar renders four tabs (Object / Properties / Data / Output)
□ Tabs render identically on every breakpoint (no breakpoint-
  specific layout)
□ Properties tab badge shows selection count when ≥1

Auto-switch logic:
□ useTabAutoSwitch composable watches selection + currentTab
□ 0 → 1+ on Object tab → switch to Properties
□ 1+ → 0 on Properties tab → switch to Object
□ Manual tab choice (Data / Output) suppresses auto-switch
□ Modifier-held defer (Shift / Cmd / Meta during gesture)
□ Re-evaluate on modifier release; respect current tab at that
  moment
□ Marquee-end is treated as selection-stable; auto-switch fires
□ Properties badge updates live with selection count

Selection header:
□ Sticky strip at top of Properties tab content
□ Renders when selection.length >= 1 OR document selected
□ Single-object: "{name} [Deselect]"
□ Multi-object: "{N} items selected [Deselect]"
□ Document: "Document [Deselect]"
□ Deselect button calls designer.deselect()
□ 44px hit target on (pointer: coarse)

Properties tab content:
□ Empty state when selection is empty
□ Document branch when selection === ['$document']
□ Object branch renders today's existing per-type property
  components straight (this amendment doesn't restructure them
  — that's amendment-properties-content.md)

Object tab document root:
□ Render document row at top of Objects list
□ Click sets selection to ['$document']
□ Visually distinct from layer rows (icon, subtitle, separator)
□ No lock / visible / reorder controls
□ Suppressed from drag-reorder

Auto-naming + inline rename:
□ Out of scope — see amendment-properties-content.md

Document Properties:
□ DocumentProperties.vue with name, description, background,
  read-only canvas size + timestamps + object count
□ "Change in Media selector" link opens the Media surface
□ Edits persist via existing document-mutating store actions
□ Description field added to document if not already present

Selection model:
□ DOCUMENT_SELECTION_ID = '$document' constant in designer store
□ isDocumentSelected helper
□ Document selection is mutually exclusive with object ids:
  Shift-clicking a regular object while doc is selected replaces
  selection
□ Existing iterators that find objects by id handle the
  '$document' case (filter or branch)

Mobile drawer:
□ Drawer expanded width = 100vw on (pointer: coarse) + narrow
  viewport breakpoint
□ Bottom corners flush (no border-radius) at full-viewport width
□ Tablet portrait keeps inset + rounded corners
□ Persistent tab bar at bottom of drawer in both expanded and
  collapsed states
□ Tab bar height: 56px on (pointer: coarse)
□ Active tab visually distinct (top accent + filled icon)
□ Selection-count badge visible in collapsed state
□ Tap inactive tab while collapsed → expand + switch
□ Tap active tab while expanded → collapse
□ Drag handle up → expand; drag down → collapse
□ Tap canvas while expanded → collapse
□ Auto-switch (§4) while collapsed → active tab updates
  silently in tab bar; Properties badge updates; drawer stays
  collapsed (no auto-expand)
□ Properties tab badge styled as a circular notification dot
  (filled coloured circle with number, not parens); hidden when
  selection is empty; identical styling on desktop and mobile
□ Drawer expanded/collapsed state persists to localStorage
□ Fresh-load default: collapsed (canvas gets full screen)
□ Tab labels collapse to icons under ~380px viewport width

i18n:
□ properties.empty, selection.deselect, etc.
□ Document field labels
□ "Change in Media…" link copy
```

---

## 11. Tests

Tab structure (`components/layout/__tests__/Sidebar.test.ts`):
- Four tabs render in order
- Properties badge shows count when selection.length >= 1
- Properties badge hidden when selection.length === 0
- Tabs render identically across breakpoints (no breakpoint-only
  rendering branch)

Auto-switch (`composables/__tests__/useTabAutoSwitch.test.ts`):
- 0 → 1 selection on Object tab → switches to Properties
- 1 → 0 selection on Properties tab → switches to Object
- 0 → 1 selection on Data tab → no switch (stays on Data)
- 1 → 0 selection on Data tab → no switch
- Modifier held during gesture (mocked) → defer; on release,
  switch fires
- Modifier released while user is on a different tab than they
  started on → no switch (respect manual choice)
- Marquee-end (selection populated, no modifier) → switch fires
- Esc within 500ms of auto-switch reverts to prior tab (if
  implemented)

Selection header
(`components/panels/__tests__/PropertiesPanel.test.ts`):
- Header renders for single, multi, and document selection
- Header text matches selection state
- Deselect button calls designer.deselect()
- Header hidden when no selection (empty state shown instead)

Document root row (`components/panels/__tests__/ObjectsPanel.test.ts`):
- Renders at top of list
- Click sets selection to ['$document']
- No lock/visible toggles
- Not drag-reorderable

Selection model (`stores/__tests__/designer.test.ts`):
- isDocumentSelected returns true for ['$document'], false
  otherwise
- Shift-clicking an object while document is selected replaces
  selection (does not merge)
- Clicking the document root while objects are selected replaces

Document properties:
- Editing name flows to designer.document.name
- Editing description flows to designer.document.description
- Background colour edits flow to canvas.background
- Read-only fields render expected values

(Auto-naming, inline rename, and HybridNumberInput tests live
in amendment-properties-content.md.)

Mobile drawer (`components/layout/__tests__/MobileDrawer.test.ts`):
- Expanded drawer renders at 100vw on coarse-pointer + narrow
  viewport
- Tab bar visible in both expanded and collapsed states
- Active tab and selection-count badge visible when collapsed
- Tap inactive tab while collapsed → expand + activate that tab
- Tap active tab while expanded → collapse
- Auto-switch to Properties while collapsed → active tab
  updates in tab bar; badge shows selection count; drawer
  stays collapsed
- Drawer state persists to localStorage across reloads

End-to-end (manual or e2e):
- Click an object → Properties tab activates with object's fields
- Click empty canvas → Object tab activates
- Shift-click in Object list to build multi-selection — no tab
  switching during; on Shift release, switch to Properties
- Click document root → Properties shows document fields
- Esc clears selection → return to Object tab
- Mobile: collapsed drawer shows tab bar with Properties badge
  reflecting selection count; tap Properties tab to expand
  directly into multi-selection editing

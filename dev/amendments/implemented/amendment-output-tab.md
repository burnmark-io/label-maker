# label-maker — Amendment: Output Tab (replaces Preview)

> Today the sidebar's Preview tab does one thing — render a bitmap
> preview of what the printer will receive. It's narrow, conditional
> (only accurate when a printer is connected), and feels lonely as
> a single-purpose tab. Meanwhile, the Save dropdown in the toolbar
> mixes a handful of save and file-lifecycle items with four Export
> formats — exports squatting in a Save menu because there's no
> better home.
>
> Promote Preview → Output. Add a Print section (mirrors the central
> Print button's popup; same `copies`/`density` store) and a
> Save-as-file row (PNG / PDF / .label / .bnmk). Pull Export out of
> the Save dropdown and trim Import out too — Import lives in the
> Library and via drag-and-drop, which is already the more natural
> entry point.
>
> The big orange central Print button stays exactly as it is,
> including its existing fallback to the sheet picker when no
> thermal printer is connected. Output tab's Print section is the
> *same* config surface as the central button's popup — both edit
> a single store, so there's no "default vs configured" split.
>
> **Known temporary regression:** with this amendment alone,
> sheet printing is unreachable when a thermal printer is
> connected (the only entry point becomes the central button's
> no-thermal fallback). The follow-up `amendment-bulk-output-
> semantics.md` adds an explicit Thermal/Sheet destination toggle
> to the Print popup that restores the path. Accepted gap; users
> who need a sheet during the gap can disconnect the printer.
>
> **Scope is the tab rename, the Print + Save-as-file sections in
> the tab, the Save dropdown trim, and routing Import through the
> Library + drag-and-drop.** No changes to the print pipeline,
> the export functions, the sheet picker, or the share encoder —
> just where their entry points live in the UI.
>
> **Deferred to `amendment-bulk-output-semantics.md`:** what
> `copies = N` means in CSV/dataset mode, for both Print and
> Export. Today's behaviour (active row × N copies for Print;
> active row only for Export) is inherited unchanged — fixing the
> "press Print, get 1 of 200" surprise is a separate problem worth
> its own amendment because it spans two surfaces (Print popup +
> Export buttons) and requires a source-selection model.
>
> Sibling amendments:
> - `amendment-sidebar-ia.md` (implemented) — defines the tab
>   structure. Tab name in this amendment changes `Preview →
>   Output`; auto-switch rules stay the same (Output is not
>   auto-switch eligible).
> - `amendment-canvas-ux-papercuts.md` (implemented) §3 — that
>   section was already marked superseded; this amendment is the
>   replacement plan. Shape diverges from §3's "split into File
>   menu + Share button" because Share already has a topbar icon
>   and Print Sheet stays with the central button.
> - `amendment-printer-status-polling.md` — wires the richer
>   status guard (disabled + warning on error) onto **both**
>   surfaces (central button + Output tab Print) when it lands.
>   This amendment ships with only the existing
>   `isConnected` + `effectiveMedia` checks; the polling
>   amendment attaches the rest. Either order is fine.
> - `amendment-multi-file-drop.md` — covers drag-and-drop import
>   (single + multi-file). With Import removed from the Save
>   dropdown, drop is the primary path and the Library modal is
>   the discoverable button-based path.
> - `designer-core-amendment-burnmark-package-format.md` — when
>   `.bnmk` package format ships, it joins the Save-as-file row in
>   the Output tab. Until then, the button isn't rendered.
> - `amendment-bulk-output-semantics.md` (new, follow-up) —
>   addresses CSV-mode multipliers across Print and Export.

---

## 1. The Problem

**Preview is lonely and conditional.** A whole sidebar tab with
one feature, and that feature only renders an *accurate* picture
when a printer is connected. Without a printer, the tab is either
empty, shows a stale preview, or shows a generic-DPI render with
no indication that it's approximate. A whole tab for that.

**Save dropdown carries unrelated cargo.** The toolbar's "Save"
dropdown has Save / Save as new / New / Library / Import / four
Export formats / Print Sheet / Share. Save and Save-as-new are
saves; the rest are squatting. Exports especially are misfiled —
users hunt for "Export PDF" inside a menu labelled Save. Print
Sheet and Share already have natural homes (the central Print
button's no-thermal fallback; a topbar Share icon) and don't need
to live here either.

Folding Export into a tab and trimming the dropdown to genuine
file-lifecycle items fixes both — the lonely tab gets substance,
the misnamed dropdown gets honest.

---

## 2. Scope

In:
- **Rename `Preview` → `Output`** in the sidebar tab list.
- **Output tab content** — three sections: Live preview, Print,
  Save as file (§3).
- **Migrate Export out of the Save dropdown** into the Output
  tab's Save-as-file row (PDF / PNG / .label / .bnmk-when-ready).
- **Single config store for Print** — Output tab's Print section
  and the central button's existing popup edit the same
  `copies`/`density` state. Two surfaces, one source of truth.
- **Trim Save dropdown** to four items: Save current, Save as
  new, New label, Library. Drops Import (now in Library +
  drag-and-drop), Export ×4 (now in Output tab), Print Sheet
  (stays with the central Print button's no-thermal fallback),
  Share (already on topbar as an icon).
- **Import button inside the Library modal**. Existing handler
  (`fileInputRef`/`labelImport.runImport`) relocated; same
  behaviour. Drag-and-drop import is unchanged and remains the
  fastest path.
- **Disconnected-friendly preview.** When no printer is connected,
  render at default 300 DPI with a small "Connect a printer for
  device-accurate preview" footnote.
- **Big orange Print button stays.** Including its existing
  no-thermal → sheet picker fallback (`CanvasActions.vue:252-257`).
- **Print button check parity** — Output tab Print button uses
  the same `isConnected` + `effectiveMedia` checks the central
  button uses today. The richer status guard from
  `amendment-printer-status-polling.md` is wired up in *that*
  amendment when it lands, applied to both surfaces uniformly.

Out:
- **Replacing the central Print button.** Stays as is, including
  the sheet-picker fallback.
- **Print Sheet's location.** Stays accessible via the central
  button's no-thermal fallback only. Not migrated to Output tab;
  not in the Save dropdown. **Known temporary regression for
  thermal-connected users** — fixed by the destination toggle in
  `amendment-bulk-output-semantics.md` §3.
- **Share's location.** Stays as the topbar icon. Not duplicated
  into Output tab or the Save dropdown.
- **Changes to the print pipeline, export functions, sheet
  picker, or share encoder.** Entry points move; implementations
  do not.
- **Bulk-output semantics under CSV mode.** Deferred to
  `amendment-bulk-output-semantics.md`. Today's per-surface
  behaviour is inherited: Print = active row × copies; Export =
  active row only.
- **Print history / re-print last N labels, presets, calibration,
  test patterns, two-colour plane preview.** All future scope.

---

## 3. Tab Content

Sections, top to bottom:

```
Output tab
┌──────────────────────────────────┐
│ ┌──────────────────────────────┐ │
│ │                              │ │
│ │    Live preview              │ │  ← always visible
│ │                              │ │
│ │    (device-accurate when     │ │
│ │     connected; 300dpi else)  │ │
│ │                              │ │
│ └──────────────────────────────┘ │
│ Connect a printer for            │  ← footnote when disconnected
│ device-accurate preview          │
├──────────────────────────────────┤
│ Print                            │  ← visible only when connected
│   Copies   [1]                   │     (mirrors central popup;
│   Density  [Normal ▾]            │      same store)
│   [Print]                        │  ← respects status guard
├──────────────────────────────────┤
│ Save as file                     │  ← always
│   [PNG] [PDF] [.label] [.bnmk]   │     buttons trigger downloads
└──────────────────────────────────┘
```

### 3.1 Live Preview

Renders the same bitmap the existing Preview tab renders. Three
states:

- **Printer connected, family supports preview rendering** —
  device-accurate render using the connected driver's preview
  pipeline (`createPreview()` from the adapter). Shows planes if
  multi-plane (Brother red+black), bitmap dithering if applicable,
  exact dimensions, dead zones if descriptor exposes them.
- **Printer connected, family doesn't support preview** —
  generic 300 DPI render with a small "Preview not available for
  this printer family" footnote. Rare; current driver set all
  support preview.
- **No printer connected** — generic 300 DPI render. Small
  footnote: "Connect a printer for device-accurate preview." User
  can still see what the design looks like; they just don't get
  exact-DPI fidelity.

**Lazy-render triggers** (the preview re-renders only on these):
- Output tab becomes the active tab.
- Document changes *while* Output is the active tab.
- `data.currentIndex` changes (active row) while Output is active
  and a dataset is loaded.
- Connection state changes from disconnected → connected (switch
  from generic 300 DPI to device-accurate render).

`copies` and `density` changes do NOT trigger a re-render — they
don't affect the rendered bitmap. Edits made while another tab
is active queue a single re-render that fires when Output is
re-opened.

### 3.2 Print

Visible only when a printer is connected. Hides entirely when
disconnected (no "ghost" Print section nagging the user). When
disconnected, the central Print button's no-thermal fallback
covers sheet printing — the Output tab doesn't need to duplicate
that affordance.

- **Copies** — number input, default 1, max 30 (matches existing
  `CanvasActions.vue:46`).
- **Density** — dropdown of `light` / `normal` / `dark` (per
  `PrintOptions.density`). Family-supported values only.
- **[Print]** — primary button. Calls the same code path as the
  central orange Print button with the configured options.

**Polling guard posture.** This amendment ships *without* the
status guard wired — the button respects only the existing
checks (`isConnected`, `effectiveMedia`) the central button uses
today. When `amendment-printer-status-polling.md` lands, both
surfaces (central + Output tab) get the guard wire-up in that
amendment, not this one. This decouples the two amendments so
either can ship first.

**Single config store.** The central button's popup
(copies/density inputs at `CanvasActions.vue:46,247`) and this
section bind to the same store. Edit either, both update.
Clicking either button prints with the current values. There is
no "default vs configured" split — the button's behaviour is
exactly what its inputs say.

In CSV/dataset mode, this section inherits today's central-button
semantics: prints **the active row** × `copies`. Hitting "Print"
with a 30-row dataset and copies = 1 produces 1 label, not 30. The
existing Print Batch flow (toolbar entry, modal) still handles
"one of every row." This is acknowledged jank; see
`amendment-bulk-output-semantics.md` for the unified fix.

### 3.3 Save as File

Always visible. Each button triggers a download in the existing
format:

- **PNG** — bitmap export.
- **PDF** — vector-as-best-we-can export.
- **.label** — burnmark JSON document format.
- **.bnmk** — when `designer-core-amendment-burnmark-package-format.md`
  lands. Until then, the button isn't rendered.

Same handlers as the current Save dropdown's Export options. Just
moved here.

In CSV mode, today's exporters use the active row only — no
multi-row PDF, no zip-of-PNGs-per-row. Inherited unchanged. The
follow-up bulk-output amendment defines the fixed model.

---

## 4. Central Print Button — Unchanged

The central orange Print button keeps its existing behaviour
end to end:

- **Connected, ready** — prints using the same `copies`/`density`
  store the Output tab Print section edits.
- **Connected, no effective media** — disabled (existing
  pre-polling check). Richer error-state guard arrives with the
  polling amendment.
- **Not connected** — opens the sheet picker dialog (existing
  fallback at `CanvasActions.vue:252-257`). This is why the
  Output tab doesn't carry a Print Sheet section: the central
  button is already the discoverable entry point for sheet
  printing whenever there's no thermal printer to print to.

The central popup (the small panel that holds `copies` + `density`
inputs today) and the Output tab Print section are two surfaces
on the same store. There is no behavioural drift between them.

---

## 5. Save Dropdown Trim

After this amendment:

```
Before                              After
┌──────────────────────────────┐    ┌──────────────────────────┐
│ Save current        Cmd+S    │    │ Save current   Cmd+S     │
│ Save as new                  │    │ Save as new              │
│ ─────────────────            │    │ ─────────────────        │
│ New label                    │    │ New label                │
│ Library                      │    │ Library                  │
│ Import                       │    └──────────────────────────┘
│ ─────────────────            │
│ Export PDF                   │     (Export → Output tab)
│ Export PNG                   │     (Print Sheet → central button
│ Export .label                │      no-thermal fallback)
│ Export Zip                   │     (Share → topbar icon, unchanged)
│ ─────────────────            │     (Import → Library + drag-drop)
│ Print Sheet                  │
│ Share                        │
└──────────────────────────────┘
```

Every item left in the dropdown is a document-lifecycle action
(save the current doc, branch off a copy, start fresh, browse
saved). The label "Save" is fair scope for the menu — a couple
of items aren't strictly saves (New, Library) but they're
adjacent enough that users won't fight the grouping.

`Cmd+S` continues to drive Save current.

---

## 6. Import Lives in the Library

`Import` is removed from the Save dropdown. Two replacements:

- **Drag-and-drop onto the canvas / library modal.** Already the
  primary import path; expanded by `amendment-multi-file-drop.md`
  for multi-file drops. No change here — just acknowledging that
  this is the discoverable, fastest path now that we're not
  surfacing an Import button in a menu.
- **Import button inside the Library modal.** Users who don't
  know about drag-drop discover Import where they look for saved
  designs. Reuses the existing `fileInputRef` / `labelImport.runImport`
  handler relocated from `CanvasActions.vue:318-328`.

The keyboard shortcut for Import (if any) and any deep-link entry
points stay wired; only the visible toolbar dropdown item moves.

---

## 7. Connected vs Disconnected

| Section       | No printer            | Printer ready | No effective media |
|---------------|-----------------------|---------------|--------------------|
| Live preview  | 300 DPI + footnote    | Device-accurate | Device-accurate (preview unaffected) |
| Print         | hidden                | enabled       | disabled (existing check) |
| Save as file  | enabled               | enabled       | enabled                   |

(Richer printer-error states — paper out, head open, etc. — gain
guard coverage when `amendment-printer-status-polling.md` lands.)

When no printer is connected, the Output tab is still useful: the
preview renders and the export buttons work. The central Print
button's no-thermal fallback handles sheet printing — Output tab
doesn't need to duplicate it.

---

## 8. Auto-Switch Behaviour

`amendment-sidebar-ia.md` §4.1 defines the auto-switch rule for
the Properties tab:

> Selection 0 → 1+ AND currentTab === 'object' → switch to Properties

The Output tab does NOT participate in auto-switch. It's
deliberate user navigation — open it when you're ready to
preview, print, or export. Auto-switching from canvas actions
would be intrusive ("why am I on Output? I just made an edit").

---

## 9. Edge Cases

### 9.1 Family Without Preview Support

Today every supported family supports preview rendering. If a
future driver lacks it, the live preview falls back to 300 DPI
generic with a footnote. Print section still works — the driver
prints fine; it just doesn't expose the preview pipeline.

### 9.2 Print Section Hidden, User Clicks Big Orange Button

Big button is independent of the Output tab. If no printer is
connected it falls back to the sheet picker (existing behaviour).
The Output tab's hidden Print section is just a UI absence; the
underlying capability surface lives elsewhere.

### 9.3 Save-as-File Buttons During an Async Render

Each export button kicks off an async render → download. Two
clicks in quick succession queue (existing behaviour from the
current Save dropdown's Export items). Could disable buttons
during in-flight render; polish, out of scope.

### 9.4 Output Tab Open With No Selection

Output's actions are document-level, not selection-level. The
tab works the same regardless of what's selected.

### 9.5 Mobile Drawer With Output Tab Active

Per `amendment-sidebar-ia.md` §7, the mobile drawer's tab bar
shows all four tabs. Output is reachable the same way as the
others. With three sections (preview, print, save-as-file) the
content height is reasonable in a drawer — no collapse needed.

### 9.6 CSV Mode Surprises

In CSV mode, Print = active row × `copies`; Export = active row
only (copies ignored). A user with 30 rows pressing Print gets
`copies` labels of the active row, not 30. A user pressing Export
PDF gets a 1-page PDF. Both are existing behaviours; the
follow-up `amendment-bulk-output-semantics.md` fixes them with a
unified Source selector. Documented here so reviewers don't
expect this amendment to solve it.

---

## 10. Files Affected

```
src/components/panels/
  PreviewPanel.vue              rename to OutputPanel.vue;
                                restructure into three sections
                                (preview, print, save-as-file)

src/components/output/          new directory grouping the section
                                components (or keep flat in panels/)
  PreviewSection.vue            extracted from current preview
                                render logic + the disconnected
                                fallback
  PrintSection.vue              copies + density + Print button;
                                visible only when connected; uses
                                the existing isConnected +
                                effectiveMedia checks (richer
                                guard wired by polling amendment);
                                binds to the same store as the
                                central popup
  SaveAsFileSection.vue         row of Export buttons (PNG / PDF /
                                .label / .bnmk-when-available)

src/components/toolbar/
  CanvasActions.vue             - Save dropdown: drop Import,
                                  Export ×4, Print Sheet, Share
                                  items; keep Save current,
                                  Save as new, New label, Library
                                - Print popup: unchanged in shape,
                                  but copies/density refs lift to
                                  a shared store (or Pinia slice)
                                  so OutputPanel's PrintSection
                                  can bind to the same state
                                - onImport/fileInputRef wiring
                                  moves to Library; remove from
                                  here

src/components/library/
  DesignLibrary.vue             add Import button (relocated
                                handler from CanvasActions); wire
                                fileInputRef the same way

src/components/layout/
  Sidebar.vue                   rename Preview tab → Output
  AppShell.vue                  if any tab routing references the
                                old name, update

src/stores/
  print-config.ts (new)         hold copies + density as a small
                                Pinia slice; both the central
                                popup and OutputPanel PrintSection
                                read/write here. Separate from
                                printer.ts (which is printer-state:
                                connection, status, model).
                                Bulk-output amendment extends this
                                same store with OutputSelection
                                and PrintDestination.

src/i18n/
  en.json + others              tab label "output" (replaces
                                "preview"); section headings
                                (output.print, output.saveAsFile);
                                disconnected footnote;
                                library.importButton
```

No designer-core changes. No print-pipeline changes. No schema
changes. No new bulk render code (deferred).

---

## 11. Implementation Checklist

```
Tab rename:
□ Rename Preview tab to Output in sidebar layout
□ Update sidebar-IA-aware logic — Output is NOT auto-switch
  eligible; explicit user nav only
□ i18n key sidebar.tab.preview → sidebar.tab.output

Output tab structure:
□ OutputPanel.vue with three sections in order: Preview / Print /
  Save as file
□ Live preview disconnected-friendly (300 DPI fallback + footnote)
□ Live preview lazy-renders when tab is active, not eagerly on
  every doc change while inactive
□ Print section visible only when connection.kind === 'connected'
□ Print section button uses the same isConnected + effectiveMedia
  checks the central button uses today (richer status guard
  attaches in amendment-printer-status-polling.md)
□ Print section copies + density bind to the new print-config
  store, shared with the central button popup
□ Lazy-render triggers per §3.1 (tab active / doc change /
  currentIndex change / connection change; NOT copies/density)
□ Save-as-file section reuses existing export handlers
□ .bnmk button conditional on package-format amendment shipping

Save dropdown trim:
□ CanvasActions.vue Save dropdown contains exactly: Save current,
  Save as new, ──, New label, Library
□ Remove Import / Export ×4 / Print Sheet / Share items
□ Cmd+S keyboard shortcut continues to drive Save current

Import relocation:
□ Add Import button inside DesignLibrary.vue
□ Move fileInputRef + onImport / onFilePicked / labelImport.runImport
  wiring to DesignLibrary
□ Remove the same wiring from CanvasActions.vue
□ Verify drag-and-drop import path is unchanged (covered by
  amendment-multi-file-drop.md)

Tests / verification:
□ Output tab renders three sections with no printer connected
□ Print section appears when a printer connects, disappears when
  it disconnects
□ Editing copies in the central popup updates Output tab Print
  section's copies input, and vice versa
□ Both Print buttons (central + Output tab) call the print
  handler with the same configured options
□ Save-as-file buttons trigger downloads in their respective
  formats
□ Save dropdown shows only the four trimmed items
□ Library modal shows Import button; clicking it opens the file
  picker; selecting a file runs the existing import flow
□ Cmd+S still saves
□ Big orange central Print button unchanged, including no-thermal
  → sheet picker fallback

i18n:
□ sidebar.tab.output (replaces sidebar.tab.preview)
□ output.previewFootnote.disconnected
□ output.previewFootnote.noPreviewSupport
□ output.print.copies, output.print.density, output.print.action
□ output.saveAsFile.* (one per format)
□ library.importButton
□ Apply to en + every other locale
```

---

## 12. Tests

OutputPanel structure
(`components/panels/__tests__/OutputPanel.test.ts`):
- Renders three sections in order (preview, print, save-as-file)
- Print section hidden when not connected
- Print section visible when connected
- .bnmk button rendered only when package-format support is enabled
- Disconnected footnote present below preview when no printer

Print section / shared store:
- Copies input in Output tab and Copies input in central popup
  reflect the same value via the print-config store (mutation
  in either propagates)
- Same for density
- Click [Print] in Output tab calls the same print handler the
  central button uses, with the configured copies + density
- Disabled when not connected or no effective media (current
  pre-polling check parity)

Save dropdown trim
(`components/toolbar/__tests__/CanvasActions.test.ts`):
- Save dropdown contains exactly: Save current, Save as new, New,
  Library
- Import / Export / Print Sheet / Share items absent
- Cmd+S keyboard shortcut still triggers Save current

Save-as-file section:
- PNG / PDF / .label buttons trigger their respective handlers
- .bnmk button absent in the no-package-format build; present
  when the build flag / module is in place

Import relocation:
- Library modal shows Import button
- Click on Import opens the file picker
- Selecting a file runs labelImport.runImport (same handler as
  before)
- Drag-and-drop import to canvas / library still works (smoke
  test against existing flow)

Tab auto-switch:
- Output tab is NOT in the auto-switch list — selection changes
  do not navigate to it
- Manual navigation still works

---

## 13. Deferred — Bulk Output Semantics

Spinning out into `amendment-bulk-output-semantics.md`:

- What `copies = N` means in CSV mode for both Print and Export
  (active row × N? all rows × N? source-selector with explicit
  choice?).
- Dynamic button labels reflecting count ("Print 30 labels").
- Sheet vs thermal unit handling when sheet fallback is the
  destination ("Print 24 labels" = how many pages?).
- Whether the existing Print Batch modal collapses into the
  unified flow or stays as a power-user surface.
- Whether Export PDF / PNG / .label gain a multi-row mode when
  CSV is loaded (a "PDF with 30 pages, one per row"-style
  output).

Until that lands, the inherited per-surface behaviour stands:
Print = active row × copies; Export = active row only; Print
Batch (modal) = one print per row, one copy each.

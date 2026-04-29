# label-maker — Amendment: Output Tab (replaces Preview)

> Today the sidebar's Preview tab does one thing — render a bitmap
> preview of what the printer will receive. It's narrow ("just a
> preview"), depends on a connected printer to be exactly accurate,
> and feels lonely as a single-purpose tab. Meanwhile, the Save
> dropdown in the toolbar is a junk drawer of 11 items where only 2
> are actually save actions — the rest are New / Library / Import
> / 4 Export formats / Print Sheet / Share. "Where do final
> artifacts come from?" has no good answer; the answers are scattered
> across a misnamed dropdown and a lonely tab.
>
> Promote Preview → Output. Fold the four Export formats, Print
> Sheet, and Share into it. The tab becomes the home for "I'm done
> designing, now what?" — preview, print, export, share — all in
> one place. The Save dropdown collapses to a one-click Save
> button + a small File menu (New / Library / Import). Two birds:
> the lonely Preview gets substance; the junk-drawer Save gets
> cleaned up.
>
> The big orange central Print button stays exactly as it is.
> Output tab's Print section is a *configured* sibling (copies,
> density, target = single label vs sheet) — the central button is
> the muscle-memory one-click default.
>
> **Scope is the tab rename, the action migration, and the
> connected-vs-disconnected rendering inside the tab.** No changes
> to the print pipeline, the export functions, or the share
> encoder — just where their entry points live in the UI.
>
> Sibling amendments:
> - `amendment-sidebar-ia.md` — defines the tab structure. Tab name
>   in this amendment changes `Preview → Output`; auto-switch rules
>   stay the same. Cross-referenced in the sibling.
> - `amendment-canvas-ux-papercuts.md` §3 (Save dropdown junk drawer)
>   — **superseded by this amendment.** That section's "rebuild Save
>   into a File menu" plan is replaced by the simpler "Save becomes
>   a one-click button; everything else moves to the Output tab."
> - `amendment-printer-status-polling.md` — the print-button guard
>   (disabled + warning on error) applies to the Output tab's
>   `[Print]` button the same way it applies to the central one.
>   Same effective-media + status check, two surfaces.
> - `designer-core-amendment-burnmark-package-format.md` — when
>   `.bnmk` package format ships, it joins the Save-as-file row in
>   the Output tab. No special case here; just adds another button.

---

## 1. The Problem

**Preview is lonely and conditional.** A whole sidebar tab with one
feature, and that feature only renders an *accurate* picture when a
printer is connected. Without a printer, the tab is either empty,
shows a stale preview, or shows a generic-DPI render with no
indication that it's approximate. Users who haven't connected a
printer don't open the Preview tab; users who have connected one
peek at it once per print job. A whole tab for that.

**Save dropdown is a junk drawer.** Per the canvas-ux-papercuts
plan §3 — the toolbar's "Save" split-button has 11 menu items and
only 2 are saves. New / Library / Import / four Export formats /
Print Sheet / Share are squatting because there's no other home for
document-level "produce a final artifact" actions. The trigger
button is labelled `topbar.save` with a save icon, lying. Users
hunt for export inside a Save menu; that's a real friction.

**No "where do final artifacts come from?" home.** Print is its own
big button (great). Save is a topbar dropdown (lying about its
contents). Preview is a tab (lonely). Export is a sub-menu in the
lying dropdown. Share is also in there. Print Sheet is also in
there. The "I'm done, what now?" actions don't share a surface;
the user has to learn each one's separate location.

Folding everything output-shaped into one tab solves all three
problems with one structural change.

---

## 2. Scope

In:
- **Rename `Preview` → `Output`** in the sidebar tab list.
- **Tab content reorganised** into sections (§3): Live preview,
  Print, Print to sheet, Save as file, Share.
- **Migrate actions out of the Save dropdown** into the Output tab:
  - Export PDF / PNG / Label / Zip → "Save as file" row
  - Print Sheet → its own section
  - Share → its own section
- **Save dropdown collapses** to a one-click Save button on the
  toolbar. The "File" menu next to it (per
  `amendment-canvas-ux-papercuts.md` §3 option A) holds New /
  Library / Import — small, focused, accurate label.
- **Disconnected-friendly preview.** When no printer is connected,
  render at default 300 DPI with a small "Connect a printer for
  device-accurate preview" footnote. Tab works without a printer;
  most sections (Save as file, Share, Print to sheet) don't need
  one.
- **Big orange Print button stays** front-and-centre. Output tab's
  Print section is a configured sibling, not a replacement.
- **Print-button guard** (per `amendment-printer-status-polling.md`)
  applies identically to both surfaces — both disabled with the
  same error reason when status reports an issue.

Out:
- **Replacing the central Print button.** Stays exactly as is.
- **Changes to the print pipeline, export functions, or share
  encoder.** This amendment moves entry points; the implementations
  are unchanged.
- **Print history / re-print last N labels.** Tempting addition to
  the Output tab but a separate feature; future scope.
- **Print presets / saved configurations.** Same — useful, future.
- **Inline progress / job status during a print.** The existing
  print toast / pill state handles this; not in this amendment.
- **Two-colour plane separator preview** (Brother black + red).
  Future; the preview here just shows the composite.
- **Calibration / test-pattern actions.** Some printers benefit
  from this; future scope.

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
│ device-accurate preview          │     or unsupported family
├──────────────────────────────────┤
│ Print                            │  ← visible only when connected
│   Copies   [1]                   │
│   Density  [Normal ▾]            │
│   [Print 1 label]                │  ← respects status guard
├──────────────────────────────────┤
│ Print to sheet                   │  ← always
│   Sheet  [Avery L7160 ▾]         │
│   Layout shows N copies fit      │
│   [Print sheet…]                 │
├──────────────────────────────────┤
│ Save as file                     │  ← always
│   [PNG] [PDF] [.label] [.bnmk]   │     buttons trigger downloads
├──────────────────────────────────┤
│ Share                            │  ← always
│   [Copy link]                    │
│   (link size readout if          │
│    applicable, like the existing │
│    ShareDialog)                  │
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

### 3.2 Print

Visible only when a printer is connected. Hides entirely when
disconnected (no "ghost" Print section nagging the user).

- **Copies** — number input, default 1.
- **Density** — dropdown of `light` / `normal` / `dark` (per
  `PrintOptions.density` in the contracts). Some drivers accept
  more values; the dropdown shows what the connected family
  supports.
- **[Print N label(s)]** — primary button. Calls the same code
  path as the central orange Print button, with the configured
  options. Disabled with the same guard as the central button
  when status is in error or no media is set; tooltip carries
  the canonical error message via the i18n helper from
  `amendment-printer-status-polling.md` §4.5.

The button label updates with the copy count: "Print 1 label" /
"Print 5 labels". Matches what's about to happen.

### 3.3 Print to Sheet

Always visible — sheet printing is paper-printer territory, not
thermal, so it works regardless of connected printer state.

- **Sheet** — dropdown of registered sheet templates (Avery L7160,
  etc.) plus "Custom…" if the existing flow supports it.
- **Layout preview / count** — shows the number of copies that
  fit on a sheet at the current label size; small text or a
  thumbnail. Existing logic (already in the codebase for the
  Print Sheet feature); just relocated.
- **[Print sheet…]** — opens the existing print-sheet dialog or
  triggers the print directly, depending on how the current
  flow works. No behavioural change; same entry point as the
  current Save dropdown's "Print Sheet" item.

### 3.4 Save as File

Always visible. Each button triggers a download in the existing
format:

- **PNG** — bitmap export.
- **PDF** — vector-as-best-we-can export.
- **.label** — burnmark JSON document format.
- **.bnmk** — when `designer-core-amendment-burnmark-package-format.md`
  lands. Until then, the button isn't rendered.

Same handlers as the current Save dropdown's Export options. Just
moved here.

### 3.5 Share

Always visible. Opens the existing share dialog (or in a future
inline mode, just renders a copy-link button + URL-size readout).
Same handler as the current Save dropdown's Share item.

---

## 4. Big Print Button — Unchanged Relationship

The central orange Print button is the muscle-memory primary
action: one click, default settings, print one copy at the
configured density. Users who want exactly that — which is most
prints — never need to open the Output tab.

The Output tab's Print section is the *configured* path:
- Print N copies at once
- Print at non-default density
- Print to a sheet instead of the active printer

Both call the same underlying print function; both respect the
same status-guard. The big button is "go"; the Output tab is "go,
but here's how."

```
Toolbar:                      Output tab Print section:
[ orange Print ]              [Print 1 label]
^ one click,                  ^ same destination,
default settings              configured params
```

Behaviourally equivalent for the default case; the tab adds
configuration when the user wants it.

---

## 5. Save Dropdown Collapses

After the action migration:

```
Before                              After
┌──────────────────────────────┐    ┌──────────┐
│ Save current        Cmd+S    │    │ [Save]   │  ← one-click; same
│ Save as new                  │    └──────────┘     handler as before
│ ─────────────────            │    ┌──────────┐
│ New label                    │    │ File ▾   │  ← New / Open Library /
│ Library                      │    └──────────┘     Import / Save as new
│ Import                       │
│ ─────────────────            │
│ Export PDF                   │    (Export / Print Sheet / Share
│ Export PNG                   │     all live in the Output tab)
│ Export .label                │
│ Export Zip                   │
│ ─────────────────            │
│ Print Sheet                  │
│ Share                        │
└──────────────────────────────┘
```

Save button becomes a true one-click save (matches its label and
icon). File menu carries the small set of file-lifecycle actions
(New / Library / Import / Save as new) — accurate label, short
list, no junk.

The original `amendment-canvas-ux-papercuts.md` §3 proposed
something similar (split into File menu + Share button). This
amendment supersedes that section because the Output tab absorbs
Export / Print Sheet / Share — the File menu shrinks further than
that section anticipated.

---

## 6. Connected vs Disconnected

| Section | No printer | Printer connected, no errors | Printer in error / no media |
|---|---|---|---|
| Live preview | 300 DPI generic + footnote | Device-accurate | Device-accurate (preview unaffected by errors) |
| Print | hidden | enabled | disabled with reason (per polling guard) |
| Print to sheet | enabled | enabled | enabled (sheet printing is independent of thermal printer state) |
| Save as file | enabled | enabled | enabled |
| Share | enabled | enabled | enabled |

The tab feels populated in every state. Even disconnected, four of
five sections are interactive. Compare to today's Preview tab
which has nothing useful at all when disconnected.

---

## 7. Auto-Switch Behaviour

`amendment-sidebar-ia.md` §4.1 defines the auto-switch rule for
the Properties tab:

> Selection 0 → 1+ AND currentTab === 'object' → switch to Properties

The Output tab does NOT participate in auto-switch. It's
deliberate user navigation — open it when you're ready to print,
export, or share. Auto-switching from canvas actions would be
intrusive ("why am I on Output? I just made an edit").

---

## 8. Edge Cases

### 8.1 Printer Connected to a Family Without Preview Support

Today every supported family supports preview rendering, but if a
future driver lacks it, the live preview falls back to 300 DPI
generic render with a footnote ("Preview not available for {family};
showing approximate render"). Print section still works (the
driver still prints — just doesn't expose the preview pipeline).

### 8.2 Print Section Hidden, User Clicks Big Orange Button

Big button is independent of the Output tab. If the printer is
connected and ready, big button prints. The Output tab's hidden
Print section is just a UI absence; the underlying capability is
present.

### 8.3 Print to Sheet Without Any Sheet Templates

Sheet template registry has at least the Avery defaults today.
If for some reason the registry is empty, the dropdown shows
"No sheets available — ([+ Add custom])" rather than a broken
empty state.

### 8.4 Save as File Buttons During an Async Render

Each export button kicks off an async render → download. If the
user clicks two in quick succession, the second one queues
behind the first (existing behaviour from the current Save
dropdown's Export items — no change). Buttons could disable
during in-flight render but that's polish, out of scope.

### 8.5 Share Dialog Already Open When User Clicks Output's Share

Idempotent — clicking Share when the dialog is open is a no-op
or re-opens (matches existing behaviour). Out of scope.

### 8.6 Output Tab Open With No Selection

The Output tab doesn't depend on selection at all. It works the
same regardless of what's selected — its actions are document-
level, not object-level. Selection state is orthogonal.

### 8.7 Mobile Drawer With Output Tab Active

Per `amendment-sidebar-ia.md` §7, the mobile drawer's tab bar
shows all four tabs. Output is reachable the same way as the
others. Live preview at the top of the tab content area; the
sections below scroll in the drawer's content scroll.

---

## 9. Files Affected

```
src/components/panels/
  PreviewPanel.vue              rename to OutputPanel.vue;
                                restructure into sections (preview,
                                print, sheet, save, share)

src/components/output/          new directory grouping the section
                                components (or keep flat in panels/)
  PreviewSection.vue            extracted from current preview render
                                logic + the disconnected fallback
  PrintSection.vue              copies + density + Print N labels
                                button; respects status guard;
                                visible only when connected
  PrintSheetSection.vue         sheet selector + layout count +
                                Print sheet button (relocated handler)
  SaveAsFileSection.vue         row of Export buttons (PNG / PDF /
                                .label / .bnmk-when-available)
  ShareSection.vue              Copy link / open share dialog

src/components/toolbar/
  CanvasActions.vue             collapse Save dropdown to:
                                - [Save] one-click button
                                - [File ▾] dropdown with New /
                                  Library / Import / Save as new
                                Remove Export / Print Sheet / Share
                                items (now in Output tab)

src/components/layout/
  Sidebar.vue                   rename Preview tab → Output
  AppShell.vue                  if any tab routing references the
                                old name, update

src/i18n/
  en.json + others              tab label "output" (replaces
                                "preview"); section headings
                                (output.print, output.printSheet,
                                output.saveAsFile, output.share);
                                disconnected footnote
```

No designer-core changes. No print-pipeline changes. No
schema changes.

---

## 10. Implementation Checklist

```
Tab rename:
□ Rename Preview tab to Output in sidebar layout
□ Update sidebar-IA-aware logic (auto-switch list — Output is NOT
  auto-switch eligible; explicit user nav only)
□ i18n key sidebar.tab.preview → sidebar.tab.output

Output tab structure:
□ OutputPanel.vue with five sections in order: Preview / Print /
  Print to sheet / Save as file / Share
□ Live preview disconnected-friendly (300 DPI fallback + footnote)
□ Print section visible only when connection.kind === 'connected'
□ Print section button respects status guard from
  amendment-printer-status-polling.md
□ Print button label updates with copy count
□ Print to sheet section reuses existing print-sheet handler
□ Save as file section reuses existing export handlers
□ Share section reuses existing share dialog opener
□ .bnmk button conditional on package-format amendment shipping

Save dropdown collapse:
□ CanvasActions.vue Save split-button → one-click [Save]
□ New File ▾ dropdown next to it: New / Library / Import / Save
  as new
□ Remove Export PDF / PNG / Label / Zip items from old dropdown
□ Remove Print Sheet item from old dropdown
□ Remove Share item from old dropdown
□ Existing keyboard shortcuts (Cmd+S etc.) continue to drive Save

Tests / verification:
□ Output tab renders all five sections with no printer connected
□ Print section appears when a printer connects, disappears when
  it disconnects
□ Print N labels button uses the configured copies + density
□ Save as file buttons trigger downloads in their respective
  formats
□ Share section opens the existing share dialog
□ Save button on toolbar performs one-click save (no menu)
□ File menu on toolbar shows only New / Library / Import / Save
  as new — no export, no share, no print sheet
□ Cmd+S still saves
□ Big orange central Print button unchanged

i18n:
□ sidebar.tab.output (replaces sidebar.tab.preview)
□ output.previewFootnote.disconnected
□ output.previewFootnote.noPreviewSupport
□ output.print.copies, output.print.density, output.print.action
  (with copy-count plural)
□ output.printSheet.* (sheet label, action)
□ output.saveAsFile.* (one per format)
□ output.share.copyLink
□ Apply to en + every other locale
```

---

## 11. Tests

OutputPanel structure
(`components/panels/__tests__/OutputPanel.test.ts`):
- Renders five sections in order
- Print section hidden when not connected
- Print section visible when connected
- .bnmk button rendered only when package-format support is enabled
- Disconnected footnote present below preview when no printer

Print section behaviour:
- Copies input updates the button label ("Print 1 label" → "Print 5 labels")
- Density dropdown shows family-supported values
- Click [Print N labels] calls the same print handler the central
  button uses, with the configured copies + density
- Disabled with status-guard reason when status reports an error
  (relies on the polling amendment's status state)

Save dropdown collapse
(`components/toolbar/__tests__/CanvasActions.test.ts`):
- Save button is a single-action button (no dropdown)
- File menu contains exactly: New, Library, Import, Save as new
- Export / Print Sheet / Share items absent from File menu
- Cmd+S keyboard shortcut still triggers Save
- Click on Save button triggers the same handler as Cmd+S

Save as file section:
- PNG / PDF / .label buttons trigger their respective handlers
- .bnmk button absent in the no-package-format build; present
  when the build flag / module is in place

Share section:
- Click [Copy link] opens the existing share dialog (or copies
  to clipboard, depending on the existing flow)

Tab auto-switch:
- Output tab is NOT in the auto-switch list — selection changes
  do not navigate to it
- Manual navigation still works

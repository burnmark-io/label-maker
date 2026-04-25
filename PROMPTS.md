# label-maker — Phase Prompts

> Ready-to-use prompts for each implementation phase. Copy-paste to an agent.
> Each prompt references the two core documents. Adjust phase groupings if
> an agent finishes early or a phase is larger than expected.
>
> **Documents the agent needs in context:**
> - `PLAN.md`
> - `GUIDE.md`

---

## Phase 1 + 2: Scaffold + Design Canvas

The foundation. Gets the app running with a functional design canvas.

```
You are building `github.com/burnmark-io/label-maker` — a Vue 3 web app
for designing and printing labels on thermal printers directly from the
browser. Two documents define the work:

- `PLAN.md` — the full product spec
- `GUIDE.md` — how to work, what to placeholder, what to track

Read BOTH documents fully before writing any code.

This session covers Phase 1 (steps 1-5) and Phase 2 (steps 6-16).
Stop after Phase 2's gate check passes.

You are working autonomously. The operator is not available.

First actions:
1. Read both documents fully
2. Install all npm dependencies and READ their type definitions —
   especially `@burnmark-io/designer-vue` and `@thermal-label/*-web`.
   Understand the actual API before writing code.
3. Create PROGRESS.md, DECISIONS.md, BLOCKERS.md, PLACEHOLDERS.md
4. Begin Phase 1 step 1

Working method:
- Commit after each step: `git add -A && git commit -m "phase N step M: description"`
  and push
- Gate check after each phase: typecheck + lint + test + build
- Use $t('key') for ALL UI strings from step 1 — no hardcoded text
- Log every placeholder in PLACEHOLDERS.md
- Log every judgment call in DECISIONS.md
- Don't stop, don't wait. Decide and keep going.

Phase 1 target: app runs in dev mode, shows the layout shell (top bar,
centre canvas area, collapsible right panel, footer), design tokens
applied, pinia stores scaffolded. Sample label loaded on first visit.

Phase 2 target: Konva canvas with all object types working (text, image,
barcode, shape). Add, select, move, resize, edit inline. Properties panel
updates live. Objects panel with z-order. Alignment guides and snapping.
Keyboard shortcuts. Undo/redo. Paper direction indicator for continuous
labels. The label is centre stage at ~2x zoom.

Do not start Phase 3. Stop after Phase 2's gate passes, commit, push.
```

---

## Phase 3: Shapes and Borders

Creative phase. Decorative shapes and border presets.

```
You are continuing work on `github.com/burnmark-io/label-maker`.
Read the implementation plan and agent guide if you haven't already.
Check PROGRESS.md for completed phases — Phases 1-2 should be done.

Two documents define the work:

- `PLAN.md` — the full product spec
- `GUIDE.md` — how to work, what to placeholder, what to track

This session covers Phase 3 (steps 17-20).
Stop after Phase 3's gate check passes.

You are working autonomously. The operator is not available.

Working method: same as previous phases. Commit per step, gate after
phase, log decisions and placeholders.

Phase 3 target: decorative shapes (heart, star, diamond, arrow, badge,
ribbon) and border presets (simple, classical, playful) all render
correctly on the Konva canvas and produce correct output in the 1bpp
bitmap preview. Shape library picker in the toolbar grouped by category
(Basic / Decorative / Borders). Borders auto-resize with the label
canvas dimensions.

Implementation notes:
- Custom shapes use Konva's `sceneFunc` on `v-shape` — a function that
  draws on CanvasRenderingContext2D
- Each shape is a ShapeDefinition: { name, icon, renderPath(ctx, x, y, w, h) }
- The shape library is a data registry, not a component tree — one
  ShapeLibrary.vue renders a grid from the registry
- Borders are special shapes that frame the entire label canvas. They
  receive the full canvas dimensions and render a pattern along all edges.
- Start with 5-6 decorative shapes and 3-4 border presets. Quality over
  quantity — each should look good on a small thermal label at 300dpi.
- All shapes must work at any aspect ratio (continuous vs die-cut labels)

Do not start Phase 4. Stop after Phase 3's gate passes, commit, push.
```

---

## Phase 4: Printer Integration

Hardware phase. Connects the app to real printers.

```
You are continuing work on `github.com/burnmark-io/label-maker`.
Check PROGRESS.md — Phases 1-3 should be done.

This session covers Phase 4 (steps 21-28).
Stop after Phase 4's gate check passes.

You are working autonomously. The operator is not available.

IMPORTANT: Before writing printer code, install the web driver packages
and READ their type definitions:

  pnpm add @thermal-label/brother-ql-web @thermal-label/labelwriter-web @thermal-label/labelmanager-web
  pnpm add @thermal-label/contracts @thermal-label/transport

Read the .d.ts files in node_modules to understand:
- How to open a printer from the web package (each driver's web exports)
- How WebUsbTransport.request() and WebSerialTransport.request() work
- How PrinterAdapter.print(), createPreview(), getStatus() work
- What PreviewResult, MediaDescriptor, PrinterStatus look like
- How to build USB filters from device registries for the picker

Log what you find about the actual API in DECISIONS.md. The plan describes
the intended flow but the shipped packages are the source of truth.

Phase 4 target:
- "Connect Printer" button triggers WebUSB picker (and Web Serial for BT SPP)
- Auto-reconnect on app load for previously paired devices
- Printer status indicator: connected (green) / paired (yellow) / disconnected (red)
- Media auto-detection from getStatus() — canvas auto-resizes to match
- Manual media selector when auto-detect unavailable (LabelWriter 450, LabelManager)
- Print preview panel showing 1bpp bitmap from printer.createPreview()
- Two-colour preview overlay for Brother QL with DK-22251
- "Assumed media" banner when preview is based on default media
- Print dialog: copies, density, print button, progress, success/error toast
- Web Serial alongside WebUSB for Bluetooth SPP printers (QL-820NWB)
- Connection persists across prints — don't close after each print

Testing: mock the web driver packages. Real hardware testing is manual
and not part of the gate check. The printer store, auto-reconnect
composable, and media detection logic should all have unit tests against
mocked drivers.

Do not start Phase 5. Stop after Phase 4's gate passes, commit, push.
```

---

## Phase 5 + 6: Data, Batch, Export, Sharing

Data import and all export paths.

```
You are continuing work on `github.com/burnmark-io/label-maker`.
Check PROGRESS.md — Phases 1-4 should be done. 

Two documents define the work:

- `PLAN.md` — the full product spec
- `GUIDE.md` — how to work, what to placeholder, what to track


This session covers Phase 5 (steps 29-36) and Phase 6 (steps 37-43).
Stop after Phase 6's gate check passes.

You are working autonomously. The operator is not available.

Phase 5 target — Data and Batch:
- Template variables: placeholder detection from the document, substitution
  preview that cycles through rows
- CSV import: drag-and-drop zone, papaparse parsing, header detection
- Excel import: SheetJS (xlsx package), first sheet extracted, row 1 as headers
- Column mapper: auto-map (exact match → fuzzy → positional), manual UI
  when auto-mapping is incomplete. Two-column layout: CSV columns ↔ placeholders
- Column mapper remembers associations per template (localStorage)
- Batch preview grid: thumbnail cards of generated labels (virtual scroll
  if many rows)
- Batch print: progress bar, per-label status, error recovery
- 30-row limit: rows beyond 30 silently dropped. Banner: "Showing first
  30 rows. Want more? [Let us know →]" — feedback link, no mention of tiers
- All limit banners and feedback links use placeholder URLs from PLACEHOLDERS.md

Phase 6 target — Export and Sharing:
- Design library panel: 10 slots as cards. Empty slots show "+". Counter
  shows "3/10". Save to IndexedDB. Name and description editable.
- When 10 slots full: "All 10 slots are in use. Delete or export one to
  make room. Need more? [Let us know →]"
- Export PNG (single label, full colour)
- Export PDF (single label or multi-page batch)
- Sheet export: sheet picker dialog (lazy-load @burnmark-io/sheet-templates),
  searchable by brand and product code, visual preview of sheet layout,
  PDF download. Follows the 30-row batch limit.
- Export .label file (JSON download)
- Export bundled .zip (design + assets via exportBundled — note it returns
  { blob, missing }, surface missing assets as a warning)
- URL sharing: pako compress + base64 encode to URL hash fragment.
  8KB limit — larger designs show "too large, export as .label file instead".
  Share dialog with copy button. Import from hash on app load.

Testing:
- Column mapper: exact match, fuzzy match, positional fallback, remembered mapping
- Share encoding: round-trip encode/decode, size limit handling
- Storage: mocked IndexedDB via idb
- Batch: verify 30-row limit, verify async generator consumption

Do not start Phase 7. Stop after Phase 6's gate passes, commit, push.
```

---

## Phase 7: PWA and Docker

Deployment infrastructure.

```
You are continuing work on `github.com/burnmark-io/label-maker`.
Check PROGRESS.md — Phases 1-6 should be done.

Two documents define the work:

- `PLAN.md` — the full product spec
- `GUIDE.md` — how to work, what to placeholder, what to track


This session covers Phase 7 (steps 44-49).
Stop after Phase 7's gate check passes.

You are working autonomously. The operator is not available.

Phase 7 target:
- PWA: vite-plugin-pwa configured with manifest, theme colour (#f59e0b amber),
  icons (placeholder — solid amber squares with "bm" text or similar, log in
  PLACEHOLDERS.md). Service worker caches all static assets.
- Install prompt: NOT on first visit. Show after 2nd or 3rd session (tracked
  in localStorage). Subtle toast: "Install burnmark for quick access from
  your desktop" with [Install] [Maybe later]. "Maybe later" dismisses for
  7 days.
- Offline mode: verify designing works offline (IndexedDB designs available,
  canvas functional, export to PNG/PDF works). Printing obviously requires
  a printer.
- Dockerfile: two-stage build (node:24-slim for build, nginx:alpine for serve).
  Build output in /usr/share/nginx/html. Expose port 80.
- docker-compose.yml: app service + print proxy sidecar. App on 8080, proxy
  on 3000. Proxy has /dev/bus/usb device mount and proxy.config.json volume.
- Publish compose.yaml to the app's static assets so it's downloadable at
  burnmark-io.github.io/compose.yaml (just put it in public/).

Testing:
- Verify PWA manifest is valid (Lighthouse or manual check)
- Verify service worker registers
- Verify Docker builds: `docker build -t burnmark-test .`
- Verify docker compose config is valid: `docker compose config`

Do not start Phase 8. Stop after Phase 7's gate passes, commit, push.
```

---

## Phase 8 + 9: Polish, i18n, a11y, Final

The finishing phase. Everything goes from "works" to "feels good."

```
You are continuing work on `github.com/burnmark-io/label-maker`.
Check PROGRESS.md — Phases 1-7 should be done. The app is functional.
This session makes it polished, accessible, and internationalised.

This session covers Phase 8 (steps 50-62) and Phase 9 (steps 63-70).
This is the final session. Complete everything.

You are working autonomously. The operator is not available.

Phase 8 target — Polish, i18n, a11y:

i18n (steps 50-51):
- vue-i18n setup with lazy-loaded JSON locale files
- en.json: complete English locale — every UI string extracted
- nl.json: Dutch locale — best-effort automated translation, mark every
  string with // TODO: verify Dutch in the JSON. Log in PLACEHOLDERS.md.
- Locale detection: localStorage preference → navigator.language → English
- Missing locale toast (one-time): "burnmark isn't available in [Deutsch]
  yet. Showing English. Want to help translate? [Let us know →]"
- Rotating footer sponsor texts translated (English set is cheeky and warm,
  Dutch set is rough draft marked for review)
- About page content translated
- Onboarding tour text translated
- Error messages translated

a11y (step 52):
- ARIA labels on ALL icon-only buttons (toolbar, panels, dialogs)
- Focus visible outlines styled to match the warm theme (not browser default)
- Keyboard navigation: Tab through toolbar, panels, dialogs
- Focus trapped in modals — Tab cycles within, Escape closes
- Dialogs: role="dialog", aria-labelledby, focus on open, return on close
- Toasts: role="status" or aria-live="polite"
- Side panel tabs: keyboard navigable, arrow keys switch tabs
- Colour contrast: all UI text meets WCAG AA. Amber accent for text uses
  #b45309 (darker) not #f59e0b (fails on white). Amber stays for backgrounds.
- Canvas: aria-label="Label design canvas", off-screen text summary of
  contents updated on change
- Reduced motion: @media (prefers-reduced-motion: reduce) disables animations

Footer (step 53):
- Rotating sponsor texts from a pool, linked to funding page
- About and Help links

About page (step 54):
- Modal, not a route. Content per plan section 18: name explanation,
  scopecreep hint ("accidentally built a label printing ecosystem, the
  workshop is still not organised"), project links, funding links, version.

Help menu (step 55):
- Accessible from footer "Help" link and ? keyboard shortcut
- Restart tour, keyboard shortcuts reference, printer compatibility note,
  docs link (placeholder URL), report problem link, feature request link

Onboarding tour (step 56):
- 4-step tooltip tour per plan section 14.2
- First visit only (localStorage flag)
- Restartable from help menu
- Dismissable at any step

Remaining polish (steps 57-62):
- Empty states: friendly prompts with emoji or Lucide icons where content
  would be (empty library, no printer, no CSV loaded)
- Error messages: audit all error paths — human language, no technical jargon
- Transitions: smooth panel slides, toast animations, dialog fade-in.
  Respect prefers-reduced-motion.
- Responsive: desktop-first. Tablet landscape functional (toolbar bottom,
  panel as bottom sheet). Don't break on mobile but don't optimise for it.
- Performance: lazy-load sheet-templates (already done), virtual scroll in
  batch preview grid if >10 items, debounce renders (already in composable)

Phase 9 target — Final:
- Verify ALL gate checks pass across all phases (typecheck + lint + format + test + build)
- Test on Chrome desktop — full flow: connect, design, print, export, batch
- Test on Edge desktop — same flow
- Firefox / Safari: verify the "printing requires Chrome or Edge" banner
  appears. Design and export should work without printing.
- Test Android OTG scenario if possible (Chrome Android + USB-C OTG adapter).
  If no Android device available, log in BLOCKERS.md.
- Test Docker build: docker build -t burnmark . && docker run -p 8080:80 burnmark
- Test docker compose config is valid
- Verify en.json is complete (no missing keys)
- Verify nl.json has all keys (even if marked TODO)
- Verify keyboard-only navigation through: open app → add text → edit →
  print dialog → close. All via keyboard, no mouse.
- Verify PWA installs in Chrome
- Verify offline mode: disconnect network, open app, design works
- Deploy: the operator will handle GitHub Pages and Docker publishing.
  Make sure `pnpm build` produces a clean dist/ directory.
- Final commit with all PROGRESS.md checkboxes ticked.

This is the last session. Everything should be complete when you stop.
```

---

## Emergency / Continuation Prompts

If a phase runs into problems and you need to restart or continue:

### Continue from where the last agent stopped

```
You are continuing work on `github.com/burnmark-io/label-maker`.
Read the implementation plan and agent guide.
Read PROGRESS.md to see what's done. Read DECISIONS.md and BLOCKERS.md
for context on previous decisions and known issues.

Continue from the first unchecked item in PROGRESS.md.
Same working method: commit per step, gate per phase, log everything.
The operator is not available. Don't stop until [Phase N] is complete.
```

### Fix a specific issue from a previous phase

```
You are fixing an issue in `github.com/burnmark-io/label-maker`.
Read the implementation plan and agent guide.
Read DECISIONS.md and BLOCKERS.md for context.

The issue: [describe the issue]

Fix it, verify the gate check passes (typecheck + lint + test + build),
commit with message "fix: [description]", push.
Do not make changes outside the scope of this fix.
```

### Add a feature not in the plan

```
You are adding a feature to `github.com/burnmark-io/label-maker`.
Read the implementation plan and agent guide for context on the
existing architecture and conventions.

The feature: [describe the feature]

Implement it following the existing patterns (pinia stores, scoped styles,
$t() for strings, Konva for canvas). Log the addition in DECISIONS.md.
Commit with message "feat: [description]", push.
```
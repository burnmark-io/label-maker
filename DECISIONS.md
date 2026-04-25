# label-maker — Decision Log

Numbered list of judgment calls, deviations from `PLAN.md`, and findings about
the actual API surface of the dependencies.

## D1 — Browser shims for designer-core's Node code paths

`@burnmark-io/designer-core@0.1.0` ships a single ESM bundle that contains
both Node and browser code paths. The runtime guards (`globalThis.FontFace`,
`globalThis.crypto.randomUUID`) ensure only browser-safe code executes in
the browser, but the bundler still needs to resolve `node:crypto`,
`node:url`, `node:path`, and `@napi-rs/canvas` imports.

Resolution: aliased these in `vite.config.ts` to shims under `src/shims/*.ts`
that export safe browser implementations (or throw if reached). The Node
paths are unreachable at runtime in browser builds.

Logged in BLOCKERS.md as a soft issue — designer-core could ship a separate
`./browser` export to avoid the shims.

## D2 — `addObject` is generic in our designer store

`LabelDesigner.add(object: LabelObjectInput)` accepts the union
`Omit<LabelObject, 'id'>`. TypeScript's `Omit` over a union returns
the intersection of common keys, dropping subtype-specific fields like
`shape: 'rectangle'` or `content: string`.

Resolution: our store wraps `add` as
`addObject<T extends LabelObject>(input: Omit<T, 'id'>)`. Callers pass
the discriminated subtype (`addObject<TextObject>(...)`) and get full
field-level type checking. Internally we cast to `LabelObjectInput` for
the underlying call.

## D3 — Routing kept minimal

The plan calls for `vue-router` but only one route is needed
("the app IS the editor"). Configured a single `/` route serving
`EditorView.vue`, with hash history so the share-URL hash fragment from
Phase 6 can co-exist cleanly. The router is kept so future additions
(About modal as route, embed mode, etc.) don't need a wholesale change.

## D4 — Pinia stores: scope of Phase 1

Plan section 22 step 4 says "designer (wraps composable), preferences."
Stubbed `printer` and `library` stores too so Phase 1 components have
typed access to the right shapes. They're empty scaffolds; Phase 4 and
Phase 6 fill them in.

## D5 — `useStorage` stores raw values for primitives

VueUse's `useStorage` JSON-serialises objects but stores primitives raw.
String preferences round-trip to localStorage as their literal value
(`"objects"` not `"\"objects\""`). Tests reflect this.

## D6 — vue-konva component prefix `V`

vue-konva's default install prefix is `V` (PascalCase: `<VStage>`,
`<VLayer>`, `<VRect>`), not the kebab-case `<v-stage>` shown in
PLAN.md section 4.1. The plan reflects an older convention; current
vue-konva 3.x uses the PascalCase form. All canvas components use the
`V*` form.

## D7 — Per-type object renderers under one `CanvasObject.vue`

Plan section 4.1 sketches a single `CanvasObject.vue`. Implemented as a
dispatcher that delegates to four type-specific components
(`TextNode`, `ImageNode`, `BarcodeNode`, `ShapeNode`). Each handles its
own Konva node type, drag, transform, and (for image/barcode) async
asset loading. Keeps each component focused; the dispatcher is just
template branches.

## D8 — Inline text editing as an HTML overlay

Konva's text rendering is read-only. Double-click a text object to
spawn an `<textarea>` overlay positioned and scaled to match the Konva
text. Edits write through to the document on each input. Blur or Enter
finishes; Escape cancels (without rolling back; we'd need a snapshot
for true cancel — the plan's spec doesn't require it).

## D9 — Canvas uses Konva native scale, not a transformed group

`Stage.scale = zoom` and `Stage.position = offset` is the cleanest way
to map design-coords (dots) to viewport pixels: every child draws in
dots, pointer events come back in dots, and the Transformer sees the
right bounding boxes. The viewport composable computes both values
from container size and label dimensions.

## D10 — Snapping is greedy and dependency-free

`computeSnap(...)` evaluates each anchor (start/mid/end on each axis)
against every other object's edges/centres and the canvas
edges/centres, picks the closest within threshold, and returns the
guide lines that triggered the snap. Optional grid snapping kicks in
only when no other candidate matched. Threshold scales with zoom so
"close enough to snap" feels right at any zoom level.

## D11 — ADR-001 adopted: two-button output, all formats always

`ADR-001_all_printers_are_equal.md` amends PLAN.md sections 14.3,
14.6, 6, 18, and 11. Three pillars:

1. **Output is two buttons near the label.** `[⎙ Print]` and `[💾 ▾]`,
   floating below the label. No modal print dialog. The topbar is just
   logo / printer status / help.
2. **All save formats always available.** PDF, PNG, .label, .zip, and
   "Print to sticker sheet" live under the save dropdown for every
   user, regardless of whether a thermal printer is connected. No
   feature gating.
3. **Privacy is part of the product story.** Zero analytics, zero
   tracking; first-visit banner combining privacy message + PWA
   install CTA; about page section; data-panel privacy line when CSV
   is loaded.

Phase 2 impact (today): moved Print out of the topbar; added a
`CanvasActions.vue` floating below the canvas with the Print and Save
controls (placeholders — Print wires in Phase 4, Save dropdown in
Phase 6). The save dropdown UI is in place with all options.

Phases 4/6/7/8 will pick up the rest. Privacy banner is held for
Phase 7 (PWA / first-visit polish) since it pairs with the install
prompt in the same surface.

## D13 — Decorative shapes and borders are rasterised as ImageObjects

`@burnmark-io/designer-core@0.1.0` ships `ShapeObject` with
`shape: 'rectangle' | 'ellipse' | 'line'` only. The package is
published, so we cannot extend the union to add heart / star / border
variants without a coordinated release.

Resolution: each entry in the shape registry (`src/lib/shapes/*`)
exposes one `renderPath(ctx, w, h)` function. On insert, the function
rasterises onto an offscreen canvas at object-space dimensions, the
PNG is stored via the existing `assetLoader`, and the result is added
as an `ImageObject` (with `dither: false` so the silhouette stays
crisp at 1bpp). Konva renders it through the regular `<VImage>`
pipeline; designer-core renders it through its image renderer for the
1bpp bitmap preview. One drawing function feeds both views — they
cannot diverge.

Trade-off: shapes are bitmap, not vector, so very aggressive scaling
loses quality. Mitigation: `MAX_RASTER_DIMENSION = 1600` for borders
that span large continuous labels, with `defaultWidth/Height = 200`
for decorative shapes. At 300 dpi thermal output this is plenty.

The plan's note about Konva `sceneFunc` on `<v-shape>` (for vector
custom shapes) was discarded for the same reason — a vector path on
the Konva canvas would not match the bitmap-path output from
designer-core's image renderer, and re-implementing the bitmap render
ourselves was out of scope for Phase 3.

## D14 — Borders auto-resize via name-tag tracking

Borders are single-instance per label. The active border is identified
by an object name beginning with `shape:border:` (set when inserted via
the registry). `useBorderResize()` watches `canvas.widthDots` and
`canvas.heightDots` and re-rasterises the active border to fill the new
canvas, replacing its asset and updating its image dimensions in place.

Adding a second border replaces the first (`upsertBorder`). The plan
doesn't explicitly require single-instance behaviour but a label with
two competing frames is almost never what the user wants, and it keeps
the resize logic simple.

The decorative shapes (heart / star / etc.) are also tagged with a
`shape:<id>` name so the objects panel can show a useful label and so
future features (e.g. a "swap shape" affordance) can find them.

## D15 — One additional border preset (dotted)

The plan asks for "simple, classical, playful". Added a fourth
preset, `dotted`, because a 6-tile grid in the picker felt sparse
with three borders that span 2 columns each (which left a gap), and
a dotted-perimeter style reads especially well on small thermal
labels (single dots are unambiguous at 1bpp, no anti-alias artefacts).
Total Phase 3 inventory: 6 decorative shapes + 4 borders. Quality
remains the bar — the fourth preset is genuinely useful, not filler.

## D12 — Web driver packages NOT yet imported

Phase 2 ends without importing `@thermal-label/*-web` — the printer
status badge in the top bar reads from `printerStore` which is still a
disconnected stub. Phase 4 wires real WebUSB / Web Serial.

The Print button ADR-001 introduced is also a placeholder for the same
reason: its smart fallback (no printer → sheet PDF) needs both Phase 4
(printer connection) and Phase 6 (sheet picker + PDF) to be real.

## D16 — Web driver API surface (Phase 4 discovery)

After reading the `.d.ts` files in `node_modules/@thermal-label/*-web`
and the underlying `*-core` packages, here's the actual API the app
programs against:

**Per-family entry points** (`@thermal-label/{brother-ql,labelwriter,labelmanager}-web`):
- `requestPrinter(options?)` — shows the WebUSB picker (filtered to that
  family's VID/PIDs), opens the device, returns a `PrinterAdapter`.
  Requires a user gesture.
- `fromUSBDevice(device: USBDevice)` — wraps an already-paired
  `USBDevice` (from `navigator.usb.getDevices()`). Throws if the
  VID/PID isn't in that family's registry. **Used for auto-reconnect.**
- `DEFAULT_FILTERS` — the family's USB filter set, built via
  `buildUsbFilters(Object.values(DEVICES))` from
  `@thermal-label/transport`.

**Constructors** (also exported, e.g. `WebBrotherQLPrinter`,
`WebLabelWriterPrinter`, `WebDymoPrinter`) — used when wrapping a
`Transport` we built ourselves (e.g. a `WebSerialTransport` for
QL-820NWB Bluetooth SPP).

**Adapter contract** (`@thermal-label/contracts`):
- `print(image: RawImageData, media?, options?)` — `RawImageData` is
  `{ width, height, data: Uint8Array }` from `@mbtech-nl/bitmap`. The
  designer returns `Uint8ClampedArray` (canvas ImageData) so we view
  it as a `Uint8Array` before passing through.
- `createPreview(image, options?)` returns `PreviewResult` with one
  `PreviewPlane` per colour, each `{ name, bitmap: LabelBitmap, displayColor }`.
  `LabelBitmap` is row-major MSB-first 1bpp. `assumed: true` when the
  driver fell back to its default media (no detection, no override).
- `getStatus()` returns `PrinterStatus` with `detectedMedia?` —
  Brother QL detects via `STATUS_REQUEST` round-trip; LabelWriter 550
  detects, 450 does not; LabelManager never detects.
- `print()` and `createPreview()` use `lastStatus.detectedMedia` as
  default if no media is provided. So calling `getStatus()` once after
  open lets the driver infer media for subsequent calls.

**Web Serial — only QL-820NWB(c)**: `DEVICES.QL_820NWB.transports`
includes `'web-serial'`. We construct the adapter manually:
`new WebBrotherQLPrinter(QL_820NWB, await WebSerialTransport.request())`.
LabelWriter and LabelManager are USB-only on the web.

**Auto-reconnect path**: `navigator.usb.getDevices()` returns
previously authorised `USBDevice`s without prompting. Match each
against the union of all family device registries via `findDevice()`,
dispatch to the right family's `fromUSBDevice()`. Web Serial paired
ports are similarly listed via `navigator.serial.getPorts()`; we only
auto-reconnect USB for now (Bluetooth pairing is rare and the picker
is fast enough on demand).

**Designer→printer image conversion**: `designer.render()` returns
`{ width, height, data: Uint8ClampedArray }`. `PrinterAdapter.print()`
expects `data: Uint8Array`. We coerce by viewing the same buffer:
`new Uint8Array(rgba.data.buffer, rgba.data.byteOffset, rgba.data.byteLength)`.

## D18 — CSV/Excel parsing reuses designer-core, lazy-loads SheetJS

Designer-core already exposes `parseCsv` (papaparse under the hood), so
the app's `useCsvImport` composable just calls it for `.csv`/`.tsv`. For
`.xlsx`/`.xls` the SheetJS `xlsx` package is dynamically imported on
first use — Vite splits it into a separate chunk (~430 kB pre-gzip)
that only loads when a user actually drops an Excel file. Sheet
parsing extracts the first worksheet and uses row 1 as headers, mirroring
the design intent in PLAN.md §7.1.

## D19 — Substitution preview lives in the canvas leaf nodes

Rather than re-rendering the document every time the previewed row
changes, `TextNode` and `BarcodeNode` apply `applyTemplate(content,
data.currentVariables)` at render time. The document remains the single
source of truth (`{{name}}` is what's stored), and the substituted
form is purely presentational. Cycling rows updates `data.currentIndex`
which Vue reactivity propagates straight to the canvas without going
through the designer-core pipeline.

## D20 — 30-row limit enforced by the data store, not the importer

`useDataStore.setData` slices the imported rows down to `ROW_LIMIT`
(30) before anything sees them. The total row count from the file is
kept on `lastImport.totalRowsInFile` so the UI can show
"showing first 30 of N rows" without leaking the dropped data anywhere
else. Batch print, sheet export, and PDF export all draw from the
trimmed array, so the limit is consistent across export paths.

## D21 — Column mapper persistence keyed by placeholder set

The remembered mapping (`localStorage` key `burnmark.columnMapper`) is
keyed by a stable hash of the **placeholders**, not the document id —
so any document with the same `{name, address}` placeholders shares a
mapping. This matches the user expectation: importing the same CSV
into a second template with identical fields auto-maps without prompting.
Manual mapper edits write through to localStorage immediately.

## D22 — Share URL uses base64url, not raw base64

`btoa` of pako-deflate output produces `+` and `/` characters that
break URL fragments. Encoded the result base64url-style (`-` / `_`
substitution, `=` padding stripped) and reverse on decode. The 8KB
ceiling check happens against the encoded length, before the URL is
built.

## D23 — IndexedDB layer is one shared module, not per-store

`services/storage.ts` is the single owner of the `burnmark` IDB. The
library store calls into it, and Phase 7 PWA / asset persistence will
share the same DB handle. Upgrading the schema later is a
single-version-bump in one file. The module memoises the open
connection and exposes a test-only `__resetForTests` so the IDB can
be reset between tests without leaking handles.

## D24 — Sheet picker lazy-loads `@burnmark-io/sheet-templates`

Per PLAN.md §4.5, `@burnmark-io/sheet-templates` (~100 KB gzipped) is
dynamically imported the first time the SheetDialog opens. The build
splits it into its own chunk (`xlsx-*.js` is the SheetJS chunk; the
sheet-templates chunk lands separately under the EditorView dynamic
imports). Cold first-open shows a "loading templates" line; subsequent
opens are instant.

## D25 — Save button writes to the design library, not just IndexedDB directly

`CanvasActions.onSave` now goes through `useLibraryStore.save`, which
enforces the 10-slot limit and updates the in-memory entries list so
the library UI reflects the new save without a manual reload. When
the library is full, the toast asks the user to make room and the
library modal opens automatically.

## D26 — Existing design counts as "already in library" for save UX

`useLibraryStore.save` accepts an updated document with the same id
without consuming a new slot. The library modal's primary button
toggles between "Save current" and "Update" based on whether the
current document id is already in the entries list. This avoids the
infuriating "library full" error when the user is just saving over
their existing design.

## D17 — Patch `createImageBitmap` for SVG blobs in Chromium

`@burnmark-io/designer-core@0.1.0`'s browser barcode path renders bwip-js
output via `toSVG()`, wraps the string in a `Blob`, then calls
`createImageBitmap(blob)`. Firefox handles this; Chromium and WebKit
throw `InvalidStateError: The source image could not be decoded` —
a long-standing gap in `createImageBitmap`'s SVG support. The first-
visit sample label has a QR code, so every preview/print fails on
Chrome out of the box.

Resolution: `src/shims/createImageBitmap-svg.ts` wraps
`globalThis.createImageBitmap` at app startup. SVG blobs are detected
by `type === 'image/svg+xml'` and routed through an `HTMLImageElement`
(`img.decode()` then native `createImageBitmap(img)`), which works in
every target browser. All other inputs pass through to the native
implementation unchanged. Logged in BLOCKERS.md as a soft issue against
designer-core — a clean fix upstream is to use the `Image` indirection
inside `BarcodeEngine.renderToImage` directly.

## D27 — PWA install prompt is a custom toast, not a generic Toast

The plan calls for a "subtle toast" with `[Install] [Maybe later]` actions.
The existing `useToast` queue only exposes `message + kind`, no action
buttons. Rather than retrofit the toast queue (Phase 8 concern), I added
a dedicated `InstallPrompt.vue` component. It listens for
`beforeinstallprompt`, gates on `prefs.sessionCount >= 2`, and persists
"Maybe later" via `prefs.installPromptDismissedAt` for 7 days.

The component is rendered alongside `<ToastStack>` in `AppShell.vue` so
it shares the same bottom-of-screen real estate but has its own layout.

## D28 — Service worker registration is `immediate: true`

`registerSW({ immediate: true })` in `main.ts`. We have no UI yet for
"a new version is available — refresh?" (a Phase 8 polish item). With
`registerType: 'autoUpdate'` plus `immediate`, the SW silently picks up
the new bundle on next reload — acceptable for a tool whose users open
it, design, print, close.

## D29 — Docker image uses workspace pnpm via corepack

`Dockerfile` uses `corepack enable && pnpm install --frozen-lockfile`
inside `node:24-slim`. corepack ships with Node 24 so no extra apt
install is needed; the slim image is ~80MB before our app, against
~15MB for the final nginx:alpine stage that actually ships.

## D31 — Barcode validation is rails, not a wall

`amendment-barcode-validation.md` adds keystroke-mask + soft-validation
to the barcode `data` field, but **never blocks save/print/batch**.
Designer-core's existing blank-block fallback ([BarcodeNode.vue:79-82](src/components/canvas/BarcodeNode.vue#L79-L82))
remains the production-side "you got it wrong" signal; the helper line
under the textarea is the design-side signal. Validation severity
(`ok` / `info` / `warning` / `error`) drives only border colour and
helper-line copy. Hitting Print on a malformed barcode still works —
some industrial workflows depend on inputs we don't model.

## D32 — Format switch preserves data and flags it (no auto-strip)

When the user switches format with carry-over data that the new format
rejects, the data is **preserved** and the helper line flips to
`error`. Auto-stripping silently on switch was the alternative; the
amendment §7.3 leaves it open and recommends preserve-and-flag as the
less-surprising default. Implementation: `applyMask` only runs on
`onDataInput`, not on format change, so the existing `data` is left
untouched until the user types again.

## D33 — Mask exception for `{` and `}` + insert-variable button (parity)

Strict masks (digits-only for EAN/UPC/ITF/POSTNET/etc.) would silently
drop the `{` keystroke, blocking the user from typing a `{{token}}` into
a barcode field. We solve this two ways simultaneously, **not** as a
mode toggle:

1. Every keystroke filter implicitly allows `{` and `}` (`applyMask`
   in `src/lib/barcode/validation/index.ts`). Once `{{...}}` shows up
   in the field, `hasPlaceholders()` flips the on-input handler into
   pass-through mode, leaving the rest of the input alone.
2. A new `InsertVariableButton.vue` next to the data field. Reads
   `useDataStore.placeholders`. Disabled with tooltip when no
   placeholders exist. Click inserts `{{name}}` at the textarea's
   cursor. Lives at `src/components/panels/InsertVariableButton.vue` so
   a follow-up can reuse it inside `TextProperties.vue` (out of scope
   for this amendment).

## D34 — GS1 AI table is a partial built-in, unknowns warn

`src/lib/barcode/validation/gs1.ts` ships a curated `AI_TABLE` (≈22
common AIs covering GTIN, dates, lot/serial, weights, GLN, etc.).
Parses the parenthesised `(AI)data` syntax and validates each entry
against the table. Unknown AIs surface a **warning** ("Unknown AI 99
— this might not scan reliably"), not an error — niche AIs we haven't
shipped should still render without UI friction. The 310/320 weight
families collapse to one entry per family (the 4-digit `310x`/`320x`
decimal-position variant resolves to the 3-digit prefix). Structured
AI builder (dropdowns + value field) is intentionally deferred.

## D35 — Library "new id" actions live app-side, not in designer-core

`amendment-library-slots.md` originally proposed a new `assignNewId`
method on `LabelDesigner`. designer-core treats document ids as
arbitrary strings (single-user, single-machine context, collision
chance ≈ 0), so there is no benefit to coupling a cross-package
release to this UI fix.

`useDocumentLifecycle.assignNewId` mints a UUID via `crypto.randomUUID`
and pipes the current document back through `designer.loadDocument`
with the new id + fresh `createdAt`/`updatedAt`. `clearHistory` is
called immediately after so undo cannot revert the id and silently
re-attach the editor to the original library slot. Same observable
behaviour as the proposed core method, no version bump, no shim.

## D36 — Confirm-destructive-swap reduces to `canUndo === true`

The amendment §3.4 listed two separate signals (`canUndo` OR
`objects.length > 0 AND id not in library`) plus three skip cases
(first-visit sample, freshly opened library doc, fresh share import).
In practice every "safe to swap" path already calls
`designer.clearHistory()` immediately after loading content
(`loadFirstVisitDocument`, `library.loadDesign` callers in the library
modal and AppShell, the share-URL import branch in AppShell), so
`canUndo === false` is a sufficient proxy for "no work to lose."

`useDocumentLifecycle.confirmDestructiveSwap` therefore prompts iff
`designer.canUndo === true`. Save-as-new never confirms — the user is
forking a copy, not discarding work.

## D37 — Save as new mutates the current doc id in place; toast announces the swap

"Save as new" on a library-known design forks: the original entry is
left intact, a copy is saved as a new entry, and **the editor
continues editing the new entry** (subsequent Saves write to the
copy). This matches the universal desktop "Save As" convention.

The mental-model jump from "Save = update X" to "Save = update X' (the
copy)" is silent — the UI offers no explicit indicator that the
underlying id changed. To close that gap, `library.savedAsNew` reads
"Saved as a new copy. Now editing the new label." A separate verb
"Duplicate" (snapshot to a new slot, keep editing the original)
remains a possible future addition; out of scope for this amendment.

## D38 — Imports always rewrite the document id

Share-URL imports go through `readDocumentFromHash`, which now
overwrites `id` + `createdAt` + `updatedAt` before returning. Same
rule will apply to `.label`/`.zip` imports when the import amendment
lands. The cost is that round-tripping a shared design no longer
re-occupies the original slot: importing is "bring in," not "restore
in place." If the user wants to update the original, they open it
from the library.

This makes silent slot clobbering impossible regardless of the source
doc's id provenance.

## D39 — Empty-slot `+` creates a fresh-id blank entry; only `library.isFull` disables it

Pre-amendment, `+` called `onSaveCurrent`, which writes to the active
doc's id — so clicking `+` on an empty slot updated whatever the user
was editing instead of creating a new slot. The 10-slot grid was
visual fiction.

Post-amendment, `+` calls `onNewBlankSlot`: confirm-replace if dirty →
`newDocument()` → `library.save({}, no thumbnail)`. The slot fills
with an "Untitled" entry the user can rename inline. The old
`hasUnsavedToSave` gating is gone; the only condition that disables
`+` is `library.isFull`, since the action requires a free slot.

Save (via Save dropdown) is unchanged in semantics — id-keyed update
or create. The two paths now have distinct intents: Save updates *this
label*, `+` creates *a new label*.

## D40 — Slots hint lives in the library modal header, not in HelpDialog

The amendment §14.E.3 suggested adding a one-sentence "How slots
work" line to `HelpDialog`. The help menu is structured as
clickable drill-down rows; an info-only paragraph would feel out of
place. The library modal header — which the user opens precisely
when slot semantics matter — is the contextually correct surface.
`library.slotsHint` renders there when the grid isn't full.

## D30 — `compose.yaml` published in `public/` (not generated)

PLAN section 12.3 wants `compose.yaml` at `burnmark-io.github.io/compose.yaml`.
Putting it in `public/` is the simplest path: Vite copies `public/*` to
the dist root verbatim, and the SW's `navigateFallbackDenylist` makes
sure the SPA fallback doesn't intercept it. The file is hand-maintained
to mirror `docker-compose.yml` at the repo root — they're tiny, and the
two filenames serve different purposes (compose.yml is for clones,
compose.yaml is for download).

## D41 — `.label` and `.zip` import is a first-class menu action plus drag-and-drop

Two surfaces share one handler. The Save dropdown gets an **Import…**
entry above the Export divider so the order reads *Save → Library |
Import | Export PDF / PNG / .label / .zip*; clicking it opens a
hidden `<input type="file" accept=".label,.zip,application/json,application/zip">`.
The app-shell mounts a full-window drop overlay that activates on any
file drag (`dataTransfer.types.includes('Files')`) and falls through to
the same `runImport` path on drop.

Menu = discoverable + keyboard-friendly; drag-drop = fast for the
common "I just downloaded this from a colleague" case. One handler,
one branch (`isZip` → `parseBundle`, otherwise → `fromJSON`), no
duplicated plumbing.

## D42 — Bundle assets are restored via `assetLoader.set(key, bytes)`, not `store(bytes)`

`InMemoryAssetLoader.store(bytes)` re-hashes the input and returns a
fresh key. That's wrong for bundle import: the document already
references `assetKey` strings the bundle filenames were written from,
and `store()` would return new keys that don't match. `set(key, bytes)`
is the public bypass — it puts bytes under a caller-supplied key with
no re-hash.

Dev-only integrity check: when running in `import.meta.env.DEV` and not
under the test runner, recompute SHA-1 and `console.warn` on mismatch.
Production skips the check; the renderer's missing-asset placeholder
covers tampered bundles.

## D43 — Imported documents land on the canvas, not in the library

Mirrors the share-URL import flow. After parsing, the editor shows the
imported document, history is cleared, no library entry is created,
and an informational toast says "Label imported." If the user wants to
keep it, they click **Save** in the Save dropdown — the imported doc
has no library id, so Save lands it in the next free slot. No
auto-save (would bloat the library with throwaway templates), no
"Save to library" toast action (would conflict with the discoverable
Save dropdown).

## D44 — `.label` / `.zip` imports always get a fresh `id` + timestamps

Every imported document is rewritten with `crypto.randomUUID()` and a
fresh `createdAt`/`updatedAt` immediately before `loadDocument`. Mirrors
the share-URL rewrite (D38, already shipped in `readDocumentFromHash`).
Without this, importing a `.label` whose id collides with an existing
library slot would silently overwrite that slot on the next Save.

The cost is that round-tripping an export through Import creates a new
slot rather than re-occupying the original. That's correct: import is
"bring in," not "restore in place." To update a library entry, the user
opens it from the library.

## D45 — Replace-confirm reuses `confirmDestructiveSwap()` with an optional `incomingName`

The library-slots amendment (D36) already routes all destructive swaps
through `confirmDestructiveSwap()`, gated on `designer.canUndo`. The
import flow extends this helper with an optional `{ incomingName }`
parameter so the prompt can name the file being imported ("Replace 'My
label' with 'colleague.label'?"). Existing parameterless callers (the
`+` button, **New label**) keep using the generic `library.replaceConfirm`
copy unchanged; the import flow uses the new
`library.replaceConfirmWithIncoming` key.

This is the only edit to library-slots' shipped code.

## D46 — PWA `file_handlers` registers `.label` and `.zip` as openable types

The PWA manifest declares `file_handlers` with `action: '/open'` and
`launch_type: 'single-client'`. On Chromium installed PWAs the OS
routes double-clicks of `.label` / `.zip` to the running (or freshly
launched) app via `launchQueue`. AppShell drains the queue before any
share-URL hash check — the file open is a more explicit user action.
Safari/Firefox ignore the field; no harm.

The launchQueue handler delegates to the same `useLabelImport.runImport`
that the menu and drop overlay use, so the confirm-replace and missing-
assets toasts are uniform across all entry points.

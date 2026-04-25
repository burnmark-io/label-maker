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

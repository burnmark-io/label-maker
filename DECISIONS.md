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

## D11 — Web driver packages NOT yet imported

Phase 2 ends without importing `@thermal-label/*-web` — the printer
status badge in the top bar reads from `printerStore` which is still a
disconnected stub. Phase 4 wires real WebUSB / Web Serial.

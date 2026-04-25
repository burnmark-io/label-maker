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

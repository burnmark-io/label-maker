# label-maker — Agent Operations Guide

> Companion to `PLAN.md`. Read both before starting.
>
> The plan says WHAT to build. This document says HOW to work, what's missing,
> what to placeholder, and what to log. A fresh agent should be able to pick
> this up and start Phase 1 without any other context.

---

## 1. Context You Need

**What is this?** A Vue 3 web app for designing and printing labels on
thermal printers directly from the browser. No server, no account. The
label is the centre of the experience. It's warm, friendly, and your
nan can use it.

**What's already built?**

| Package | What it does | npm |
|---|---|---|
| `@burnmark-io/designer-core` | Headless label design engine | ✅ published |
| `@burnmark-io/designer-vue` | Vue 3 composable wrapping designer-core | ✅ published |
| `@burnmark-io/sheet-templates` | 500+ sticker sheet definitions | ✅ published |
| `@thermal-label/contracts` | PrinterAdapter, MediaDescriptor, Transport interfaces | ✅ published |
| `@thermal-label/transport` | USB, TCP, Serial, WebUSB, Web Serial, Web BLE transports | ✅ published |
| `@thermal-label/brother-ql-web` | Brother QL WebUSB driver | ✅ published |
| `@thermal-label/labelwriter-web` | Dymo LabelWriter WebUSB driver | ✅ published |
| `@thermal-label/labelmanager-web` | Dymo LabelManager WebUSB driver | ✅ published |
| `@mbtech-nl/bitmap` | 1bpp bitmap rendering, dithering, rotation | ✅ published |

All dependencies are on npm. Install them normally. Read their type
definitions to understand the API — don't guess.

**What does the app use from these packages?**

```typescript
// Design engine
import { LabelDesigner } from '@burnmark-io/designer-core';
import { useLabelDesigner } from '@burnmark-io/designer-vue';

// Printer connection (browser — WebUSB + Web Serial)
import type { PrinterAdapter, MediaDescriptor, PreviewResult } from '@thermal-label/contracts';
import { WebUsbTransport, WebSerialTransport } from '@thermal-label/transport/web';

// Driver-specific web packages (one per printer family)
import { /* printer class, device registry */ } from '@thermal-label/brother-ql-web';
import { /* ... */ } from '@thermal-label/labelwriter-web';
import { /* ... */ } from '@thermal-label/labelmanager-web';

// Sheet templates (lazy-loaded when sheet export dialog opens)
const { SHEETS, findSheet } = await import('@burnmark-io/sheet-templates');
```

---

## 2. Working Method

### 2.1 Tracking Files

Create these in the repo root on day one:

- **`PROGRESS.md`** — checkbox list of every phase and step from the plan's
  section 22. Tick boxes as you complete them. This is the primary status document.
- **`DECISIONS.md`** — judgment calls, deviations from the plan, "the plan
  said X but I did Y because Z." Number them D1, D2, D3...
- **`BLOCKERS.md`** — anything that genuinely cannot be resolved without human
  input. Include what you tried and what you need.
- **`PLACEHOLDERS.md`** — things you put a temporary value for (URLs, copy text,
  asset references). The operator will fill these in later.

### 2.2 Commit Discipline

Commit after each completed step within a phase. Descriptive messages:

```
git commit -m "phase 1 step 3: app shell with top bar, sidebar, canvas area"
git commit -m "phase 2 step 7: text objects — add, select, move, resize, edit"
```

Push after each commit. Every commit should leave the app in a buildable state.

### 2.3 Gate Checks

After each phase (not each step), verify:

```bash
pnpm typecheck
pnpm lint
pnpm test          # where tests exist
pnpm build
```

Record pass/fail in PROGRESS.md. Fix failures before moving to the next phase.

### 2.4 Don't Stop

**The operator is not available during implementation.** Don't wait for
answers. Make reasonable decisions, log them, keep going. If something is
genuinely blocking (e.g. a package isn't published, a type doesn't exist),
log it in BLOCKERS.md and continue with the next phase that isn't blocked.

---

## 3. Known Unknowns — Placeholder Everything

These items are referenced in the plan but don't exist yet. Use placeholder
values and log every placeholder in `PLACEHOLDERS.md`.

### 3.1 URLs

| Reference | Placeholder | Notes |
|---|---|---|
| GitHub issues link | `https://github.com/burnmark-io/label-maker/issues` | Repo may not exist yet — use this URL anyway |
| GitHub discussions link | `https://github.com/burnmark-io/label-maker/discussions` | Same |
| Documentation site | `https://thermal-label.github.io/` | Doesn't exist yet |
| Origin story blog post | `https://burnmark.io/blog/origin-story` | Not published yet |
| Ko-fi funding link | `https://ko-fi.com/mannes` | ✅ Real, use as-is |
| GitHub Sponsors link | `https://github.com/sponsors/mannes` | ✅ Real, use as-is |
| Feedback form / "Let us know" | `https://github.com/burnmark-io/label-maker/issues/new?template=feedback.yml` | Issue template may not exist — URL is still correct |
| Translation contribution | `https://github.com/burnmark-io/label-maker/issues/new?template=translation.yml` | Same |

Use these URLs in the code. They'll work once the repo is public. Don't
invent different URLs or leave `#` placeholders — use the real pattern.

### 3.2 Assets

| Asset | Placeholder | Notes |
|---|---|---|
| App logo / favicon | Simple SVG burnmark icon or text "🏷️" | A proper logo will be designed later |
| PWA icons (192, 512, maskable) | Generated from the placeholder logo | Use a tool like `pwa-asset-generator` or simple solid-colour squares with the text "bm" |
| Sample label (first visit) | Create a simple but attractive label | Text "Hello {{name}}", QR code for `https://burnmark.io`, a simple border |
| Empty state illustrations | Use emoji or Lucide icons as placeholders | Proper illustrations come later |
| Onboarding tour highlight overlays | CSS-based overlays with tooltip | Library like `vue-tour` or `driver.js` or hand-built |

### 3.3 Copy Text

All UI strings go through `vue-i18n` from the start. English is the
source locale. Dutch is the second locale.

For Dutch translations: do your best with automated translation, mark
every Dutch string with a `// TODO: verify Dutch` comment in the locale
file. Log in PLACEHOLDERS.md that Dutch needs human review.

The rotating sponsor texts (footer) need personality. Write English ones
that are cheeky and warm. For Dutch, write a rough version and mark for
review.

### 3.4 Driver API Surface

The web driver packages are published but you need to understand their
actual exports. On day one:

```bash
pnpm add @thermal-label/brother-ql-web @thermal-label/labelwriter-web @thermal-label/labelmanager-web
```

Then read their type definitions:
- How do you open a printer? (`openPrinter`, `requestPrinter`, factory function?)
- What does the web adapter expose? (It implements `PrinterAdapter` from contracts)
- How do you get the device registry for WebUSB filters?
- Does the web package export a `discovery`-like interface or is it
  `navigator.usb.requestDevice()` with filters?

Log what you find in DECISIONS.md. The plan describes the intended flow
but the shipped API is the source of truth.

---

## 4. Architectural Guidance

### 4.1 State Management

```
Pinia stores (global state)
├── designerStore    wraps useLabelDesigner() from @burnmark-io/designer-vue
├── printerStore     connection state, auto-reconnect, media detection
├── libraryStore     saved designs in IndexedDB, 10-slot management
└── preferencesStore UI preferences in localStorage (grid, theme, locale, tour)
```

The `designerStore` is the bridge between the headless engine and the Vue UI.
It calls `useLabelDesigner()` from the Vue composable and exposes its refs
to the rest of the app.

The `printerStore` manages the connection lifecycle independently of the
designer. The app connects the two: `designerStore.render()` produces RGBA,
`printerStore.printer.print(rgba, media)` sends it.

### 4.2 Component Composition

Components should be small and single-purpose. The plan's file tree is a
guide, not a mandate — split further if a component grows beyond ~150 lines.
Use `<script setup>` throughout.

### 4.3 Styling

Tailwind is NOT used. The plan specifies CSS custom properties (design tokens
in `variables.css`) and scoped component styles. Keep it simple — the app's
visual language is minimal enough that utility classes aren't worth the dependency.

Use `<style scoped>` in components. Shared styles via CSS custom properties.
No CSS modules, no CSS-in-JS.

### 4.4 Canvas Library

Konva via `vue-konva`. Read the vue-konva docs for the component API
(`v-stage`, `v-layer`, `v-rect`, `v-text`, `v-image`, `v-group`).

Custom shapes (hearts, stars, borders) are rendered via `v-shape` with a
`sceneFunc` that draws on the Canvas context.

### 4.5 Sheet Templates — Lazy Loading

`@burnmark-io/sheet-templates` is ~100KB gzipped. Do NOT import it at
the top level. Dynamic import when the sheet export dialog opens:

```typescript
async function openSheetDialog() {
  const { SHEETS, findSheet, listBrands } = await import('@burnmark-io/sheet-templates');
  // now populate the sheet picker
}
```

---

## 5. Phase-by-Phase Notes

### Phase 1: Scaffold + Core Shell (steps 1-5)

Straightforward Vite + Vue setup. The critical output is an app that runs
in dev mode and shows the layout shell. No functionality yet — just the
spatial structure (top bar, centre canvas area, collapsible right panel,
footer).

The design tokens (CSS variables) should be set up here — they affect
every component from this point forward.

### Phase 2: Design Canvas (steps 6-16)

The biggest phase. Konva canvas with all object types. This is where the
app becomes real.

**Important:** the `useLabelDesigner` composable from `@burnmark-io/designer-vue`
manages the document state and rendering. The Konva canvas is a VIEW of
that state — it reads from the composable's reactive refs and dispatches
updates via the composable's methods. Don't manage label state in Konva.

Read how the composable works before writing canvas code. The flow is:
1. Composable owns the `LabelDocument`
2. Konva renders from the document's objects array
3. User interactions (drag, resize) call `composable.update(id, patch)`
4. Composable updates the document and emits `'change'`
5. Konva re-renders from the updated document

### Phase 3: Shapes and Borders (steps 17-20)

Custom Konva shapes via `sceneFunc`. Each shape definition is a function
that draws on a `CanvasRenderingContext2D`. The shape library is a data
structure, not a component tree — one `ShapeLibrary.vue` component renders
a grid of all available shapes from the registry.

Border presets are the most complex — they repeat a pattern along all four
edges and need to scale with the label dimensions.

### Phase 4: Printer Integration (steps 21-28)

This is where the web driver packages get used. The printer store manages
the full lifecycle: connect → detect media → print → handle errors.

Auto-reconnect uses `navigator.usb.getDevices()` and
`navigator.serial.getPorts()`. These return previously paired devices.
Try each on mount — first success wins.

**The printer stays connected** after printing. Don't close the connection
after each print — the user will print multiple labels in a session.
Close on tab close (beforeunload) or explicit disconnect.

### Phase 5: Data and Batch (steps 29-36)

CSV/Excel import + template variables + batch printing. The column mapper
is the trickiest UX piece — auto-mapping needs to be good enough that most
users never see the manual mapper.

SheetJS (`xlsx` package) for Excel. Import only the parser, not the full
package — check if tree-shaking handles this or if you need a specific
import path.

### Phase 6: Export and Sharing (steps 37-43)

Save/load from IndexedDB. The 10-slot design library. Export flows for
PNG, PDF, sheets, .label files, bundled .zip.

URL sharing via pako compression + base64 in the hash fragment. Test the
round-trip carefully — compression ratio varies with label complexity.

### Phase 7: PWA and Docker (steps 44-49)

`vite-plugin-pwa` handles most of the work. The install prompt timing
(after 2nd visit) needs manual tracking in localStorage.

**Link capture (Chromium).** The manifest declares `launch_handler`
with `client_mode: ['navigate-existing', 'auto']`. Once installed,
Chromium-based browsers (Chrome, Edge desktop; Chrome Android) will
offer to open `https://burnmark.app/#…` share links in the PWA window
instead of a new browser tab. Captured navigations are delivered to
`window.launchQueue` as `targetURL` and routed through the existing
share-decode + swap-with-save flow. Safari and Firefox ignore the
field; links open in a browser tab as before. Users can disable the
behaviour from the installed app's "open supported links" toggle.

The Docker build is a two-stage Dockerfile — Node for building, nginx
for serving. The compose.yaml includes the print proxy sidecar.

### Phase 8: Polish + i18n + a11y (steps 50-62)

This is where "it works" becomes "it feels good." Extract all strings to
vue-i18n. Add ARIA labels. Add the onboarding tour. Add the about page
and help menu. Polish transitions and error messages.

### Phase 9: Final (steps 63-70)

Integration testing on real hardware and real browsers. Deploy.

---

## 6. What To Do When Stuck

**Can't figure out the web driver API?** Install the package, read the
`.d.ts` files in `node_modules`. The types are the documentation.

**Konva/vue-konva confusion?** The vue-konva docs are thin. Read the Konva
docs directly (konvajs.org) for concepts, then map to vue-konva components
(`Konva.Rect` → `<v-rect>`).

**Design decision not in the plan?** Make a choice, log it in DECISIONS.md,
keep going. Err toward simpler. You can always add complexity later.

**An npm package doesn't export what you expect?** Log in BLOCKERS.md with
the package name, version, what you expected, and what you found. Use a
workaround if possible (direct import path, type assertion) and continue.

**i18n / a11y feels like too much for this phase?** It's in Phase 8 for a
reason. Get the app working first (Phases 1-7), then layer on i18n and a11y.
But DO use `$t()` for all strings from the start — extracting later is painful.

**The plan's component tree doesn't match what you're building?** The tree
is a guide. Split, merge, rename components as needed. The UX walkthrough
(plan section 14) and the ASCII layout diagram are the real spec — the
file tree is just one way to organise the code.

---

## 7. Quality Bar

**The app should feel good.** Not just "it works" but "I want to use this."

- Transitions are smooth, not janky
- The label updates live as you type — no save-and-refresh cycle
- The printer status indicator is always visible and always accurate
- Error messages help the user fix the problem, not just describe it
- The 10-slot library feels generous, not restrictive
- The sample label on first visit makes you go "oh, that's nice"
- The footer sponsor text makes you smile, not cringe

If something feels off, fix it. Don't leave rough edges for "later."
Later is Phase 8, and Phase 8 is for polish that requires the full app
to exist. Basic quality is every phase.

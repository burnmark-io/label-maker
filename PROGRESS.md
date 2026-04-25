# label-maker — Implementation Progress

Tracking the phase/step plan from `PLAN.md` section 22. Tick boxes as steps complete.

## Phase 1: Scaffold + Core Shell
- [x] 1. Scaffold — vite, vue, router, pinia, eslint, prettier, tsconfig
- [x] 2. Design tokens — CSS variables, base styles, typography
- [x] 3. AppShell — layout with top bar, sidebar, canvas area
- [x] 4. Pinia stores — designer (wraps composable), preferences, printer, library
- [x] 5. Gate: app runs in dev mode, sample label loaded

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 2: Design Canvas
- [x] 6. Konva canvas — stage, background layer, grid overlay
- [x] 7. Text objects — add, select, move, resize, edit inline
- [x] 8. Image objects — import (with resize), fit modes, drag
- [x] 9. Shape objects — basic shapes (rect, circle, line)
- [x] 10. Barcode objects — format picker, data input, live preview
- [x] 11. Selection — multi-select, handles, alignment guides, snapping
- [x] 12. Properties panel — text, image, barcode, shape properties
- [x] 13. Objects panel — z-order list, visibility, lock
- [x] 14. Paper direction indicator — feed arrow, cut line for continuous
- [x] 15. Keyboard shortcuts
- [x] 16. Gate: can design a label with all object types, undo/redo works

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 3: Shapes and Borders
- [x] 17. Decorative shapes — heart, star, diamond, arrow, badge, ribbon
- [x] 18. Border presets — simple, classical, playful, dotted
- [x] 19. Shape library picker in toolbar (Basic / Decorative / Borders)
- [x] 20. Gate: all shapes render correctly on canvas and in bitmap preview

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 4: Printer Integration
- [x] 21. Printer connection lib (registry, drivers, connect helpers) and refactored store
- [x] 22. "Connect Printer" button (PrinterPopover) + auto-reconnect composable
- [x] 23. Printer status indicator (connected/paired/disconnected/error)
- [x] 24. Media auto-detection from getStatus() + manual selector
- [x] 25. Print preview panel rendering createPreview() planes (incl. two-colour)
- [x] 26. Print button flow with copies/density popover and toast feedback
- [x] 27. Web Serial alongside WebUSB for Bluetooth SPP (QL-820NWB)
- [x] 28. Gate: connect→preview→print works against mocked drivers

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 5: Data and Batch
- [x] 29. Template variables — placeholder detection, substitution preview
- [x] 30. CSV import — drag-and-drop, papaparse (via designer-core)
- [x] 31. Excel import — SheetJS, first sheet, row 1 as headers
- [x] 32. Column mapper — auto-map (exact → fuzzy → positional) + manual UI, persisted per template-shape
- [x] 33. Batch preview grid — virtual-scrolled thumbnails (lazy-rendered as scrolled into view)
- [x] 34. Batch print — progress bar, per-row status, error recovery
- [x] 35. Limit banner — 30-row cap with "let us know" feedback link
- [x] 36. Gate: import CSV/Excel, map columns, preview batch, print batch

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 6: Export and Sharing
- [x] 37. Save/load — IndexedDB-backed library, 10-slot UI with editable name + description
- [x] 38. Export PNG/PDF — via designer-core composable helpers
- [x] 39. Sheet export — picker dialog (lazy-loads `@burnmark-io/sheet-templates`), visual preview, PDF download
- [x] 40. Export .label file — JSON download
- [x] 41. Export bundled .zip — design + assets, surfaces missing-asset warnings
- [x] 42. URL sharing — pako + base64url, 8KB cap with .label fallback, hash import on app load
- [x] 43. Gate: all export paths work, share URLs round-trip correctly

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 7: PWA and Docker
- [x] 44. PWA — vite-plugin-pwa, manifest, icons, install prompt (after 2nd session, 7-day "maybe later")
- [x] 45. Offline mode — IndexedDB designs, no external CDN deps; SW caches all static assets
- [x] 46. Dockerfile — two-stage build (node:24-slim → nginx:alpine), serves on port 80
- [x] 47. docker-compose.yml — app on 8080, proxy sidecar on 3000 with /dev/bus/usb mount
- [x] 48. compose.yaml published to public/ for download at burnmark-io.github.io/compose.yaml
- [x] 49. Gate: PWA manifest valid, SW registers, Docker builds and runs (smoke-tested with curl)

**Gate check:**
- [x] typecheck
- [x] lint
- [x] test
- [x] build

## Phase 8: Polish, i18n, a11y
- [x] 50. vue-i18n setup with en/nl locales (localStorage → navigator.language → en)
- [x] 51. Dutch locale (best-effort, marked for review in PLACEHOLDERS.md); missing-locale toast for unsupported browsers
- [x] 52. a11y: ARIA labels on icon buttons, focus-visible ring, focus trap in modals, role="dialog" + aria-labelledby + Escape, ToastStack aria-live, side panel tabs (arrow keys), darker amber for text (#b45309), canvas aria-label + off-screen contents summary, prefers-reduced-motion
- [x] 53. Footer with rotating sponsor texts (per-mount, locale-aware), About + Help links
- [x] 54. About modal — name explanation, scopecreep hint, project links, funding, version
- [x] 55. Help menu — restart tour, shortcuts reference, printer compatibility, docs/report/feature links; opens via footer link, top-bar button, and `?` shortcut
- [x] 56. Onboarding tour (4 steps, first-visit auto-start, restartable, dismissable)
- [x] 57. Empty states: side panel "no objects yet" hint, library empty cards, batch "no data" prompt
- [x] 58. Error messages audited — toasts use friendly language, errors include why-then-what
- [x] 59. Transitions polished, all wrapped by prefers-reduced-motion override
- [x] 60. Responsive: tablet landscape stacks side panel under canvas (≤900px breakpoint)
- [x] 61. Performance: virtual scroll in batch grid (Phase 5), debounced renders in composable, lazy-loaded sheet templates
- [x] 62. Gate: typecheck + lint + format + test + build all clean

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

## Phase 10: Side-panel and data UX

Implementing `amendment-side-panel-and-data.md` — merge Objects+Properties into
an accordion, grow the Data tab into a real workspace with a global dataset
pool (≤10 sets, ≤30 rows each, IndexedDB-persisted, cross-design).

### Phase A: Tab structure & migration
- [x] A1. Reduce tabs to 3 (`objects` / `data` / `preview`); `SidePanelTab` type pruned; one-shot migration maps legacy `'properties'` value → `'objects'` at store init
- [x] A2. i18n — `panel.properties` kept as a string but no longer used as a tab label; locale parity preserved
- [x] A3. Onboarding tour step 3 copy updated ("Edit objects in the side panel" / "Click any object in the list to edit its properties.") in en + nl
- [x] A4. Help / shortcuts modal: no Properties-tab references; nothing to update
- [x] A5. Dropped redundant `<h2 class="panel__title">{{ t('panel.X') }}</h2>` headers from `ObjectsPanel.vue`, `DataPanel.vue`, `PrintPreview.vue`

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

## Phase 9: Final
- [x] 63. Verify all gate checks across phases
- [x] 64. Designed for Chrome/Edge desktop full flow; Firefox/Safari fall back to design+export only (banner via `noWebUsb` string)
- [ ] 65. Android OTG scenario — no device available in this session, see BLOCKERS.md
- [x] 66. Docker build smoke-tested in Phase 7
- [x] 67. en.json + nl.json verified at full parity (318 keys each)
- [x] 68. Keyboard-only navigation verified (Tab through topbar/toolbar/panel/dialogs, focus trap in modals, Escape closes)
- [x] 69. PWA manifest valid, install prompt wired (Phase 7)
- [x] 70. Offline-capable build (no external CDNs, IndexedDB designs, SW caches static assets)

**Gate check:**
- [x] typecheck
- [x] lint
- [x] format
- [x] test
- [x] build

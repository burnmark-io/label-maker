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

## Phase 8+ (later sessions)

See `PLAN.md` section 22 for the remaining phases.

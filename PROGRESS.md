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

## Phase 5+ (later sessions)

See `PLAN.md` section 22 for the remaining phases.

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
- [ ] 6. Konva canvas — stage, background layer, grid overlay
- [ ] 7. Text objects — add, select, move, resize, edit inline
- [ ] 8. Image objects — import (with resize), fit modes, drag
- [ ] 9. Shape objects — basic shapes (rect, circle, line)
- [ ] 10. Barcode objects — format picker, data input, live preview
- [ ] 11. Selection — multi-select, handles, alignment guides, snapping
- [ ] 12. Properties panel — text, image, barcode, shape properties
- [ ] 13. Objects panel — z-order list, visibility, lock
- [ ] 14. Paper direction indicator — feed arrow, cut line for continuous
- [ ] 15. Keyboard shortcuts
- [ ] 16. Gate: can design a label with all object types, undo/redo works

**Gate check:**
- [ ] typecheck
- [ ] lint
- [ ] test
- [ ] build

## Phase 3+ (later sessions)

See `PLAN.md` section 22 for the remaining phases.

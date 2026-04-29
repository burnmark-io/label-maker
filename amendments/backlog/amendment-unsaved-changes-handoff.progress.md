# amendment-unsaved-changes-handoff — progress log

Implementation log for the three-way unsaved-changes prompt.

## Pre-implementation review

Re-read the plan; codebase exploration confirms:

- Precondition `amendment-confirmer-singleton-and-hashchange.md` is merged.
  `useConfirm` is a singleton, `<ConfirmDialog>` is mounted at AppShell,
  `isSwapping` race guard is in place, `onHashChange` listener exists.
- `LibraryFullError` is exported from `stores/library.ts`. `MAX_SLOTS` is
  exposed as a property on the store.
- Two inline thumbnail helpers exist (CanvasActions.vue and
  DesignLibrary.vue), both calling `designer.exportPng(undefined, 0.25)`
  + `blobToDataUrl`. Worth factoring out (Step 3).
- `DesignLibrary.onOpen` currently has **no** prompt — opening a library
  design silently discards unsaved canvas work. The plan's "library-open
  migration" is therefore an *addition* of a prompt, not a swap.

## Decision log

- **Migrate every caller of `confirmDestructiveSwap`, not just the three
  named in the plan.** The plan lists drag-drop / hashchange /
  library-open but the cleanup step ("remove `confirmDestructiveSwap`
  once no callers remain") only fires if the new-blank callers
  (`CanvasActions.onNewLabel`, `DesignLibrary.onNewBlankSlot`) also
  migrate. Spirit of the amendment: every canvas-content swap goes
  through one helper and one prompt. Add `swapMessageNoIncoming` i18n
  key for the no-incoming case.
- **Helper return type: `'proceed' | 'save' | 'discard' | 'cancel'`.**
  `'proceed'` is the honest "no work to lose, no prompt shown" value
  (instead of the leaky-abstraction `'discard'` from the prior draft).
  Callers treat `'proceed'` and `'discard'` the same way (load without
  saving) but they're semantically distinct.
- **`useConfirm` extension over sibling composable** (Option A in §4.1).
  Add `choose()` returning `'primary' | 'secondary' | 'cancel'`; reuse
  the same `<ConfirmDialog>` modal, render a third button when
  `secondaryLabel` is provided. Existing binary `confirm()` callers see
  no change.
- **Factor thumbnail helper** to `src/services/thumbnail.ts` (Step 3).
  Two existing call sites already duplicate the logic; adding a third
  in `useLabelImport.saveCurrentToLibrary` would compound the drift.
- **Commit cadence**: gate-and-commit after each step (10 commits).
  Gate = typecheck + tests pass for steps that touch TS; full lint at
  the final step.

## Steps

- [ ] Step 1: Extend `useConfirm` + `ConfirmDialog` with `choose()`
- [ ] Step 2: Add `confirmSwapWithSave` helper
- [ ] Step 3: Factor out thumbnail helper
- [ ] Step 4: `useLabelImport` — `saveCurrentToLibrary` + migrate `runImport`
- [ ] Step 5: AppShell hashchange — migrate
- [ ] Step 6: `DesignLibrary` — add `onOpen` prompt + migrate `onNewBlankSlot`
- [ ] Step 7: `CanvasActions.onNewLabel` — migrate
- [ ] Step 8: i18n keys (en + nl)
- [ ] Step 9: Remove `confirmDestructiveSwap`; update tests
- [ ] Step 10: Final gate

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
- **`DesignLibrary.onOpen` skips the prompt when re-opening the
  document already on the canvas** (`id === designer.document.id`).
  Not in the plan, but the prompt would be confusing — there's no swap
  to confirm.
- **`useConfirm` preemption is bidirectional.** Calling `confirm()`
  while a `choose()` is in flight resolves the choose to `'cancel'`,
  and vice versa. Tests cover both directions.
- **Commit cadence**: gate-and-commit after each step (10 commits).
  Gate = typecheck + tests pass for steps that touch TS; full build +
  lint at the final step.

## Steps

- [x] Step 1: Extend `useConfirm` + `ConfirmDialog` with `choose()` —
      commit `fd51bac`
- [x] Step 2: Add `confirmSwapWithSave` helper — commit `146d585`
- [x] Step 3: Factor out thumbnail helper — commit `a08ebd3`
- [x] Step 4: `useLabelImport` — `saveCurrentToLibrary` + migrate
      `runImport` — commit `727b378`
- [x] Step 5: AppShell hashchange — migrate — commit `3428149`
- [x] Step 6: `DesignLibrary` — add `onOpen` prompt + migrate
      `onNewBlankSlot` — commit `0d36946`
- [x] Step 7: `CanvasActions.onNewLabel` — migrate — commit `9312aa8`
- [x] Step 8: i18n keys (en + nl) — commit `6461fc3`
- [x] Step 9: Remove `confirmDestructiveSwap`; rewrite tests —
      commit `2a6a7be`
- [x] Step 10: Final gate — typecheck, lint, prettier (touched files
      only), full build, 442 tests passing

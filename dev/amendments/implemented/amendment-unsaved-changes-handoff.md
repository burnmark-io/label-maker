# label-maker — Amendment: Three-Way Unsaved-Changes Prompt

> **Precondition:**
> `amendment-confirmer-singleton-and-hashchange.md` lands first.
> That amendment fixes the bug where the prompt didn't render at all
> for drag-drop / Import (factory `useConfirm` with no shared
> dialog), and adds the hashchange listener so share-link mid-session
> loads route through the *existing* binary `confirmDestructiveSwap`.
>
> This amendment is the UX redesign that layers on top: replace the
> binary prompt (Replace / Cancel) with a three-way one
> (Save & open / Discard & open / Cancel) so users with unsaved work
> have a non-destructive path. Once it lands, every "swap canvas
> content" entry point — drag-drop (single file), toolbar Import,
> share-link, library open — converges on the same three-way prompt
> and the same mental model.
>
> **Scope is the prompt rework and the migration of every single-file
> swap caller from the binary helper to the new ternary one.** No
> changes to the share encoder, library service, or import service
> themselves.
>
> **Multi-file drop is split out** into
> `amendment-multi-file-drop.md`. That amendment depends on this one.

---

## 1. The Problem

After the precondition amendment lands, the user sees the *existing*
binary prompt for drag-drop / Import / share-link / library-open:

- Title: "Replace current design?"
- Message: "Replacing will discard your unsaved changes."
- Confirm: "Replace"
- Cancel: "Cancel"

The choices presented are "yes, throw away your unsaved work" and
"no, abandon what you just dropped." Neither matches the common
intent, which is "keep both — save what I'm working on, then load
the new one."

A three-way prompt resolves it: Save & open / Discard & open /
Cancel. The "Save" branch saves the current document to the library
first, then loads the incoming.

---

## 2. Scope

In:
- New `confirmSwapWithSave()` helper on the document lifecycle
  composable. Returns `'proceed' | 'save' | 'discard' | 'cancel'`
  (see §4.2 for why the fourth value). Used by every single-file
  code path that swaps the canvas content while there might be
  unsaved work.
- A three-action confirm modal — extend `useConfirm` to support a
  `secondaryAction` (or introduce a sibling `useChoice` — whichever
  is smaller; see §4.1).
- `runImport` in `useLabelImport.ts` switches from
  `confirmDestructiveSwap` (binary) to `confirmSwapWithSave`
  (ternary). The `'save'` branch saves current to library first,
  then loads incoming.
- `AppShell.vue`'s hashchange listener (added by the precondition
  amendment) re-routed through `confirmSwapWithSave`.
- Library-open path (`DesignLibrary.vue`) re-routed through
  `confirmSwapWithSave`.
- Library save in the `'save'` branch: reuse the existing
  `library.save(doc, { thumbnail })` path. Generate the thumbnail
  via the same helper that the toolbar's Save button uses. If the
  document has never been saved, this creates a new library entry;
  otherwise it updates the existing one.
- Toast feedback after save+open: "Saved {name} to library, then
  opened {incoming}."
- After all callers migrate, remove `confirmDestructiveSwap`.

Out:
- The singleton fix and hashchange listener — covered by the
  precondition amendment.
- **Multi-file drop** — covered by `amendment-multi-file-drop.md`.
- **Library-modal-open drop routing** — covered by
  `amendment-multi-file-drop.md`.
- Auto-saving to library without prompting. This amendment makes
  saving an explicit user choice in the prompt. Implicit autosave to
  library would be a separate, broader policy decision.
- Cross-tab synchronisation. If the user has the same document open
  in two tabs, this amendment doesn't try to reconcile them.
- Conflict resolution if the library save fails (disk full, etc.).
  We surface the error and abort the swap; the user keeps their
  current canvas state. No retry queue.
- Naming the document in the prompt. If the doc has no name yet
  (`document.name === 'Untitled'`), we save under that default; the
  user can rename in the library afterward. Asking for a name inline
  would clutter the prompt; out of scope.
- Save to external `.bnmk` file (covered by
  `designer-core-amendment-burnmark-package-format.md`). When that
  amendment lands, the save action could grow a "Save as file..."
  sibling, but that's its own UX call.

---

## 3. The Prompt

### 3.1 Modal Layout

```
┌──────────────────────────────────────────────┐
│  Replace current design?                     │
├──────────────────────────────────────────────┤
│                                              │
│  You have unsaved changes to                 │
│  "{currentName}". Loading "{incomingName}"   │
│  will replace what's on the canvas.          │
│                                              │
├──────────────────────────────────────────────┤
│   [Cancel]      [Discard & open]             │
│                 [Save & open]   ← primary    │
└──────────────────────────────────────────────┘
```

Three actions, return values:
- **Save & open** → `'save'`. Primary visual treatment (the
  least-destructive, preserves user's work).
- **Discard & open** → `'discard'`. Secondary, with a destructive
  visual cue (red text or warning icon).
- **Cancel** → `'cancel'`. Tertiary / link-style. Also returned on
  Esc, backdrop click, or browser back.

The modal doesn't auto-close on click outside the action buttons —
the user must make a choice. Esc maps to Cancel.

### 3.2 Phrasing

Localised. Default English copy:

```
title:    "Replace current design?"
message:  "You have unsaved changes to '{current}'. Loading '{incoming}'
           will replace what's on the canvas."
saveAndOpen:    "Save & open"
discardAndOpen: "Discard & open"
cancel:         "Cancel"
```

Where `current` is `designer.document.name` and `incoming` is the
file name (or share-link doc name, defaulting to "shared design" if
empty).

### 3.3 When the Prompt Doesn't Fire

The same `!designer.canUndo` short-circuit from
`confirmDestructiveSwap` applies — if there's no work to lose, swap
silently. The helper returns `'proceed'` in that case (see §4.2);
callers treat `'proceed'` the same as `'discard'` for the "load
without saving" branch, but no modal is shown. Demo content (loaded
with `clearHistory()` after) doesn't fire the prompt.

---

## 4. Implementation

### 4.1 useConfirm Extension vs Sibling Composable

The existing `useConfirm` is binary. Two options:

**Option A — extend.** Add an optional `secondaryAction` field to
the existing `confirm` options. When present, render a three-button
modal. Return type widens from `Promise<boolean>` to
`Promise<'primary' | 'secondary' | 'cancel'>`.

**Option B — sibling.** Add `useChoice(...)` returning the three
values. `useConfirm` stays untouched.

Pick **Option A** — extending keeps the modal component reused and
the confirm controller singleton handles both shapes. The
return-type widening is additive (consumers who pass no
`secondaryAction` get the boolean shape) via overloads. One less
component, one less composable, fewer places for state to drift.

```typescript
// useConfirm.ts (sketch)
export interface ConfirmOptionsBase {
  title: string;
  message: string;
  cancelLabel?: string;
  tone?: 'neutral' | 'danger';
}
export interface ConfirmOptions extends ConfirmOptionsBase {
  confirmLabel: string;
}
export interface ChoiceOptions extends ConfirmOptionsBase {
  primaryLabel: string;
  secondaryLabel: string;
  primaryTone?: 'neutral' | 'danger';
  secondaryTone?: 'neutral' | 'danger';
}

export interface ConfirmController {
  confirm(opts: ConfirmOptions): Promise<boolean>;
  choose(opts: ChoiceOptions): Promise<'primary' | 'secondary' | 'cancel'>;
}
```

The modal component (`ConfirmDialog.vue`) gains a third button slot,
hidden when `secondaryLabel` isn't provided. Existing `confirm`
callers see no change.

### 4.2 Lifecycle Helper

The helper returns one of four values. The `'proceed'` value is the
honest answer for "no work to lose, no prompt was shown" — it's
distinct from `'discard'` (user actively chose to throw work away)
even though callers treat both the same way (load without saving).
Keeping them distinct prevents the leaky abstraction of returning a
synthetic user-choice value when no user was asked.

```typescript
// useDocumentLifecycle.ts
export type SwapChoice = 'proceed' | 'save' | 'discard' | 'cancel';

export interface DocumentLifecycle {
  // ... existing fields ...
  confirmSwapWithSave(opts?: { incomingName?: string }):
    Promise<SwapChoice>;
}

async function confirmSwapWithSave(
  opts: { incomingName?: string } = {},
): Promise<SwapChoice> {
  if (!designer.canUndo) return 'proceed';   // no work to lose, no prompt
  const result = await confirmer.choose({
    title: t('lifecycle.swapTitle'),
    message: t('lifecycle.swapMessage', {
      current: designer.document.name,
      incoming: opts.incomingName ?? t('lifecycle.swapIncomingFallback'),
    }),
    primaryLabel: t('lifecycle.swapSaveAndOpen'),
    secondaryLabel: t('lifecycle.swapDiscardAndOpen'),
    cancelLabel: t('common.cancel'),
    primaryTone: 'neutral',
    secondaryTone: 'danger',
  });
  return result === 'primary' ? 'save' : result === 'secondary' ? 'discard' : 'cancel';
}
```

Callers branch:

```typescript
const choice = await lifecycle.confirmSwapWithSave({ incomingName });
if (choice === 'cancel') return;
if (choice === 'save') {
  const ok = await saveCurrentToLibrary();
  if (!ok) return;
}
// 'proceed' and 'discard' both fall through to the load step
```

The `isSwapping` race guard from the precondition amendment wraps
this helper too — same try/finally pattern.

### 4.3 Drag-Drop Wiring (Single File)

```typescript
// useLabelImport.ts (sketch)
async function runImport(file: File): Promise<void> {
  const choice = await lifecycle.confirmSwapWithSave({ incomingName: file.name });
  if (choice === 'cancel') return;

  if (choice === 'save') {
    const ok = await saveCurrentToLibrary();
    if (!ok) return;       // save error toast already shown; don't proceed
  }

  const toastId = show(t('import.loading'), 'info', { sticky: true });
  // ... existing import flow ...
}

async function saveCurrentToLibrary(): Promise<boolean> {
  try {
    const thumbnail = await captureCanvasThumbnail();   // existing helper
    await library.save(designer.document, { thumbnail });
    return true;
  } catch (err) {
    if (err instanceof LibraryFullError) {
      show(t('library.fullOnSaveAndOpen', { count: library.maxSlots }), 'error');
      return false;
    }
    show(t('library.saveError'), 'error');
    return false;
  }
}
```

`captureCanvasThumbnail()` is the same helper the toolbar's Save
button already uses (`CanvasActions.vue:285` area). Factor out once
if not already; reuse here.

**Slot routing** is handled by `library.save()`'s existing
behaviour — it uses `document.id` as the slot key:

- Document loaded from a library slot (existing `id`) → updates
  that slot.
- Fresh / imported / share-link document (`id` not in library)
  → creates a new slot.

No special branching in this amendment; the existing save path
already disambiguates correctly. Worth confirming during
implementation that the doc's `id` survives the
`confirmSwapWithSave` flow without being mutated (it should —
nothing in the new code touches `document.id`).

**Library-full case:** `library.save()` throws
`LibraryFullError` when the user is at capacity and the doc isn't
already in a slot. The save helper catches it specifically and
shows a distinct error toast pointing the user at library
management. The swap aborts; current canvas state preserved. See
§5 for the full behaviour and the future upgrade path when
`amendment-burnmark-package-format.md` lands.

### 4.4 Share-Link Wiring

The hashchange listener (added by the precondition amendment)
swaps from `confirmDestructiveSwap` to `confirmSwapWithSave`:

```typescript
// AppShell.vue
function onHashChange() {
  if (window.location.hash.length <= 1) return;
  const shared = readDocumentFromHash(window.location.hash);
  if (!shared) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return;
  }

  void (async () => {
    const choice = await lifecycle.confirmSwapWithSave({
      incomingName: shared.name || t('lifecycle.swapIncomingFallback'),
    });
    if (choice === 'cancel') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }
    if (choice === 'save') {
      const ok = await saveCurrentToLibrary();
      if (!ok) return;
    }
    designer.loadDocument(shared);
    designer.clearHistory();
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    show(t('share.imported'), 'success');
  })();
}
```

The boot-time read continues to work for cold starts (where canUndo
is false at load and the helper returns `'proceed'` silently).

### 4.5 Library-Open Migration

`components/library/DesignLibrary.vue` opens a chosen design via
`designer.loadDocument(...)`. Switch its `confirmDestructiveSwap`
call to `confirmSwapWithSave` so library users get the same
three-way choice when opening a different design with unsaved work.

After this migration, no callers of the binary
`confirmDestructiveSwap` remain → remove it.

---

## 5. Library Capacity

The library has a hard slot limit. `library.save()` throws
`LibraryFullError` when the user is at capacity and the doc
isn't already in a slot. Three cases the new flow has to handle:

### 5.1 Save & Open With Library Full

User picks "Save & open"; library is full; their document isn't
already a slot. The save helper catches `LibraryFullError`
specifically and surfaces a distinct toast:

> **Library is full ({N}/{N}).**
> Free a slot in the library to save this. [Open library]

The toast includes a link/button that opens the library modal
so the user can delete an entry. The swap itself aborts —
current canvas state preserved, incoming file/share not loaded.
The user can retry the drop / share-link / library-open after
making space.

We do NOT auto-evict. Silently destroying a library entry to
make room for a new one is too easy to get wrong. Strict block
with a clear path is the safer default.

### 5.2 Save & Open When Doc Already Has a Slot

If `document.id` matches an existing library slot, the save is
an *update*, not a new slot — capacity isn't relevant.
`library.save()` succeeds even when the library is full because
no new slot is allocated. The swap proceeds normally.

This is the common case for users who load from library, edit,
then drop in a new file: their current doc updates in place,
the new one loads.

### 5.3 Future Upgrade — Save to File Fallback

When `designer-core-amendment-burnmark-package-format.md` ships
the `.bnmk` package format, the library-full toast grows a
second action:

> **Library is full ({N}/{N}).**
> [Open library]   [Save as file instead…]

"Save as file instead" exports the current document as `.bnmk`
(self-contained, includes images), prompts a download, then
continues the swap. Decouples "save my work" from "save in *this*
place." Out of scope for this amendment — flagged here so the
toast copy and component don't need restructuring when it
lands.

For today's amendment, the toast is the simpler one-action
version with just `[Open library]`.

---

## 6. Edge Cases

### 6.1 Save Fails

`library.save(...)` throws (IndexedDB quota, disk full, etc.).
Catch, show error toast, return `false` from `saveCurrentToLibrary`,
and abort the swap. The user keeps the current canvas state; the
incoming file/share is not loaded. No data lost.

### 6.2 Save Succeeds But Load Fails

Save lands in the library, then the import parser throws. The
user's work is safely in the library; the failed import shows its
existing error toast. No regression — the library entry is real.
Canvas remains on the pre-swap document.

### 6.3 Multi-File Drop

Out of scope — covered by `amendment-multi-file-drop.md`. For this
amendment, the existing single-file behaviour (`files[0]` only) is
preserved; the multi-file amendment fixes the silent-drop bug.

### 6.4 User Cancels Mid-Save

The save step is asynchronous and not user-cancellable today (it's
a quick IndexedDB put). Out of scope to change.

### 6.5 Save & Open When Library Is at Capacity

See §5 (the dedicated Library Capacity section above) for the
full behaviour — strict block, distinct toast with [Open library]
action, swap aborts, current canvas state preserved.

### 6.6 Demo Content — `canUndo === false`

Helper returns `'proceed'`; no prompt fires. Demo content gets
replaced silently. Intentional.

### 6.7 `canUndo === false` After Undo-Back-To-Zero

User makes one change, then undoes it. `canUndo` is now false but
the user may still feel they have work in flight (redo stack
exists). Helper returns `'proceed'` and the swap happens silently;
the redo stack is gone. Mild regression risk but matches today's
behaviour with `confirmDestructiveSwap`. Not worth changing the
heuristic just for this amendment; if it surfaces in feedback, swap
to `canUndo || canRedo` as a follow-up.

---

## 7. Files Affected

```
src/composables/
  useConfirm.ts             extend with `choose()` returning
                            'primary' | 'secondary' | 'cancel';
                            modal renders three buttons when
                            secondaryLabel is provided
  useDocumentLifecycle.ts   add confirmSwapWithSave returning
                            'proceed' | 'save' | 'discard' | 'cancel';
                            remove confirmDestructiveSwap after
                            migration
  useLabelImport.ts         switch to confirmSwapWithSave; add
                            saveCurrentToLibrary helper
                            (single-file only — multi-file routing
                            lives in the multi-file amendment)

src/components/common/
  ConfirmDialog.vue         third button slot, conditional on
                            secondaryLabel; existing binary path
                            unchanged

src/components/layout/
  AppShell.vue              hashchange listener uses
                            confirmSwapWithSave (was
                            confirmDestructiveSwap from precondition
                            amendment); save+load on 'save'

src/components/library/
  DesignLibrary.vue         migrate from confirmDestructiveSwap
                            to confirmSwapWithSave on design open

src/components/toolbar/
  CanvasActions.vue         expose captureCanvasThumbnail (factor
                            out of the existing inline use) so
                            useLabelImport can call it

src/stores/
  library.ts                ensure LibraryFullError is exported;
                            confirm maxSlots is exposed for the
                            error-toast count display

i18n:
  lifecycle.swapTitle, swapMessage, swapSaveAndOpen,
  swapDiscardAndOpen, swapIncomingFallback
  library.saveError, library.fullOnSaveAndOpen,
  library.openLibraryAction
```

No designer-core changes. No schema changes.

---

## 8. Implementation Checklist

```
Precondition:
□ amendment-confirmer-singleton-and-hashchange.md is merged

useConfirm three-way:
□ Extend ConfirmController with choose(ChoiceOptions) overload
□ Modal component renders third button when secondaryLabel provided
□ Tone classes for primary, secondary, danger

Lifecycle helper:
□ confirmSwapWithSave returns 'proceed' | 'save' | 'discard' | 'cancel'
□ Returns 'proceed' when !designer.canUndo (no prompt shown)
□ Wraps in the existing isSwapping guard (try/finally)

Save helper:
□ captureCanvasThumbnail factored out of CanvasActions if not
  already
□ saveCurrentToLibrary uses captureCanvasThumbnail and library.save
□ Catches generic save errors; returns boolean
□ Catches LibraryFullError specifically with distinct toast
  ("Library is full ({N}/{N})") + [Open library] action
□ Slot routing relies on existing library.save behaviour
  (existing id → updates slot; new id → creates slot)
□ Verify document.id survives confirmSwapWithSave flow unchanged

Drag-drop (single file):
□ useLabelImport.runImport handles all four branches
  ('proceed' and 'discard' both fall through to load)
□ 'save' branch saves before loading; aborts on save failure
□ Combined toast on save+open success ("Saved X, opened Y")

Share-link:
□ AppShell hashchange listener routes through confirmSwapWithSave
□ Hash cleared on success, cancel, and undecodable cases

Library-open migration:
□ DesignLibrary.vue uses confirmSwapWithSave for open-design

Cleanup:
□ Remove confirmDestructiveSwap once no callers remain

i18n:
□ lifecycle.swapTitle, swapMessage, swapSaveAndOpen,
  swapDiscardAndOpen, swapIncomingFallback
□ library.saveError, library.fullOnSaveAndOpen,
  library.openLibraryAction
□ Apply to en + every other locale
```

---

## 9. Tests

useConfirm `choose` (`composables/__tests__/useConfirm.test.ts`):
- Renders three buttons when secondaryLabel provided
- Esc / backdrop / cancel return 'cancel'
- Primary returns 'primary'; Secondary returns 'secondary'
- Existing binary `confirm` path unaffected by additions

confirmSwapWithSave
(`composables/__tests__/useDocumentLifecycle.test.ts`):
- Returns 'proceed' immediately when !canUndo (no prompt shown)
- With canUndo, choose returns 'primary' → returns 'save'
- 'secondary' → 'discard'
- 'cancel' → 'cancel'
- Includes incoming name in the message string
- Respects isSwapping guard (concurrent call returns 'cancel'
  without prompting)

Drag-drop wiring:
- Drop with !canUndo → import runs without prompt ('proceed')
- Drop with canUndo + 'save' → library.save called, then import
  runs, both toasts appear
- Drop with canUndo + 'discard' → import runs, no library.save
- Drop with canUndo + 'cancel' → no import, no library.save
- library.save throws → import aborts; canvas state unchanged;
  error toast shown

Share-link wiring:
- hashchange to a valid encoded design + canUndo + 'save' → save
  + load + hash cleared
- hashchange + 'discard' → load + hash cleared, no save
- hashchange + 'cancel' → no load; hash cleared
- hashchange while !canUndo → silent load ('proceed' branch)

Library-open migration:
- Opening a design from library with canUndo prompts via
  confirmSwapWithSave
- 'save' branch saves current to library, then opens chosen
- 'cancel' keeps current; library remains at last entry

Slot routing
(`composables/__tests__/useLabelImport.test.ts`):
- 'save' on a new (never-saved) document → library.save creates
  a new slot
- 'save' on a document loaded from a library slot → library.save
  updates that slot (no new slot created)
- document.id is unchanged across the confirmSwapWithSave call

Library capacity (single-file save):
- 'save' when library is full + new document → LibraryFullError
  thrown; saveCurrentToLibrary returns false; canvas state
  preserved; distinct toast shown with [Open library] action
- 'save' when library is full + existing slot doc → save
  succeeds (update path); swap proceeds normally

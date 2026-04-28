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
> content" entry point — drag-drop, toolbar Import, share-link,
> library open — converges on the same three-way prompt and the same
> mental model.
>
> **Scope is the prompt rework and the migration of every swap
> caller from the binary helper to the new ternary one.** No changes
> to the share encoder, library service, or import service
> themselves.

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
  composable. Returns `'save' | 'discard' | 'cancel'`. Used by every
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
`confirmDestructiveSwap` applies to the new helper — if there's no
work to lose, swap silently. Same heuristic, same trust in `canUndo`
as the "is there real work" signal. Demo content (loaded with
`clearHistory()` after) doesn't fire the prompt.

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

```typescript
// useDocumentLifecycle.ts
export interface DocumentLifecycle {
  // ... existing fields ...
  confirmSwapWithSave(opts?: { incomingName?: string }):
    Promise<'save' | 'discard' | 'cancel'>;
}

async function confirmSwapWithSave(
  opts: { incomingName?: string } = {},
): Promise<'save' | 'discard' | 'cancel'> {
  if (!designer.canUndo) return 'discard';   // no work to lose; "discard" is fine
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

The `isSwapping` race guard from the precondition amendment wraps
this helper too — same try/finally pattern.

### 4.3 Drag-Drop Wiring

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
    show(t('library.saveError'), 'error');
    return false;
  }
}
```

`captureCanvasThumbnail()` is the same helper the toolbar's Save
button already uses (`CanvasActions.vue:285` area). Factor out once
if not already; reuse here.

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
is false at load and the prompt is a no-op).

### 4.5 Library-Open Migration

`components/library/DesignLibrary.vue` opens a chosen design via
`designer.loadDocument(...)`. Switch its `confirmDestructiveSwap`
call to `confirmSwapWithSave` so library users get the same
three-way choice when opening a different design with unsaved work.

After this migration, no callers of the binary
`confirmDestructiveSwap` remain → remove it.

---

## 5. Edge Cases

### 5.1 Save Fails

`library.save(...)` throws (IndexedDB quota, disk full, etc.).
Catch, show error toast, return `false` from `saveCurrentToLibrary`,
and abort the swap. The user keeps the current canvas state; the
incoming file/share is not loaded. No data lost.

### 5.2 Save Succeeds But Load Fails

Save lands in the library, then the import parser throws. The
user's work is safely in the library; the failed import shows its
existing error toast. No regression — the library entry is real.
Canvas remains on the pre-swap document.

### 5.3 User Drops Multiple Files

Existing behaviour: `onDrop` reads `files[0]` only. Unchanged. The
prompt fires once for the first file; subsequent files are ignored.

### 5.4 User Cancels Mid-Save

The save step is asynchronous and not user-cancellable today (it's
a quick IndexedDB put). Out of scope to change.

### 5.5 Save & Open When Library Is at Capacity

If the library has size limits (it does: see existing IndexedDB
quota handling), `library.save(...)` may fail. §5.1 handles it —
error toast, abort.

### 5.6 Demo Content — `canUndo === false`

Short-circuit: prompt doesn't fire. Demo content gets replaced
silently. Intentional.

### 5.7 `canUndo === false` After Undo-Back-To-Zero

User makes one change, then undoes it. `canUndo` is now false but
the user may still feel they have work in flight (redo stack
exists). With the short-circuit, the swap happens silently and the
redo stack is gone. Mild regression risk but matches today's
behaviour with `confirmDestructiveSwap`. Not worth changing the
heuristic just for this amendment; if it surfaces in feedback, swap
to `canUndo || canRedo` as a follow-up.

---

## 6. Files Affected

```
src/composables/
  useConfirm.ts             extend with `choose()` returning
                            'primary' | 'secondary' | 'cancel';
                            modal renders three buttons when
                            secondaryLabel is provided
  useDocumentLifecycle.ts   add confirmSwapWithSave; remove
                            confirmDestructiveSwap after migration
  useLabelImport.ts         switch to confirmSwapWithSave; add
                            saveCurrentToLibrary helper

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

i18n:
  lifecycle.swapTitle, swapMessage, swapSaveAndOpen,
  swapDiscardAndOpen, swapIncomingFallback
  library.saveError
```

No designer-core changes. No schema changes.

---

## 7. Implementation Checklist

```
Precondition:
□ amendment-confirmer-singleton-and-hashchange.md is merged

useConfirm three-way:
□ Extend ConfirmController with choose(ChoiceOptions) overload
□ Modal component renders third button when secondaryLabel provided
□ Tone classes for primary, secondary, danger

Lifecycle helper:
□ confirmSwapWithSave returns 'save' | 'discard' | 'cancel'
□ Short-circuits to 'discard' when !designer.canUndo
□ Wraps in the existing isSwapping guard (try/finally)

Save helper:
□ captureCanvasThumbnail factored out of CanvasActions if not
  already
□ saveCurrentToLibrary uses captureCanvasThumbnail and library.save
□ Catches and surfaces errors; returns boolean

Drag-drop:
□ useLabelImport.runImport handles all three branches
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
□ Three new lifecycle.swap* keys
□ library.saveError key
□ Apply to en + every other locale
```

---

## 8. Tests

useConfirm `choose` (`composables/__tests__/useConfirm.test.ts`):
- Renders three buttons when secondaryLabel provided
- Esc / backdrop / cancel return 'cancel'
- Primary returns 'primary'; Secondary returns 'secondary'
- Existing binary `confirm` path unaffected by additions

confirmSwapWithSave
(`composables/__tests__/useDocumentLifecycle.test.ts`):
- Returns 'discard' immediately when !canUndo (no prompt shown)
- With canUndo, choose returns 'primary' → returns 'save'
- 'secondary' → 'discard'
- 'cancel' → 'cancel'
- Includes incoming name in the message string
- Respects isSwapping guard (concurrent call returns 'cancel'
  without prompting)

Drag-drop wiring:
- Drop with !canUndo → import runs without prompt
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
- hashchange while !canUndo → silent load (existing short-circuit)

Library-open migration:
- Opening a design from library with canUndo prompts via
  confirmSwapWithSave
- 'save' branch saves current to library, then opens chosen
- 'cancel' keeps current; library remains at last entry

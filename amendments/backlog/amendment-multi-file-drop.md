# label-maker — Amendment: Multi-File Drop & Library-Modal Drop Routing

> **Precondition:**
> `amendment-unsaved-changes-handoff.md` lands first. That amendment
> establishes `confirmSwapWithSave`, the three-way prompt, the
> `saveCurrentToLibrary` helper, and the library-full toast pattern.
> This amendment reuses those primitives and extends the drop flow
> to handle multi-file drops and drops onto an open library modal.
>
> **Scope is the multi-file drop UX and the drop-routing rule for
> when the library modal is the active context.** Single-file drop
> behaviour from the precondition amendment is preserved unchanged
> for the 1-file path.

---

## 1. The Problem

Two issues with today's drag-drop flow:

### 1.1 Multi-File Drop Silently Drops Files

When the user drops multiple files at once, the existing flow
reads `files[0]` only — silently dropping every file beyond the
first. Folders containing labels and zip-imports of multiple
labels both hit this. Real workflow: a user with 5 labels designed
elsewhere drops them onto burnmark to import in bulk.

### 1.2 Drop Onto Library Modal Asks the Wrong Question

If the library modal is open and the user drops files onto it (or
the underlying drop overlay catches them), today's flow runs the
canvas-swap prompt — but the user is in library context, not canvas
context. The right question is "save these to the library?", not
"do you want to replace what's on the canvas?"

---

## 2. Design Constraint: No Nested Prompts

The natural sketch of multi-file drop has the user answering two
modals in sequence — first "Save N files to library?", then
"Replace current design?" if they picked the "and open last"
branch. **That's the wrong UX.** Two modals back-to-back feels like
a bug, breaks Esc-to-cancel intuition (which one cancels?), and
doubles the chance of confused interaction.

**Every flow in this amendment must reach a decision in at most
one prompt.** The primary tool for that is making the bulk prompt
*situation-aware*: when `canUndo` is true, the canvas-doc save is
folded into the bulk save batch and surfaced in the primary action
label, not asked separately.

See §4.2 for the resulting prompt shape.

---

## 3. Scope

In:
- `ImportDropOverlay.vue` reads all dropped files (not `files[0]`)
  and dispatches by count.
- New bulk-import prompt for ≥2 files. Situation-aware: includes
  current canvas in the save batch when `canUndo` is true, so no
  nested prompt is needed.
- Pre-flight capacity check for bulk: free slots vs files dropped
  (plus 1 for current canvas when applicable).
- Partial-failure handling mid-bulk: "Saved {k} of {N}" toast.
- Library-modal-open detection: when the library modal is the
  active context, drop routes straight through bulk save (single
  or multi), skipping the canvas-swap prompt entirely. Canvas
  remains untouched.

Out:
- Re-design of the single-file canvas-swap prompt — done by the
  precondition amendment.
- Folder drop and zip drop as separate flows. A folder dropped on
  a browser typically expands to a flat file list at the
  dataTransfer level — the multi-file handler picks them up
  naturally. Zip files are opened by the existing import path
  (which knows how to extract labels from zips); this amendment
  doesn't change that handling.
- Re-ordering / per-file selection in the bulk prompt. The user
  drops what they drop; if they want a subset, they re-drop a
  subset.

---

## 4. The Bulk Prompt

### 4.1 Single File (existing flow)

```
Files dropped: 1
→ confirmSwapWithSave (from precondition amendment)
   → Save & open / Discard & open / Cancel
```

Unchanged.

### 4.2 Multiple Files — Situation-Aware

Two shapes for the bulk prompt depending on whether the canvas has
unsaved work:

**Case A — `canUndo === false` (no work to lose):**

```
┌──────────────────────────────────────────────────────┐
│  Save 5 files to your library?                       │
├──────────────────────────────────────────────────────┤
│  You dropped 5 files. They'll be added to your       │
│  library as new entries.                             │
├──────────────────────────────────────────────────────┤
│   [Cancel]   [Save all]   [Save all and open last]   │
└──────────────────────────────────────────────────────┘
```

- **Save all** — adds every dropped file to the library as new
  slots. Canvas unaffected.
- **Save all and open last** — saves all, then loads the
  last-dropped file onto the canvas. No nested prompt because
  there's no canvas work to protect.
- **Cancel** — no action.

**Case B — `canUndo === true` (canvas has unsaved work):**

```
┌──────────────────────────────────────────────────────┐
│  Save 5 files to your library?                       │
├──────────────────────────────────────────────────────┤
│  You dropped 5 files. They'll be added to your       │
│  library as new entries.                             │
│                                                      │
│  You also have unsaved changes to "{current}".       │
├──────────────────────────────────────────────────────┤
│   [Cancel]                                           │
│   [Save all (keep current canvas)]                   │
│   [Save all + current, open last]   ← primary        │
│   [Discard current, save all, open last]             │
└──────────────────────────────────────────────────────┘
```

- **Save all (keep current canvas)** — saves the 5 dropped files;
  current canvas continues editing. No swap.
- **Save all + current, open last** — saves the 5 dropped files
  *and* the current canvas to the library, then loads the
  last-dropped file. Capacity needs N+1 free slots (or one of
  those is an update to an existing slot — see §5.1).
- **Discard current, save all, open last** — saves the 5 dropped
  files (not the canvas), then loads the last-dropped file. The
  current canvas's unsaved changes are lost. Distinct destructive
  visual treatment.
- **Cancel** — no action.

The Case B layout is busy but it's the correct trade — collapsing
two prompts into one means one busy prompt instead of two simpler
ones. The destructive option is visually distinct enough that the
user doesn't pick it by accident.

The "open last file" branches use the last-dropped file because
drop order is meaningful (file pickers and OS drag operations
preserve order; the last one is typically the "newest" intent in a
multi-select).

### 4.3 Implementation Sketch

```typescript
// useLabelImport.ts (sketch)
async function runBulkImport(files: File[]): Promise<void> {
  // Pre-flight: capacity, including current canvas if it'll be saved
  const willIncludeCurrent = designer.canUndo;
  const newSlotsNeeded = files.length + (willIncludeCurrent && !isCurrentInLibrary() ? 1 : 0);
  const slotsAvailable = library.maxSlots - library.entries.length;

  if (slotsAvailable < newSlotsNeeded) {
    show(t('library.fullOnBulkDrop', {
      free: slotsAvailable,
      needed: newSlotsNeeded,
    }), 'error');
    return;
  }

  const choice = await promptBulkImport({ files, hasUnsavedCanvas: designer.canUndo });
  if (choice === 'cancel') return;

  // Save current canvas first if user opted in (Case B primary action)
  if (choice === 'saveAllPlusCurrentAndOpen') {
    const ok = await saveCurrentToLibrary();
    if (!ok) return;       // toast already shown
  }
  // Discard branch: nothing to do for current; it'll be replaced

  // Bulk save the dropped files
  const result = await saveAllToLibrary(files);
  // result: { saved: number, total: number, failed?: Error }

  if (result.saved < result.total) {
    show(t('library.bulkPartialSuccess', {
      k: result.saved,
      n: result.total,
    }), 'warning');
    if (choice !== 'saveAllOnly' && choice !== 'saveAllKeepCanvas' && result.saved < result.total) {
      // Open-last branch can't reach the last file if save aborted before it
      return;
    }
  }

  // Load last file for the open-last branches
  if (choice === 'saveAllAndOpen' || choice === 'saveAllPlusCurrentAndOpen' || choice === 'discardSaveAllOpen') {
    await loadFile(files[files.length - 1]);
  }
}
```

The `confirmSwapWithSave` helper is **not called** from this path —
the bulk prompt subsumes its question. That's the whole point of
the no-nested-prompt rule.

---

## 5. Library Capacity for Bulk

Bulk save needs to fit *all* files; partial save is disorienting
("which 3 of my 5 went in?"). Pre-flight check rejects the whole
batch when free slots < needed.

### 5.1 N+1 Accounting When Saving Current Canvas

In Case B's "Save all + current, open last" branch, the canvas doc
counts toward capacity *only if it isn't already a slot*. Logic:

```typescript
const newSlotsNeeded =
  files.length +
  (willIncludeCurrent && !isCurrentInLibrary() ? 1 : 0);
```

If the current doc is already a library slot (loaded from library,
edited), the save is an update and consumes no new slot. Common
case for users who load → edit → drop new files.

### 5.2 Overflow Toast

```
Library can hold {2} more file(s); you'd need {6} (5 dropped + your
current canvas). Free more space or drop fewer files. [Open library]
```

User decides: open library and clean up, or re-drop a smaller
batch. Same path as the single-file library-full toast from the
precondition amendment.

### 5.3 Future Upgrade — Save to File Fallback

When `designer-core-amendment-burnmark-package-format.md` ships,
the overflow toast can grow a "Save overflow as files…" action:
export the excess as `.bnmk` downloads. Out of scope here; flagged
so the toast component doesn't need restructuring later.

---

## 6. Library-Modal-Open Drop Routing

When the library modal is the active context, drops bypass the
canvas-swap question entirely and route directly through bulk save
(or single save for 1 file).

### 6.1 Detection

The library modal exposes an `isOpen` flag (via store or shared
ref). The drop overlay's handler reads it before deciding which
flow to run:

```typescript
function onDrop(files: File[]): void {
  if (libraryModal.isOpen) {
    void saveAllToLibraryDirect(files);   // skip canvas-swap entirely
    return;
  }
  if (files.length === 1) {
    void runImport(files[0]);             // single-file flow (precondition amendment)
  } else {
    void runBulkImport(files);            // §4.2 bulk flow
  }
}
```

`saveAllToLibraryDirect` is the bulk save without the prompt — the
user is already in library context, so saving is the obvious
intent. It still runs the capacity check; on overflow it shows the
same toast as §5.2 (without the canvas-related verbiage).

### 6.2 Canvas Untouched

In this route, `designer.canUndo` is irrelevant; the canvas is
never swapped. The user's in-progress canvas work is preserved by
construction.

### 6.3 Single-File Drop Onto Library

A single-file drop while the library modal is open also routes
through `saveAllToLibraryDirect([file])` — same rule applies.
"Library is the active context" beats file-count routing.

---

## 7. Edge Cases

### 7.1 Failure Mid-Bulk

If `library.save()` throws partway through the bulk save (rare —
disk error, etc.), the entries that already saved stay; the
remaining files are skipped. Toast reports partial success:
"Saved {3} of {5} files. {message}." The "open last file" branches
short-circuit when the bulk save aborted before reaching the last
file.

### 7.2 Drop With Zero Real Files

User drops a folder containing only non-label files (or an empty
folder). After filtering by extension, `files.length === 0`. Show
a brief toast ("No label files found") and return without
prompting.

### 7.3 Drop While a Bulk Save Is In Flight

The `isSwapping` guard from the precondition amendment generalises
to a broader `isImporting` flag for this amendment. Concurrent
drops while a bulk save is running are dropped with a brief toast
("Import already in progress").

### 7.4 Save All + Current When Current Save Fails

Case B's primary action saves the current canvas first, then the
batch. If the canvas save fails, abort before touching the batch
(no partial state where some files saved but the user's canvas
wasn't). Toast shows the canvas save error; user retries.

### 7.5 Library Modal Closes Mid-Drop

User starts a drop while modal is open; modal closes before the
async handler reads `isOpen`. The drop committed to the library
route at the synchronous drop event — capture the flag once at
drop time and use the captured value, don't re-read mid-flow.

### 7.6 All Files Already Exist as Slots

Bulk save deduplicates by `document.id`. Imported files get a
fresh `id` so this is unlikely, but if a future flow reuses ids
(e.g., re-import of a previously exported file), saves become
updates and capacity check uses the corrected count.

---

## 8. Files Affected

```
src/composables/
  useLabelImport.ts         add runBulkImport, saveAllToLibrary,
                            saveAllToLibraryDirect; promote
                            isSwapping guard to isImporting

src/components/layout/
  ImportDropOverlay.vue     read all dropped files (not files[0]);
                            dispatch by libraryModal.isOpen first,
                            then by file count

src/components/library/
  DesignLibrary.vue         expose isOpen flag (via store or shared
                            ref) the drop overlay can read

src/components/common/
  BulkImportDialog.vue      new component for the bulk prompt
                            (Case A and Case B layouts; tone classes
                            for the destructive option)

src/stores/
  library.ts                no API changes; confirm bulk-save
                            iteration is exposed (or add a thin
                            saveBatch helper that yields per-file
                            success/failure)

i18n:
  library.bulkPromptTitle, library.bulkPromptMessage,
  library.bulkPromptMessageWithCanvas,
  library.bulkSaveAll, library.bulkSaveAllAndOpen,
  library.bulkSaveAllKeepCanvas,
  library.bulkSaveAllPlusCurrentAndOpen,
  library.bulkDiscardSaveAllOpen,
  library.fullOnBulkDrop, library.bulkPartialSuccess,
  library.noLabelFilesFound, library.importInProgress
```

No designer-core changes. No schema changes.

---

## 9. Implementation Checklist

```
Precondition:
□ amendment-unsaved-changes-handoff.md is merged

Drop overlay:
□ Read files from dataTransfer.files (all of them, not [0])
□ Filter to label-recognisable extensions before counting
□ Capture libraryModal.isOpen at drop time (sync read)
□ Dispatch: library-open → direct save; else by count

Bulk prompt:
□ BulkImportDialog renders Case A (no canvas) and Case B
  (canvas has unsaved) layouts
□ Case B's destructive action ("Discard current") has
  distinct tone treatment
□ Esc / cancel button / backdrop click → 'cancel'
□ NO call to confirmSwapWithSave from the bulk path
  (bulk prompt subsumes that question — design constraint §2)

Bulk save:
□ Pre-flight capacity: files.length (+1 if current included
  AND current not already a slot)
□ Overflow toast: "Library can hold {free}; you'd need {needed}"
  with [Open library] action
□ saveAllToLibrary iterates, collects per-file results
□ Partial-failure toast: "Saved {k} of {N}"
□ Open-last branch short-circuits if save aborted before last

Save current branch (Case B primary):
□ Reuse saveCurrentToLibrary from precondition amendment
□ On failure, abort before touching the batch
□ Capacity already accounted for in pre-flight

Library-modal-open routing:
□ DesignLibrary exposes isOpen via store/ref
□ Drop overlay reads it synchronously at drop time
□ saveAllToLibraryDirect skips both prompts; runs capacity
  check + bulk save only
□ Single-file drop onto library also routes here

Concurrency:
□ isImporting guard (generalised from isSwapping); concurrent
  drops show "Import already in progress" toast

i18n:
□ library.bulkPromptTitle, bulkPromptMessage,
  bulkPromptMessageWithCanvas
□ library.bulkSaveAll, bulkSaveAllAndOpen,
  bulkSaveAllKeepCanvas, bulkSaveAllPlusCurrentAndOpen,
  bulkDiscardSaveAllOpen
□ library.fullOnBulkDrop, bulkPartialSuccess,
  noLabelFilesFound, importInProgress
□ Apply to en + every other locale
```

---

## 10. Tests

Drop overlay routing
(`components/layout/__tests__/ImportDropOverlay.test.ts`):
- Drop 1 file, library modal closed → routes to single-file flow
- Drop 1 file, library modal open → routes to direct save (no prompt)
- Drop 3 files, library modal closed → routes to bulk prompt
- Drop 3 files, library modal open → routes to direct save (no prompt)
- Library modal closes between drop event and async handler →
  uses captured `isOpen` (still routes to library)
- Drop with no label-recognisable files → "No label files found"
  toast, no prompt

Bulk prompt
(`components/common/__tests__/BulkImportDialog.test.ts`):
- Case A (canUndo false) renders 3 buttons
- Case B (canUndo true) renders 4 buttons including the
  "Discard current" destructive action
- Esc / backdrop → 'cancel'
- Each action returns its expected token
- "Save all + current, open last" is the primary visual treatment
  in Case B

Bulk save flow
(`composables/__tests__/useLabelImport.test.ts`):
- Drop 5 files, canUndo false, "Save all" → 5 entries added,
  canvas unchanged
- Drop 5 files, canUndo false, "Save all and open last" → 5
  entries added, last file loaded onto canvas
- Drop 5 files, canUndo true, "Save all + current, open last" →
  current canvas saved, 5 entries added, last loaded
- Drop 5 files, canUndo true, "Discard current, save all, open
  last" → 5 entries added, last loaded; current canvas's edits
  lost as expected
- Drop 5 files, canUndo true, "Save all (keep current canvas)" →
  5 entries added, current canvas unchanged, no swap

Capacity
(`composables/__tests__/useLabelImport.test.ts`):
- Drop 5 files when 2 slots free, canUndo false → overflow toast,
  no save
- Drop 5 files when 6 slots free, canUndo true, current is NEW →
  pre-flight needs 6 (5 + 1); passes
- Drop 5 files when 5 slots free, canUndo true, current is
  ALREADY a slot → pre-flight needs 5; passes (current is update)
- Drop 5 files when 5 slots free, canUndo true, current is NEW →
  pre-flight needs 6; rejects with overflow toast
- Overflow toast includes [Open library] action

Failure cases:
- Bulk save aborts mid-batch (3 of 5 saved) → partial toast,
  open-last branch short-circuits
- Save current fails (Case B primary) → abort before batch;
  no entries created
- Concurrent drop while bulk save in flight → second drop shows
  "Import already in progress"; first drop completes normally

Library-modal-open direct save:
- Drop 3 files into open library modal → 3 entries added,
  canvas unchanged regardless of canUndo
- Drop 1 file into open library modal → 1 entry added, no prompt
- Capacity check still applies in this route
- Canvas's `canUndo` state irrelevant — never swapped

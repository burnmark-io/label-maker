# label-maker — Amendment: Multi-File Drop & Library-Modal Drop Routing

> **Precondition:**
> `amendment-unsaved-changes-handoff.md` has landed. That amendment
> establishes `confirmSwapWithSave`, the three-way prompt, the
> `saveCurrentToLibrary` helper, and the library-full toast pattern.
> This amendment reuses those primitives and extends the drop flow
> to handle multi-file drops and drops onto an open library modal.
>
> **Scope is the multi-file drop UX and the drop-routing rule for
> when the library modal is the active context.** Single-file drop
> behaviour from the precondition amendment is preserved unchanged
> for the 1-file canvas-context path.

---

## 1. The Problem

Two issues with today's drag-drop flow:

### 1.1 Multi-File Drop Silently Drops Files

When the user drops multiple files at once, the existing flow
reads `files[0]` only — silently dropping every file beyond the
first. Real workflow: a user with 5 labels designed elsewhere
drops them onto burnmark to import in bulk.

### 1.2 Drop Onto Library Modal Asks the Wrong Question

If the library modal is open and the user drops files onto it,
today's flow runs the canvas-swap prompt — but the user is in
library context, not canvas context. The right question is "save
these to the library?", not "do you want to replace what's on the
canvas?"

---

## 2. Design Principles

Three principles drive the rest of the document:

### 2.1 Bulk Drop Is Additive, Never a Swap

A multi-file drop adds entries to the library. It never swaps
the canvas. After the bulk save, the library modal opens (or
stays open) so the user can browse and pick what to load — at
which point the existing single-file `confirmSwapWithSave` prompt
fires naturally if their canvas is dirty. This collapses the
"two prompts back-to-back" trap into one prompt + a deferred
choice the user makes when they're ready.

### 2.2 All-or-Nothing Capacity

Bulk save is binary: either every dropped file lands, or none do.
Pre-flight rejects when capacity is insufficient. The bulk prompt
disables individual branches whose specific outcome would
overflow capacity (e.g. "Save all + current canvas" when only N
slots free for N files and the current doc is new). The user is
never asked to consent to a partial save.

### 2.3 Library Context Beats File-Count Routing

When the library modal is open at drop time, drops route directly
through bulk save, skipping the prompt entirely. The user is
already in library curation mode — saving is the obvious intent.
Single-file or multi-file, same rule.

---

## 3. Scope

In:
- `ImportDropOverlay.vue` reads all dropped files (not `files[0]`),
  filters out folders and zips, dispatches by count and library
  context.
- New bulk-import prompt for ≥2 files. Two shapes (Case A / Case
  B) depending on whether the canvas has unsaved work; never
  swaps the canvas as part of the bulk action.
- Pre-flight capacity check rejecting drops that can't fit.
- Per-branch capacity disabling in the prompt for the `+ current`
  branch.
- Library-modal-open detection: when the library modal is the
  active context, drops route straight through bulk save (single
  or multi), skipping all prompts. Canvas remains untouched.
- After bulk save completes, open the library modal so the user
  can browse the new entries and pick one to load.
- Explicit refusal toasts for folder drops and zip-in-bulk drops.

Out:
- Re-design of the single-file canvas-swap prompt — done by the
  precondition amendment.
- **Folder drop.** Browsers don't expose folder contents in
  `dataTransfer.files` (folders show up as zero-byte entries; full
  recursion needs the `dataTransfer.items` + `webkitGetAsEntry`
  API). Dropping a folder shows a clear refusal toast. A future
  amendment can add folder traversal if demand surfaces.
- **Zip in multi-file or library-modal-open routes.** The
  designer-core `amendment-burnmark-package-format.md` will
  introduce a `.bnmk` package format that supersedes today's zip
  bundle. Rather than extending zip handling to two new code paths
  we'd retire shortly after, this amendment treats zips in those
  paths as unsupported (refusal toast). Single-file canvas drop of
  a zip is unchanged — that's the existing flow.
- Re-ordering or per-file selection in the bulk prompt. The user
  drops what they drop; if they want a subset, they re-drop a
  subset.
- Auto-loading any of the dropped files onto the canvas. The user
  picks from the library after the save lands.

---

## 4. The Bulk Prompt

### 4.1 Single File, Canvas Context (existing flow)

```
Files dropped: 1, library modal closed
→ confirmSwapWithSave (from precondition amendment)
   → Save & open / Discard & open / Cancel
```

Unchanged.

### 4.2 Multiple Files — Two Shapes

**Case A — `canUndo === false` (no work on canvas):**

```
┌──────────────────────────────────────────────────────┐
│  Save 5 files to your library?                       │
├──────────────────────────────────────────────────────┤
│  5 dropped files will be added to your library as    │
│  new entries.                                        │
├──────────────────────────────────────────────────────┤
│   [Cancel]                          [Save all]       │
└──────────────────────────────────────────────────────┘
```

- **Save all** — adds every dropped file to the library as new
  slots. After save, the library modal opens.
- **Cancel** — no action.

Case A has no `+ current` option because there's nothing to add
beyond the dropped files.

**Case B — `canUndo === true` (canvas has unsaved work):**

```
┌──────────────────────────────────────────────────────┐
│  Save 5 files to your library?                       │
├──────────────────────────────────────────────────────┤
│  5 dropped files will be added to your library as    │
│  new entries.                                        │
│                                                      │
│  You also have unsaved changes to "{current}".       │
├──────────────────────────────────────────────────────┤
│   [Cancel]                                           │
│   [Save without current]                             │
│   [Save all + current]              ← primary        │
└──────────────────────────────────────────────────────┘
```

- **Save without current** — saves the 5 dropped files; current
  canvas continues editing. After save, library modal does NOT
  open (the user explicitly said "I'm staying on the canvas").
- **Save all + current** — saves the 5 dropped files *and* the
  current canvas to the library. After save, library modal opens
  so the user can pick what to load next. Disabled when the
  current canvas isn't already a library slot AND remaining
  capacity equals `files.length` exactly (no room for the +1).
  Disabled state shows an inline hint:
  *"Library full — free a slot to include the current canvas."*
  When disabled, the primary visual treatment shifts to
  "Save without current" so we never render a disabled primary
  button.
- **Cancel** — no action.

There's no "Discard current" branch. Discarding only made sense
in the precondition amendment's *swap* context — bulk drop never
swaps, so there's nothing to discard. The user who wants to throw
away their canvas work picks "Save without current" and then
manually clears or loads something from the library afterwards.

### 4.3 Why No "Open Last" Branch

Earlier sketches included a "Save all and open the last-dropped
file" branch. Removed because:
- "Last" is unstable across OS / browsers (Finder marquee selects
  preserve order; Windows Explorer doesn't reliably).
- It re-introduced the nested-prompt problem (the open step would
  need to ask about discarding the current canvas).
- The library-after-save flow lets the user pick deliberately.

If the user wants to load one of the new entries, they click it
in the library modal that opens automatically. That click goes
through the existing single-file flow including the swap prompt
— no new code path needed.

### 4.4 Implementation Sketch

```typescript
// useLabelImport.ts (sketch)

const isImporting = ref(false);  // module-scoped, blocks overlapping bulk flows

async function runBulkImport(files: File[]): Promise<void> {
  if (isImporting.value) {
    show(t('library.importInProgress'), 'info');
    return;
  }
  isImporting.value = true;
  try {
    // Pre-flight: hard capacity reject when no branch can fit.
    const free = library.remainingSlots;
    if (files.length > free) {
      show(t('library.fullOnBulkDrop', {
        free, needed: files.length,
      }), 'error');
      return;
    }

    // Per-branch feasibility: can we also fit the current canvas?
    const currentIsExistingSlot = library.entries.some(
      e => e.id === designer.document.id,
    );
    const plusCurrentFits =
      currentIsExistingSlot || files.length + 1 <= free;

    const choice = await promptBulkImport({
      fileCount: files.length,
      currentName: designer.document.name,
      hasUnsavedCanvas: designer.canUndo,
      plusCurrentEnabled: plusCurrentFits,
    });
    if (choice === 'cancel') return;

    const result = await saveAllToLibrary(files);
    if (!result.ok) {
      show(t('library.bulkSaveFailed'), 'error');
      return;                                     // batch failed, no library open
    }

    let currentSaveFailed = false;
    if (choice === 'saveAllPlusCurrent') {
      const ok = await saveCurrentToLibrary();    // from precondition
      if (!ok) currentSaveFailed = true;          // toast already shown by helper
      // Bulk batch stays either way — see §8.4.
    }

    if (!currentSaveFailed) {
      show(t('library.bulkSaveSuccess', { count: files.length }), 'success');
    }

    // Open library so the user can pick — except when they
    // explicitly chose "Save without current" (they want to keep
    // editing) or the library is already open.
    const shouldOpenLibrary =
      choice !== 'saveDroppedOnly' && !libraryUi.isOpen;
    if (shouldOpenLibrary) libraryUi.open();
  } finally {
    isImporting.value = false;
  }
}
```

`confirmSwapWithSave` is **not called** from this path. The bulk
prompt is its own modal — it never asks about replacing the
canvas because it never replaces the canvas.

### 4.5 Save Order and Atomicity

`saveAllToLibrary` iterates the dropped files and calls
`library.save` for each. On any per-file failure (rare —
IndexedDB / quota / disk error after pre-flight passed), it rolls
back the entries created so far via `library.deleteDesign(id)`
for each saved id, then returns `{ ok: false, error }`. Net
effect: either every dropped file lands or none do. Matches the
all-or-nothing principle in §2.2.

The `saveCurrentToLibrary` step (Case B's `+ current` branch)
runs *after* the batch succeeds. If it fails, the dropped files
remain saved (the user's main intent) and the canvas-save error
is toasted. We do not roll back the bulk batch on a current-save
failure — the dropped files were the primary action, and rolling
them back would punish the user for an orthogonal failure.

---

## 5. Library Capacity for Bulk

### 5.1 Pre-flight (no branch can fit)

If `files.length > remainingSlots`, the drop is rejected
immediately with a toast and no prompt is shown:

> Library can hold {2} more file(s); you'd need {6}.
> Free space in the library first. [Open library]

The `[Open library]` action opens the library modal so the user
can delete an entry and re-drop.

### 5.2 Per-branch (only `+ current` doesn't fit)

When `files.length === remainingSlots` and the current canvas
isn't already a library slot, the dropped files alone fit but
the `+ current` option would overflow. The prompt still shows;
the `+ current` button is rendered disabled with the hint
*"Library full — free a slot to include the current canvas."*
The `Save without current` and `Cancel` actions remain
enabled.

When the current canvas already occupies a slot (its `id` matches
an existing entry), the `+ current` save is an *update* — no new
slot allocated — so it's enabled even at exact capacity.

### 5.3 Future Upgrade — Save to File Fallback

When `designer-core-amendment-burnmark-package-format.md` ships,
both the pre-flight overflow toast and the per-branch disabled
hint can grow a "Save overflow as files…" action: export the
excess as `.bnmk` downloads. Out of scope here; flagged so the
toast and dialog components don't need restructuring later.

---

## 6. Library-Modal-Open Drop Routing

When the library modal is the active context, drops bypass the
bulk prompt entirely and route straight through bulk save (or
single save for 1 file).

### 6.1 Detection Without Prop-Drilling

Today `libraryOpen` is a `ref` in `AppShell.vue` passed via the
`:open` prop to `<DesignLibrary>`. The drop overlay can't reach
that without prop-drilling, and `TopBar` / `CanvasActions` /
`DesignLibrary` itself all toggle it. Lift to a tiny pinia store:

```typescript
// stores/libraryUi.ts
export const useLibraryUiStore = defineStore('libraryUi', () => {
  const isOpen = ref(false);
  function open()  { isOpen.value = true;  }
  function close() { isOpen.value = false; }
  return { isOpen, open, close };
});
```

Migrate the `libraryOpen` ref in `AppShell.vue`, the
`@open-library` event handlers in `TopBar.vue` and
`CanvasActions.vue`, and `DesignLibrary.vue`'s `@close` emit to
read/write `libraryUi.isOpen` instead. Single source of truth,
readable from the drop overlay.

### 6.2 Captured at Drop Time

The drop overlay reads `libraryUi.isOpen` *synchronously at the
top of `onDrop`*, before any `await`. The captured value is the
one used for routing — even if the modal closes during the async
flow, the route stays committed:

```typescript
function onDrop(event: DragEvent): void {
  const libraryWasOpen = libraryUi.isOpen;   // capture sync
  const files = collectDroppedFiles(event);
  void dispatch(files, libraryWasOpen);
}
```

### 6.3 Modal vs Overlay Z-Index

The drop overlay uses `z-index: 1000`. The library modal sits on
its own stacking context (`Modal.vue`). During drag, the overlay
must paint above any open modal so the drop event lands on the
overlay's handler.

**Verify during implementation**: bump the overlay's z-index above
the modal layer if needed, and add a test that the overlay's
`onDrop` actually fires while the library modal is open.

### 6.4 Routing Logic

```typescript
async function dispatch(files: File[], libraryWasOpen: boolean):
  Promise<void>
{
  if (files.length === 0) {
    show(t('library.noLabelFilesFound'), 'info');
    return;
  }
  if (libraryWasOpen) {
    void runBulkImport(files);   // §4.4 — prompt-less direct save
    return;                      //         (see §6.5)
  }
  if (files.length === 1) {
    void runImport(files[0]);    // single-file flow, precondition amendment
  } else {
    void runBulkImport(files);   // §4.4 — multi-file bulk with prompt
  }
}
```

### 6.5 Prompt-Less When Library Is Open

When the bulk flow is invoked from the library-modal-open route,
it skips the prompt and runs the equivalent of Case A's `Save
all` directly:
- Capacity pre-flight still applies (§5.1).
- Canvas is never touched; `canUndo` is irrelevant in this route.
- After save, library modal stays open (it was already open) so
  the new entries appear without a transition.

The single-file branch into this route also goes through the
prompt-less path (1-file capacity is trivial; no canvas concern).

### 6.6 Drop Overlay Copy

When the library modal is open, the overlay's title changes
from "Drop to import" to "Drop to add to library." One i18n key:
`import.dropOverlayTitleLibrary`. The overlay component reads
`libraryUi.isOpen` to pick the copy.

---

## 7. Folder and Zip Refusal

### 7.1 Folders

A dropped folder appears in `dataTransfer.files` as a zero-byte
entry with no extension; recursion would need the
`dataTransfer.items` + `webkitGetAsEntry` API which we're not
adding. Detection at drop time:

```typescript
function collectDroppedFiles(event: DragEvent): File[] {
  const items = event.dataTransfer?.items;
  let sawFolder = false;
  if (items) {
    for (let i = 0; i < items.length; i += 1) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry?.isDirectory) sawFolder = true;
    }
  }
  if (sawFolder) {
    show(t('library.foldersUnsupported'), 'info');
  }
  // Filter to label-recognisable extensions. Folder pseudo-files
  // (zero-byte, no extension) fall out naturally.
  const files = Array.from(event.dataTransfer?.files ?? []);
  return files.filter(isLabelFile);
}

function isLabelFile(f: File): boolean {
  const lower = f.name.toLowerCase();
  return lower.endsWith('.label') || lower.endsWith('.json');
}
```

Mixed drop (folder + files): the folder is announced via toast,
the inside-folder files are *not* recursed, but any sibling files
dropped alongside the folder do get picked up via the extension
filter.

### 7.2 Zip Files

Single-file canvas-context drop of a zip: unchanged. The existing
`runImport` accepts zip via `importLabelFile`. Out of scope here.

Multi-file drop containing zip(s), or library-modal-open drop of
a zip: zips are filtered out by `isLabelFile` (no `.zip` in the
allowlist). If any zip was filtered out, surface a one-time
toast:

> Zip files aren't supported in bulk drops. Drop them one at a time.

When `amendment-burnmark-package-format.md` lands, `.bnmk` joins
the allowlist and zips can be removed entirely. This amendment
prepares for that by not entrenching zip in the new code paths.

### 7.3 Empty After Filtering

After folder warning + extension filter, if `files.length === 0`,
show `library.noLabelFilesFound` and return without prompting.

---

## 8. Edge Cases

### 8.1 Mid-Batch Failure With Rollback

Pre-flight ensures capacity, so a runtime failure during
`saveAllToLibrary` is rare (disk quota, IndexedDB transaction
abort). When it happens, rollback deletes the entries created so
far and the user sees:

> Save failed. No files were added. {error message}

If the rollback delete itself fails (very rare), swallow the
secondary error — the user's library is in a slightly polluted
state but the primary error is what they need to see and act on.

### 8.2 Drop With Zero Real Files

After folder warning + extension filter, `files.length === 0`.
Toast: "No label files found in the drop." No prompt.

### 8.3 Concurrent Drops

The `isImporting` ref blocks re-entry. A second drop while the
first is still running shows: "An import is already in progress.
Wait for it to finish." First drop completes normally.

### 8.4 Save Current Fails (Case B `+ current`)

Bulk batch saved successfully; the post-batch
`saveCurrentToLibrary` fails (disk quota during the canvas save).
We do NOT roll back the bulk batch — the dropped files were the
primary action and the user's intent. The canvas save error toast
fires (from `saveCurrentToLibrary`). The library modal still
opens.

### 8.5 Library Modal Closes Mid-Drop

The route is committed at the synchronous drop event via
`libraryWasOpen` capture (§6.2). If the modal closes during the
async flow, the route still uses the captured value.

### 8.6 Library Modal Opens Mid-Drop

Symmetric case: drop starts on canvas (modal closed), modal opens
during async flow. Captured `libraryWasOpen === false` → bulk
prompt fires anyway. After save, the §4.4 logic checks
`libraryUi.isOpen` and skips the auto-open if it's already open.

### 8.7 Document IDs Always Fresh

`importLabelFile` rewrites every imported doc's `id` (see comment
in `services/label-import.ts`). Bulk save can't accidentally
update an existing slot via id collision.

---

## 9. Files Affected

```
src/composables/
  useLabelImport.ts         add runBulkImport, saveAllToLibrary
                            (with rollback); add isImporting ref;
                            keep existing runImport untouched

src/components/layout/
  ImportDropOverlay.vue     read all dropped files, detect folders,
                            filter to .label/.json; capture
                            libraryUi.isOpen at drop time;
                            dispatch by route then by count;
                            update overlay copy when library open;
                            verify z-index above modal

src/components/library/
  DesignLibrary.vue         migrate libraryOpen prop to libraryUi
                            store (read isOpen, emit close to
                            store.close())

src/components/layout/
  AppShell.vue              libraryOpen ref → libraryUi store
  TopBar.vue                @open-library → libraryUi.open()
src/components/toolbar/
  CanvasActions.vue         @open-library → libraryUi.open()

src/components/common/
  BulkImportDialog.vue      new component for the bulk prompt
                            (Case A and Case B layouts; renders
                            disabled "+ current" button with
                            inline hint when over capacity)

src/stores/
  libraryUi.ts              new tiny pinia store: { isOpen,
                            open, close }

src/stores/
  library.ts                no API changes (uses existing
                            remainingSlots, save, deleteDesign)

i18n:
  library.bulkPromptTitle
  library.bulkPromptMessage
  library.bulkPromptCanvasNote
  library.bulkSaveAll
  library.bulkSaveDroppedOnly
  library.bulkSaveAllPlusCurrent
  library.bulkPlusCurrentDisabled
  library.bulkSaveSuccess
  library.bulkSaveFailed
  library.fullOnBulkDrop
  library.foldersUnsupported
  library.zipUnsupportedInBulk
  library.noLabelFilesFound
  library.importInProgress
  import.dropOverlayTitleLibrary
```

ICU plural rules required for any key with a `{count}` /
`{free}` / `{needed}` placeholder. No designer-core changes. No
schema changes.

---

## 10. Implementation Checklist

```
Precondition:
□ amendment-unsaved-changes-handoff.md is merged

libraryUi store + migrations:
□ Create src/stores/libraryUi.ts ({ isOpen, open, close })
□ AppShell.vue: replace local libraryOpen ref with store
□ TopBar.vue / CanvasActions.vue: @open-library → libraryUi.open()
□ DesignLibrary.vue: read :open from store; emit close → store.close()
□ Verify all existing call sites of libraryOpen migrated

Drop overlay:
□ collectDroppedFiles(event) — detect folders via items API,
  toast foldersUnsupported, filter to .label/.json
□ Toast zipUnsupportedInBulk when any .zip filtered out
  (multi-file or library-modal-open route only)
□ Capture libraryUi.isOpen synchronously at drop time
□ Dispatch: empty → noLabelFilesFound; library open → bulk
  (prompt-less); 1 file → runImport; ≥2 → runBulkImport
□ Overlay copy switches to import.dropOverlayTitleLibrary when
  library modal is open
□ Verify overlay z-index renders above Modal stacking context;
  bump if necessary

Bulk prompt (BulkImportDialog.vue):
□ Case A (canUndo false) renders 2 buttons (Cancel, Save all)
□ Case B (canUndo true) renders 3 buttons (Cancel, Save without
  current, Save all + current); primary = "Save all + current"
  when enabled, otherwise primary shifts to "Save without current"
□ "Save all + current" disabled when plusCurrentEnabled is false;
  disabled state shows library.bulkPlusCurrentDisabled hint
□ Esc / cancel button / backdrop click → 'cancel'
□ NO call to confirmSwapWithSave from this path

Bulk save flow (useLabelImport.runBulkImport):
□ isImporting guard; second drop shows importInProgress toast
□ Pre-flight: files.length > remainingSlots → fullOnBulkDrop
  toast with [Open library] action; no prompt
□ Per-branch feasibility passed to prompt
  (currentIsExistingSlot OR files.length + 1 <= remainingSlots)
□ saveAllToLibrary iterates files; on per-file error, rolls back
  via library.deleteDesign(savedIds[]); returns { ok: false, error }
□ On rollback failure, swallow secondary error, show primary
□ "Save all + current" branch runs saveCurrentToLibrary AFTER
  the batch; on its failure, batch stays saved, current-save
  toast fires, library modal still opens
□ Success toast: bulkSaveSuccess { count }
□ Library modal auto-opens after success EXCEPT when:
    • route was library-modal-open (already open), OR
    • user picked "Save without current"

Library-modal-open route:
□ runBulkImport invoked with prompt-less flag → runs Case A
  semantics directly (no canvas operations)
□ Capacity pre-flight still applies
□ Single-file drops into open library route through here too

Concurrency:
□ isImporting blocks overlapping bulk flows (toast)
□ confirmSwapWithSave's existing isSwapping guard is unchanged
  (precondition amendment)

i18n:
□ All keys listed in §9 added with ICU plural rules where
  placeholders are counts
□ Apply to en + every other locale
```

---

## 11. Tests

Drop overlay routing
(`components/layout/__tests__/ImportDropOverlay.test.ts`):
- Drop 1 file, library closed → routes to single-file flow
- Drop 1 file, library open → routes to prompt-less bulk save
- Drop 3 files, library closed → routes to bulk prompt
- Drop 3 files, library open → routes to prompt-less bulk save
- Library closes between drop event and async handler → uses
  captured `isOpen` (still routes to library-route)
- Drop empty after filtering → noLabelFilesFound toast, no prompt
- Drop with folder entry detected → foldersUnsupported toast;
  sibling files are still picked up
- Drop with .zip among files in multi-file route →
  zipUnsupportedInBulk toast; non-zip files still processed
- Drop with .zip into library-modal-open → zipUnsupportedInBulk
  toast; non-zip files still processed
- Overlay paints above library modal during drag (z-index test)
- Overlay copy switches when library is open

Bulk prompt
(`components/common/__tests__/BulkImportDialog.test.ts`):
- Case A (canUndo false) renders 2 buttons
- Case B (canUndo true) renders 3 buttons including "+ current"
- "+ current" is the primary visual treatment in Case B when enabled
- "+ current" rendered disabled with hint when
  plusCurrentEnabled === false; primary visual shifts to
  "Save without current"
- Esc / backdrop / cancel → 'cancel'
- Each enabled action returns its expected token

Bulk save flow
(`composables/__tests__/useLabelImport.test.ts`):
- Drop 5 files, canUndo false → 5 entries added; canvas
  unchanged; library modal opens after success
- Drop 5 files, canUndo true, "Save without current" → 5
  entries added; current canvas unchanged; library does NOT
  auto-open
- Drop 5 files, canUndo true, "Save all + current" → 5 entries
  added, then current canvas saved; library opens after success
- Bulk save mid-batch error → rollback deletes already-saved
  entries; bulkSaveFailed toast; library does not open
- Save current fails after successful batch → batch stays;
  current-save error toast fires; library still opens

Capacity
(`composables/__tests__/useLabelImport.test.ts`):
- Drop 5 files when 2 slots free → fullOnBulkDrop toast, no
  prompt
- Drop 5 files when 5 slots free, canUndo false → prompt shows;
  Save all enabled
- Drop 5 files when 5 slots free, canUndo true, current is NEW →
  prompt shows; "Save without current" enabled; "+ current"
  disabled with hint
- Drop 5 files when 5 slots free, canUndo true, current is
  existing slot → "+ current" enabled (update, no new slot)
- Drop 5 files when 6 slots free, canUndo true, current is NEW →
  "+ current" enabled
- Pre-flight overflow toast includes [Open library] action

Concurrency:
- Concurrent drop while bulk in flight → second drop shows
  importInProgress toast; first drop completes normally

libraryUi store migration:
- TopBar @open-library calls store.open(); modal becomes visible
- DesignLibrary close emits → store.close()
- Drop overlay reads isOpen from the store

i18n:
- All new keys exist in en and every shipped locale
- Plural keys render correctly for count = 1 and count > 1

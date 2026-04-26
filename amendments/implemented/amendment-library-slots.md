# Amendment — Library slot semantics: Save / Save as / New / Fork

> **Amends:** `PLAN.md` §10 (Storage / library) and §6 (Save flow).
> The library renders 10 slots
> ([DesignLibrary.vue:15-73](src/components/library/DesignLibrary.vue#L15-L73))
> but only one of them is ever reachable: the slot keyed by the
> current document's id. Every Save call writes back to that same id
> ([library.ts:47-60](src/stores/library.ts#L47-L60)), so slots 2–10
> are dead UI for anyone who hasn't opened a different design from
> the library first.
> **Companion to:** `PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md`.
> **Sibling:** `amendment-label-import.md` (imports need to know
> which slot they land in — see §3.5 for the cross-cutting decision).
>
> One sentence: surface explicit **New label**, **Save**, and **Save
> as new** actions so the 10-slot library is fully reachable, fix the
> empty-slot `+` button to actually create a new entry instead of
> silently overwriting the active one, and make import / share / sample
> documents follow the same id-aware rules — every slot can be filled,
> every slot can be reopened, and no slot is ever clobbered by accident.

---

## 1. Vision

Today's UX:

```
User boots burnmark → sample loads → user edits → clicks Save →
slot 1 fills with "My great label" → user keeps editing → clicks Save →
slot 1 updates → user clicks "+" on slot 2 → slot 1 updates again →
user wonders why slot 2 is empty.
```

The library is presented as a 10-slot grid with `+` placeholders, but
the only path to slot 2 is to open *something else* first (which
nothing creates) or to share-import a foreign document (which has its
own id). The grid is a promise the app doesn't keep.

**Three small actions fix this:**

1. **New label.** Top-bar / menu action that mints a fresh document
   id and a blank canvas. The next Save lands in the next free slot.
2. **Save / Save as new.** Save updates the current slot (id-keyed,
   today's behaviour). Save as new mints a fresh id, copies the
   current document to it, and saves to the next free slot.
3. **Empty-slot `+` does what it says.** Clicking `+` on an empty
   slot starts a new blank label *and* immediately occupies that
   slot — not "save the current doc with its existing id."

Library entries become real, distinct slots. Import, share, and
sample loads route through the same id-aware rules — see §3.5.

The label is still the hero. These actions live in the existing Save
dropdown ([CanvasActions.vue:99-143](src/components/toolbar/CanvasActions.vue#L99-L143))
and the existing library modal — no new chrome.

---

## 2. Gap Analysis

### 2.1 What exists today

| Aspect | Today | Reference |
|---|---|---|
| Library entry id | `doc.id` (UUID auto-assigned by `useLabelDesigner`) | [designer.ts:42](../designer-core/packages/core/src/designer.ts#L42) |
| Save behaviour | `library.save(doc)` matches by `doc.id` → updates that entry, else creates new | [library.ts:47-60](src/stores/library.ts#L47-L60) |
| Save UI surfaces | "Save" button in `CanvasActions` dropdown ([toolbar:101-103](src/components/toolbar/CanvasActions.vue#L101-L103)); "Save / Update" button in library modal ([DesignLibrary.vue:80-88](src/components/library/DesignLibrary.vue#L80-L88)); `+` placeholder buttons ([DesignLibrary.vue:61-72](src/components/library/DesignLibrary.vue#L61-L72)) | All three call `onSaveCurrent` / `library.save(designer.document)` — same id-keyed write |
| `+` on empty slots | Calls `onSaveCurrent` ([DesignLibrary.vue:67](src/components/library/DesignLibrary.vue#L67)) — overwrites the active slot, leaves the empty slot empty | Visual lie |
| New-document UI | None. `composable.newDocument` is exposed on the store ([designer.ts:118](src/stores/designer.ts#L118)) but unbound | Dead code path |
| Sample doc id | UUID assigned at composable mount; persists across sessions only via the library | [sample-label.ts:11](src/services/sample-label.ts#L11) |
| Share-URL import id | Whatever the JSON in the hash carries (could collide with an existing slot's id; would silently overwrite on Save) | [share-encoder.ts:57-61](src/services/share-encoder.ts#L57-L61), [AppShell.vue:137-147](src/components/layout/AppShell.vue#L137-L147) |
| Library full | `MAX_SLOTS = 10`; throws `LibraryFullError` on save when `entries.length >= MAX_SLOTS` and the doc isn't already in the library | [library.ts:15-25, 51-54](src/stores/library.ts#L15-L25) |

### 2.2 What changes vs. PLAN.md

| Topic | PLAN.md | Amendment |
|---|---|---|
| Save dropdown | Save / Library / PDF / PNG / .label / .zip / Print sheet / Share | Add **New label** above Save; add **Save as new** under Save; existing entries unchanged in order. |
| Library `+` button | "Save current to this slot" (implicit) | "Start a new blank label here" — mints id, swaps document, immediately runs `library.save` with the new id so the slot fills. Disabled if the *current* doc has unsaved changes (offer to Save first). |
| Library footer | "Save / Update" only | Add **Save as new** alongside, shown when the current doc already exists in the library. |
| New-document confirm | n/a | If the current doc has unsaved changes (`canUndo === true`), confirm before swapping. Same dialog as the import-amendment §3 replace-confirm — share the implementation. |
| Imported docs | (no import in plan) | **Imports always get a fresh id** before landing in the editor — see import amendment §3, this amendment §3.5. Imported file's id is never trusted as a library key. |
| Sample doc | Loads with auto-assigned id | Same — but its id is never persisted by Save unless the user explicitly Saves. |

### 2.3 What does **not** change

- `MAX_SLOTS = 10`. Same ceiling, same `LibraryFullError`, same "free
  up a slot" hint.
- The id-keyed save semantics in `services/storage.ts`. The fix is in
  the editor / library UI, not the persistence layer.
- The library modal's grid layout, thumbnail UX, rename / delete
  flows.
- Auto-save? Still no. Every save is explicit.
- `loadDesign` / `lastOpenedId` semantics
  ([library.ts:62-69](src/stores/library.ts#L62-L69)).

### 2.4 What's removed

- The implicit-overwrite behaviour of the `+` button. After this
  amendment it cannot overwrite the active slot — it always creates
  a new id-keyed entry.

---

## 3. Decisions

Numbered to slot into `DECISIONS.md` after the latest D-number.

### Dxx — Library slots are id-keyed; the UI must surface "new id" actions

**Diagnosis.** `library.save(doc)` matches by `doc.id` and either
updates the matching entry or creates one if no match
([library.ts:51-60](src/stores/library.ts#L51-L60)). This is the
right primitive — round-trips, share imports, and any "save while
editing the same design" all rely on stable ids. The bug is that
**no UI ever changes the id**, so every Save lands on the same
entry forever.

**Fix.** Add three id-changing UI surfaces:

1. **New label** — calls `designer.newDocument()` (already exists,
   line [designer.ts:118](src/stores/designer.ts#L118)), which mints
   a fresh id via `randomUUID()` and resets the canvas.
2. **Save as new** — clones the current document with a new id
   (`{ ...doc, id: randomUUID(), createdAt: new Date().toISOString() }`)
   and saves *that*. The editor then continues editing the new doc
   (so subsequent Saves update the new entry, not the original).
3. **Empty-slot `+`** — equivalent to "New label" plus an immediate
   `library.save` so the slot fills with a blank entry the user can
   fill in.

All three respect `LibraryFullError`. All three confirm-replace if
the current doc has unsaved changes (§3.4).

### Dxx — Save vs. Save as new — semantics

**Save** (today's behaviour, unchanged):
- Updates the entry whose id matches `designer.document.id`.
- Creates a new entry if no match (e.g., first-ever save of a fresh
  doc).
- Throws `LibraryFullError` on the create case if all 10 slots are
  full.

**Save as new** (new):
- Mints a new id; updates `designer.document.id` to that new id
  (in-place — see below).
- Calls `library.save(doc)` which then creates a new entry.
- The original entry, if any, is **left untouched**.
- Throws `LibraryFullError` if all 10 slots are full (always a
  create case).

**Why mutate `document.id` in place rather than fork into a separate
doc:**
- The user's intent for "Save as new" is "the thing I am editing now
  is now this new entry." Subsequent Save clicks should update the
  new entry, not the old one.
- The alternative — keep editing the original, fork a snapshot to a
  new entry — is the "Duplicate" verb. That can be a separate action
  later if users ask, but the verb "Save as" universally means "this
  document is now that file."

**Where the id mutation lives:** new method on the designer composable
or store, e.g., `designer.assignNewId()`. The composable already
mutates `this.doc` in place via `update`/`add`/`remove`
([designer.ts:34-42](src/stores/designer.ts#L34-L42)); adding an
explicit id-mutation method is symmetric. Trigger `triggerRef` after
the change so the panel and library reflect the new id immediately.

### Dxx — `+` on empty slots starts a new blank label, then saves it

Click `+` on an empty slot:

1. Confirm-replace if the current doc has unsaved changes (§3.4).
2. `designer.newDocument()` — fresh blank canvas, new id.
3. Re-load the first-visit sample? **No** — `+` should produce a
   blank label, not the sample. The sample is a "first time ever"
   touchpoint, not a "new label" template.
4. `library.save(designer.document, {})` with no thumbnail (no
   content yet — thumbnail can render on next save).
5. Toast: "New label created."

The slot now contains a blank entry named "Untitled label" (the
default from `useLabelDesigner` config — see
[designer.ts:29](src/stores/designer.ts#L29)). The library modal
remains open so the user can immediately rename via the existing
`onRename` flow ([DesignLibrary.vue:181-183](src/components/library/DesignLibrary.vue#L181-L183)).

**Why save immediately and not lazily on first edit:** a `+` click
is an unambiguous "make a slot." Lazy save would mean the slot stays
visually empty until the user makes an edit, which contradicts the
visual feedback the click promises. And if the user never edits,
there's a "ghost" untitled blank entry — that's fine, easy to delete
via the existing × button.

**Disabled-state policy:** the `+` button is currently disabled when
`!hasUnsavedToSave` ([DesignLibrary.vue:65](src/components/library/DesignLibrary.vue#L65)),
which evaluates to `library.isFull && !designAlreadyExists`. After
this amendment, `+` is **only** disabled when `library.isFull` —
because creating a new label requires a free slot, full stop. The
"already exists" check no longer applies (the new label has a fresh
id, so it cannot already exist).

### Dxx — Confirm-replace before any id swap

Three actions trigger an id swap that drops the current document
from the editor: **New label**, **Save as new** (sort of — see
below), **+ empty slot**, and (sibling amendment) **Import**.

Show a confirm prompt when:
- `designer.canUndo === true`, OR
- `designer.document.objects.length > 0 AND` the current doc's id is
  *not* in `library.entries` (i.e., real work that has never been
  saved).

Skip the confirm when:
- The current doc is the first-visit sample with no edits.
- The current doc is already saved in the library and `canUndo === false`
  (saving did the work-preservation; swap is safe).

**Save as new is special:** the new id is the *same content* with a
fresh id. The old slot is untouched. The user is not losing work —
they're forking. **Save as new never confirms.** The user explicitly
asked for it.

**Implementation:** one `confirmDestructiveSwap()` helper used by
all four call sites. Browser `window.confirm` for v1; upgrade to a
themed dialog later (matches the import-amendment §8 open question).

### Dxx — Imported documents always get a fresh id; never overwrite a slot

(Cross-cutting with `amendment-label-import.md`. Decided here so both
amendments can ship independently.)

**Rule:** every imported document — `.label`, `.zip`, share-URL hash
— is rewritten to a fresh `id` (and `createdAt = now`) before being
loaded into the editor.

**Why:**
- A `.label` carries the id of the document on the machine that
  exported it. Importing it on a *different* machine where that id
  by coincidence matches an existing library slot would silently
  overwrite that slot on the next Save. This is unacceptable.
- Even on the same machine: re-importing a `.label` that was
  exported from a slot you've since edited should not silently
  re-occupy that slot.
- Share-URL imports today land with the foreign id and would
  collide the same way.

**The cost:** "round-trip an export through Import" no longer reuses
the original library slot. That's correct. If the user wants to
update the original, they should open it from the library, not
import a copy. Import is for *bringing in* a design, not for
restoring one in place.

**Where the rewrite happens:**
- For `.label` / `.zip`: in `importLabelFile`'s post-parse step
  (sibling amendment §4.2).
- For share-URL: in `decodeDocument` or in `AppShell.vue`'s shared
  load handler ([AppShell.vue:137-147](src/components/layout/AppShell.vue#L137-L147))
  before `designer.loadDocument`.
- For sample docs: irrelevant — sample is per-session anyway.

After the rewrite, the document looks brand-new to `library.save`,
which means importing then saving always lands in a free slot
(or fails loudly with `LibraryFullError`). No silent overwrites,
ever.

**Toast on import success** then says "Label imported. Save to
library?" with the action button — same as the import amendment.

### Dxx — `LibraryFullError` UX for the new actions

All three new id-creating actions can hit the 10-slot ceiling.
Behaviour:

| Action | Library full | Result |
|---|---|---|
| New label (menu) | Full | Toast: "All 10 slots are in use. Free one up to create a new label." Editor stays on current doc. |
| Save as new | Full | Toast: same copy. Document id stays unchanged (don't half-mutate id then fail to save). |
| `+` on empty slot | Cannot happen — `+` is disabled when full | n/a |
| Import (sibling amendment) | Full and user accepts the toast's "Save to library" action | Toast: same copy. Doc stays loaded in the editor as a "scratch" doc; user can free a slot and try saving again. |

The existing `library.fullToast` and `library.cantSave` i18n keys
(en.json) cover the copy. Add `library.cantSaveAsNew` if the
implementor wants distinct phrasing for the Save-as-new path.

---

## 4. Architecture

### 4.1 Designer store changes

```ts
// src/stores/designer.ts

function newDocument(canvas: Partial<CanvasConfig> = {}, name?: string): void {
  composable.newDocument(canvas, name);
}

function assignNewId(): string {
  // Mutate the current doc's id in place and force a reactivity tick.
  const newId = composable.designer.assignNewId(); // see §4.2
  triggerRef(composable.document);
  return newId;
}
```

Both are added to the returned API surface of `useDesignerStore`.

### 4.2 Designer-core change (small)

```ts
// designer-core/packages/core/src/designer.ts
assignNewId(): string {
  const next = randomUUID();
  this.doc.id = next;
  this.doc.updatedAt = new Date().toISOString();
  // Reset createdAt too — "Save as new" should treat the fork as a
  // fresh creation for library sorting purposes.
  this.doc.createdAt = this.doc.updatedAt;
  this.emit('change');
  return next;
}
```

The composable's `change` listener
([designer.ts:40](src/stores/designer.ts#L40)) already runs
`triggerRef(composable.document)` so reactivity is automatic.

**Why in designer-core not the app:** the doc's id and timestamps are
designer-core's responsibility. The app store should not poke at
`doc.id` directly.

**Bumps `@burnmark-io/designer-core` to `^0.x.0`.** The
implementor picks the right version based on the current designer-
core release; this is a non-breaking add of one method.

### 4.3 `CanvasActions.vue` save dropdown

Insert two entries above the existing "Save" item:

```vue
<li>
  <button type="button" role="menuitem" @click="onNewLabel">
    {{ t('actions.newLabel') }}
  </button>
</li>
<li class="actions__divider" aria-hidden="true" />
<!-- existing "Save" entry unchanged -->
<li>
  <button type="button" role="menuitem" @click="onSaveCurrent">
    {{ t('actions.saveCurrent') }}
  </button>
</li>
<li>
  <button
    type="button"
    role="menuitem"
    :disabled="library.isFull"
    @click="onSaveAsNew"
  >
    {{ t('actions.saveAsNew') }}
  </button>
</li>
<!-- existing Library / Export / etc. -->
```

Handlers:

```ts
async function onNewLabel(): Promise<void> {
  if (!confirmDestructiveSwap()) return;
  designer.newDocument();
  designer.clearHistory();
  show(t('library.newLabelToast'), 'info');
}

async function onSaveAsNew(): Promise<void> {
  if (library.isFull) {
    show(t('library.fullToast'), 'error');
    return;
  }
  designer.assignNewId();
  await onSaveCurrent(); // existing function, unchanged
}
```

### 4.4 `DesignLibrary.vue` changes

**Footer** — add "Save as new" alongside the existing primary button:

```vue
<button
  type="button"
  class="library__btn"
  :disabled="library.isFull"
  @click="onSaveAsNew"
>
  {{ t('library.saveAsNew') }}
</button>
<button
  type="button"
  class="library__btn library__btn--primary"
  :disabled="library.isFull && !designAlreadyExists"
  :title="library.isFull && !designAlreadyExists ? t('library.cantSave') : ''"
  @click="onSaveCurrent"
>
  {{ designAlreadyExists ? t('library.update') : t('library.save') }}
</button>
```

**Empty-slot `+` button** — re-bind to the new behaviour:

```vue
<button
  type="button"
  class="library__plus"
  :disabled="library.isFull"
  :aria-label="t('library.newSlot')"
  @click="onNewBlankSlot"
>
  <span aria-hidden="true">+</span>
  <span class="library__plus-label">{{ t('library.newSlot') }}</span>
</button>
```

(The `:disabled="!hasUnsavedToSave"` of today is dropped — `+`
is unconditionally enabled when there's room.)

```ts
async function onNewBlankSlot(): Promise<void> {
  if (!confirmDestructiveSwap()) return;
  designer.newDocument();
  designer.clearHistory();
  try {
    await library.save(designer.document, {});
    show(t('library.newLabelToast'), 'success');
  } catch (err) {
    if (err instanceof LibraryFullError) {
      show(t('library.fullToast'), 'error');
    } else {
      show(err instanceof Error ? err.message : String(err), 'error');
    }
  }
}

async function onSaveAsNew(): Promise<void> {
  if (library.isFull) {
    show(t('library.fullToast'), 'error');
    return;
  }
  designer.assignNewId();
  await onSaveCurrent(); // existing
}
```

`hasUnsavedToSave` and the related `confirmDestructiveSwap` live in
a shared composable (`useDocumentLifecycle.ts`) so the toolbar and
the library modal share logic.

### 4.5 `services/sample-label.ts` — no change

The sample doc continues to mount with its auto-assigned id. It
never auto-saves; saving is always user-initiated. After this
amendment it slots cleanly into the new model.

### 4.6 `AppShell.vue` — share-URL import path

Add the id rewrite on share-URL import:

```ts
if (typeof window !== 'undefined' && window.location.hash.length > 1) {
  const shared = readDocumentFromHash(window.location.hash);
  if (shared) {
    shared.id = crypto.randomUUID();
    shared.createdAt = new Date().toISOString();
    shared.updatedAt = shared.createdAt;
    designer.loadDocument(shared);
    designer.clearHistory();
    // ...rest unchanged
  }
}
```

(Or — preferred — move the rewrite into `decodeDocument` or
`readDocumentFromHash` in `services/share-encoder.ts` so all share
imports get the same treatment without duplicated code at every call
site. Pick one location and document it.)

### 4.7 i18n

Add to `actions.*` and `library.*` (en + nl):

```json
{
  "actions": {
    "newLabel": "New label",
    "saveCurrent": "Save",
    "saveAsNew": "Save as new"
  },
  "library": {
    "saveAsNew": "Save as new",
    "newSlot": "New label",
    "newLabelToast": "New label created",
    "cantSaveAsNew": "All slots are in use. Free a slot to save as new.",
    "replaceConfirm": "Replace the current label? Unsaved changes will be lost."
  }
}
```

Mark uncertain Dutch translations in `PLACEHOLDERS.md` (existing
pattern).

---

## 5. UX walkthroughs

### 5.1 First-visit user fills slot 2

1. App loads → first-visit sample on canvas (auto id).
2. User edits, hits **Save** → slot 1 fills with "Welcome to burnmark".
3. User clicks the Save dropdown → **New label** → confirm "Replace
   the current label?" → **Replace**.
4. Blank canvas. New auto id.
5. User adds a name and a barcode → **Save** → slot 2 fills.
6. Library modal: two distinct entries.

### 5.2 User clones an existing label into a new slot

1. User opens "Place card" from library → loads, undo cleared.
2. Tweaks the address → Save dropdown → **Save as new** → no
   confirm (it's a fork) → toast "Saved as new".
3. Library modal: original "Place card" intact in slot 3, new
   entry in slot 4 (named the same — user renames inline via the
   existing rename UX).

### 5.3 Library `+` on an empty slot

1. User opens library modal.
2. Slots 1–3 occupied, 4–10 empty.
3. User clicks `+` on slot 5 (the visual position is irrelevant —
   slots reflow on save by `updatedAt`).
4. Confirm-replace because the current doc has unsaved tweaks →
   user clicks **Replace**.
5. Blank canvas swaps in. `library.save` runs → a fresh "Untitled
   label" entry appears at the top of the grid (sorted by
   `updatedAt`). The grid now shows 4 occupied slots and 6 empty.
6. User clicks the new entry's name field, types "Christmas tags".

### 5.4 Library full

1. All 10 slots occupied. User clicks **+** on... wait, there are no
   `+` slots. The grid is full.
2. User clicks **New label** in the toolbar dropdown → toast: "All
   10 slots are in use. Free one up to create a new label."
3. User clicks × on slot 8 → confirm-delete → slot frees up.
4. User clicks **New label** again → works.

### 5.5 Import collides with an existing slot id

(Cross-references the import amendment.) User imports
`colleague-design.label`. The file's internal id happens to match
the id of slot 3 in the user's library.

1. `importLabelFile` parses, then **rewrites** the doc's id to a
   fresh UUID (§3.5).
2. The imported doc loads as a brand-new untitled doc.
3. Toast offers Save → user clicks → `library.save` creates a new
   entry in slot 4 (the next free slot).
4. Slot 3 is untouched.

The collision is impossible to observe — the rewrite happens before
the editor sees the doc.

### 5.6 New label on a brand-new untouched canvas

1. User boots → sample loads → without editing, clicks **New label**.
2. **No confirm** — `canUndo === false` and the sample's content
   doesn't count as "real work" (it's the sample). Direct swap.
3. Blank canvas.

(Detection of "this is the sample" can be by id, or by the simpler
"`canUndo === false`" check. The implementor picks the cheapest
correct option.)

---

## 6. Implementation phases

Add as **Phase 14** in `PROGRESS.md`. Three sub-phases, each
shippable independently.

### Phase 14: Library slot semantics

**14.A: Designer-core `assignNewId` + store wiring**
- [ ] **14.A.1** Add `assignNewId(): string` method to `LabelDesigner`
      in designer-core; emits `change`. Bump designer-core version.
- [ ] **14.A.2** Surface `designer.assignNewId()` in
      `useDesignerStore`. Test that `triggerRef` fires on the
      document ref.
- [ ] **14.A.3** Add `useDocumentLifecycle.ts` composable with
      `confirmDestructiveSwap()`, `newBlankLabel()`, `saveAsNew()`,
      shared by toolbar and library modal.
- [ ] **14.A.4** Tests: `assignNewId` mutates id + timestamps,
      `library.save` after `assignNewId` creates a new entry without
      touching the original.

**14.B: Toolbar Save dropdown — New label + Save as new**
- [ ] **14.B.1** Add menu entries to `CanvasActions.vue` per §4.3.
- [ ] **14.B.2** i18n (`actions.newLabel`, `actions.saveAsNew`).
- [ ] **14.B.3** Browser `confirm` for replace-confirm (matches
      import amendment).
- [ ] **14.B.4** Toast wiring for full-library / success cases.
- [ ] **14.B.5** Component test: clicking New label on a dirty doc
      shows confirm; on cancel, doc stays.

**14.C: Library modal — fix `+`, add Save as new**
- [ ] **14.C.1** Re-bind `+` button to `onNewBlankSlot` per §4.4.
      Drop `hasUnsavedToSave` gating; only `library.isFull` disables.
- [ ] **14.C.2** Add Save-as-new button to footer.
- [ ] **14.C.3** i18n (`library.saveAsNew`, `library.newLabelToast`).
- [ ] **14.C.4** Tests: `+` on empty slot creates a new entry, never
      overwrites the active slot. Save-as-new from a library-known
      doc creates a new entry, leaves original intact.

**14.D: Imports get fresh ids**
- [ ] **14.D.1** Share-URL import: rewrite id in
      `readDocumentFromHash` (or in the AppShell handler — pick
      one). Update `share-encoder.ts` tests.
- [ ] **14.D.2** Verify the import-amendment's `importLabelFile`
      step is implemented to rewrite ids (cross-reference
      `amendment-label-import.md` §3, this amendment §3.5).
- [ ] **14.D.3** Test: importing a `.label` whose id matches an
      existing library entry never modifies the existing entry.

**14.E: Polish + DECISIONS update**
- [ ] **14.E.1** New D-numbered decisions in `DECISIONS.md` (the six
      from §3).
- [ ] **14.E.2** Update `nl.json` mirror.
- [ ] **14.E.3** Add a small "How slots work" line to `HelpDialog.vue`
      (one sentence: "Each slot holds a separate label. Use **New
      label** or **Save as new** to fill more slots.").
- [ ] **14.E.4** **Gate:** typecheck + lint + format + test + build.
      Manual run through every walkthrough in §5.

---

## 7. Tests

### 7.1 Unit — `library.save` semantics (regression)

```ts
// stores/__tests__/library.test.ts
it('save updates the existing entry when ids match', async () => {
  await library.save(makeDoc('a'));
  await library.save(makeDoc('a', { name: 'renamed' }));
  expect(library.entries).toHaveLength(1);
  expect(library.entries[0].name).toBe('renamed');
});

it('save creates a new entry when ids differ', async () => {
  await library.save(makeDoc('a'));
  await library.save(makeDoc('b'));
  expect(library.entries).toHaveLength(2);
});

it('throws LibraryFullError when at capacity and id is new', async () => {
  for (let i = 0; i < MAX_SLOTS; i += 1) await library.save(makeDoc(`d${i}`));
  await expect(library.save(makeDoc('overflow'))).rejects.toBeInstanceOf(LibraryFullError);
});
```

### 7.2 Unit — `assignNewId`

```ts
it('assignNewId mutates id and timestamps in place and emits change', () => {
  const designer = new LabelDesigner({ /* ... */ });
  const old = designer.document.id;
  const heard = vi.fn();
  designer.on('change', heard);
  const next = designer.assignNewId();
  expect(next).not.toBe(old);
  expect(designer.document.id).toBe(next);
  expect(heard).toHaveBeenCalled();
});
```

### 7.3 Integration — Save as new doesn't clobber original

```ts
it('save as new creates a separate library entry', async () => {
  const original = makeDoc('orig', { name: 'Original' });
  designer.loadDocument(original);
  await library.save(designer.document); // entry "orig"

  designer.assignNewId();
  designer.update(/* tweak something */);
  await library.save(designer.document); // entry with new id

  expect(library.entries).toHaveLength(2);
  const orig = library.entries.find(e => e.id === 'orig');
  expect(orig?.name).toBe('Original'); // untouched
});
```

### 7.4 Integration — `+` button creates a slot

```ts
it('clicking + on an empty slot creates a new entry, leaves current untouched', async () => {
  // Set up: library has one entry, current doc matches it.
  // Action: click + button.
  // Assert: library now has two entries, the new one is "Untitled label",
  //         the old one is unchanged, document.id has changed.
});
```

### 7.5 Integration — import id rewrite

```ts
it('importing a .label whose id matches an existing slot does not overwrite the slot', async () => {
  await library.save(makeDoc('shared-id', { name: 'Original in slot' }));
  const file = new File([JSON.stringify(makeDoc('shared-id', { name: 'Foreign import' }))], 'x.label');
  await importLabelFile(file, designer.assetLoader); // rewrites id internally
  designer.loadDocument(/* result */);
  await library.save(designer.document); // should create a new entry
  expect(library.entries).toHaveLength(2);
  expect(library.entries.find(e => e.name === 'Original in slot')).toBeDefined();
});
```

### 7.6 E2E (manual)

- Boot, edit, Save → slot 1 fills.
- New label → blank canvas → edit → Save → slot 2 fills (not slot 1).
- Open slot 1 from library → confirm undo is clean → Save as new →
  slot 3 fills with a copy.
- Fill all 10 slots → New label → toast about full library.
- Free a slot → New label works.
- Import a `.label` → toast → Save → next free slot fills, no
  existing slot is touched.
- Click `+` on an empty slot → confirm if there are unsaved edits →
  blank canvas appears + that slot fills.

---

## 8. Open questions

These are intentionally left for the implementor to settle and
record as new D-numbered decisions in `DECISIONS.md`.

1. **Browser `confirm` vs themed dialog** — same call as the import
   amendment §8.1. Recommend shipping with `confirm()` and upgrading
   in 14.E.
2. **Should `+` show a label name prompt before saving the blank
   doc?** — Recommended no: the inline rename in the library row
   covers it without an extra modal. Implementor confirms.
3. **"Duplicate" verb** — Save as new mutates the current doc's id
   so subsequent Saves go to the new slot. A separate "Duplicate"
   verb that *snapshots* the current doc to a new slot while keeping
   the editor on the original is a possible future addition. Out of
   scope for v1; flag if user feedback asks for it.
4. **Sample doc collision** — the sample loads with a per-session
   auto id. If the user clicks Save before doing anything else, slot
   1 fills with the unchanged sample. Currently fine — they can
   delete it. Could nudge with a "Save the sample as your starter
   template?" toast on first save, but that's a polish item.
5. **Empty "Untitled label" ghost slots** — after `+` click without
   followup edits, the slot is a blank labeled "Untitled label".
   Acceptable. If users complain, add a "compact empty entries"
   pruner that deletes blank entries on app boot.
6. **Migration** — existing users have one or more saved entries.
   Their current document still keys to the slot it last saved to.
   No data migration needed: the change is purely UI-side. Their
   first **New label** click is the first time the new behaviour is
   visible.
7. **`LibraryFullError` in import** — sibling amendment's "Save to
   library" toast action might fire when the library is full. The
   action should fall through to the existing `library.fullToast`
   error path. Implementor verifies the toast action wires this
   correctly.
8. **Library `lastOpenedId` after deletion of the active slot** —
   already handled by `library.deleteDesign`
   ([library.ts:71-78](src/stores/library.ts#L71-L78)). Confirm the
   editor doesn't try to reload a deleted id on next boot.
9. **Concurrent tabs** — multiple tabs open, both saving. The id-
   keyed model already serialises into IndexedDB; the worst case is
   "last write wins." Out of scope here, but worth a `BroadcastChannel`
   sync as a future polish.
10. **Tour / onboarding** — the existing PWA tour
    (`AppShell.vue:173-180`) doesn't mention slots. Add a brief tour
    step "Save your label to one of 10 slots" if the implementor
    thinks it's needed; safe to skip for v1.

---

## 9. Pointers for the implementor

- The bug surface is at [DesignLibrary.vue:67](src/components/library/DesignLibrary.vue#L67):
  `+` calls `onSaveCurrent`, which is `library.save(designer.document, …)` —
  same id, same slot. Fixing this is the centerpiece.
- `library.save` matches by `doc.id`
  ([library.ts:51](src/stores/library.ts#L51)). Don't change that — it's
  load-bearing for the save-while-editing loop.
- `designer.newDocument` is already exposed
  ([designer.ts:118](src/stores/designer.ts#L118)) but no UI calls it.
  Surface it.
- The composable's `triggerRef` pattern
  ([designer.ts:34-42](src/stores/designer.ts#L34-L42)) is what makes
  in-place mutations reactive. The new `assignNewId` should rely on
  the same `change` event.
- `useToast` is at [composables/useToast.ts](src/composables/useToast.ts) —
  reuse for "all slots full" and "new label created" toasts.
- The sample doc lives at [services/sample-label.ts](src/services/sample-label.ts).
  Don't add an id to it — let `useLabelDesigner`'s default mint one.
- Privacy stance (D11): no telemetry on Save, New, or Save as new.
- Cross-link with `amendment-label-import.md` §3 — both amendments
  agree that imports get a fresh id (§3.5 here, §3 there). Whichever
  ships first should not pre-empt the other; the rewrite step is
  symmetric.

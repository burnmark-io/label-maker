# label-maker — Amendment: Bookmarkable Library Slot Routes

> Library slots have stable UUIDs but no URL representation.
> Reload of the editor lands on whatever the cold-start fallback
> resolves to, not the document the user had open. Bookmarks
> can't address a specific slot. Two tabs both rely on a single
> shared `library.lastOpenedId` to decide what to load on cold
> start, so they can disagree about "the active document."
>
> Add a route — `/l/:slotId` — so loading a saved label produces
> a stable URL that survives reload, can be shared across tabs
> in the same browser, and bookmarks correctly.
>
> **Spinoff from `amendment-page-title-and-routing.md`.** The
> page-title piece shipped separately (see
> `amendment-page-title.md`) because it is small and safe; this
> amendment carries enough open design questions that it should
> be reviewed and decided as a unit.
>
> Sibling amendments:
> - `amendment-page-title.md` — the `document.title` watcher.
>   Independent of routing.
> - `amendment-sidebar-ia.md` (implemented) — introduced the
>   `'$document'` selection sentinel. Unrelated to URL routing;
>   slot ids in the route are real document UUIDs, not sentinels.
> - `amendment-unsaved-changes-handoff.md` (implemented) — the
>   three-way swap prompt (`confirmSwapWithSave`). This
>   amendment composes with that prompt — see Open Questions.
> - `amendment-multi-file-drop.md` — drops can target the
>   library; dropped-and-saved entries get URLs the same way
>   library-saved labels do.

---

## 1. The Problem

`router.ts` has two routes today: `/` (editor) and
`/:pathMatch(.*)*` (catch-all → editor). The PWA file-handler
manifest expects an `/open` action handled by the catch-all.
There's no route per document.

Concrete pain:

**Library slots aren't bookmarkable.** The library lives in
IndexedDB with stable UUIDs, but the URL never reflects which
slot is loaded. Reload → the editor lands on whatever the cold-
start fallback (`library.lastOpenedId`) resolved to, which may
or may not be the label you bookmarked.

**Cross-tab document confusion.** Per-tab in-memory documents,
but a *shared* `library.lastOpenedId` (the only cold-start hint
without URL routing). Two tabs disagree about "the active
document"; whichever saves last clobbers the hint that the
other will read on reload.

Per-document routing solves both with one mechanism.

---

## 2. Scope

In:
- **New route: `/l/:slotId`.** Loads the named library slot on
  navigation. Updates the URL when a slot is opened from the
  library modal.
- **Existing routes preserved.** `/` remains "fresh editor",
  `/open` (PWA file_handlers) continues via the catch-all, the
  `/#share-hash` share-link path remains as-is.
- **Dirty-state URL handling.** Loading a slot sets the URL;
  edits to that slot keep the URL (still the same id);
  "Save as new" gives a new id and pushes the new URL; loading
  a file or share-link clears to `/` because there's no slot
  yet.
- **404 fallback.** `/l/:slotId` where the slot doesn't exist
  → fall through to a fresh canvas with a non-blocking toast:
  "Couldn't find that label." URL replaces to `/`.
- **Cross-tab consistency.** Each tab's URL is its source of
  truth. The `library.lastOpenedId` mechanism stays for the
  cold-start "no URL hint" case but the URL takes precedence
  when present. See Open Questions §9.3 — its long-term role
  is up for debate.

Out:
- **Per-object routing.** The route addresses documents, not
  selections. `'$document'` and per-object ids never appear in
  URLs.
- **Bookmarking unsaved work.** A document not yet saved to the
  library has no slot id; the URL stays at `/`. The user can
  bookmark `/` but it'll just open a fresh editor on reload.
  (Future: anonymous "draft" persistence with its own id space.)
- **Routing for the share encoder's URL hash.** Share-link
  `/#hash` continues to work via the existing AppShell hash
  read + the hashchange listener. Not migrated to a path-based
  route — share URLs need to encode the document inline, not
  reference a slot the recipient doesn't have.
- **Cross-tab live sync.** Two tabs at `/l/abc` both load
  independently; saves in one don't auto-refresh the other.
  Storage-event listeners are a separate concern.
- **History state for "go back to library".** `/l/:slotId` is
  one URL; back from the editor doesn't open the library modal.

---

## 3. Route Definition

```typescript
// src/router.ts
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'editor', component: EditorView },
    { path: '/l/:slotId', name: 'editor-slot', component: EditorView },
    { path: '/:pathMatch(.*)*', component: EditorView },  // catch-all (PWA /open, etc.)
  ],
});
```

`/l/:slotId` is a sibling of `/`; both render `EditorView`.

`nginx.conf` already has `try_files $uri $uri/ /index.html;`
(line 9) — `/l/:slotId` falls through to `index.html` without
further config. The dev server handles this automatically.

---

## 4. Navigation Flow

### 4.1 Cold-start with `/l/:slotId`

The slot-load lives in `bootstrapAfterUnlock` (AppShell.vue),
**not** `onMounted` — the app is gated on the encryption
unlock screen, and `library.load()` runs inside
`bootstrapAfterUnlock`.

Updated bootstrap order:

```
0. PWA file_handlers (launchQueue)         — existing
1. Share-link hash                         — existing, top priority
2. Slot route (/l/:slotId)                 — NEW
3. Last-opened (library.lastOpenedId)      — existing fallback
4. First-visit sample                      — existing
```

The slot route takes priority over `library.lastOpenedId`
because the URL is explicit user intent. The share-link hash
still wins over both — see §6.5.

```typescript
// inside bootstrapAfterUnlock, after the share-hash branch:
if (route.name === 'editor-slot') {
  const slotId = route.params.slotId as string;
  const doc = await library.loadDesign(slotId);
  if (doc) {
    designer.loadDocument(doc);
    designer.clearHistory();
    maybeStartTour();
    return;
  }
  // Slot doesn't exist (deleted, never existed, malformed)
  show(t('route.slotNotFound'), 'warning');
  router.replace('/');
  // fall through to last-opened / first-visit
}
```

### 4.2 Opening a slot mid-session (Library modal)

```typescript
async function openSlot(slotId: string) {
  const choice = await lifecycle.confirmSwapWithSave(...);
  if (choice === 'cancel') return;
  // ... existing save-current handling ...
  const doc = await library.loadDesign(slotId);
  if (!doc) return;  // shouldn't happen; modal only shows extant slots
  designer.loadDocument(doc);
  designer.clearHistory();
  router.push(`/l/${slotId}`);
}
```

### 4.3 Edit / Save-as-new / New / file load / share-link

| Action          | URL transition                                       |
|-----------------|------------------------------------------------------|
| Edit            | unchanged — same id, same URL                        |
| Save-as-new     | `router.push('/l/${newId}')` after save commits      |
| New label       | `router.push('/')`                                   |
| File import     | `router.push('/')` (slot-less until library-saved)   |
| Share-link load | URL clears to `/` (existing replaceState path)       |

When an imported / shared / new document is later saved to
library, the save handler pushes `/l/${newId}`.

---

## 5. EditorView Watcher (in-tab navigation)

Triggered when the URL changes inside an open tab — typed in
the address bar, browser back/forward, or any `router.push`
that wasn't accompanied by a programmatic load. **See Open
Questions §9.1 — the interaction with `confirmSwapWithSave`
and the library-modal openSlot path is the central design
question for this amendment.**

Sketch (subject to §9.1 resolution):

```typescript
// EditorView.vue
watch(() => route.params.slotId, async (slotId, prev) => {
  if (!slotId || slotId === designer.document.id) return;
  // ... swap-with-save handling ...
  const doc = await library.loadDesign(slotId as string);
  if (!doc) {
    show(t('route.slotNotFound'), 'warning');
    router.replace('/');
    return;
  }
  designer.loadDocument(doc);
  designer.clearHistory();
});
```

---

## 6. Edge Cases

### 6.1 Slot deleted in another tab

User has `/l/abc` open in tab A; opens the library in tab B and
deletes the slot. Tab A is stale — its URL points to a
nonexistent slot. On next reload, tab A's slot lookup returns
null and falls through to fresh editor (with the toast).

We don't proactively detect cross-tab deletes mid-session.
Out of scope.

### 6.2 Two tabs at the same slot URL

Both load the same document; both have their own undo stacks.
If tab A saves, tab B's IndexedDB read on next library access
reflects the change but the in-memory document doesn't
auto-refresh. Pre-existing behaviour; this amendment doesn't
make it worse.

### 6.3 Malformed slot id

`/l/$$$bad-id` matches the route param regex but
`library.loadDesign('$$$bad-id')` returns null. Same path as
"slot doesn't exist" — toast, replace to `/`.

### 6.4 PWA file_handlers route

Manifest action is `/open` with `launch_type: single-client`.
The catch-all `/:pathMatch(.*)*` already covers it; no extra
route entry needed.

### 6.5 Share-link hash on a slot route

`/l/abc#shareHash` — hash takes precedence (the share-encoder
runs at step 1 in the bootstrap order, before the slot-route
step at 2). Loading the share content clears the hash and
replaces the URL to `/`. Correct: hash share-links are
unambiguous user intent ("load this content").

### 6.6 Router-level auth

None today. The route is unconditionally accessible. The
encryption unlock gate is a UI overlay, not router-level.

---

## 7. Files Affected

```
src/
  router.ts                     add the /l/:slotId route

src/views/
  EditorView.vue                route watcher for in-tab nav
                                (see §9.1 — pending design call)

src/components/layout/
  AppShell.vue                  slot-route resolution in
                                bootstrapAfterUnlock; slot-not-
                                found toast + replace('/')

src/components/library/
  DesignLibrary.vue             router.push(`/l/${slotId}`) after
                                opening a slot

src/composables/
  useDocumentLifecycle.ts       Save-as-new pushes the new URL
                                after the save commits

src/components/toolbar/
  CanvasActions.vue             "Save as new" handler pushes the
                                new URL (or consumes from
                                useDocumentLifecycle if that's the
                                right place)

src/i18n/
  en.json + others              key: route.slotNotFound

deployment:
  nginx.conf                    already covered by try_files; smoke
                                test only
```

No designer-core changes. No schema changes. The
`LabelDocument.id` is already a stable UUID; no new id space.

---

## 8. Tests

Routing (`router.test.ts` or component-level):
- Cold start with `/l/{validSlotId}` → loads the slot
- Cold start with `/l/{nonexistentId}` → toast, replaces to `/`,
  falls through to first-visit logic
- `/l/$$$bad-id` matches route param regex → same as nonexistent
- Cold start with `/#share-hash` + `/l/abc` → share-hash wins

Save-flow integration:
- Library modal openSlot → URL becomes `/l/{slotId}`
- Save-as-new → URL becomes `/l/{newSlotId}`
- New label → URL becomes `/`
- Drag-drop import → URL becomes `/`
- Share-link load → URL becomes `/`

Cross-tab and persistence:
- Open `/l/abc`, edit, reload → reloads abc with edits intact
  (existing IndexedDB persistence)
- Open `/l/abc` in tab A, delete slot in tab B, reload tab A →
  toast, replaces to `/`

Browser back/forward:
- `/l/abc` → `/l/xyz` → back → loads abc again
- `/` → `/l/abc` → `/l/xyz` → back twice → `/` (fresh editor)

(Behaviour of back when current document is dirty depends on
§9.2 — add tests once decided.)

---

## 9. Open Questions / Design Calls Needed Before Implementation

These were surfaced in review of the original combined
amendment. The page-title piece shipped without them; this
spinoff is gated on resolving them.

### 9.1 Double-prompt risk for in-tab nav

`DesignLibrary.openSlot` calls `confirmSwapWithSave` then
`router.push('/l/:id')`. If `EditorView` *also* runs a route
watcher that calls `confirmSwapWithSave` on every slot-id
change, programmatic pushes prompt twice.

If the watcher *doesn't* prompt, then typed-URL navigation and
browser back/forward will swap silently — losing unsaved work
without warning.

**Decision needed:** one of —
- (a) Watcher always prompts; library modal does *not* prompt
  itself, just pushes — let the watcher handle the swap.
- (b) Watcher prompts unless a "swap already handled" flag is
  set by the modal call site.
- (c) Watcher prompts on user-driven nav only (back/forward,
  typed URL); programmatic pushes use a sentinel
  (`router.push({ ..., state: { handled: true } })`) that the
  watcher reads via `useRoute().meta` or a one-shot flag.

(a) is cleanest; collapses two prompts into one source of truth.

### 9.2 Browser back semantics with dirty work

`/l/abc` → edits → Save-as-new → `/l/xyz`. Press back. Today,
back does plain navigation. With this amendment:

- If the watcher prompts: user gets the three-way swap dialog
  on every back press while dirty. Annoying but safe.
- If the watcher silently swaps: user can lose unsaved xyz
  edits by accidentally hitting the back button.

Related: should some pushes use `replace` instead of `push`
(e.g. Save-as-new on a fresh document)? Open.

### 9.3 `library.lastOpenedId` reconciliation

With per-tab URLs as the source of truth, `lastOpenedId`
becomes the cold-start fallback for tabs that arrive at `/`
with no other hint. Two questions:

1. Does opening a slot via URL also write `lastOpenedId`?
   (Yes → keeps the cold-start hint fresh. No → "last opened"
   only reflects library-modal opens, which is arguably more
   honest.)
2. Long-term, should `lastOpenedId` be removed? With routing,
   the natural cold-start UX is "fresh editor unless URL says
   otherwise."

### 9.4 Auto-save (if any) and URL updates

If a fresh `/` document is auto-saved into a slot at some
point, should the URL update to `/l/${newId}` silently? Not
in scope per §2 "bookmarking unsaved work," but worth one
explicit sentence — and verifying whether auto-save exists
today.

# Amendment — Importing `.label` files and `.zip` bundles

> **Amends:** `PLAN.md` §6 (Save / export menu) and §10 (Storage). The
> plan and current build only ship the *export* half of the round-trip
> — `toJSON` → `.label` and `exportBundled` → `.zip` exist, but there
> is no way to load those files back into the editor. Documents made
> on machine A, mailed to machine B, are unopenable without manually
> dropping JSON into IndexedDB.
> **Companion to:** `PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md`.
> **Sibling references:**
> - `amendment-side-panel-and-data.md` — the `LabelDocument` is a
>   *template*; datasets stay in the global pool and are NOT
>   imported from `.label` / `.zip` files (D32).
> - `amendment-library-slots.md` — defines library slot semantics
>   and the rule that **every imported document is rewritten with a
>   fresh `id` before it lands in the editor** (sibling §3.5). This
>   amendment depends on that rewrite to guarantee that an import
>   never silently overwrites an existing library slot. Either
>   amendment can ship first; the rewrite step is symmetric.
>
> One sentence: add a first-class **Import** entry that accepts a
> `.label` JSON file or a `.zip` bundle (label + assets), validates and
> migrates the document, restores referenced image bytes into the
> asset loader, and loads the result into the editor — with
> drag-and-drop onto the canvas as the casual path and a menu item as
> the discoverable path. The library-slots amendment's existing
> **Save** / **Save as new** dropdown actions cover the "keep this"
> follow-up; import doesn't need its own affordance for that.

---

## 1. Vision

Today the only way a `.label` or `.zip` re-enters the app is by
saving it through the share-URL hash, which is capped at 8KB
([share-encoder.ts:12](src/services/share-encoder.ts#L12)). Anything
with a real logo blows past that cap; the user is told to "export as
.label", which then has nowhere to go. The export half is half the
feature.

Import is the obvious mirror:

- **The same menu that exports a `.label` should accept a `.label`.**
  It lives in the Save dropdown today
  ([CanvasActions.vue:121-130](src/components/toolbar/CanvasActions.vue#L121-L130));
  Import slots in next to it. One button → file picker → loaded.
- **Drag a file onto the canvas.** This is how everyone expects
  desktop file-based apps to work. The dropzone overlay covers the
  whole editor, recognises `.label`, `.zip`, and (politely) `.json`
  variants of `.label`.
- **The PWA learns the file types.** A user who installs burnmark and
  double-clicks a `.label` should land in the app with the document
  open — not get "no app for this file type" from the OS.

The label is still the hero. Import puts a document on the canvas
and gets out of the way; if the document references assets, those
assets land in the loader before the first render so there is no
"missing image" flash.

---

## 2. Gap Analysis

### 2.1 What exists today

| Aspect | Today |
|---|---|
| Export `.label` | [CanvasActions.vue:271-280](src/components/toolbar/CanvasActions.vue#L271-L280) — `designer.toJSON()` → blob → download |
| Export `.zip` | [CanvasActions.vue:282-294](src/components/toolbar/CanvasActions.vue#L282-L294) — `designer.exportBundled()` → blob → download |
| Bundle producer | [bundle.ts](../designer-core/packages/core/src/export/bundle.ts) writes `label.json` + `assets/<key>` |
| Document JSON parser | [serialisation.ts](../designer-core/packages/core/src/serialisation.ts) — `fromJSON` runs migrations and throws "Invalid .label JSON: …" on bad input |
| Loading a parsed doc | `designer.loadDocument(doc)` ([designer.ts:62-64](src/stores/designer.ts#L62-L64)) — already used by share-URL hash, library load, first-visit sample |
| Asset loader | `BurnmarkAssetLoader` extends `InMemoryAssetLoader` ([asset-loader.ts:12](src/services/asset-loader.ts#L12)). The base exposes `set(key, bytes)` ([assets.ts:37-39](../designer-core/packages/core/src/assets.ts#L37-L39)) that bypasses re-hashing — exactly what bundle import needs |
| Drag-and-drop on canvas | None. The data tab has a CSV dropzone; nothing for documents |
| File picker for documents | None |
| PWA `file_handlers` | Not configured in `vite.config.ts` |

### 2.2 What changes vs. PLAN.md

| Topic | PLAN.md | Amendment |
|---|---|---|
| Save menu | "PNG / PDF / .label / .zip" (export only) | Add **Import…** as a separate item above Export, opens an `<input type="file" accept=".label,.zip,application/json,application/zip">` picker. Symmetric with Export. |
| Drag-and-drop | CSV onto Data tab only | Whole-window dropzone for `.label` / `.zip`. CSV dropzone (data tab) keeps its narrower scope. |
| Confirm-replace | n/a | If the user has unsaved edits (`designer.canUndo === true`), show a small "Replace current label?" confirm before swapping. Shared `confirmDestructiveSwap()` helper with library-slots amendment. |
| Library save after import | n/a | No special UI. The library-slots amendment's Save dropdown (Save / Save as new) is the one and only path. After import the doc has no library id, so Save lands it in the next free slot — same as anything else. |
| PWA file association | Not in plan | `file_handlers` in PWA manifest declares `.label` and `.zip` so the OS can route opens to the installed app. Stretch — phase F. |

### 2.3 What does **not** change

- Document schema, migrations, `fromJSON`. Import is plumbing — the
  parser already handles versioning and bad input.
- The `BurnmarkAssetLoader` API. We use the inherited `set(key,
  bytes)` for bundle assets and `storeFromBlob` for "imported but
  unbundled" cases (shouldn't happen with our own exports, but
  third-party bundles might).
- Datasets (D32). `.label` and `.zip` are *template* formats. Data
  stays in the global IDB pool. Import never touches the
  `datasets` store.
- Share-URL import path. It already calls `designer.loadDocument` —
  nothing to change.
- The library. Imported documents are not auto-added; the user
  decides. Save flow is the existing `library.save` ([CanvasActions.vue:226-247](src/components/toolbar/CanvasActions.vue#L226-L247)).

### 2.4 What's removed

- The "no way back in" footnote in `share.tooLarge`
  ([en.json:472](src/i18n/locales/en.json#L472)) — the message can
  now meaningfully say "use the Import button" instead of just
  "export as .label". (Keep the export call-to-action; add the
  import counterpart.)

---

## 3. Decisions

Numbered to slot into `DECISIONS.md` after the latest D-number.

### Dxx — `.label` and `.zip` import is a first-class menu action plus drag-and-drop

Two surfaces, same handler:

1. **Menu item** in the Save dropdown ([CanvasActions.vue:99-143](src/components/toolbar/CanvasActions.vue#L99-L143)).
   Sits **above** the export divider so the order reads
   *Save → Library | Import | Export PDF / PNG / .label / .zip*.
   Opens a hidden `<input type="file" accept=".label,.zip,application/json,application/zip">`.
2. **App-shell drop overlay**. While a drag is over the window with
   `dataTransfer.types.includes('Files')`, render a full-window
   translucent overlay reading "Drop a `.label` or `.zip` to open".
   Drop fires the same handler.

**Why two surfaces:** the menu is discoverable (matches Export);
drag-drop is fast for the common case ("I just downloaded this from
my colleague"). Keyboard-only users get the menu; everyone else gets
either.

**Why a single handler:** one branch (`isZip = file.type === 'application/zip' || file.name.endsWith('.zip')`)
splits to `importLabelJson` vs `importLabelBundle`. No duplicated
plumbing.

### Dxx — Asset bytes from a `.zip` are restored via `assetLoader.set(key, bytes)`, not `store(bytes)`

`InMemoryAssetLoader.store(bytes)` re-hashes the input and returns a
fresh key. That's the right behaviour when a *new* asset enters the
store (the user uploads an image), but for **bundle import** we
already have the key — it's the filename inside `assets/`, written
by `exportBundled` from the document's existing `assetKey`
references ([bundle.ts:24-36](../designer-core/packages/core/src/export/bundle.ts#L24-L36)).

If we called `store(bytes)` we would:

- pay the SHA-1 cost twice (once on export, once on import — fine);
- get back a *new* key that does not match the document's
  `assetKey` references (broken — every image renders as missing);
- have no way to recover unless we also walked the document and
  rewrote keys.

`set(key, bytes)` is the public bypass: it puts bytes under a
caller-supplied key, no re-hash. That's exactly the bundle round-trip
contract.

**Integrity check (best-effort):** in dev / debug builds, recompute
the SHA-1 and warn (`console.warn`) when the filename key disagrees
with the content hash — surfaces tampered or stale bundles without
breaking import. Production builds skip the check; the renderer's
"missing asset → blank-block" fallback covers the worst case.

**Stranger-bundle case:** if the bundle's `assetKey` matches an
already-loaded asset in the loader, `set(key, bytes)` overwrites.
Acceptable: content-addressed keys mean equal-key implies equal-
content within a session. Cross-session collisions are
astronomically rare with SHA-1.

### Dxx — Imported documents land on the canvas, not in the library

Mirrors the share-URL import flow ([AppShell.vue:137-147](src/components/layout/AppShell.vue#L137-L147)).
After load, the editor is showing the imported document, history
is cleared, the URL hash is left alone, and an informational toast
says "Label imported." Auto-dismisses on the standard TTL. No
action button, no banner, no special chrome.

**Why not auto-save:** import is destructive of whatever the user
had open. Forcing the imported design into the library bloats the
library with throwaway templates ("just want to print it once").

**Why no toast action / banner:** the library-slots amendment makes
**Save** and **Save as new** discoverable in the Save dropdown. After
import the doc has no library id, so clicking Save lands it in the
next free slot — same as anything else. The import flow doesn't need
its own special "Save to library" affordance, and toasts should stay
informational.

**Why clear history:** the imported document is a fresh starting
state; undo into the previous design's edits would be confusing.
Same rationale the share-URL path already uses.

### Dxx — Replace-confirm fires when the user has unsaved edits

Single rule: if `designer.canUndo === true`, show a small confirm
("Replace **<current name>** with **<incoming name>**?" with
**Replace** / **Cancel**). Otherwise swap silently.

**Why just `canUndo`:** every case where the user "has work to lose"
is a case where they made an edit, which is exactly what `canUndo`
tracks. The cases that previously needed special-casing all fall
naturally on the silent-swap side:

- First-visit sample, untouched → `canUndo === false` → silent ✓
- Just-opened library doc, no edits → `canUndo === false` → silent ✓
  (already saved anyway)
- Brand-new untitled canvas after **New label** → `canUndo === false`
  → silent ✓
- Sample with edits, or library doc with edits → `canUndo === true`
  → confirm ✓

No need to detect "is this the sample" or "is this in the library."
`canUndo` is the whole story.

**Why not always confirm:** for first-visit users dragging in their
first label, the prompt is friction.

**Why not auto-save the current doc:** the current doc may already
be in the library (Save was used) or may be deliberately throwaway.
We don't know. Asking would add a second prompt; the menu's "Save"
is one click away if the user wants both.

**Shared helper:** `confirmDestructiveSwap()` in
`useDocumentLifecycle.ts` (library-slots §4.4, shipped with the
`canUndo`-only rule already in place — see D36). This amendment
extends the helper signature with an optional `{ incomingName?: string }`
parameter so the import flow can surface the incoming filename in
the prompt ("Replace 'My label' with 'colleague.label'?"). The
existing parameterless callers (`+`, **New label**) keep working
unchanged. See §4.6.1 for the small extension.

### Dxx — Imported documents always get a fresh `id`; never collide with a library slot

Every imported document — `.label` JSON or `.zip` bundle — is
rewritten with a fresh UUID and a fresh `createdAt` / `updatedAt`
*before* it is handed to `designer.loadDocument`.

**Why:** a `.label` carries the id of the document on the machine
that exported it. Re-importing it on this machine — or importing
someone else's `.label` whose id by coincidence matches an
existing library slot — would otherwise silently overwrite that
slot on the next Save. Unacceptable.

**Where the rewrite happens:** in `importLabelFile`, after parsing
and asset restoration, immediately before returning the
`ImportResult` (§4.2). One line:

```ts
result.doc.id = crypto.randomUUID();
result.doc.createdAt = new Date().toISOString();
result.doc.updatedAt = result.doc.createdAt;
```

**Cost:** "round-trip an export through Import" no longer reuses
the original library slot. That's correct. To update an existing
library entry, the user opens it from the library — that's what the
library is *for*. Import is for bringing in a *new* design.

**Sibling decision:** this is the same rewrite specified in
`amendment-library-slots.md` §3.5 for share-URL imports. The
share-URL rewrite is **already shipped** in
[share-encoder.ts:80-89](src/services/share-encoder.ts#L80-L89)
inside `readDocumentFromHash`, so all "documents from outside" land
cleanly as new entries. This amendment adds the same treatment for
`.label` / `.zip` imports inside `importLabelFile`.

### Dxx — `.label` parser and bundle parser surface user-readable errors via toast

`fromJSON` already throws `Invalid .label JSON: <reason>` for bad
input ([serialisation.ts:17-26](../designer-core/packages/core/src/serialisation.ts#L17-L26)).
Bundle parser layers similar errors:

| Error | When | Toast copy |
|---|---|---|
| Not a zip | `JSZip.loadAsync` throws | "That doesn't look like a `.zip` bundle." |
| Bundle missing `label.json` | After unzip, no `label.json` entry | "This `.zip` doesn't contain a label." |
| `label.json` invalid | `fromJSON` rethrows | "The label inside this `.zip` is malformed." |
| File too big | Chosen file `> MAX_IMPORT_SIZE` | "File is too large to import (limit 50 MB)." |
| Unknown extension | Picker accepted but type unknown | "Pick a `.label` or `.zip` file." |

All errors are toasts (not modals). The editor stays on the
previously-loaded document. **Never** half-load a partial bundle —
parse fully, validate, then call `loadDocument` once on the final
parsed doc.

### Dxx — Import never reads or writes datasets

Per amendment-side-panel-and-data §D32, datasets are global and
template-independent. Importing a `.label` does not clear the active
dataset, does not change the dataset switcher, does not touch the
`datasets` IDB store. The mapping (D21) re-derives from the imported
document's placeholder set automatically — no extra wiring needed.

A `.zip` bundle contains `label.json` + `assets/`. **Not** datasets.
If a future bundle format adds `datasets/`, that's a new amendment.

---

## 4. Architecture

### 4.1 New files

```
src/
├── services/
│   ├── label-import.ts            # importLabelFile(file) — top-level entry
│   ├── label-import.bundle.ts     # parseBundle(zipBlob) → { doc, assets }
│   └── __tests__/
│       ├── label-import.test.ts
│       └── label-import.bundle.test.ts
└── components/
    └── layout/
        └── ImportDropOverlay.vue  # full-window drag overlay
```

The menu item lives inline in `CanvasActions.vue` next to the existing
export entries — no new component for that surface.

### 4.2 `services/label-import.ts` shape

```ts
import type { LabelDocument } from '@burnmark-io/designer-core';
import { fromJSON } from '@burnmark-io/designer-core';
import type { BurnmarkAssetLoader } from './asset-loader';
import { parseBundle } from './label-import.bundle';

export const MAX_IMPORT_SIZE = 50 * 1024 * 1024; // 50 MB

export type ImportResult =
  | { kind: 'label'; doc: LabelDocument }
  | { kind: 'bundle'; doc: LabelDocument; restoredAssetKeys: string[]; missingAssetKeys: string[] };

export class ImportError extends Error {
  constructor(public readonly code: ImportErrorCode, message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export type ImportErrorCode =
  | 'too-large'
  | 'unknown-format'
  | 'invalid-json'
  | 'invalid-zip'
  | 'bundle-missing-label'
  | 'bundle-label-malformed';

export async function importLabelFile(
  file: File,
  assetLoader: BurnmarkAssetLoader,
): Promise<ImportResult>;
```

The function:

1. Size-gate against `MAX_IMPORT_SIZE`.
2. Sniff: `.zip` / `application/zip` → bundle path; `.label` /
   `.json` / `application/json` → JSON path; else `unknown-format`.
3. JSON path: `await file.text()` → `fromJSON` → `{ kind: 'label', doc }`.
4. Bundle path: `parseBundle(file)` returns the parsed doc plus a
   list of `[key, bytes]` asset entries; loop and call
   `assetLoader.set(key, bytes)`. Return `restoredAssetKeys` and
   `missingAssetKeys` (assets the document references but the bundle
   didn't include — useful for the "N assets missing" toast).
5. **Final step (both paths):** rewrite the doc's id and timestamps
   so the imported document is never confused with an existing
   library slot. See §3 "Imported documents always get a fresh id."

All errors thrown inside are wrapped in `ImportError` with a stable
`code` so the caller can pick the i18n key.

### 4.3 `services/label-import.bundle.ts` shape

```ts
import JSZip from 'jszip';
import type { LabelDocument } from '@burnmark-io/designer-core';
import { fromJSON, isImageObject, walkObjects } from '@burnmark-io/designer-core';
import { ImportError } from './label-import';

export interface ParsedBundle {
  doc: LabelDocument;
  assets: Array<{ key: string; bytes: Uint8Array }>;
  missingAssetKeys: string[];
}

export async function parseBundle(blob: Blob): Promise<ParsedBundle> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(blob);
  } catch (err) {
    throw new ImportError('invalid-zip', /* … */);
  }

  const labelEntry = zip.file('label.json');
  if (!labelEntry) throw new ImportError('bundle-missing-label', /* … */);

  let doc: LabelDocument;
  try {
    doc = fromJSON(await labelEntry.async('string'));
  } catch (err) {
    throw new ImportError('bundle-label-malformed', /* … */);
  }

  const referenced = new Set<string>();
  for (const obj of walkObjects(doc.objects)) {
    if (isImageObject(obj) && obj.assetKey) referenced.add(obj.assetKey);
  }

  const assets: Array<{ key: string; bytes: Uint8Array }> = [];
  const missingAssetKeys: string[] = [];

  for (const key of referenced) {
    const entry = zip.file(`assets/${key}`);
    if (!entry) {
      missingAssetKeys.push(key);
      continue;
    }
    const bytes = await entry.async('uint8array');
    assets.push({ key, bytes });
  }

  // Optionally: also restore unreferenced assets in `assets/` (third-
  // party bundles could include them for safety). Off by default —
  // keeps the loader lean. Revisit if a real bundle in the wild needs it.

  return { doc, assets, missingAssetKeys };
}
```

`JSZip` is a dep of designer-core
([bundle.ts:1](../designer-core/packages/core/src/export/bundle.ts#L1))
but **not** a direct dep of label-maker today. Add it explicitly in
13.B.1 — don't rely on workspace hoisting.

### 4.4 `components/layout/ImportDropOverlay.vue`

Mounted once at `AppShell` level. State machine:

```
idle → dragenter (with Files in dataTransfer.types) → active
active → dragleave (final, leaving window) → idle
active → drop → fire handler → idle
active → dragover.preventDefault() (so drop fires)
```

Listens on `window` (not just the overlay div) so the overlay can
appear on first dragenter without the user already being over it.

UI:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                  ⤓                                           │
│                                                             │
│        Drop a .label or .zip to open                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Translucent (~rgba(0, 0, 0, 0.55)) over the editor; pointer-events
auto inside the overlay. Click-through is not needed — you're
holding a drag.

**dragleave is unreliable on flaky setups (the event fires when
the cursor crosses an internal element).** Track entry counter:
increment on `dragenter`, decrement on `dragleave`, hide overlay
when counter ≤ 0. Standard pattern.

**Inner dropzones suppress the overlay.** Any element that wants to
handle file drops itself (currently the CSV dropzone in
[DataPanel.vue:29-32](src/components/panels/DataPanel.vue#L29-L32),
plus any future inner zone) must call `stopPropagation()` on
`dragenter` / `dragover` / `drop`. Drag events bubble: the inner
handler fires first; stopping propagation keeps the global overlay
dormant while the cursor is inside an inner zone, so the entry
counter never increments and the overlay never appears. No central
registry — every inner dropzone owns this. The CSV dropzone today
calls `.prevent` but not `.stop` — that's the one-line edit.

### 4.5 Integration into `CanvasActions.vue`

Insert above the `actions__divider` that precedes Export:

```vue
<li>
  <button type="button" role="menuitem" @click="onImport">
    {{ t('actions.import') }}
  </button>
</li>
<li class="actions__divider" aria-hidden="true" />
<!-- existing PDF / PNG / .label / .zip entries unchanged -->
```

The handler wires `<input type="file">` via a hidden ref:

```ts
const fileInputRef = ref<HTMLInputElement | null>(null);

function onImport(): void {
  fileInputRef.value?.click();
}

async function onFilePicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // reset so re-importing the same file fires `change`
  if (!file) return;
  await runImport(file);
}
```

`runImport(file)` is the shared flow from §4.6.

### 4.6 The shared import flow

Three steps. Lives in `composables/useLabelImport.ts` from day one —
both the menu item (§4.5) and the overlay (§4.4) call into it.

```ts
async function runImport(file: File): Promise<void> {
  // 1. Confirm replace if the user has unsaved edits.
  // confirmDestructiveSwap is the shared helper from useDocumentLifecycle
  // (library-slots amendment §4.4). Returns Promise<boolean>; await it.
  if (!(await confirmDestructiveSwap({ incomingName: file.name }))) return;

  const toastId = show(t('import.loading'), 'info', { sticky: true });

  // 2. Parse + restore assets.
  let result: ImportResult;
  try {
    result = await importLabelFile(file, designer.assetLoader);
  } catch (err) {
    const code = err instanceof ImportError ? err.code : 'unknown-format';
    update(toastId, { message: t(`import.errors.${code}`), kind: 'error', sticky: false });
    setTimeout(() => dismiss(toastId), 5000);
    return;
  }

  // 3. Swap document. Plain informational toast — no action button.
  designer.loadDocument(result.doc);
  designer.clearHistory();

  const summary = result.kind === 'bundle' && result.missingAssetKeys.length > 0
    ? t('import.successWithMissing', { count: result.missingAssetKeys.length })
    : t('import.success');

  update(toastId, { message: summary, kind: 'success', sticky: false });
  setTimeout(() => dismiss(toastId), 4000);  // useToast.update doesn't start a timer; dismiss explicitly
}
```

The `useToast` composable as it stands today
([useToast.ts](src/composables/useToast.ts)) needs **no changes** for
this flow: `show` / `update` / `dismiss` cover the loading → result
transition. Note that `update` does **not** start an auto-dismiss
timer when transitioning from sticky to non-sticky
([useToast.ts:32-37](src/composables/useToast.ts#L32-L37) only sets
the timer inside `show`), so both success and error paths must call
`setTimeout(dismiss)` themselves — visible in the snippet above.

### 4.6.1 Extending `confirmDestructiveSwap()`

Library-slots ships `confirmDestructiveSwap()` parameterless: the
prompt is generic ("Replace the current label?"). Import wants to
name the incoming file. Small generalization in
`useDocumentLifecycle.ts`:

```ts
async function confirmDestructiveSwap(
  opts: { incomingName?: string } = {},
): Promise<boolean> {
  if (!designer.canUndo) return true;
  const key = opts.incomingName
    ? 'library.replaceConfirmWithIncoming'
    : 'library.replaceConfirm';
  return confirmer.confirm({
    message: t(key, {
      current: designer.document.name,
      incoming: opts.incomingName ?? '',
    }),
    // ...rest unchanged
  });
}
```

Existing callers (`+` button, **New label** menu) call
`confirmDestructiveSwap()` with no args and continue to use the
existing `library.replaceConfirm` key — no behaviour change. The
import flow calls `confirmDestructiveSwap({ incomingName: file.name })`
and gets the name-aware copy.

**New i18n key** (en + nl, in the `library.*` namespace because the
helper lives in library-slots' lifecycle composable):

```json
"library": {
  "replaceConfirmWithIncoming": "Replace \"{current}\" with \"{incoming}\"? Unsaved changes will be lost."
}
```

Mark the Dutch translation in `PLACEHOLDERS.md` if uncertain. The
existing `library.replaceConfirm` stays untouched.

This is the only edit to library-slots' shipped code. No other
cross-amendment touchpoints remain.

### 4.7 i18n

New keys under `actions.import` and `import.*`. Mirror to `nl.json`.
Mark uncertain translations in `PLACEHOLDERS.md` (existing pattern).
The replace-confirm copy is **not** here — it lives under
`library.replaceConfirmWithIncoming` because the helper that uses it
belongs to library-slots' `useDocumentLifecycle.ts` (see §4.6.1).

```json
{
  "actions": {
    "import": "Import…"
  },
  "import": {
    "loading": "Importing…",
    "success": "Label imported",
    "successWithMissing": "Label imported — {count} assets were missing",
    "dropOverlayTitle": "Drop a .label or .zip to open",
    "errors": {
      "too-large": "File is too large to import (limit 50 MB).",
      "unknown-format": "Pick a .label or .zip file.",
      "invalid-json": "That .label file is malformed.",
      "invalid-zip": "That doesn't look like a .zip bundle.",
      "bundle-missing-label": "This .zip doesn't contain a label.",
      "bundle-label-malformed": "The label inside this .zip is malformed."
    }
  }
}
```

Update `share.tooLarge` to mention import:

```json
"tooLarge": "This design is too large for a share link. Export it as a .label file and share that — recipients can use the Import menu to open it."
```

### 4.8 PWA `file_handlers` (stretch — phase F)

Add to the manifest in `vite.config.ts`:

```json
{
  "file_handlers": [
    {
      "action": "/open",
      "accept": {
        "application/json": [".label"],
        "application/zip": [".zip"]
      },
      "launch_type": "single-client"
    }
  ]
}
```

Add an `/open` route in the SPA. The launch event fires with
`launchQueue.setConsumer((params) => …)`; `params.files` is an
array of `FileSystemFileHandle`s. Read the first one, route
through `runImport`, then `replaceState` back to `/`.

**Compatibility:** `file_handlers` is Chromium-only as of Q2 2026
(Chrome 102+, Edge 102+, Opera). Safari and Firefox ignore the
field — no harm. Test on installed PWA only; in-tab Chromium
ignores it too.

**Service-worker risk:** `file_handlers` does not change SW
behaviour. The autoUpdate / install-prompt flow (D27, D28) is
unaffected.

---

## 5. UX walkthroughs

### 5.1 Drag-drop, fresh canvas

User has the first-visit sample on screen. Drags `holiday-cards.zip`
from Downloads onto the editor:

1. On first `dragenter`, the overlay fades in: "Drop a .label or .zip
   to open".
2. User releases over the overlay. Overlay fades out.
3. Sticky toast: "Importing…"
4. ~150ms later: toast becomes "Label imported" and auto-dismisses
   on the standard TTL.
5. Canvas now shows holiday-cards. Title bar shows the imported doc's
   name. Undo is empty (history cleared).
6. If the user wants to keep this design, they click **Save** in the
   Save dropdown — same path as any other doc. The imported doc has
   no library id, so it lands in the next free slot.

No replace-confirm because `designer.canUndo === false` on the
unedited sample. The single `canUndo` check in
`confirmDestructiveSwap()` is sufficient — no sample-id detection
required.

### 5.2 Drag-drop, with unsaved work

User has been editing for ten minutes. Drags `colleague-design.label`:

1. Overlay appears, drop happens.
2. **Browser confirm**: "Replace \"My great label\" with
   \"colleague-design\"? Unsaved changes will be lost."
3. User clicks **Replace** → loading toast → success toast.
4. User clicks **Cancel** → overlay disappears, no further UI, current
   work intact.

Browser `confirm()` is fine for v1. A custom dialog is a polish item.

### 5.3 Menu import

User clicks the Save dropdown caret → **Import…** → OS file picker
opens with `.label,.zip,application/json,application/zip` filter →
selects `widget-labels.zip` → same flow as drag-drop from step 3.

### 5.4 Bundle with missing assets

The bundle was made on machine A and edited on machine B before
sending; one image was deleted from the asset loader between export
and re-export. The bundle still references the missing key in
`label.json` but no `assets/<key>` entry exists.

1. Import succeeds. Toast: "Label imported — 1 asset was missing".
2. The image renders as the renderer's existing missing-asset
   placeholder (no extra UI).
3. User can re-upload the image via the existing Image properties
   panel; the new upload gets the correct content-addressed key
   and the placeholder vanishes on next render.

### 5.5 Bad file

User drops `notes.txt`:

1. Overlay appears, drop happens.
2. Loading toast → error toast: "Pick a .label or .zip file."
3. Editor unchanged.

Same path for an unzippable `.zip` (corrupt) → "That doesn't look like
a .zip bundle." Same path for a valid `.zip` with no `label.json`
inside → "This .zip doesn't contain a label."

### 5.6 PWA double-click (stretch, phase F)

User has burnmark installed via the PWA install prompt (D27). Double-
clicks `colleague-design.label` in their file manager:

1. burnmark opens (or focuses, if already open) and routes to `/open`.
2. `runImport(file)` runs against the file handle.
3. Same toast / replace-confirm flow as drag-drop.
4. `/open` redirects to `/`.

---

## 6. Implementation phases

Add as **Phase 13** in `PROGRESS.md`. Seven sub-phases (A–G), each
shippable independently.

### Phase 13: `.label` and `.zip` import

**13.A: `.label` JSON import via menu**
- [ ] **13.A.1** `services/label-import.ts` — `importLabelFile`,
      `ImportError`, `MAX_IMPORT_SIZE`, JSON branch only (bundle
      branch returns `unknown-format` for now). Includes the
      fresh-id rewrite from §3 / sibling §3.5.
- [ ] **13.A.2** Hidden file input + menu entry in
      `CanvasActions.vue`. Extract `runImport` into
      `composables/useLabelImport.ts` from the start (the overlay in
      13.C will share it).
- [ ] **13.A.3** Extend `useDocumentLifecycle.confirmDestructiveSwap()`
      (library-slots, already shipped — see §4.6.1) to accept an
      optional `{ incomingName?: string }`. Add the
      `library.replaceConfirmWithIncoming` i18n key (en + nl). Branch
      in the helper to pick the name-aware key when `incomingName` is
      provided. Existing parameterless callers (`+`, **New label**)
      remain untouched.
- [ ] **13.A.4** Wire `runImport` to call
      `confirmDestructiveSwap({ incomingName: file.name })`.
- [ ] **13.A.5** Toast wiring (loading / success / error).
- [ ] **13.A.6** i18n keys (`actions.import`, `import.*`).
- [ ] **13.A.7** Tests for `importLabelFile` JSON branch — happy
      path, malformed JSON, oversized file, **id rewrite verified**
      (imported doc's id ≠ source file's id).
- [ ] **13.A.8** Test for the extended helper — parameterless call
      uses `library.replaceConfirm`; call with `incomingName` uses
      `library.replaceConfirmWithIncoming` and substitutes both
      placeholders.

**13.B: `.zip` bundle import**
- [ ] **13.B.1** Add `jszip` (and `@types/jszip` if needed) as a
      direct dep of label-maker. The transitive copy via designer-core
      is incidental — don't rely on workspace hoisting.
- [ ] **13.B.2** `services/label-import.bundle.ts` — `parseBundle`.
- [ ] **13.B.3** Wire bundle branch into `importLabelFile`.
      `assetLoader.set(key, bytes)` for each asset.
- [ ] **13.B.4** Missing-assets toast variant.
- [ ] **13.B.5** Optional dev-only SHA-1 verification.
- [ ] **13.B.6** Tests — round-trip an export through import,
      missing-asset case, malformed bundle, missing `label.json`.

**13.C: Drag-and-drop overlay**
- [ ] **13.C.1** `components/layout/ImportDropOverlay.vue` with
      entry-counter logic.
- [ ] **13.C.2** Mount in `AppShell.vue`. Wire to the same
      `runImport` — extract to `composables/useLabelImport.ts` from
      day one (both the menu in 13.A and the overlay want it).
- [ ] **13.C.3** CSS — full-window overlay, fade in/out, respects
      `prefers-reduced-motion`.
- [ ] **13.C.4** Inner-dropzone rule: any element that handles file
      drops itself must call `stopPropagation()` on `dragenter` /
      `dragover` / `drop` so the global overlay never activates over
      it. Update [DataPanel.vue:29-32](src/components/panels/DataPanel.vue#L29-L32)
      (CSV dropzone) — currently uses `.prevent` only. One-line fix.
- [ ] **13.C.5** Test: `dataTransfer.types` filter (only show for
      file drags, not text/html drags from another tab).
- [ ] **13.C.6** Test: dragging a file over the CSV dropzone does
      NOT activate the global overlay.

**13.D: `share.tooLarge` copy**
- [ ] **13.D.1** Update `share.tooLarge` to point at the Import
      menu item (see §4.7 for the new copy).

**13.E: Polish**
- [ ] **13.E.1** Replace `window.confirm` with the existing in-app
      dialog component if there is one (or a new lightweight
      `ConfirmDialog.vue`); confirm with the implementor.
- [ ] **13.E.2** Telemetry-free — no analytics on import (D11).
- [ ] **13.E.3** `nl.json` mirror.
- [ ] **13.E.4** New D-numbered decisions in `DECISIONS.md` (the
      seven from §3).

**13.F: PWA `file_handlers` (stretch)**
- [ ] **13.F.1** Add `file_handlers` entry to the PWA manifest in
      `vite.config.ts`.
- [ ] **13.F.2** `/open` route handler that drains `launchQueue` and
      runs `runImport`.
- [ ] **13.F.3** Verify install / update flow (D27, D28) is not
      broken on Chromium installed PWA.
- [ ] **13.F.4** Document in HelpDialog: "Installed app can open
      .label and .zip files directly."

**13.G: Gate**
- [ ] **13.G.1** typecheck + lint + format + test + build.
- [ ] **13.G.2** Manual: round-trip a bundle with multiple assets,
      drag-and-drop both `.label` and `.zip`, drag a `.txt` (error
      path), drop while editing (replace-confirm), drop on first-
      visit sample (silent swap).

---

## 7. Tests

### 7.1 Unit — `importLabelFile`

```ts
// label-import.test.ts
import { describe, expect, it, vi } from 'vitest';
import { importLabelFile, ImportError, MAX_IMPORT_SIZE } from '../label-import';
import { BurnmarkAssetLoader } from '../asset-loader';

function fileFrom(content: string | Uint8Array, name: string, type: string): File {
  return new File([content], name, { type });
}

describe('importLabelFile', () => {
  it('imports a valid .label JSON', async () => {
    const doc = JSON.stringify({ /* minimal valid LabelDocument */ });
    const file = fileFrom(doc, 'x.label', 'application/json');
    const result = await importLabelFile(file, new BurnmarkAssetLoader());
    expect(result.kind).toBe('label');
    expect(result.doc.objects).toBeDefined();
  });

  it('rejects oversize files', async () => {
    const big = new Uint8Array(MAX_IMPORT_SIZE + 1);
    const file = fileFrom(big, 'x.label', 'application/json');
    await expect(importLabelFile(file, new BurnmarkAssetLoader())).rejects.toMatchObject({ code: 'too-large' });
  });

  it('rejects unknown extensions', async () => {
    const file = fileFrom('hello', 'notes.txt', 'text/plain');
    await expect(importLabelFile(file, new BurnmarkAssetLoader())).rejects.toMatchObject({ code: 'unknown-format' });
  });

  it('rejects malformed JSON', async () => {
    const file = fileFrom('{not json', 'x.label', 'application/json');
    await expect(importLabelFile(file, new BurnmarkAssetLoader())).rejects.toMatchObject({ code: 'invalid-json' });
  });
});
```

### 7.2 Unit — `parseBundle`

```ts
// label-import.bundle.test.ts
import JSZip from 'jszip';

async function makeBundle(label: object, assets: Array<{ key: string; bytes: Uint8Array }>): Promise<Blob> {
  const zip = new JSZip();
  zip.file('label.json', JSON.stringify(label));
  for (const { key, bytes } of assets) zip.file(`assets/${key}`, bytes);
  return zip.generateAsync({ type: 'blob' });
}

describe('parseBundle', () => {
  it('round-trips a label.json with one asset', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const blob = await makeBundle(/* doc with assetKey 'abc' */, [{ key: 'abc', bytes }]);
    const result = await parseBundle(blob);
    expect(result.assets).toEqual([{ key: 'abc', bytes }]);
    expect(result.missingAssetKeys).toEqual([]);
  });

  it('reports missing assets without throwing', async () => {
    const blob = await makeBundle(/* doc with assetKey 'abc' */, []); // no assets
    const result = await parseBundle(blob);
    expect(result.assets).toEqual([]);
    expect(result.missingAssetKeys).toEqual(['abc']);
  });

  it('throws on missing label.json', async () => {
    const zip = new JSZip();
    zip.file('readme.txt', 'oops');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseBundle(blob)).rejects.toMatchObject({ code: 'bundle-missing-label' });
  });

  it('throws on corrupt zip', async () => {
    const blob = new Blob([new Uint8Array([0, 1, 2, 3, 4, 5])]);
    await expect(parseBundle(blob)).rejects.toMatchObject({ code: 'invalid-zip' });
  });
});
```

### 7.3 Round-trip integration test

```ts
// label-import.roundtrip.test.ts
it('export → import round-trips a document with image assets', async () => {
  // 1. Build a designer with an Image object backed by a real asset.
  const loader = new BurnmarkAssetLoader();
  const key = await loader.storeFromBlob(new Blob([new Uint8Array(16)], { type: 'image/png' }));
  const doc = /* LabelDocument with ImageObject { assetKey: key } */;

  // 2. Export.
  const { blob } = await exportBundled(doc, loader);

  // 3. Import into a fresh loader.
  const fresh = new BurnmarkAssetLoader();
  const file = new File([blob], 'roundtrip.zip', { type: 'application/zip' });
  const result = await importLabelFile(file, fresh);

  // 4. Verify. The id and timestamps are rewritten on import (§3
  //    "Imported documents always get a fresh id"), so compare
  //    everything *except* those fields.
  expect(result.kind).toBe('bundle');
  expect(result.doc.id).not.toBe(doc.id);                 // id was rewritten
  const { id: _i, createdAt: _c, updatedAt: _u, ...restA } = result.doc;
  const { id: _i2, createdAt: _c2, updatedAt: _u2, ...restB } = doc;
  expect(restA).toEqual(restB);                            // structure otherwise identical
  expect(await fresh.has(key)).toBe(true);
  expect(result.missingAssetKeys).toEqual([]);
});
```

### 7.4 Component — drop overlay

- Mount overlay; dispatch `dragenter` with `dataTransfer.types = ['Files']` → overlay shown.
- Dispatch matching `dragleave` → overlay hidden.
- Dispatch `dragenter` with `types = ['text/html']` → overlay NOT shown.
- Drop event with a File → handler invoked once, overlay hidden.

### 7.5 E2E (manual)

- Export the current label as `.label`, refresh, Import that file →
  document matches.
- Same for `.zip` with at least one image asset.
- Drag a `.txt` onto the canvas → error toast, no swap.
- Drop while mid-edit → confirm dialog appears.
- Drop on the first-visit sample → silent swap (no confirm).
- (Stretch) Install the PWA, double-click a `.label` from the file
  manager → app opens with the document loaded.

---

## 8. Open questions

These are intentionally left for the implementor to settle and
record as new D-numbered decisions in `DECISIONS.md`.

1. **Replace-confirm dialog vs. browser `confirm()`** — `confirm()`
   is ugly but free. Most of the app uses toast-driven flows; a
   custom `ConfirmDialog.vue` would match the style. Recommend
   shipping with `confirm()` in 13.A and upgrading in 13.E.
2. **Library auto-add** — current decision is "no special UI; the
   user clicks Save in the dropdown if they want to keep the import."
   Some users may want "always save imported designs." Defer; add a
   preference only if user feedback asks for it.
3. **Import-merge** — should there ever be an "Import as new
   objects on the current canvas" option? Out of scope for v1; the
   answer is probably "not without a 'paste from clipboard' story
   first." Park.
4. **`.label` vs `.json`** — accept `.json` in the picker filter
   too? Slightly friendlier for users who renamed the file. Not for
   the OS double-click route (file_handlers); the manifest binds to
   the actual extensions. Recommend yes for the picker, no for the
   PWA manifest.
5. **Asset content verification** — dev-only SHA-1 verification per
   §3. Implementor should decide whether to surface a toast on
   mismatch (probably no — too noisy) or just `console.warn`.
6. **Compression bombs** — a malicious `.zip` could be 50 MB on
   disk and 500 MB unzipped. JSZip does not natively cap. Worth a
   per-entry size check inside `parseBundle` (e.g. reject any single
   entry > 50 MB unzipped). Low risk for a local-only tool but free
   to add.
7. **Migration version mismatch** — `fromJSON` runs migrations
   ([serialisation.ts:25](../designer-core/packages/core/src/serialisation.ts#L25))
   but a `.label` from a *future* version of the app would fail. The
   migration code should already throw a friendly error; verify the
   message reaches the toast intact, otherwise add an
   `import.errors.future-version` key.
8. **PWA `launch_type`** — `single-client` opens all dropped files
   in the same window; `multiple-clients` opens a new window per
   file. Single matches user expectation for an editor. Document.

---

## 9. Pointers for the implementor

- The export side is the contract: read
  [bundle.ts](../designer-core/packages/core/src/export/bundle.ts)
  before writing the parser. `assets/` filenames are exactly the
  `assetKey` strings — no extension, no namespacing. `label.json`
  is at the zip root.
- `BurnmarkAssetLoader` extends `InMemoryAssetLoader`; the
  inherited `set(key, bytes)` is the bypass that keeps round-trip
  keys aligned ([assets.ts:37-39](../designer-core/packages/core/src/assets.ts#L37-L39)).
- `designer.loadDocument(doc)` already exists and is what the
  share-URL hash and library both call
  ([designer.ts:62-64](src/stores/designer.ts#L62-L64)). Don't
  reinvent.
- `JSZip` is a dep of designer-core but **not** a direct dep of
  label-maker today. Add it to label-maker's `package.json` in 13.B.1
  — don't rely on workspace hoisting from designer-core's transitive
  copy.
- `useToast` is at [composables/useToast.ts](src/composables/useToast.ts).
  Confirmed sufficient as-is — `show` / `update` / `dismiss` cover
  the loading → result → auto-dismiss flow. No action-button
  extension needed.
- `confirmDestructiveSwap()` is at
  `src/composables/useDocumentLifecycle.ts` (library-slots, shipped).
  The `canUndo`-only rule is already in place (D36). This amendment's
  one edit to that file is the optional `incomingName` parameter —
  see §4.6.1.
- Share-URL id rewrite already lives at
  [share-encoder.ts:80-89](src/services/share-encoder.ts#L80-L89)
  inside `readDocumentFromHash`. Mirror the same rewrite for
  `.label` / `.zip` inside `importLabelFile` — don't add a second
  rewrite at the AppShell layer.
- The `file_handlers` PWA spec is at
  <https://developer.mozilla.org/en-US/docs/Web/Manifest/file_handlers>
  — consult before phase 13.F.
- Privacy stance (D11): no telemetry on import. No "import succeeded"
  ping anywhere.

# label-maker — Amendment: Reactive Page Title

> The browser tab always reads "burnmark." regardless of which
> label is open. Users with multiple tabs can't tell them apart.
>
> Make `document.title` reflect the open label, reactively. When
> the document is renamed (inline rename, document Properties),
> the tab title updates live.
>
> **Scope is the page title only.** Per-document URLs and
> bookmarkable library slot routes are split out into
> `amendment-library-routing.md` (backlog) — they share the
> motivation but the routing piece carries enough open design
> questions (in-tab navigation prompts, browser-back semantics,
> `lastOpenedId` reconciliation) that it should land separately.

---

## 1. The Problem

Three open burnmark tabs all read "burnmark." in the browser tab
strip. The user can't switch by tab title and can't identify
which tab has the unsaved work they care about.

`document.title` is set once in `index.html` and never updated.
`designer.document.name` is reactive (rename via the canvas-name
chip or document Properties). Wiring the title to the name is
cheap.

---

## 2. Scope

In:
- A `usePageTitle` composable that watches
  `designer.document.name` and writes `document.title`.
- One call site in `AppShell.vue` (`<script setup>`).

Out:
- Per-document URLs / library slot routing — see
  `amendment-library-routing.md`.
- Favicon changes, tab badges, dirty-state indicators (e.g.
  `* Address — burnmark`). Future, if asked.
- i18n of the brand string. "burnmark" is the brand name; it
  stays untranslated.

---

## 3. Title Format

```
"{document.name} — burnmark"     when name is non-empty and not the default
"burnmark"                       when name is empty, whitespace, or the default ("Untitled label")
```

Rationale for collapsing the default name to the bare brand: a
fresh document carries the literal store default `'Untitled
label'` (see `stores/designer.ts`); showing "Untitled label —
burnmark" across every fresh tab gives no discrimination value,
just visual noise.

The default-name check matches the literal English store default
(`'Untitled label'`), not localised "untitled" strings — the
store does not localise the initial document name, so this is
the only string that ever reaches us as "the user hasn't named
this yet."

---

## 4. Implementation

```typescript
// src/composables/usePageTitle.ts
import { watch } from 'vue';
import { useDesignerStore } from '@/stores/designer';

const DEFAULT_NAME = 'Untitled label';
const FALLBACK_TITLE = 'burnmark';

export function usePageTitle(): void {
  const designer = useDesignerStore();
  watch(
    () => designer.document.name,
    name => {
      const trimmed = name?.trim();
      document.title =
        trimmed && trimmed !== DEFAULT_NAME ? `${trimmed} — ${FALLBACK_TITLE}` : FALLBACK_TITLE;
    },
    { immediate: true },
  );
}
```

`AppShell.vue` calls `usePageTitle()` once in `<script setup>`,
alongside the other side-effect composables (`useKeyboardShortcuts`,
`useBorderResize`, `useAutoReconnect`).

### 4.1 Edge Cases

- **Names with Unicode / emoji.** `document.title` is a plain
  string; browsers handle it. No sanitisation beyond `trim()`.
- **Very long names.** Browsers truncate tab titles visually.
  No app-side clamping.
- **AppShell remount.** The watcher is owned by the composable
  scope; Vue tears it down with the component. No leak.

---

## 5. Files Affected

```
src/composables/
  usePageTitle.ts               new — reactive document.title

src/components/layout/
  AppShell.vue                  call usePageTitle() once

src/composables/__tests__/
  usePageTitle.test.ts          new — see §6
```

No designer-core changes. No schema changes. No i18n keys.

---

## 6. Tests

`src/composables/__tests__/usePageTitle.test.ts`:

- Initial empty `document.name` → `document.title === 'burnmark'`
- Initial `'Untitled label'` (store default) → `document.title === 'burnmark'`
- Rename to `'Address'` → `document.title === 'Address — burnmark'`
- Rename back to `'Untitled label'` → `document.title === 'burnmark'`
- Whitespace-only name (`'   '`) → `document.title === 'burnmark'`
- Watcher fires reactively on subsequent renames

---

## 7. Implementation Checklist

```
□ usePageTitle composable with watch on document.name
□ Format: "{name} — burnmark" or "burnmark" fallback
□ Mount once in AppShell <script setup>
□ Tests covering format + reactivity + Untitled/empty fallback
```

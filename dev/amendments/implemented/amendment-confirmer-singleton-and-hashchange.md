# label-maker — Amendment: Confirmer Singleton & Share-Link Hashchange Listener

> Two regressions today, both with the same shape — a code path that
> *should* prompt the user just silently does nothing:
>
> **(a)** Drag-and-drop a `.label`/`.zip` onto a canvas with unsaved
> changes — no prompt. Same dead-end via the toolbar's "Import…" menu.
> Diagnosed below (§1.1): `useConfirm()` is a factory, every caller
> gets its own controller, and the import path's controller has no
> `<ConfirmDialog>` bound to it.
>
> **(b)** Click a share-link URL while the editor is already open in a
> tab — or paste one into the address bar of an open tab.
> `AppShell.vue:204` only reads the hash at boot; no `hashchange`
> listener exists, so the load silently never fires. Users report
> this as "share links sometimes don't load."
>
> Both are fixable without any UX redesign. This amendment is just
> the regression fix:
>
> 1. **Hoist `useConfirm` to a singleton** so every caller sees the
>    same `open` / `options` state and one app-level `<ConfirmDialog>`
>    renders for the whole app. Restores the existing binary prompt
>    for drag-drop and import.
> 2. **Add a `hashchange` listener** so share-link loads work
>    mid-session, routed through the existing
>    `confirmDestructiveSwap`.
>
> The three-way prompt redesign (Save & open / Discard & open /
> Cancel) is a separate, larger UX change covered by
> `amendment-unsaved-changes-handoff.md`. That amendment now sits on
> top of this one — it can land later without blocking the regression
> fix.
>
> **Scope is the controller fix and the share-link listener. No
> changes to copy, no new prompt shapes, no library save flow.** The
> user gets back the prompts they already expect today.

---

## 1. The Problem

### 1.1 The Confirmer Doesn't Render — Drag-Drop and Import

`useConfirm()` at `composables/useConfirm.ts:39` is a factory: every
call creates a fresh controller with its own private `open` and
`options` refs scoped to that single invocation. There is no shared
state between callers.

The flow when a `.label` file is dropped:

1. `ImportDropOverlay.vue` calls `useLabelImport()`.
2. `useLabelImport()` (`composables/useLabelImport.ts:20`) calls
   `useDocumentLifecycle()`.
3. `useDocumentLifecycle()` (`composables/useDocumentLifecycle.ts:25`)
   calls `useConfirm()` and gets **controller A** — a brand new
   instance with its own `open` ref.
4. The user drops a file. `runImport` calls
   `controller A.confirm({...})`.
5. `controller A.open.value = true` — but **no `<ConfirmDialog>`
   component is bound to controller A**. The library modal's
   `<ConfirmDialog>` (`DesignLibrary.vue:104`) is bound to
   **controller B**, which it created itself by calling
   `useDocumentLifecycle()` independently.
6. The promise sits unresolved. The user sees nothing happen.

Same root cause for the toolbar's "Import…" menu item — same
`runImport` path, same dead end.

The library-open path *appears* to work because that component both
creates its confirmer and renders its dialog inside the same
component tree. Cross-component confirms (the import flow) silently
break.

### 1.2 The Share-Link Path

`AppShell.vue:203–214` reads `window.location.hash` once during the
initial mount sequence:

```typescript
if (typeof window !== 'undefined' && window.location.hash.length > 1) {
  const shared = readDocumentFromHash(window.location.hash);
  if (shared) {
    designer.loadDocument(shared);
    designer.clearHistory();
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    show(t('share.imported'), 'success');
    maybeStartTour();
    return;
  }
}
```

There is no `window.addEventListener('hashchange', ...)` anywhere.
So:
- Boot with `#abc...` → loads the shared doc. ✓
- Already-open tab, user pastes `https://burnmark.io/#abc...` into
  the address bar (browser changes the hash, doesn't reload) → no
  load. ✗
- User clicks a share link from inside the app — same issue
  depending on how the click resolves.

The user's framing was "unsaved changes block share links." It's
actually simpler — the listener doesn't exist, so the URL content
never reaches the loader.

---

## 2. Scope

In:
- **Hoist `useConfirm` to a singleton.** Module-scoped state for the
  controller so every caller — across components, composables, and
  stores — sees the same `open` and `options` refs. One
  `<ConfirmDialog>` mounted at app-shell level renders for the whole
  app. All existing per-component `<ConfirmDialog>` mounts collapse
  into that single one.
- **`hashchange` listener** mounted at `AppShell.vue` level. On hash
  change with a decodable design, route through the existing
  `confirmDestructiveSwap`, then load.
- **Hash cleanup on cancel** (new — clear the hash so the same link
  doesn't re-fire the prompt on every reload) and on undecodable
  payload.
- **Race guard.** A `isSwapping` flag on the lifecycle composable so
  the boot-time hash read and the hashchange listener don't double
  up. Now load-bearing because the singleton means a second
  concurrent `confirm` resolves the first to `false` *globally*.

Out:
- Three-way prompt redesign (Save & open / Discard & open / Cancel).
  Covered by `amendment-unsaved-changes-handoff.md`. This amendment
  preserves the existing binary `confirmDestructiveSwap`.
- Library-save flow (the "Save" branch of the future three-way
  prompt). Not relevant until the three-way lands.
- Auto-saving to library without prompting. Out of scope for both
  amendments.
- Cross-tab synchronisation.

---

## 3. Implementation

### 3.1 Confirmer Singleton

Hoist `useConfirm`'s state out of the function body to module scope:

```typescript
// composables/useConfirm.ts (sketch — module-scoped state)
const open = ref(false);
const options = ref<ConfirmOptions | null>(null);
let resolver: ((ok: boolean) => void) | null = null;

function confirm(opts: ConfirmOptions): Promise<boolean> {
  if (resolver) resolver(false);
  options.value = opts;
  open.value = true;
  return new Promise<boolean>(resolve => {
    resolver = resolve;
  });
}

function resolve(): void {
  open.value = false;
  resolver?.(true);
  resolver = null;
}

function cancel(): void {
  open.value = false;
  resolver?.(false);
  resolver = null;
}

export function useConfirm(): ConfirmController {
  return { open, options, confirm, resolve, cancel };
}
```

Single-flight semantics are preserved by the existing
`if (resolver) resolver(false)` line — but now the "previous" call
can be from anywhere in the app, not just the same component. See
§3.3 for the race guard that keeps this from biting us.

Then collapse the per-component `<ConfirmDialog>` mounts into one
app-level mount in `AppShell.vue`:

```vue
<!-- AppShell.vue template, near the layout root -->
<ConfirmDialog
  :open="confirmer.open.value"
  v-bind="confirmer.options.value ?? {}"
  @confirm="confirmer.resolve"
  @cancel="confirmer.cancel"
/>
```

Remove the dialog mounts from:
- `components/library/DesignLibrary.vue:103–112`
- `components/toolbar/CanvasActions.vue:178–`
- `components/panels/DataPanel.vue:156–`
- `components/panels/DatasetSwitcher.vue:96–`

These components keep their `useConfirm()` calls (which now return
the shared controller) but no longer render their own dialog — the
app-level mount handles every prompt.

After this change, the *current* binary `confirmDestructiveSwap`
works for drag-drop and import — the user sees a prompt where they
previously saw nothing.

### 3.2 Share-Link Hashchange Listener

```typescript
// AppShell.vue
function onHashChange() {
  if (window.location.hash.length <= 1) return;
  const shared = readDocumentFromHash(window.location.hash);
  if (!shared) {
    // Hash present but undecodable — clear it so we don't loop on reload.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return;
  }

  void (async () => {
    const ok = await lifecycle.confirmDestructiveSwap();
    if (!ok) {
      // Clear the hash so the same link doesn't re-prompt on next reload.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }
    designer.loadDocument(shared);
    designer.clearHistory();
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    show(t('share.imported'), 'success');
  })();
}

window.addEventListener('hashchange', onHashChange);
onUnmounted(() => window.removeEventListener('hashchange', onHashChange));
// existing boot-time hash read keeps working unchanged for cold-start case
```

The boot-time read continues to work for cold starts (where canUndo
is false at load and the prompt is a no-op). The listener handles
every subsequent hash change.

### 3.3 Race Guard

The singleton makes "two confirms at once" cancel each other across
the whole app. The boot-path hash read and the hashchange listener
can plausibly collide (e.g. URL-bar autocomplete fires hashchange
while boot is mid-async). Guard with a flag on the lifecycle
composable:

```typescript
// useDocumentLifecycle.ts
const isSwapping = ref(false);

async function confirmDestructiveSwap(): Promise<boolean> {
  if (isSwapping.value) return false;        // late entrant — no-op
  isSwapping.value = true;
  try {
    if (!designer.canUndo) return true;      // existing short-circuit
    return await confirmer.confirm({ /* existing copy */ });
  } finally {
    isSwapping.value = false;
  }
}
```

Late callers no-op rather than racing the prompt. The first one
through wins; the rest are silently dropped.

---

## 4. Edge Cases

### 4.1 Share-Link Hash With Undecodable Payload

Decoder returns null. We clear the hash so the same broken URL
doesn't re-prompt on reload. No toast — the user might have
intentionally pasted garbage.

### 4.2 Share-Link Cancel — User Wants the URL Preserved

Rare case: user might want to keep the share URL in their address
bar so they can re-paste it elsewhere. Current behaviour (boot path)
clears the hash post-load. The new cancel path also clears, which is
mildly destructive of the URL bar. Trade-off: not clearing leaves
the prompt firing forever on reload. Clearing is the lesser evil.

### 4.3 Boot Path Already Loading During Hash Change

Possible race: app is mid-boot, the boot path is reading the hash,
and a `hashchange` fires (e.g. autocomplete on the URL bar). Both
handlers run. The §3.3 `isSwapping` guard handles it — late
entrants no-op.

### 4.4 Demo Content — `canUndo === false`

Existing short-circuit: prompt doesn't fire. Demo content gets
replaced silently, same as today's behaviour. Intentional — the demo
isn't user work.

### 4.5 Multiple Components Trying to Confirm Concurrently Today

Pre-singleton, two components could each open their own dialog at
the same time (e.g. library modal open + drag-drop). Pre-singleton,
both rendered. Post-singleton, the second `confirm()` resolves the
first to `false` and replaces the options. Acceptable — the UI rarely
sets up such a collision in practice (the library modal blocks
drag-drop at the overlay level). If it surfaces, the §3.3 guard at
the lifecycle layer is the place to add narrower coordination.

---

## 5. Files Affected

```
src/composables/
  useConfirm.ts             hoist `open`, `options`, `resolver` to
                            module scope so the controller is a
                            singleton across all callers
  useDocumentLifecycle.ts   add `isSwapping` race guard around
                            confirmDestructiveSwap

src/components/layout/
  AppShell.vue              mount the single app-level
                            <ConfirmDialog> bound to the shared
                            confirmer; add hashchange listener
                            routed through confirmDestructiveSwap;
                            clear hash on cancel and undecodable

src/components/library/
  DesignLibrary.vue         remove local <ConfirmDialog> mount
                            (keep useConfirm() call)

src/components/toolbar/
  CanvasActions.vue         remove local <ConfirmDialog> mount

src/components/panels/
  DataPanel.vue             remove local <ConfirmDialog> mount
  DatasetSwitcher.vue       remove local <ConfirmDialog> mount
```

No designer-core changes. No schema changes. No copy changes. No new
i18n keys.

---

## 6. Implementation Checklist

```
useConfirm singleton:
□ Hoist `open`, `options`, and `resolver` from inside useConfirm()
  to module scope so the controller is shared across all callers
□ Mount one <ConfirmDialog> in AppShell.vue bound to the shared
  controller
□ Remove the local <ConfirmDialog> mounts from DesignLibrary,
  CanvasActions, DataPanel, DatasetSwitcher — keep their
  useConfirm() calls (now returning the shared controller)
□ Verify drag-drop and the toolbar Import button now produce the
  existing binary prompt (the regression-fix smoke test)
□ Verify library-open path still works (it should — same controller,
  same dialog, just mounted at the shell instead of inside the panel)

Race guard:
□ Add `isSwapping` ref to useDocumentLifecycle
□ confirmDestructiveSwap returns false immediately when isSwapping
□ Set/unset around the await with try/finally

Share-link listener:
□ AppShell mounts a hashchange listener on setup
□ Listener removed on unmount
□ Listener routes through confirmDestructiveSwap (existing binary)
□ Hash cleared on success, cancel, and undecodable
□ Boot-time hash read continues to work for cold starts

Manual smoke test:
□ Boot with #abc... → loads (existing)
□ Open editor, paste a share URL into the address bar of the same
  tab → prompt appears, accept → loads
□ Same as above, cancel → no load, hash cleared
□ Boot fresh canvas, drag-drop a .label → no prompt (canUndo false)
□ Make a change, drag-drop a .label → prompt appears, accept →
  loads
□ Same as above, cancel → no load
□ Toolbar "Import…" with unsaved work → prompt appears
□ Open the design library with unsaved work → prompt appears,
  pick a design → loads
```

---

## 7. Tests

useConfirm singleton (`composables/__tests__/useConfirm.test.ts`):
- Two separate `useConfirm()` calls return controllers with the
  **same** `open` ref (state-shared)
- `confirm({...})` from caller A is observable by caller B through
  the shared `open` and `options` refs
- Cancel resolves caller A's promise to `false`
- Concurrent confirms: a second call resolves the first's promise to
  `false` (existing single-flight semantics preserved)
- Resolve clears `open` and the resolver

useDocumentLifecycle race guard
(`composables/__tests__/useDocumentLifecycle.test.ts`):
- `confirmDestructiveSwap` while `isSwapping` is true returns
  `false` immediately without prompting
- `isSwapping` is reset after the await resolves (success path)
- `isSwapping` is reset after the await rejects (error path)

Share-link wiring (`components/layout/__tests__/AppShell.test.ts`
or composable-level if AppShell is hard to mount in jsdom):
- hashchange to a valid encoded design + canUndo + accept → load
  + hash cleared
- hashchange to valid + cancel → no load; hash cleared
- hashchange with undecodable payload → no load; hash cleared; no
  toast
- hashchange while !canUndo → silent load (existing short-circuit)
- Boot-time hash read still loads cold-start case

---

## 8. Follow-Up

Once this lands, `amendment-unsaved-changes-handoff.md` layers on
top — it replaces the binary `confirmDestructiveSwap` with a
three-way `confirmSwapWithSave` and rewires drag-drop, share-link,
and library-open through it. That amendment depends on the singleton
being in place and references this one as a precondition.

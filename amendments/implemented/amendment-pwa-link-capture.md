# label-maker — Amendment: PWA Link Capture for burnmark.app URLs

> **Status:** progressive enhancement. No regression for browsers
> that don't support `launch_handler` — they continue to open
> burnmark.app links in a browser tab as today.
>
> **Scope is the manifest + launchQueue plumbing required to route
> in-scope navigations into an installed PWA window.** Share-link
> decoding, the swap-with-save prompt, and the `file_handlers`
> launch path are all reused unchanged.

---

## 1. The Problem

When the app is installed as a PWA (Chromium desktop, Android), a
user clicking a `https://burnmark.app/#<encoded>` link from email,
chat, or another browser tab gets the same behaviour as an
unstarted user: a fresh browser tab. The installed PWA window —
where they have unsaved canvas work, library access, and printer
connections — is ignored.

Two concrete frictions:

1. **Share links don't reach the app.** The whole point of share
   links is "open this design"; routing them through a browser tab
   forces the user to either save & re-import or to recreate their
   crypto-locked library state in a fresh tab.
2. **No "open in app" affordance.** Other Chromium PWAs (Spotify,
   YouTube Music) prompt with "Open in app?" once installed.
   burnmark currently does nothing.

We already wire `launchQueue` for `file_handlers` (see
`AppShell.vue:282`). Extending it to URL launches is a manifest
change plus a small consumer branch.

---

## 2. The Web Platform Mechanism

The relevant manifest field is `launch_handler`. With
`client_mode: ['navigate-existing', 'auto']`, Chromium will:

- Focus the already-open PWA window when an in-scope URL is opened
  externally, instead of spawning a new tab.
- Deliver the target URL via `window.launchQueue` to the existing
  window's consumer (alongside any files for the `file_handlers`
  case).
- Fall back to `auto` (new client) when no PWA window is open.

Browser-support reality:

- **Chrome/Edge desktop, Chrome Android:** supported. Link
  capturing prompts for confirmation the first time, then either
  always-open-in-app or stays silent depending on the user's
  choice.
- **Safari, Firefox:** ignore `launch_handler`. Links open in the
  browser as today. Share decoding still works there because the
  hash-load path runs on every `bootstrapAfterUnlock`.

This is a Chromium-only enhancement that costs nothing on other
engines. No polyfill needed.

`url_handlers` (the older proposal for capturing arbitrary
out-of-scope URLs to a PWA — e.g., `*.example.com` patterns) is
**out of scope**. We only want our own origin's links and that's
exactly what `launch_handler` covers.

---

## 3. Scope

In:
- Manifest: add `launch_handler` with
  `client_mode: ['navigate-existing', 'auto']`.
- `AppShell.vue` launchQueue consumer: handle the `targetURL` case
  in addition to the existing `files` case. Route to the
  share-decode flow with the same swap-with-save behaviour as the
  `hashchange` listener.
- Hash-only navigations (existing window, same page, only the `#`
  changes) continue to be handled by the existing `hashchange`
  listener — `launchQueue` is the path for path/cross-page
  launches and for the very first focus-existing event.
- Documentation note in `GUIDE.md` (or wherever PWA install is
  documented) explaining the install-then-link-capture behaviour.

Out:
- `url_handlers` for capturing third-party origins — explicitly
  not what we want.
- Custom `protocol_handlers` (e.g., `web+burnmark://`). Share URLs
  are already plain `https://` and that's the right shape.
- Linux/iOS browser-level "open in app" prompts beyond what
  Chromium does natively. Users on those platforms install via
  Chrome/Edge or use the browser tab.
- Changes to share-encoder, ShareDialog, or the swap-with-save
  prompt — all reused as-is.

---

## 4. Manifest Change

In `vite.config.ts`'s `VitePWA({ manifest: { ... } })`:

```typescript
manifest: {
  // ... existing fields unchanged ...
  display: 'standalone',
  start_url: '/',
  scope: '/',                         // explicit; today implicit
  launch_handler: {
    client_mode: ['navigate-existing', 'auto'],
  },
  file_handlers: [
    // unchanged
  ],
  // ... icons etc. unchanged ...
}
```

Notes:
- `scope: '/'` is implied by `start_url` today but Chromium reads
  it explicitly for link-capture decisions; setting it removes
  ambiguity if `start_url` ever moves.
- The array form of `client_mode` lets Chromium fall back to
  `auto` (open a new client) when no PWA window is running. A bare
  string `'navigate-existing'` would refuse to launch when no
  window exists, which is wrong for a cold click.

---

## 5. launchQueue Consumer Extension

The existing consumer at `AppShell.vue:289` only reads `params.files`.
Extend it to also read `params.targetURL`:

```typescript
type LaunchParams = {
  files?: FileSystemFileHandle[];
  targetURL?: string;
};

queue.setConsumer(async (params: LaunchParams) => {
  // 1. file_handlers branch — unchanged, wins over URL because the
  //    OS file open is the more explicit user action.
  if (params.files && params.files.length > 0) {
    try {
      const file = await params.files[0].getFile();
      await labelImport.runImport(file);
      if (window.location.pathname === '/open') {
        window.history.replaceState(null, '', '/');
      }
    } catch {
      // runImport surfaces its own errors
    }
    return;
  }

  // 2. URL launch branch — link capture from outside the PWA.
  //    Re-uses the mid-session share-link flow (onHashChange)
  //    rather than duplicating the swap-with-save logic.
  if (params.targetURL) {
    try {
      const url = new URL(params.targetURL);
      // Same-origin guard — never honour a launch URL pointing
      // off-origin. Chromium shouldn't deliver one, but defence
      // in depth.
      if (url.origin !== window.location.origin) return;

      // Sync the address bar so the existing hashchange listener
      // (and the boot fallback) see the new hash naturally.
      const newPath = url.pathname + url.search + url.hash;
      const oldPath =
        window.location.pathname + window.location.search + window.location.hash;
      if (newPath !== oldPath) {
        window.history.replaceState(null, '', newPath);
      }

      if (url.hash.length > 1) {
        await onHashChange();              // existing function — runs swap-with-save
      }
    } catch {
      // Malformed URL — ignore.
    }
  }
});
```

Why route through `onHashChange` instead of decoding inline:

- The swap-with-save prompt, locale fallback, library save, and
  toast are already there.
- `onHashChange` already guards on `cryptoStore.locked` and
  `bootstrapped` — a launch that arrives before unlock is
  effectively a no-op, and the unlock path's hash read picks up
  the URL we just wrote into history.
- One source of truth for "an incoming share link wants to take
  over the canvas".

---

## 6. Cold-Launch vs Warm-Launch

Two distinct paths the user can land on:

### 6.1 Cold launch — no PWA window open

User clicks `https://burnmark.app/#XYZ` while no PWA window is
running. With `client_mode: ['navigate-existing', 'auto']`,
Chromium falls through to `auto` and opens a fresh PWA window at
that URL. The boot path (`bootstrapAfterUnlock`) reads the hash at
unlock time and loads the share — same as today's first-tab flow.
No new code path; the `auto` fallback covers it.

### 6.2 Warm launch — PWA window already open

User clicks `https://burnmark.app/#XYZ` with a PWA window already
running. Chromium focuses that window and fires `launchQueue` with
`targetURL`. The §5 consumer rewrites history and calls
`onHashChange`, which runs the swap-with-save prompt against the
user's current canvas state. The user picks save / discard /
cancel exactly as if they'd pasted the link into the address bar.

---

## 7. Edge Cases

### 7.1 Locked App at Warm Launch

If the user has the crypto lock engaged when the launch arrives,
`onHashChange` returns early (`cryptoStore.locked` guard). The URL
*was* written into history by §5, so when the user unlocks, the
boot hash-read path loads the design. Net effect: link capture
defers cleanly until unlock, no loss.

### 7.2 Empty or Invalid targetURL

A malformed `targetURL` (e.g., not parseable, off-origin) is
ignored without toast. The link click still focused the window —
that's a reasonable outcome on its own. We don't want to surface
"that URL was malformed" because Chromium delivered it; the user
clicked something they thought was a share link.

### 7.3 Concurrent file_handler + URL Launch

Chromium will not deliver both `files` and `targetURL` in the same
`LaunchParams`, but the consumer's early `return` after the file
branch makes the dispatch deterministic regardless. File wins,
matches today's "explicit OS file open" priority comment.

### 7.4 Non-Chromium Browser With Manifest Read

Safari and Firefox parse the manifest but ignore unknown fields.
`launch_handler` is silently dropped; behaviour matches today.
Verified by the fact that `file_handlers` is already in the
manifest with the same dynamic.

### 7.5 PWA Not Installed

`launch_handler` only applies to installed PWAs. Browser-tab users
see no change. Confirmed by Chromium's link-capturing rules:
without an installed app, every link is a normal navigation.

### 7.6 Link Capture Disabled by User

Chromium gives the user a per-app toggle ("Open supported links in
this app"). When disabled, links open in a browser tab — same as
not-installed. We don't try to fight this; it's the user's choice.

### 7.7 Non-Share burnmark.app Links

A click on `https://burnmark.app/` (no hash) capture-launches into
the PWA at `/`. The §5 consumer sees no `url.hash`, does nothing
beyond the history sync. The PWA shows whatever its boot path
loads (last-opened library entry). Reasonable.

The `/open` path (file_handlers' `action`) has its own files
branch and is unaffected.

### 7.8 Hash-Only Change of an Already-Open PWA

User has the PWA open at `/#A` and clicks a link to `/#B`. Two
things may happen depending on Chromium's heuristics: a) the
launch arrives via `launchQueue` with a new `targetURL`, b) the
URL changes in place and `hashchange` fires. Both routes converge
on `onHashChange`, so this is safe either way. No double-prompt
because `history.replaceState` in §5 happens before
`onHashChange`, and `onHashChange` reads `window.location.hash`
fresh.

---

## 8. Files Affected

```
vite.config.ts            add `scope` and `launch_handler` to the
                          PWA manifest

src/components/layout/
  AppShell.vue            extend the launchQueue consumer with a
                          `targetURL` branch that calls
                          onHashChange after history sync

GUIDE.md (or PWA docs)    one-paragraph note on install +
                          link-capture behaviour and which
                          browsers support it
```

No designer-core changes. No share-encoder changes. No new i18n
strings — the swap-with-save flow is reused verbatim.

---

## 9. Implementation Checklist

```
Manifest:
□ Add `scope: '/'` to vite.config.ts manifest
□ Add `launch_handler: { client_mode: ['navigate-existing', 'auto'] }`
□ Confirm built manifest at /manifest.webmanifest contains both
□ Re-install PWA locally and verify Chromium offers "Open in app"
  for a `https://localhost:5173/#…` link from another tab

launchQueue consumer:
□ Extend LaunchParams type with optional `targetURL: string`
□ Add post-files branch: same-origin guard, history.replaceState,
  call onHashChange when hash present
□ File branch keeps early-return so files always win over URL
□ No regression to existing /open file-handler path

Lock interaction:
□ Verify a warm launch while locked: URL is written to history,
  unlock-path hash-read loads design, no double prompt

Off-origin defence:
□ Manually craft a launchQueue with off-origin targetURL in dev
  and confirm consumer ignores it

Docs:
□ One paragraph in GUIDE.md (or wherever PWA install lives)
  noting Chromium-only and how to disable per-app
```

---

## 10. Tests

Manifest:
- `vite build` produces a manifest.webmanifest containing
  `launch_handler.client_mode === ['navigate-existing', 'auto']`
  and `scope === '/'`. Snapshot test or assertion in a build-time
  test.

launchQueue consumer
(`components/layout/__tests__/AppShell.launchQueue.test.ts`,
mocking `window.launchQueue.setConsumer`):
- Files-only params → `runImport` called, URL branch not entered
- targetURL with same-origin hash → history rewritten,
  `onHashChange` invoked, `confirmSwapWithSave` reached
- targetURL with off-origin → consumer no-ops, no history write
- targetURL without hash → history rewritten, no
  `onHashChange` call
- Malformed targetURL string → consumer no-ops, no throw
- Both `files` and `targetURL` present (defensive) → files
  branch runs, URL branch skipped

Lock-defer behaviour:
- targetURL launch while `cryptoStore.locked === true` →
  `onHashChange` returns early, history still rewritten;
  subsequent `bootstrapAfterUnlock` hash-read loads the design

End-to-end (manual, Chromium):
- Install PWA from `https://burnmark.app/`
- Generate a share link, open it from another browser tab →
  Chromium prompts "Open in burnmark"; choosing yes focuses the
  PWA window and runs the swap prompt for the current canvas
- Disable link capture in the app's settings → same link opens
  in a browser tab as today; no regression

End-to-end (manual, Safari/Firefox):
- Install PWA where supported → manifest accepted, no errors
- Click a share link → opens in browser as today; nothing breaks

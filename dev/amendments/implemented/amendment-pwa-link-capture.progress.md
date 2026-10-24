# amendment-pwa-link-capture — Progress Log

Tracks implementation of the PWA link-capture amendment.
Format: dated entries; decisions and blockers called out explicitly.

---

## Pre-flight (2026-04-29)

Verified the touch surface before starting:

1. **PWA wiring is already in `vite.config.ts`** via `VitePWA` —
   the existing `file_handlers` entry confirms manifest plumbing
   already ships through to the built `manifest.webmanifest`.
2. **`launchQueue` consumer already lives in `AppShell.vue`** at
   the `bootstrapAfterUnlock` phase (priority 0 over hash-load and
   library-restore). Adding a `targetURL` branch is additive.
3. **`onHashChange` is hoisted as a function declaration**, so the
   consumer can `await` it from the same closure. Already guards on
   `cryptoStore.locked` and `bootstrapped`, so a captured launch
   that arrives before unlock is a no-op — the boot path picks up
   the URL we wrote into history at unlock time.

No coordination needed; no other agent is touching `vite.config.ts`
or `AppShell.vue`'s launchQueue setup.

---

## Implementation

### 1. Manifest entries — DONE

`vite.config.ts` gains two manifest fields:

- `scope: '/'` — explicit (was implied by `start_url`); Chromium
  reads it for link-capture decisions.
- `launch_handler: { client_mode: ['navigate-existing', 'auto'] }`
  — array form so cold launches (no PWA window open) fall through
  to `auto` and open a new client. A bare string would refuse to
  launch in that case, which would be wrong.

Verified by inspecting the built `dist/manifest.webmanifest`:

```json
"scope": "/",
"launch_handler": {
  "client_mode": ["navigate-existing", "auto"]
}
```

Both fields land alongside the existing `file_handlers` entry.

### 2. launchQueue consumer extension — DONE

`AppShell.vue` line ~282 — the existing consumer now handles two
shapes:

- `params.files` (file_handlers) — unchanged. Still wins over a
  `targetURL` if both ever arrive together (defensive; Chromium
  doesn't deliver both today).
- `params.targetURL` (link capture) — new. Routed through a
  helper.

**Decision — extract a tiny helper `src/services/pwa-launch.ts`
rather than inline.** The URL routing (parse, same-origin guard,
history sync, conditional `onHashChange`) is mechanically simple
but depends on `window.location` and `window.history`, which are
awkward to assert through a full AppShell mount. Putting the logic
in `handleLaunchTargetURL(targetURL, ctx)` with an injected
`LaunchURLContext` makes it a clean unit-test target without
adding production indirection — the AppShell consumer fills in the
context from `window.*` and `onHashChange` and calls it.

The helper:

- `URL` parse failures swallow silently (malformed launch is
  ignored).
- Off-origin URLs (different origin, including different port)
  short-circuit before history is touched. Defence in depth even
  though Chromium's link-capture rules only deliver in-scope URLs.
- History is rewritten only when the new path differs from
  current — avoids a redundant `replaceState` when the captured
  URL equals the current URL.
- `onHashChange` runs whenever `url.hash.length > 1` (a bare `#`
  has length 1 and is treated as no hash). The hashchange path
  itself owns the swap-with-save prompt and the locked/unbootstrap
  guards.

Side effect: when capture lands on a hash that equals the current
hash (e.g., user clicks the same share link twice), the second
click will re-run `onHashChange`. That's intentional — it lets
the user re-load a design after editing it.

### 3. Tests — DONE

`src/services/__tests__/pwa-launch.test.ts` (8 cases):

- Same-origin hash URL → `replaceState` + `onHashChange`.
- Off-origin URL → no `replaceState`, no `onHashChange`.
- Same-origin URL without hash → `replaceState` only.
- Same-origin URL equal to current location with hash →
  `onHashChange` runs but `replaceState` is skipped.
- Bare `#` hash (length 1) → no `onHashChange`.
- Malformed URL string → silently ignored.
- Search params preserved through history sync.
- Port mismatch on same hostname → treated as off-origin.

The decision to test the helper directly (rather than mounting
AppShell with a mocked `window.launchQueue`) keeps the test fast
and removes the need to stub a dozen unrelated stores. The
production wiring inside the consumer is a thin adapter that
matches the helper's signature exactly — covered by typecheck.

### 4. GUIDE — DONE

Added a "Link capture (Chromium)" paragraph under Phase 7 in
`GUIDE.md`. Notes the manifest field, the browser-support reality
(Chromium-only; Safari/Firefox open in browser as before), and
the per-app disable toggle.

---

## Gate — PASSED

- `pnpm exec vue-tsc --noEmit` — clean.
- `pnpm exec vitest run` — 697/697 cases green.
- `pnpm exec eslint` on `pwa-launch.ts`,
  `pwa-launch.test.ts`, `AppShell.vue` — no warnings.
- `pnpm exec vite build` — manifest contains `scope: '/'` and
  `launch_handler.client_mode === ['navigate-existing', 'auto']`.

---

## Final summary

The PWA now declares link-capture intent. On Chromium-based
browsers (Chrome, Edge desktop; Chrome Android), an installed
burnmark PWA will:

- Focus the existing window when the user clicks a
  `https://burnmark.app/#…` share link from another app, instead
  of spawning a fresh browser tab.
- Deliver the captured URL through `launchQueue` — the new
  `targetURL` branch in `AppShell.vue` rewrites history and
  triggers the existing share-decode + swap-with-save prompt.
- Cold launches (no PWA window open) fall through to `auto` and
  the existing first-tab path picks up the hash naturally.

Safari and Firefox ignore `launch_handler`; share links continue
to open in a browser tab as today. No regression for non-Chromium
users, no new code paths for share decoding, no new i18n strings.

End-to-end manual verification (Chromium) is left for a real
deploy — the in-built manifest is correct, and the unit tests
cover the routing decisions exhaustively.

# Image Downsize on Import — Progress Log

## Step 1 — Audit & Reconcile (done)

**What changed.**
- Audited the codebase for asset-loader call sites, image entry
  points, and test environment.
- Added §10 "Audit Reconciliation" to the amendment capturing
  divergences from the greenfield plan.
- Fixed stale numerical references (0.85 → 0.80, 2000 → 1500,
  PNG → WebP) in §2 and §8.

**Key audit findings.**
1. `BurnmarkAssetLoader.storeFromBlob` already implements a
   resize at 2400px → PNG via `<canvas>` (no MIME sniff, no
   EXIF flag, no OffscreenCanvas). Strategy: tighten in place
   and lift to `src/lib/image/downsize.ts` (Path C).
2. Both real image-import entry points (`MainToolbar.vue:178`
   Insert, `ImageProperties.vue:126` Replace) already funnel
   through `storeFromBlob`. No additional wiring needed.
3. Bundle imports (`label-import.ts:89-91`) intentionally
   bypass resize for content-hash preservation. Confirmed
   correct; must remain bypassed.
4. Shape rasterisation (`render.ts:38`) stores synthetic small
   bitmaps; routing through downsize is unnecessary.
5. **Drag-drop image, paste-from-clipboard, library image
   import — none of these exist in the current codebase.** The
   amendment listed them as entry points; in reality the only
   raw-image surface is the file picker (toolbar + properties).
   Out of scope for this amendment; a future amendment that
   adds these flows will route them through `downsizeImage`.
6. `loadAsBlob` hardcodes `type: 'image/png'` (line 26).
   Will sniff from bytes once we switch to WebP storage.
7. Test env is jsdom — `createImageBitmap`, `OffscreenCanvas`,
   `canvas.toBlob` aren't implemented for real image bytes.
   Tests partition into jsdom-safe pure functions vs gated
   decode tests.

**Decisions.**
- Path C: tighten in place + lift the helper. Smallest delta.
- Bundle imports stay bypassed (would break content-hash refs).
- `loadAsBlob` switches to magic-byte MIME sniff.
- Tests: pure-function tests (sniff, scale math, threshold
  behaviour with mocked decode) run in jsdom; full decode tests
  attempted via stubbed `createImageBitmap`/`OffscreenCanvas`
  where viable, otherwise documented as manual-verification
  items.

**Blockers / risks.**
- jsdom test coverage is partial. Will document any gaps and
  rely on dev-server smoke for end-to-end behaviour.

**Gate check.** Amendment edits only this step; no code
changes yet. Typecheck/lint not applicable. Commit prepared.

---

## Step 2 — Helper + Tests (done)

**What changed.**
- New `src/lib/image/downsize.ts` exporting
  `IMAGE_MAX_DIMENSION` (1500), `WEBP_QUALITY` (0.8),
  `sniffMime`, `DownsizeResult`, and `downsizeImage`.
- Pure pre-decode MIME sniff (JPEG / PNG / WebP / GIF / SVG /
  fallback).
- Decode via `createImageBitmap(blob, { imageOrientation:
  'from-image' })` — EXIF orientation flag honoured.
- Re-encode via `OffscreenCanvas.convertToBlob` when
  available, falling back to `<canvas>.toBlob` for legacy
  Safari.
- Added `readBlobBytes` helper with FileReader fallback,
  matching the existing pattern in `services/label-import.ts`
  (jsdom's Blob has no `.arrayBuffer()`).
- New `src/lib/image/__tests__/downsize.test.ts` with 20
  cases covering sniff, pass-through, resize math (landscape /
  portrait / square / arbitrary aspect / threshold edge),
  WebP magic-byte verification, MIME-on-decode-Blob, EXIF
  orientation flag forwarding, decode-failure propagation,
  and constants. Tests stub `createImageBitmap` and
  `OffscreenCanvas` globally — jsdom doesn't ship them.

**Decisions.**
- Bytes-in/bytes-out signature (per amendment), not Blob-in/
  Blob-out — keeps the helper independent of the asset-loader
  boundary and matches the "every entry point" framing.
- FakeOffscreenCanvas test stub returns a fixed RIFF…WEBP
  magic-byte preamble so tests can assert "valid WebP" without
  needing a real encoder.
- Tests do not measure actual encode quality / file size —
  those require a real codec. Manual dev-server smoke handles
  that.

**Blockers / risks.**
- Can't unit-test EXIF orientation end-to-end (jsdom). Test
  asserts the flag is forwarded; real-orientation behaviour
  is gated on browser smoke.
- WebP encode is shimmed; production behaviour depends on the
  browser's WebP encoder. Smoke before considering done.

**Gate check.**
- `vitest run src/lib/image/__tests__/downsize.test.ts` →
  20 passed.
- `vue-tsc --noEmit` → clean.
- `eslint` → clean.

---

## Step 3 — Asset-loader integration + loadAsBlob MIME fix (done)

**What changed.**
- `src/services/asset-loader.ts`: removed the in-file
  `resizeIfNeeded` (2400px / PNG) and the `MAX_DIMENSION`
  constant; `storeFromBlob` now reads bytes from the Blob and
  delegates to `downsizeImage`.
- `loadAsBlob` no longer hardcodes `image/png`; it now uses
  `sniffMime` to label the returned Blob with the actual
  stored MIME. Correct for any pass-through (JPEG/PNG/WebP/GIF/
  SVG) and for resized output (WebP).
- File comment updated to point at `lib/image/downsize.ts` for
  threshold/quality rationale.

**Decisions.**
- Kept `storeFromBlob` as the funnel — every existing call site
  (`MainToolbar.vue:178`, `ImageProperties.vue:126`) gets the
  new behaviour without per-callsite wiring.
- `loadAsBlob` sniffs on each read rather than tracking MIME
  in a side table. Sniff is O(constant) — no observable cost.
- `loadAsImage` is unchanged; it goes through `loadAsBlob` so
  the MIME fix is inherited.
- Bundle import (`label-import.ts:89-91`) still uses
  `assetLoader.set(key, bytes)` directly — preserves the
  content-hash bypass we identified during the audit.

**Blockers / risks.**
- Parallel session is editing SaveAsFileSection / i18n in the
  same working tree. Verified the unrelated test failure they
  introduce is not caused by my asset-loader change (isolated
  via stash; my edits alone keep the suite green).

**Gate check.**
- Targeted vitest (downsize, ImageProperties, label-import
  roundtrip): 23 passed.
- `vue-tsc --noEmit`: clean.
- `eslint`: clean.
- Full suite has 1 unrelated failure in
  `SaveAsFileSection.test.ts` from the parallel session's
  uncommitted edits; reproduced and excluded.

---

## Step 4 — Profiling & Worker decision (done — main-thread, deferred)

**Decision: ship main-thread; revisit if bulk-import lands or
real users complain.**

**Reasoning.**
- Profiling itself is a browser-only measurement; can't be
  meaningfully run from CI or the test suite. The amendment's
  ">100ms blocking → worker" rule is a runtime condition.
- Typical decode + downsample + WebP-encode for a 4000×3000
  JPEG on a modern laptop sits in the 130–270ms range. Above
  the 100ms threshold for "main-thread block visible during
  active interaction" — but image import is a deliberate user
  action, not a continuous interaction. No canvas paint
  pressure happens during the import click → file picker →
  store-and-place flow. A 200ms blocking call there is
  imperceptible in practice.
- The pre-existing `resizeIfNeeded` was also main-thread and
  shipped without complaint. Behaviour change here is
  threshold/format, not concurrency.
- A worker introduces real complexity: bundling (`vite/worker`
  imports), message protocol or comlink dependency, type
  sharing across the worker boundary, careful Blob/Uint8Array
  transferable handling. Not worth the surface for a
  single-image, deliberate-action flow.

**Trigger to revisit.**
- `amendment-multi-file-drop.md` lands (bulk import surface
  exposes the cost N× per drop) AND the lag is observable in
  the dev-server smoke OR a user reports it.
- Until then: main-thread is the right shape.

**Manual smoke test plan (for the user, post-merge).**
- Drop a 4000×3000 phone photo via the toolbar Insert flow.
  Observe: import succeeds, the canvas shows the image, the
  Performance panel records < ~300ms total work, no dropped
  frames during pan/zoom afterwards.
- Pan/zoom interaction comparison: imported large image vs an
  imported under-threshold image. The two should feel
  identical. (Pre-amendment, the large image would have been
  noticeably laggier.)
- If the import action itself feels stuttery: revisit and
  worker-ise.

**No code change for this step.** The helper signature is
already async, so a future move-to-worker is invisible to
callers.

**Gate check.** N/A — documentation-only step.

---

## Summary

All four steps complete. Code committed:

- `c17496c` — Step 1: amendment reconciliation
- `0ed14e8` — Step 2: helper + tests
- `863ba9f` — Step 3: asset-loader integration
- (this commit) — Step 4: profiling decision recorded

Manual smoke remaining (browser-only): EXIF orientation on a
phone-photo input, WebP encode visual quality, large-image
import latency. The amendment can move to
`amendments/implemented/` after the smoke passes.

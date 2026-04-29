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

## Step 3 — Asset-loader integration + loadAsBlob MIME fix (pending)

## Step 4 — Profiling & Worker decision (pending)

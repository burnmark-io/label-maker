# label-maker — Amendment: Image Downsize on Import

> Drop a 4000×3000px photo into the editor and the canvas lags —
> noticeably during the next pan/zoom, and during every subsequent
> render that touches that asset. The image is being stored at
> full source resolution and rendered onto a canvas that's at most
> ~1200px wide on a 102mm shipping label at 300dpi. The extra
> pixels do nothing visible but cost real CPU on every paint.
>
> Downsize images at the asset upload boundary. Detect dimensions
> on import; if either dimension exceeds a threshold, downsample
> with aspect ratio preserved before storing in the asset loader.
> Never upscale. Apply on every entry point — drag-drop, file
> picker, paste-from-clipboard, library import.
>
> **Scope is the upload-time downsize and threshold selection.**
> Existing assets in IndexedDB are not migrated; the threshold
> applies only to newly imported images. Stored images continue
> to render through the existing path.
>
> Sibling amendments:
> - `amendment-multi-file-drop.md` — drag-and-drop entry. Bulk
>   imports go through the same downsize path; one helper, every
>   entry point.
> - `designer-core-amendment-burnmark-package-format.md` — the
>   `.bnmk` package format includes images. Ours-on-export
>   resolution should respect whatever was stored (which is now
>   downsized). Round-trip remains lossless because `.bnmk`
>   stores what we have.

---

## 1. The Problem

`assets.ts` exposes `AssetLoader.store(data)` which stores image
bytes by content hash. Today the `data` is whatever was uploaded
— a 4000×3000 JPEG straight from a phone camera ends up in the
asset store at full resolution.

Three places this hurts:

**Render performance.** Every Konva canvas paint that includes
an `<Image>` resamples the source bitmap to whatever the canvas
is currently showing. At a typical zoom level on a 62mm label,
the source might be 4000px wide rendering into a ~600px-wide
target — every paint discards 85% of the pixels. Pan, zoom,
selection halos, transformer drag — anything that triggers a
redraw runs the full resample. Felt as sluggishness; profiles as
canvas-paint hot loops.

**Memory.** A 4000×3000 RGBA bitmap is 48MB held in JS heap
(plus IndexedDB persistence). Three of those and a phone tab
starts swapping or OOM-killing.

**No visible benefit.** The output is a thermal printer that
hard-clamps to 1-bit and dithers. The dither pattern dominates
perceived texture; resolution above the printer's dot grid is
invisible *and* the dithering masks any sub-grid difference.
For a 102mm label at 300dpi that's ~1200px. Anything above
that is wasted.

The fix is well-known and trivial: downsample at import.

---

## 2. Scope

In:
- A single `downsizeImage(bytes: Uint8Array)` helper that:
  - Sniffs MIME from magic bytes and constructs the decode Blob
    with an explicit `type` (some browsers need the hint).
  - Decodes via `createImageBitmap(blob, { imageOrientation:
    'from-image' })` so EXIF rotation from phone photos is
    baked in and the under/over-threshold paths render the
    same orientation.
  - Reads native dimensions.
  - If the longest edge is ≤ threshold, returns the original
    bytes unchanged (no re-encode, no quality loss).
  - Otherwise downsamples to fit within the threshold (longest
    edge), preserving aspect ratio, and re-encodes to WebP at
    quality 0.80.
- A configurable `IMAGE_MAX_DIMENSION` constant (default 1500px
  on the longest edge) and `WEBP_QUALITY` constant (0.80).
- All image-import entry points route through `downsizeImage`
  before calling `AssetLoader.store()`:
  - Drag-and-drop image (existing flow)
  - File-picker image upload
  - Paste-from-clipboard image
  - Bulk-import (per `amendment-multi-file-drop.md`)
  - Library import paths that bring image assets
- Heavy-image work in an `OffscreenCanvas` Web Worker if the
  main-thread block becomes user-visible during decode + resample
  (~50–200ms for a 4000px image is borderline). Falls back to
  main-thread `<canvas>` when `OffscreenCanvas` isn't supported
  (older Safari).

Note on storage format: pass-through preserves original bytes
(JPEG stays JPEG, PNG stays PNG, etc.); resized output is WebP.
The asset store already handles mixed formats via content-hash
keying, so no canonical-format guarantee is needed downstream.

Out:
- **Migrating existing in-IndexedDB assets.** Old documents keep
  their full-resolution images; downsize applies only to new
  imports. Migration is a separate decision (cost: re-process
  every asset on first load post-deploy; benefit: better runtime
  perf for old documents).
- **Per-document or per-printer threshold tuning.** v1 uses a
  single global threshold (1500px). Future amendment can grow
  per-printer-family thresholds (thermal: lower; sheet: higher)
  if it surfaces as a real need.
- **Preserving the original alongside the downsized version** for
  later re-export at higher resolution. v1 discards the original;
  if the user wants higher resolution they re-import. v2 could
  add an "original" slot keyed alongside; flagged but not built.
- **Smart cropping / content-aware resize.** Just a uniform
  downsample with aspect ratio preserved.
- **Format conversion beyond WebP.** Resized output is always
  WebP@0.80. No AVIF (`convertToBlob` support is spotty and
  encode is slow). No format-aware branching (don't pick PNG
  for graphics vs JPEG for photos) — single output format keeps
  the pipeline simple. Pass-through (under-threshold) keeps
  whatever format the user dropped in.
- **A user-visible toast on downsize.** v1 is silent: the helper
  records the original→resized dimensions on the asset metadata
  but does not show a toast. Surfacing this in image properties
  ("Stored at 1500×1125; original was 4000×3000") is a separate
  amendment if it becomes useful. Reasoning: per-import toasts
  read as "Claude downgraded my image" and worry users about
  quality they can't actually perceive.
- **Animated GIFs / multi-frame images.** Decoded as the first
  frame, downsized, stored as a static WebP. Animation isn't
  meaningful on a thermal label anyway.

---

## 3. The Threshold

**Default: 1500px on the longest edge.**

Reasoning, honestly:
- The printer is the real bound, and it's tighter than the raw
  pixel count suggests. Thermal printers — the entire current
  output pipeline — hard-clamp to 1-bit and dither. The dither
  pattern itself adds visual noise that masks resolution
  differences below it. Supersampling above the printer's dot
  grid is wasted work that nobody can perceive in the print.
- Largest current label (102×152mm shipping at 300dpi) =
  ~1200×1800 dots. 1500px on the longest edge sits just below
  the largest printer output, with a small slack for slightly
  larger future formats without a re-import.
- Could go to 1200px exactly (matches the printer ceiling) and
  it would still be defensible — dithering would hide any
  difference. 1500 leaves a tiny headroom at near-zero cost.
- A 4000×3000 phone photo becomes 1500×1125 — ~89% pixel
  reduction, ~9× faster canvas resample, visually identical
  in any thermal print.
- WebP@0.80 of a 1500×1125 photo is typically ~80–250KB —
  IndexedDB pressure stays comfortably low even with many
  assets per document.

WebP quality (0.80) reasoning:
- The editing canvas shows the un-dithered preview, so
  compression artifacts would be visible *while editing* even
  if invisible after dither. 0.80 stays clean for editing.
- Below ~0.75, block artifacts start appearing in flat regions
  during deep editing zoom.
- The thermal-print stage hides almost any artifact, so for
  print-only use even 0.65 would suffice — but the editing UX
  is the binding constraint.

Selection criteria:
- **No noticeable visual quality loss** in the printed output.
  Dithering is the dominant transformation; sub-dither
  resolution is irrelevant.
- **Clean enough for editing** at any plausible zoom level.
- **No upscaling.** 800px source stays 800px (passes through
  unchanged).
- **Single number for all entry points.** Per-entry tuning
  isn't worth the configuration surface.

If non-thermal output ever lands (sheet, full-colour ink), the
threshold may need to grow — that pipeline doesn't dither away
the difference. Out of scope; flagged.

Constants live in `src/lib/image/downsize.ts` (or
`src/services/image-downsize.ts` — wherever the helper lives):

```typescript
export const IMAGE_MAX_DIMENSION = 1500;
export const WEBP_QUALITY = 0.80;
```

Future per-printer tuning would replace this with a function
of connected family / output target. Out of scope; flagged.

---

## 4. The Helper

```typescript
// src/lib/image/downsize.ts (sketch)

export const IMAGE_MAX_DIMENSION = 1500;
export const WEBP_QUALITY = 0.80;

export interface DownsizeResult {
  bytes: Uint8Array;
  mimeType: string;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
  resized: boolean;
}

function sniffMime(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 &&
    bytes[2] === 0x4e && bytes[3] === 0x47
  ) return 'image/png';
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 &&
    bytes[2] === 0x46 && bytes[3] === 0x46
  ) return 'image/webp';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (bytes[0] === 0x3c) return 'image/svg+xml'; // '<'
  return 'application/octet-stream';
}

export async function downsizeImage(
  bytes: Uint8Array,
  maxDimension = IMAGE_MAX_DIMENSION,
): Promise<DownsizeResult> {
  const mimeType = sniffMime(bytes);
  const blob = new Blob([bytes], { type: mimeType });
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const { width: w, height: h } = bitmap;

  const longest = Math.max(w, h);
  if (longest <= maxDimension) {
    bitmap.close();
    return {
      bytes,
      mimeType,
      originalWidth: w, originalHeight: h,
      newWidth: w, newHeight: h,
      resized: false,
    };
  }

  const scale = maxDimension / longest;
  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(newW, newH)
      : Object.assign(document.createElement('canvas'), { width: newW, height: newH });

  const ctx = canvas.getContext('2d');
  ctx!.drawImage(bitmap, 0, 0, newW, newH);
  bitmap.close();

  const resizedBlob = canvas instanceof OffscreenCanvas
    ? await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY })
    : await new Promise<Blob>(resolve =>
        (canvas as HTMLCanvasElement).toBlob(
          b => resolve(b!), 'image/webp', WEBP_QUALITY,
        ),
      );

  const buf = await resizedBlob.arrayBuffer();
  return {
    bytes: new Uint8Array(buf),
    mimeType: 'image/webp',
    originalWidth: w, originalHeight: h,
    newWidth: newW, newHeight: newH,
    resized: true,
  };
}
```

The `createImageBitmap` + `OffscreenCanvas` path is
modern-browser fast and works inside Web Workers. Falls back to
a hidden `<canvas>` element for legacy Safari.

For very large images (anything > maybe 10MP), the work moves
into a Web Worker via `comlink` or a small bespoke worker. The
threshold for "main thread is fine" vs "needs worker" is
empirical — start with main-thread, profile, move heavy cases
to a worker if needed. The helper signature is async either
way; consumers don't need to know the difference.

---

## 5. Entry Point Wiring

Every code path that calls `assetLoader.store(bytes)` for image
data goes through `downsizeImage` first:

```typescript
// before
const key = await assetLoader.store(bytes);

// after
const result = await downsizeImage(bytes);
const key = await assetLoader.store(result.bytes);
// v1 is silent on resize. The DownsizeResult dimensions can be
// stashed on asset metadata for later surfacing in image
// properties, but no toast.
```

Entry points to find and update:
- `src/services/label-import.ts` — bundle imports that include
  embedded images
- Drag-and-drop image flow (likely in `ImportDropOverlay.vue`
  or a dedicated image-drop handler)
- File-picker image upload (toolbar Insert Image button or
  Image properties Replace button)
- Paste-from-clipboard handler (anywhere `navigator.clipboard.read()`
  is used to grab image data)
- Bulk import per `amendment-multi-file-drop.md` (each file's
  image content runs through downsize)

Audit all sites that produce image bytes for `assetLoader.store()`
and route through the helper.

---

## 6. Edge Cases

### 6.1 Image Already Smaller Than Threshold

`downsizeImage` returns `resized: false`, the original bytes
unchanged, and the original MIME (sniffed). No re-encode. No
quality loss. Pass-through.

### 6.2 Image at Exactly the Threshold

`longest === maxDimension` → not resized (the `<=` check).
1500×1125 source passes through unchanged. Edge case but
correct.

### 6.3 Decode Failure

`createImageBitmap` throws on corrupted or unsupported formats.
Caller surfaces the existing image-import error path; the
downsize helper doesn't swallow the error. The user sees the
same "couldn't open this image" message they would have got
without the downsize step.

### 6.4 SVG and Vector Sources

`createImageBitmap` rasterises SVGs at their default size, which
may be tiny or huge depending on the source. A 24×24 SVG icon
passes through unchanged (under threshold). A SVG with an
intrinsic 6000×4000 viewBox gets rasterised + downsized — fine
visually because we're using it as a bitmap on a thermal label
anyway.

If preserving SVG-as-vector through to print becomes a goal
later, that's a separate amendment (vector pipeline through to
the rasteriser); v1 treats every image as bitmap.

### 6.5 Animated GIF

`createImageBitmap` returns the first frame. The downsized WebP
is a static image. Animation isn't useful on a printed label.
No special handling needed; documented behaviour.

### 6.6 EXIF Orientation

Phone photos commonly carry an EXIF orientation flag (camera
held sideways → bytes encoded one way, display orientation
another). Without `imageOrientation: 'from-image'` on
`createImageBitmap`, an under-threshold pass-through image
displays in the EXIF-rotated orientation (browser's `<img>`
honours EXIF), but a re-encoded over-threshold image bakes
the un-rotated bytes — same source, different orientation
across the threshold. The helper sets the flag explicitly so
both paths render identically.

### 6.7 IndexedDB Quota Pressure

Even after downsize, a doc with many images can pressure quota.
Out of scope for this amendment; existing quota handling
applies. The quota error toast already exists somewhere in the
asset save path; downsize just makes it less likely to fire.

### 6.8 Threshold Bumped in a Future Release

If non-thermal output (sheet, ink) lands later and we raise
`IMAGE_MAX_DIMENSION`, existing already-downsized assets stay
at their stored resolution. Re-importing a high-resolution
source after the bump gets the new threshold. No automatic
re-process. Same applies to `WEBP_QUALITY`.

---

## 7. Files Affected

```
src/lib/image/
  downsize.ts                   new — IMAGE_MAX_DIMENSION constant,
                                downsizeImage helper,
                                DownsizeResult type

src/services/
  label-import.ts               route bundle-imported image bytes
                                through downsizeImage before
                                assetLoader.store

src/components/canvas/ (or wherever image drop/paste lives)
  ImageDropZone.vue / ImagePaste.ts (audit names)
                                route uploaded bytes through
                                downsizeImage

src/components/panels/
  ImageProperties.vue           "Replace image" handler routes
                                replacement bytes through
                                downsizeImage

src/composables/ or src/services/
  useLabelImport.ts (extending the multi-file drop amendment)
                                bulk image imports route through
                                downsizeImage
```

No new i18n keys (v1 is silent on resize).

No designer-core changes — the asset loader contract stays
identical. No schema changes. No store changes.

---

## 8. Implementation Checklist

```
Helper:
□ src/lib/image/downsize.ts with IMAGE_MAX_DIMENSION (= 1500),
  WEBP_QUALITY (= 0.80), downsizeImage(bytes, max?),
  DownsizeResult type (incl. mimeType field)
□ Sniffs MIME from magic bytes; passes type to Blob constructor
□ Decodes with createImageBitmap(blob, { imageOrientation:
  'from-image' }) so EXIF rotation is honoured
□ Uses OffscreenCanvas where available; falls back to <canvas>
  element for legacy browsers
□ Returns original bytes unchanged when below threshold
  (no re-encode)
□ Re-encodes to WebP@0.80 always when resizing
□ Closes ImageBitmap to release memory

Entry-point routing:
□ Audit every assetLoader.store call in the codebase that
  takes image bytes; route each through downsizeImage
□ Drag-drop image handler
□ File-picker image upload (toolbar Insert)
□ Paste-from-clipboard image
□ Image properties Replace handler
□ label-import.ts bundle-imported images
□ Bulk import (multi-file-drop amendment compat)

Web Worker (conditional):
□ Profile main-thread downsize on a 4000×3000 input on a
  baseline laptop (target: Intel-class ultrabook)
□ If decode + resample blocks main thread > 100ms, move to a
  Web Worker via comlink or small dedicated worker module
□ Behaviour identical to main-thread path; consumer code
  unchanged
```

---

## 9. Tests

`src/lib/image/__tests__/downsize.test.ts`:
- 800×600 input → resized: false; bytes identical to input;
  mimeType matches sniff (e.g. JPEG in → JPEG out)
- 1500×1125 input → resized: false (at threshold)
- 4000×3000 input → resized: true; output is 1500×1125;
  output bytes are valid WebP (magic bytes RIFF…WEBP);
  mimeType is 'image/webp'
- 3000×4000 portrait → resized: true; output is 1125×1500
  (longest edge clamped)
- Square 4000×4000 → output is 1500×1500
- Aspect ratio preserved within ±1px (rounding)
- Custom maxDimension override works
- MIME sniff: JPEG / PNG / WebP / GIF / SVG inputs each get
  the right `type` on the decode Blob
- EXIF orientation: a JPEG with rotation flag decodes to the
  oriented dimensions (e.g. 4000×3000 portrait-flagged source
  reports 3000×4000 to the helper, downsizes to 1125×1500)

Entry-point routing:
- Drag-drop a 4000px image → asset store contains a 1500px
  WebP
- Drag-drop a 800px image → asset store contains the original
  bytes
- Paste a 4000px clipboard image → downsized
- File-picker upload → downsized
- Replace image with a 4000px source → downsized; previous
  asset replaced with the downsized hash

Bulk import:
- Drop 5 images all over threshold → all downsized
- Drop 5 images mixed (3 over, 2 under) → 3 downsized,
  2 pass-through

Edge cases:
- Corrupted bytes → downsizeImage rejects; existing error toast
  fires
- Animated GIF → first frame downsized; static WebP stored
- Tiny SVG (24×24) → passes through unchanged
- Large SVG (huge viewBox) → rasterised then downsized to WebP

---

## 10. Audit Reconciliation (added during implementation)

The plan above was written greenfield. Reality differs in a
few load-bearing places — reconciled here so the implementation
matches what's actually in the repo.

**Existing helper.** `BurnmarkAssetLoader.storeFromBlob`
already calls a `resizeIfNeeded(blob)` helper at
`src/services/asset-loader.ts:43–70`, capping at 2400px and
re-encoding to PNG via `<canvas>.toBlob`. Strategy: tighten
this helper in place (1500px / WebP@0.80 / sniff / orientation
/ OffscreenCanvas) and lift it to `src/lib/image/downsize.ts`
for testability and reuse. `storeFromBlob` becomes a one-liner
calling the lifted helper.

**Real entry points (audited).**
- `src/components/toolbar/MainToolbar.vue:178` (Insert Image)
  — calls `storeFromBlob(file)` ✓ already funnelled.
- `src/components/panels/ImageProperties.vue:126` (Replace) —
  calls `storeFromBlob(file)` ✓ already funnelled.
- `src/lib/shapes/render.ts:38` — synthetic small bitmaps from
  shape rasterisation; under threshold by construction. Not
  routed through downsize.
- Bundle import (`src/services/label-import.ts:89-91`) —
  intentionally bypasses downsize via `assetLoader.set(key,
  bytes)` to preserve content-hash references in the imported
  document. **MUST NOT be routed through downsize**; doing so
  would change asset hashes and break document references.

**Entry points the original plan listed that don't exist yet.**
- Drag-drop image flow: `ImportDropOverlay → useLabelImport →
  importLabelFile` only handles `.label` JSON or `.zip`
  bundles; raw image files are rejected with `unknown-format`.
- Paste-from-clipboard image: no handler in this codebase
  (no `clipboard.read` callers, no `@paste` bindings).
- Library import of image assets: goes via the bundle path
  (already correctly bypasses).

These three are out of scope for this amendment. If/when they
land in a separate amendment, that amendment routes through
the same `downsizeImage` helper.

**MIME on read.** `loadAsBlob` currently hardcodes
`type: 'image/png'` (line 26). With WebP storage this label is
wrong. Switch to a magic-byte sniff so the returned Blob
carries the real content type.

**Test environment.** Vitest runs in jsdom, which does not
implement `createImageBitmap`, `OffscreenCanvas`, or
`<canvas>.toBlob` for real image bytes. Tests partition into:
- Pure functions (sniff, scale-math) — straightforward unit
  tests.
- Decode + resize — gated behind a happy-dom / browser-mode
  runner, or skipped in jsdom with a comment. Belt-and-braces
  manual verification in the dev server before considering the
  step done.

**Files affected — actual.**
```
src/lib/image/
  downsize.ts                   new — IMAGE_MAX_DIMENSION,
                                WEBP_QUALITY, sniffMime,
                                downsizeImage, DownsizeResult

src/lib/image/__tests__/
  downsize.test.ts              new — sniff + scale-math
                                tests (jsdom-safe), gated
                                decode tests where possible

src/services/
  asset-loader.ts               storeFromBlob delegates to
                                downsizeImage; loadAsBlob
                                sniffs MIME from bytes
```

No changes to entry points; no changes to designer-core; no
schema changes; no i18n changes.

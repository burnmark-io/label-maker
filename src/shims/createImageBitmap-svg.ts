/**
 * Patch `createImageBitmap` so SVG `Blob`s decode in Chromium/WebKit.
 *
 * Background: `createImageBitmap(svgBlob)` is a long-standing Chromium
 * gap — it throws `InvalidStateError: The source image could not be
 * decoded`. The standard workaround is to indirect through an
 * `HTMLImageElement`, which decodes SVG natively. But there's a second
 * trap: an `HTMLImageElement` whose `src` is an SVG with only a
 * `viewBox` (no explicit `width`/`height` attributes) has zero
 * `naturalWidth`/`naturalHeight`, and `createImageBitmap(img)` then
 * fails with "no resize options are specified". bwip-js's `toSVG()`
 * output is exactly that shape — viewBox only.
 *
 * Fix: parse the SVG blob's text once, pull dimensions out of the
 * `<svg>` tag (preferring explicit `width`/`height`, falling back to
 * `viewBox`), and forward them to `createImageBitmap` as
 * `resizeWidth`/`resizeHeight`. Every other input falls through to the
 * native implementation.
 */
export function patchCreateImageBitmap(): void {
  if (typeof globalThis === 'undefined' || typeof globalThis.createImageBitmap !== 'function') {
    return;
  }
  const native = globalThis.createImageBitmap.bind(globalThis);

  globalThis.createImageBitmap = (async function patched(
    source: ImageBitmapSource,
    sxOrOptions?: number | ImageBitmapOptions,
    sy?: number,
    sw?: number,
    sh?: number,
    options?: ImageBitmapOptions,
  ): Promise<ImageBitmap> {
    if (isSvgBlob(source)) {
      return decodeSvgBlob(source, native);
    }
    if (typeof sxOrOptions === 'number') {
      return native(source, sxOrOptions, sy as number, sw as number, sh as number, options);
    }
    if (sxOrOptions !== undefined) {
      return native(source, sxOrOptions);
    }
    return native(source);
  }) as typeof globalThis.createImageBitmap;
}

function isSvgBlob(source: ImageBitmapSource): source is Blob {
  return typeof Blob !== 'undefined' && source instanceof Blob && source.type === 'image/svg+xml';
}

async function decodeSvgBlob(
  blob: Blob,
  native: typeof createImageBitmap,
): Promise<ImageBitmap> {
  const text = await blob.text();
  const dims = readSvgDimensions(text);
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const w = dims.width || img.naturalWidth || 0;
    const h = dims.height || img.naturalHeight || 0;
    if (w > 0 && h > 0) {
      return await native(img, { resizeWidth: w, resizeHeight: h });
    }
    // Last-ditch: try without resize options. May throw if naturals are
    // also 0, but that's a malformed SVG and not our problem to mask.
    return await native(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function readSvgDimensions(svg: string): { width: number; height: number } {
  // Look only at the opening <svg ...> tag — the first '>' after '<svg'.
  const tagStart = svg.indexOf('<svg');
  if (tagStart < 0) return { width: 0, height: 0 };
  const tagEnd = svg.indexOf('>', tagStart);
  const tag = tagEnd > tagStart ? svg.slice(tagStart, tagEnd + 1) : svg.slice(tagStart);

  let width = parseLength(tag.match(/\swidth\s*=\s*"([^"]+)"/)?.[1]);
  let height = parseLength(tag.match(/\sheight\s*=\s*"([^"]+)"/)?.[1]);

  if (!width || !height) {
    const vb = tag.match(/\sviewBox\s*=\s*"([^"]+)"/)?.[1];
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map((s) => parseFloat(s));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        if (!width) width = parts[2]!;
        if (!height) height = parts[3]!;
      }
    }
  }
  return { width: width || 0, height: height || 0 };
}

function parseLength(value: string | undefined): number {
  if (!value) return 0;
  // Strip a trailing unit suffix (px, pt, mm…) — bwip-js sometimes emits
  // bare numbers, sometimes with units. parseFloat handles both since it
  // stops at the first non-numeric character.
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

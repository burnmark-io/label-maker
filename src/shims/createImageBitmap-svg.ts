/**
 * Patch `createImageBitmap` so SVG `Blob`s decode in Chromium/WebKit.
 *
 * Background: `createImageBitmap(svgBlob)` is a long-standing Chromium
 * gap — it throws `InvalidStateError: The source image could not be
 * decoded`. The standard workaround is to indirect through an
 * `HTMLImageElement`, which decodes SVG natively. There are two traps:
 *
 *  1. An `<img>` whose `src` is an SVG with only a `viewBox` and no
 *     explicit `width`/`height` attributes has zero
 *     `naturalWidth`/`naturalHeight`. `createImageBitmap(img)` then
 *     errors with "no resize options are specified".
 *  2. Passing `resizeWidth`/`resizeHeight` to compensate for trap (1)
 *     scales the 0×0 source up to the target size — every pixel stays
 *     transparent, producing a blank ImageBitmap.
 *
 * bwip-js's `toSVG()` output trips both: the produced SVG is
 * `<svg viewBox="0 0 W H">…</svg>` with no explicit dimensions.
 *
 * Fix: inject `width`/`height` attributes (derived from the viewBox)
 * into the SVG text before creating the image, so the `<img>` decodes
 * with real natural dimensions and `createImageBitmap(img)` rasterises
 * the actual content. Every other input falls through to the native
 * implementation.
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
  const sized = ensureSvgDimensions(text);
  const url = URL.createObjectURL(
    sized.text === text ? blob : new Blob([sized.text], { type: 'image/svg+xml' }),
  );
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      return await native(img);
    }
    // Fallback: still no natural dimensions, but we know the target
    // size from the viewBox. Resize options force the output size at
    // the cost of a 0×0 source — produces a blank but at least the
    // call doesn't reject.
    if (sized.width > 0 && sized.height > 0) {
      return await native(img, { resizeWidth: sized.width, resizeHeight: sized.height });
    }
    return await native(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * If the root `<svg>` tag is missing `width`/`height` attributes,
 * inject ones derived from the `viewBox`. Returns the (possibly
 * unchanged) SVG text and the resolved dimensions.
 */
export function ensureSvgDimensions(svg: string): {
  text: string;
  width: number;
  height: number;
} {
  const tagStart = svg.indexOf('<svg');
  if (tagStart < 0) return { text: svg, width: 0, height: 0 };
  const tagEnd = svg.indexOf('>', tagStart);
  if (tagEnd < 0) return { text: svg, width: 0, height: 0 };
  const tag = svg.slice(tagStart, tagEnd + 1);

  const explicitWidth = parseLength(tag.match(/\swidth\s*=\s*"([^"]+)"/)?.[1]);
  const explicitHeight = parseLength(tag.match(/\sheight\s*=\s*"([^"]+)"/)?.[1]);

  let viewBoxW = 0;
  let viewBoxH = 0;
  const vb = tag.match(/\sviewBox\s*=\s*"([^"]+)"/)?.[1];
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map((s) => parseFloat(s));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      viewBoxW = parts[2]!;
      viewBoxH = parts[3]!;
    }
  }

  const width = explicitWidth || viewBoxW;
  const height = explicitHeight || viewBoxH;

  if (explicitWidth && explicitHeight) {
    return { text: svg, width, height };
  }
  if (!width || !height) {
    return { text: svg, width: 0, height: 0 };
  }
  // Inject the missing attributes just before the closing '>' of the
  // opening tag.
  const closingChar = tag.endsWith('/>') ? '/>' : '>';
  const tagBody = tag.slice(0, tag.length - closingChar.length);
  const inject =
    (explicitWidth ? '' : ` width="${width}"`) +
    (explicitHeight ? '' : ` height="${height}"`);
  const newTag = `${tagBody}${inject}${closingChar}`;
  const text = svg.slice(0, tagStart) + newTag + svg.slice(tagEnd + 1);
  return { text, width, height };
}

function parseLength(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

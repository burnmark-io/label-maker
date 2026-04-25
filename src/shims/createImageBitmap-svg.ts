/**
 * Patch `createImageBitmap` so SVG `Blob`s decode in Chromium/WebKit.
 *
 * Background: `createImageBitmap(svgBlob)` is a long-standing Chromium
 * gap — it throws `InvalidStateError: The source image could not be
 * decoded`, even though the same SVG decodes fine through an
 * `HTMLImageElement`. Firefox handles SVG blobs natively.
 *
 * Designer-core's browser barcode path renders QR / Code128 / etc. via
 * `bwip-js.toSVG()` then `createImageBitmap(blob)`. That fails on
 * Chrome the moment any document contains a barcode — including our
 * first-visit sample label. We intercept SVG blobs at the
 * `createImageBitmap` boundary and route them through an
 * `HTMLImageElement` decode, which Chrome handles correctly. Every
 * other input falls through to the native implementation.
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
      const url = URL.createObjectURL(source);
      try {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
        await img.decode();
        return await native(img);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    // Fall through to native, preserving both overloads.
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

/**
 * Image fit math for canvas rendering. Mirrors CSS `object-fit`
 * semantics — `contain`, `cover`, `fill`, `none` — and returns
 * the Konva config fragment needed to realise each mode against
 * the user's bounding box.
 *
 * Pure: no Konva, no DOM. The caller merges the result with
 * positioning (x, y, rotation, …) into a Konva.Image config.
 *
 * Anchor convention: the resulting `{ offsetX, offsetY }` puts
 * the image's geometric centre at whatever world-space (x, y)
 * the caller chose, so rotation always pivots around the
 * bounding-box centre regardless of fit mode.
 */

export type ImageFit = 'contain' | 'cover' | 'fill' | 'none';

export interface FitInput {
  fit: ImageFit;
  bbox: { width: number; height: number };
  source: { width: number; height: number } | null;
}

export interface FitOutput {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

function fillBbox(bbox: FitInput['bbox']): FitOutput {
  return {
    width: bbox.width,
    height: bbox.height,
    offsetX: bbox.width / 2,
    offsetY: bbox.height / 2,
  };
}

export function computeFit({ fit, bbox, source }: FitInput): FitOutput {
  if (!source || source.width <= 0 || source.height <= 0) {
    return fillBbox(bbox);
  }

  if (fit === 'fill') {
    return fillBbox(bbox);
  }

  const sourceAspect = source.width / source.height;
  const bboxAspect = bbox.width / bbox.height;

  if (fit === 'contain') {
    const w = sourceAspect > bboxAspect ? bbox.width : bbox.height * sourceAspect;
    const h = sourceAspect > bboxAspect ? bbox.width / sourceAspect : bbox.height;
    return { width: w, height: h, offsetX: w / 2, offsetY: h / 2 };
  }

  if (fit === 'cover') {
    let cropWidth: number;
    let cropHeight: number;
    let cropX: number;
    let cropY: number;
    if (sourceAspect > bboxAspect) {
      cropHeight = source.height;
      cropWidth = source.height * bboxAspect;
      cropX = (source.width - cropWidth) / 2;
      cropY = 0;
    } else {
      cropWidth = source.width;
      cropHeight = source.width / bboxAspect;
      cropX = 0;
      cropY = (source.height - cropHeight) / 2;
    }
    return {
      width: bbox.width,
      height: bbox.height,
      offsetX: bbox.width / 2,
      offsetY: bbox.height / 2,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
    };
  }

  // 'none' — render at native pixel size, centred in the bbox,
  // clipping any overflow on the larger axis.
  const dispW = Math.min(bbox.width, source.width);
  const dispH = Math.min(bbox.height, source.height);
  const cropX = source.width > bbox.width ? (source.width - bbox.width) / 2 : 0;
  const cropY = source.height > bbox.height ? (source.height - bbox.height) / 2 : 0;
  return {
    width: dispW,
    height: dispH,
    offsetX: dispW / 2,
    offsetY: dispH / 2,
    cropX,
    cropY,
    cropWidth: dispW,
    cropHeight: dispH,
  };
}

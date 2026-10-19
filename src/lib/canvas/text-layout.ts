import type { TextObject } from '@burnmark-io/designer-core';

/**
 * Vertical font metrics (in dots) sourced from a 2D context's
 * `measureText()` — the same numbers Konva and the browser use to lay out
 * canvas text.
 */
export interface FontVerticalMetrics {
  /** Em-box ascent: distance from the alphabetic baseline to the em-box top. */
  ascent: number;
  /** Em-box descent: distance from the alphabetic baseline to the em-box bottom. */
  descent: number;
}

type MeasurableText = Pick<TextObject, 'fontSize' | 'lineHeight'>;
type FontedText = Pick<TextObject, 'fontSize' | 'fontFamily' | 'fontWeight' | 'fontStyle'>;

/**
 * CSS/canvas `font` shorthand for a text object, in the same shape Konva
 * builds it (no quotes around the family) so `measureText` resolves the same
 * face the editor draws with.
 */
export function konvaFontString(object: FontedText): string {
  return `${object.fontStyle} ${object.fontWeight} ${object.fontSize}px ${object.fontFamily}`;
}

/**
 * Measure the em-box ascent/descent for `font` on `ctx`, leaving the context's
 * previous font restored.
 */
export function measureFontVerticalMetrics(
  ctx: CanvasRenderingContext2D,
  font: string,
): FontVerticalMetrics {
  const previous = ctx.font;
  ctx.font = font;
  const metrics = ctx.measureText('Mg');
  ctx.font = previous;
  return {
    ascent: metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? 0,
    descent: metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent ?? 0,
  };
}

/**
 * Local y at which **Konva** draws the first line's anchor.
 *
 * Konva's `Text._sceneFunc` always renders with `textBaseline: 'middle'` and
 * centres each line in its line box, so the first line's anchor sits at
 * `lineHeight · fontSize / 2` below the node's top.
 */
export function konvaFirstLineAnchorY(object: MeasurableText): number {
  return (object.lineHeight * object.fontSize) / 2;
}

/**
 * Local y of the first line's alphabetic baseline for a top-aligned text.
 *
 * **designer-core** (`renderText` → `dist/render/text.js`) uses
 * `textBaseline: 'alphabetic'` and, for `verticalAlign: 'top'`, draws the
 * first baseline at `fontSize` below the object's top. This is the reference
 * the print / PNG / PDF exporters use, so the editor must match it.
 */
export function designerCoreFirstLineBaselineY(object: Pick<TextObject, 'fontSize'>): number {
  return object.fontSize;
}

/**
 * Local y of the first line's *alphabetic* baseline as Konva places it: the
 * `textBaseline: 'middle'` anchor converted back with the font's ascent and
 * descent (`middle` sits `(ascent − descent) / 2` above the baseline).
 */
export function konvaFirstLineBaselineY(
  object: MeasurableText,
  metrics: FontVerticalMetrics,
): number {
  return konvaFirstLineAnchorY(object) + (metrics.ascent - metrics.descent) / 2;
}

/**
 * Extra local-y offset the editor's Konva text node needs so its rendered ink
 * matches `@burnmark-io/designer-core`'s `renderText`.
 *
 * Konva anchors the first line by its *middle* baseline
 * (`konvaFirstLineBaselineY`), designer-core by its *alphabetic* baseline
 * (`designerCoreFirstLineBaselineY`); the difference is a fixed shift that the
 * editor has to add to the node's `y`. It is independent of `verticalAlign`
 * (both renderers move the whole block identically for middle/bottom).
 *
 * Applied by `src/components/canvas/TextNode.vue` (and its inline editor) so
 * the canvas is WYSIWYG with the print. Guarded by
 * `src/lib/canvas/__tests__/text-layout.test.ts`.
 */
export function editorTextYCorrection(
  object: MeasurableText,
  metrics: FontVerticalMetrics,
): number {
  return designerCoreFirstLineBaselineY(object) - konvaFirstLineBaselineY(object, metrics);
}

/**
 * Lazily-created shared 2D context used only to read font metrics. Text nodes
 * are created/updated in bunches, so one offscreen canvas is enough. Returns
 * `null` when there is no 2D context available (jsdom in tests, SSR), in which
 * case the correction degrades to 0 — i.e. the pre-fix behaviour.
 */
let measurementCtx: CanvasRenderingContext2D | null | undefined;
function sharedMeasurementContext(): CanvasRenderingContext2D | null {
  if (measurementCtx !== undefined) return measurementCtx;
  if (typeof document === 'undefined') {
    measurementCtx = null;
    return measurementCtx;
  }
  measurementCtx = document.createElement('canvas').getContext('2d');
  return measurementCtx;
}

/**
 * `editorTextYCorrection` for a text object, measuring the font itself.
 *
 * This is what the canvas components call: `TextNode.vue` offsets the Konva
 * node's `y` by it, and `InlineTextEditor.vue` offsets the DOM overlay by the
 * same amount so entering/leaving edit mode does not jump.
 */
export function textYCorrectionFor(object: MeasurableText & FontedText): number {
  const ctx = sharedMeasurementContext();
  if (!ctx) return 0;
  return editorTextYCorrection(object, measureFontVerticalMetrics(ctx, konvaFontString(object)));
}

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

type VerticalAlignInput = Pick<TextObject, 'fontSize' | 'lineHeight'>;

/**
 * Local y at which **Konva** draws the first line's anchor.
 *
 * Konva's `Text._sceneFunc` always renders with `textBaseline: 'middle'` and
 * centres each line in its line box, so the first line's anchor sits at
 * `lineHeight · fontSize / 2` below the node's top.
 */
export function konvaFirstLineAnchorY(object: VerticalAlignInput): number {
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
 * Extra local-y offset the editor's Konva text node needs so its rendered ink
 * matches designer-core's `renderText`.
 *
 * Konva anchors the first line by its *middle* baseline at
 * `konvaFirstLineAnchorY`, whereas designer-core anchors it by its *alphabetic*
 * baseline at `designerCoreFirstLineBaselineY`. Converting Konva's middle
 * anchor to an alphabetic baseline uses the font's ascent/descent.
 *
 * ⚠️ **This currently returns `0` — the bug.** Until it returns the value
 * below, the editor draws the first line
 * `designerCoreFirstLineBaselineY(o) − (konvaFirstLineAnchorY(o) + (ascent − descent) / 2)`
 * dots away from where the print puts it (≈ 9% of `fontSize`, invisible for
 * small text and large for big glyphs). Reproduced by
 * `src/lib/canvas/__tests__/text-layout.test.ts`; the fix is to return the
 * formula here *and* apply it to the Konva node in
 * `src/components/canvas/TextNode.vue`.
 */
export function editorTextYCorrection(
  object: VerticalAlignInput,
  metrics: FontVerticalMetrics,
): number {
  void object;
  void metrics;
  return 0;
}

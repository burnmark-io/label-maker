/**
 * WYSIWYG regression: the editor (Konva) and the print/export renderer
 * (`@burnmark-io/designer-core`'s `renderFull`) must place a text object's
 * first line at the same vertical position.
 *
 * Konva does not render in jsdom, so the editor side is mirrored here (the
 * same convention `marquee.test.ts` / `group-transform.test.ts` use for Konva
 * math) and drawn onto a real 2D canvas (`@napi-rs/canvas` — the
 * implementation designer-core itself uses in Node) so the comparison uses
 * real font metrics. The print side runs the real `renderFull` pipeline.
 *
 * This test is expected to FAIL today: designer-core anchors the first line by
 * its alphabetical baseline at `fontSize` (`textBaseline: 'alphabetic'`),
 * while Konva centres it in the line box (`textBaseline: 'middle'`). The
 * offset grows with `fontSize` — a 350-dot "D" drifts ~30 dots, a 50-dot
 * caption is nearly invisible. See `@/lib/canvas/text-layout`.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import type { Canvas } from '@napi-rs/canvas';
import { renderFull, type LabelDocument, type RawImageData, type TextObject } from '@burnmark-io/designer-core';
import {
  konvaFirstLineAnchorY,
  editorTextYCorrection,
  konvaTextHeight,
  type FontVerticalMetrics,
} from '@/lib/canvas/text-layout';

const W = 460;
const H = 480;

// `@napi-rs/canvas` is CJS-only; load it through `createRequire` so the test
// works regardless of how the ESM interop is resolved.
const require = createRequire(import.meta.url);
const { createCanvas } = require('@napi-rs/canvas') as {
  createCanvas: (width: number, height: number) => Canvas;
};

function textObject(over: Partial<TextObject>): TextObject {
  return {
    type: 'text',
    id: 'text-1',
    name: 'Text 1',
    x: 0,
    y: 0,
    width: W,
    height: H,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#000000',
    content: 'D',
    fontFamily: 'Helvetica',
    fontSize: 350,
    fontWeight: 'bold',
    fontStyle: 'normal',
    textAlign: 'left',
    verticalAlign: 'top',
    letterSpacing: 0,
    lineHeight: 1.1,
    invert: false,
    wrap: true,
    autoHeight: false,
    ...over,
  } as TextObject;
}

function document(object: TextObject): LabelDocument {
  return {
    id: 'doc-1',
    version: 1,
    name: 'test',
    canvas: {
      widthDots: W,
      heightDots: H,
      dpi: 300,
      background: '#ffffff',
      grid: { enabled: false, spacingDots: 10 },
      orientation: 'vertical',
    },
    objects: [object],
    metadata: {},
  } as unknown as LabelDocument;
}

function fontString(object: TextObject): string {
  return `${object.fontStyle} ${object.fontWeight} ${object.fontSize}px "${object.fontFamily}"`;
}

function verticalMetrics(ctx: CanvasRenderingContext2D, object: TextObject): FontVerticalMetrics {
  const m = ctx.measureText('Mg');
  return {
    ascent: m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? object.fontSize,
    descent: m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? 0,
  };
}

/** Topmost row (y) that carries ink on a napi canvas, or -1 when blank. */
function inkTopOfCanvas(canvas: Canvas): number {
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return inkTopOfData(data, canvas.width, canvas.height);
}

/** Topmost row (y) that carries ink in an RGBA buffer, or -1 when blank. */
function inkTopOfData(data: Uint8ClampedArray | Uint8Array, width: number, height: number): number {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (data[i + 3] > 10 && luminance < 128) return y;
    }
  }
  return -1;
}

/**
 * Mirror of Konva's `Text._sceneFunc` for a single, top-aligned line: Konva
 * forces `textBaseline: 'middle'` and draws the line at its line-box centre,
 * plus the WYSIWYG correction the app applies to the node.
 */
function editorInkTop(object: TextObject): number {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.font = fontString(object);
  const anchor = konvaFirstLineAnchorY(object) + editorTextYCorrection(object, verticalMetrics(ctx, object));

  ctx.fillStyle = object.color;
  ctx.textAlign = object.textAlign;
  ctx.textBaseline = 'middle';
  ctx.fillText(object.content, 0, anchor);

  return inkTopOfCanvas(canvas);
}

describe('konvaTextHeight — Konva must not drop lines the print renders', () => {
  it('omits the height for top-aligned text (Konva would truncate to the box)', () => {
    expect(konvaTextHeight({ height: 110, autoHeight: false, verticalAlign: 'top' })).toBeUndefined();
    expect(
      konvaTextHeight({ height: 110, autoHeight: false, verticalAlign: undefined }),
    ).toBeUndefined();
  });

  it('keeps the height where alignment needs it, and for autoHeight', () => {
    expect(konvaTextHeight({ height: 110, autoHeight: false, verticalAlign: 'middle' })).toBe(110);
    expect(konvaTextHeight({ height: 110, autoHeight: false, verticalAlign: 'bottom' })).toBe(110);
    expect(konvaTextHeight({ height: 110, autoHeight: true, verticalAlign: 'middle' })).toBeUndefined();
  });
});

describe('WYSIWYG — editor (Konva) vs print (designer-core) first text line', () => {
  for (const fontSize of [50, 120, 350]) {
    it(`places the first line at the same y (fontSize=${fontSize})`, async () => {
      const object = textObject({ fontSize, lineHeight: 1.1 });

      const printed: RawImageData = await renderFull(document(object), {});
      const printTop = inkTopOfData(printed.data, printed.width, printed.height);

      const editorTop = editorInkTop(object);

      expect(printTop, 'print has ink').toBeGreaterThanOrEqual(0);
      expect(editorTop, 'editor has ink').toBeGreaterThanOrEqual(0);
      expect(
        Math.abs(printTop - editorTop),
        `first-line ink top differs: print=${printTop}, editor=${editorTop}`,
      ).toBeLessThanOrEqual(2);
    });
  }
});

// @vitest-environment node
/** WYSIWYG: TextNode's paint path (node transform + paintEditorText) must match renderFull pixel for pixel. */
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Canvas } from '@napi-rs/canvas';
import {
  createDocument,
  renderFull,
  setMeasurementContext,
  type LabelObject,
  type RawImageData,
  type TextObject,
} from '@burnmark-io/designer-core';
import {
  layoutEditorText,
  paintEditorText,
  parseTextLayoutKey,
  textLayoutKey,
  textNodeTransform,
  withAutoHeight,
  withAutoHeightInput,
} from '@/lib/canvas/text-layout';

const W = 400;
const H = 300;

// `@napi-rs/canvas` is CJS-only; load it through `createRequire`.
const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas') as {
  createCanvas: (width: number, height: number) => Canvas;
  GlobalFonts: { registerFromPath: (path: string, name?: string) => unknown };
};

// Register designer-core's bundled font on this canvas instance too: CI has
// no system fonts, and a linked designer-core may load its own canvas copy.
const fontDir = '../../../../node_modules/@burnmark-io/designer-core/dist/fonts/bundled/';
for (const file of ['burnmark-sans.woff2', 'burnmark-sans-bold.woff2']) {
  // `node:url` is shimmed in this project; take the path from the URL itself.
  const path = decodeURIComponent(new URL(fontDir + file, import.meta.url).pathname);
  if (!GlobalFonts.registerFromPath(path, 'Burnmark Sans')) throw new Error(`font: ${path}`);
}

type Ctx = Parameters<typeof paintEditorText>[0];

function textObject(over: Partial<TextObject> = {}): TextObject {
  return {
    type: 'text',
    id: 'text-1',
    name: 'Text 1',
    x: 30,
    y: 20,
    width: 300,
    height: 200,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#000000',
    content: 'The quick brown fox jumps over the lazy dog',
    fontFamily: 'Burnmark Sans',
    fontSize: 36,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    verticalAlign: 'top',
    letterSpacing: 0,
    lineHeight: 1.2,
    invert: false,
    wrap: true,
    autoHeight: false,
    ...over,
  } as TextObject;
}

async function printed(
  object: TextObject,
  variables?: Record<string, string>,
): Promise<RawImageData> {
  const doc = createDocument('doc', { widthDots: W, heightDots: H, background: '#ffffff' });
  doc.objects.push(object as LabelObject);
  return renderFull(doc, { variables });
}

/** What TextNode's Konva Shape paints, on a white canvas. */
function edited(object: TextObject, variables: Record<string, string> = {}): Uint8ClampedArray {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const layout = layoutEditorText(object, variables, null, ctx as unknown as Ctx);
  const t = textNodeTransform(object, layout);
  ctx.translate(t.x, t.y);
  if (t.rotation !== 0) ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.translate(-t.offsetX, -t.offsetY);
  paintEditorText(ctx as unknown as Ctx, object, layout);
  return ctx.getImageData(0, 0, W, H).data;
}

function inkCount(data: Uint8ClampedArray | Uint8Array): number {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i]! < 128) n++;
  return n;
}

/** Pixels whose red channel differs by more than `tol`. */
function diffCount(
  a: Uint8ClampedArray | Uint8Array,
  b: Uint8ClampedArray | Uint8Array,
  tol = 8,
): number {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]! - b[i]!) > tol) n++;
  return n;
}

const cases: [string, Partial<TextObject>][] = [];
for (const verticalAlign of ['top', 'middle', 'bottom'] as const) {
  for (const textAlign of ['left', 'center', 'right'] as const) {
    cases.push([`${verticalAlign}/${textAlign}`, { verticalAlign, textAlign }]);
  }
}
cases.push(
  ['letterSpacing', { letterSpacing: 6, textAlign: 'center' }],
  ['invert', { invert: true, content: 'Inverted' }],
  ['multi-line overflow past the box', { height: 40, fontSize: 48 }],
  [
    'large single glyph (PR #2 case)',
    { content: 'D', fontSize: 200, fontWeight: 'bold', lineHeight: 1.1 },
  ],
  ['whitespace runs', { content: 'a    b\t\tc' }],
  [
    'long word broken per character',
    { content: 'Supercalifragilisticexpialidocious', fontSize: 40, width: 200 },
  ],
  [
    'autoHeight with stale stored height, bottom',
    { autoHeight: true, height: 250, verticalAlign: 'bottom' },
  ],
  ['autoHeight, inverted', { autoHeight: true, height: 250, invert: true }],
  ['bold italic', { fontWeight: 'bold', fontStyle: 'italic' }],
  ['rotated 90°', { rotation: 90, x: 60, y: 60, width: 200, height: 120 }],
  ['rotated 30° autoHeight', { rotation: 30, autoHeight: true, height: 10 }],
);

describe('WYSIWYG — editor paint vs renderFull', () => {
  it.each(cases)('%s', async (_name, over) => {
    const object = textObject(over);
    const print = await printed(object);
    const editor = edited(object);
    expect(inkCount(print.data), 'print has ink').toBeGreaterThan(0);
    // Rotation uses an equivalent but different transform chain: allow anti-aliasing noise.
    const budget = object.rotation === 0 ? 0 : Math.ceil(inkCount(print.data) * 0.01);
    expect(diffCount(print.data, editor)).toBeLessThanOrEqual(budget);
  });

  it('resolves template variables the same way', async () => {
    const object = textObject({ content: 'Hello {{name}}, welcome' });
    const variables = { name: 'Bartholomew' };
    const print = await printed(object, variables);
    expect(diffCount(print.data, edited(object, variables))).toBe(0);
    // And the variable actually changed the output.
    expect(diffCount(print.data, edited(object, {}))).toBeGreaterThan(0);
  });
});

describe('withAutoHeight — stored height for autoHeight text', () => {
  beforeAll(() => {
    setMeasurementContext(createCanvas(1, 1).getContext('2d') as unknown as Ctx);
  });
  afterAll(() => {
    setMeasurementContext(null);
  });

  const auto = textObject({ autoHeight: true, height: 999, fontSize: 10, lineHeight: 1.2 });

  it('folds the laid-out height into layout-affecting patches', () => {
    expect(withAutoHeight(auto, { content: 'a\nb\nc' }, {})).toEqual({
      content: 'a\nb\nc',
      height: 36,
    });
  });

  it('measures with template variables resolved', () => {
    const patch = withAutoHeight(auto, { content: '{{v}}', wrap: false }, { v: 'a\nb' });
    expect(patch).toMatchObject({ height: 24 });
  });

  it('leaves unrelated patches alone', () => {
    expect(withAutoHeight(auto, { color: '#ff0000' }, {})).toEqual({ color: '#ff0000' });
  });

  it('leaves fixed-height text alone', () => {
    const fixed = textObject({ autoHeight: false });
    expect(withAutoHeight(fixed, { content: 'a\nb' }, {})).toEqual({ content: 'a\nb' });
  });

  it('sizes a new autoHeight object before it is added', () => {
    const { id: _id, ...input } = textObject({
      autoHeight: true,
      height: 1,
      content: 'x',
      fontSize: 10,
    });
    void _id;
    expect(withAutoHeightInput(input, {}).height).toBe(12);
  });
});

describe('textLayoutKey', () => {
  it('ignores position, rotation and colour', () => {
    const a = textObject();
    const b = textObject({ x: 999, y: 5, rotation: 45, color: '#ff0000', opacity: 0.5 });
    expect(textLayoutKey(a)).toBe(textLayoutKey(b));
  });

  it('changes with every layout field', () => {
    const base = textLayoutKey(textObject());
    for (const over of [
      { content: 'x' },
      { fontSize: 1 },
      { letterSpacing: -1 },
      { lineHeight: 2 },
      { width: 1 },
      { height: 1 },
      { wrap: false },
      { autoHeight: true },
      { textAlign: 'right' as const },
      { verticalAlign: 'bottom' as const },
      { fontWeight: 'bold' as const },
      { fontStyle: 'italic' as const },
      { fontFamily: 'Other' },
    ]) {
      expect(textLayoutKey(textObject(over)), JSON.stringify(over)).not.toBe(base);
    }
  });

  it('round-trips to the same layout', () => {
    const o = textObject({ letterSpacing: 3, verticalAlign: 'middle', textAlign: 'center' });
    const ctx = createCanvas(1, 1).getContext('2d') as unknown as Ctx;
    expect(layoutEditorText(parseTextLayoutKey(textLayoutKey(o)), {}, null, ctx)).toEqual(
      layoutEditorText(o, {}, null, ctx),
    );
  });
});

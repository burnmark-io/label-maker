import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { LabelDocument } from '@burnmark-io/designer-core';
import type * as DesignerCore from '@burnmark-io/designer-core';

/**
 * The renderer needs an actual canvas backend (`@napi-rs/canvas` in Node,
 * `OffscreenCanvas` in browsers) which the unit test env lacks. Mock
 * `renderFull` so we can assert what document the designer store hands it.
 *
 * `vi.hoisted` declares the spy in the same hoisted scope as `vi.mock`,
 * which is required because `vi.mock`'s factory runs before module-level
 * code in this file.
 */
const { renderFullSpy } = vi.hoisted(() => ({
  renderFullSpy: vi.fn(
    async (doc: LabelDocument): Promise<{ width: number; height: number; data: Uint8Array }> => ({
      width: doc.canvas.widthDots,
      height: doc.canvas.heightDots > 0 ? doc.canvas.heightDots : 1,
      data: new Uint8Array(0),
    }),
  ),
}));

vi.mock('@burnmark-io/designer-core', async () => {
  const actual = await vi.importActual<typeof DesignerCore>('@burnmark-io/designer-core');
  return { ...actual, renderFull: renderFullSpy };
});

import { useDesignerStore, isDocumentSelected, DOCUMENT_SELECTION_ID } from '../designer';

describe('designer store — orientation-aware render', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    renderFullSpy.mockClear();
  });

  it('renderToRGBA passes the canonical doc through for vertical orientation', async () => {
    const designer = useDesignerStore();
    designer.setCanvas({ widthDots: 100, heightDots: 50, dpi: 300, orientation: 'vertical' });
    await designer.renderToRGBA();

    const docArg = renderFullSpy.mock.calls.at(-1)?.[0] as LabelDocument;
    expect(docArg.canvas.widthDots).toBe(100);
    expect(docArg.canvas.heightDots).toBe(50);
    expect(docArg.canvas.orientation).toBe('vertical');
  });

  it('renderToRGBA swaps widthDots/heightDots for horizontal die-cut so the bitmap matches the design view', async () => {
    const designer = useDesignerStore();
    designer.setCanvas({ widthDots: 100, heightDots: 50, dpi: 300, orientation: 'horizontal' });
    await designer.renderToRGBA();

    const docArg = renderFullSpy.mock.calls.at(-1)?.[0] as LabelDocument;
    expect(docArg.canvas.widthDots).toBe(50);
    expect(docArg.canvas.heightDots).toBe(100);
    // Orientation reset on the clone so downstream code doesn't double-rotate.
    expect(docArg.canvas.orientation).toBe('vertical');
  });

  it('renderToRGBA renders horizontal-continuous as die-cut (long axis × short axis) so designs do not get clipped to a tiny strip', async () => {
    const designer = useDesignerStore();
    // 100 dots @ 300dpi ≈ 8.467 mm; 4:3 default continuous length ≈ 11 mm → 130 dots.
    designer.setCanvas({ widthDots: 100, heightDots: 0, dpi: 300, orientation: 'horizontal' });
    await designer.renderToRGBA();

    const docArg = renderFullSpy.mock.calls.at(-1)?.[0] as LabelDocument;
    expect(docArg.canvas.widthDots).toBe(130);
    expect(docArg.canvas.heightDots).toBe(100);
    expect(docArg.canvas.orientation).toBe('vertical');
  });

  it('renderToRGBA respects the user-set continuous length when present', async () => {
    const designer = useDesignerStore();
    designer.setCanvas({ widthDots: 100, heightDots: 0, dpi: 300, orientation: 'horizontal' });
    designer.setDocumentMetadata({ canvasContinuousLengthMm: 80 });
    await designer.renderToRGBA();

    const docArg = renderFullSpy.mock.calls.at(-1)?.[0] as LabelDocument;
    // 80 mm @ 300dpi = 945 dots.
    expect(docArg.canvas.widthDots).toBe(945);
    expect(docArg.canvas.heightDots).toBe(100);
  });

  it('toggling orientation does not mutate the document widthDots/heightDots', async () => {
    const designer = useDesignerStore();
    designer.setCanvas({ widthDots: 100, heightDots: 50, dpi: 300 });
    expect(designer.designer.document.canvas.orientation).toBe('vertical');

    designer.setOrientation('horizontal');
    expect(designer.designer.document.canvas.widthDots).toBe(100);
    expect(designer.designer.document.canvas.heightDots).toBe(50);
    expect(designer.designer.document.canvas.orientation).toBe('horizontal');
  });
});

describe('designer store — selection model with document sentinel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('isDocumentSelected returns true only for the lone sentinel', () => {
    expect(isDocumentSelected([DOCUMENT_SELECTION_ID])).toBe(true);
    expect(isDocumentSelected([])).toBe(false);
    expect(isDocumentSelected(['some-object-id'])).toBe(false);
    expect(isDocumentSelected([DOCUMENT_SELECTION_ID, 'some-object-id'])).toBe(false);
  });

  it('select() drops the sentinel when combined with regular object ids (last action wins)', () => {
    const designer = useDesignerStore();
    designer.select([DOCUMENT_SELECTION_ID, 'obj-a']);
    expect(designer.selection).toEqual(['obj-a']);
  });

  it('select([sentinel]) sets pure document selection', () => {
    const designer = useDesignerStore();
    designer.select(['obj-a']);
    designer.select([DOCUMENT_SELECTION_ID]);
    expect(designer.selection).toEqual([DOCUMENT_SELECTION_ID]);
    expect(isDocumentSelected(designer.selection)).toBe(true);
  });

  it('selectedObjectIds filters out the sentinel', () => {
    const designer = useDesignerStore();
    designer.select([DOCUMENT_SELECTION_ID]);
    expect(designer.selectedObjectIds).toEqual([]);

    designer.select(['obj-a', 'obj-b']);
    expect(designer.selectedObjectIds).toEqual(['obj-a', 'obj-b']);
  });

  it('setDocumentInfo patches name and description in place', () => {
    const designer = useDesignerStore();
    designer.setDocumentInfo({ name: 'My label', description: 'A test description' });
    expect(designer.document.name).toBe('My label');
    expect(designer.document.description).toBe('A test description');
  });

  it('setDocumentInfo bumps updatedAt', async () => {
    const designer = useDesignerStore();
    const before = designer.document.updatedAt;
    await new Promise(r => setTimeout(r, 5));
    designer.setDocumentInfo({ name: 'New name' });
    expect(designer.document.updatedAt).not.toBe(before);
  });
});

describe('designer store — auto-naming on addObject', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function addText(designer: ReturnType<typeof useDesignerStore>, name?: string): string {
    return designer.addObject({
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      content: 'Hello',
      fontFamily: 'Arial',
      fontSize: 16,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      color: '#000',
      letterSpacing: 0,
      lineHeight: 1.2,
      invert: false,
      wrap: false,
      autoHeight: false,
      ...(name !== undefined ? { name } : {}),
    } as never);
  }

  function nameOf(designer: ReturnType<typeof useDesignerStore>, id: string): string | undefined {
    return designer.document.objects.find(o => o.id === id)?.name;
  }

  it('auto-names sequential text adds Text 1 / Text 2 / Text 3', () => {
    const designer = useDesignerStore();
    const id1 = addText(designer);
    const id2 = addText(designer);
    const id3 = addText(designer);
    expect(nameOf(designer, id1)).toBe('Text 1');
    expect(nameOf(designer, id2)).toBe('Text 2');
    expect(nameOf(designer, id3)).toBe('Text 3');
  });

  it('rename then add → next text uses max+1 (Text 4 after renaming Text 2)', () => {
    const designer = useDesignerStore();
    const id1 = addText(designer);
    const id2 = addText(designer);
    const id3 = addText(designer);
    designer.updateObject(id2, { name: 'Greeting' });
    const id4 = addText(designer);
    expect(nameOf(designer, id1)).toBe('Text 1');
    expect(nameOf(designer, id2)).toBe('Greeting');
    expect(nameOf(designer, id3)).toBe('Text 3');
    expect(nameOf(designer, id4)).toBe('Text 4');
  });

  it('reuses freed numbers after deletion of the highest-numbered object', () => {
    const designer = useDesignerStore();
    const id1 = addText(designer);
    const id2 = addText(designer);
    designer.removeObject(id2);
    const id3 = addText(designer);
    expect(nameOf(designer, id1)).toBe('Text 1');
    // id2 is gone — pool is {Text 1}, max+1 = 2
    expect(nameOf(designer, id3)).toBe('Text 2');
  });

  it('does not override an explicitly provided name', () => {
    const designer = useDesignerStore();
    const id = addText(designer, 'Greeting');
    expect(nameOf(designer, id)).toBe('Greeting');
  });

  it('per-pool counters are independent (text vs rectangle)', () => {
    const designer = useDesignerStore();
    const t1 = addText(designer);
    const r1 = designer.addObject({
      type: 'shape',
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fill: true,
      strokeWidth: 1,
      color: '#000',
      invert: false,
    } as never);
    const t2 = addText(designer);
    expect(nameOf(designer, t1)).toBe('Text 1');
    expect(nameOf(designer, r1)).toBe('Rectangle 1');
    expect(nameOf(designer, t2)).toBe('Text 2');
  });
});

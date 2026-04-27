import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { LabelDocument } from '@burnmark-io/designer-core';

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
  const actual =
    await vi.importActual<typeof import('@burnmark-io/designer-core')>(
      '@burnmark-io/designer-core',
    );
  return { ...actual, renderFull: renderFullSpy };
});

import { useDesignerStore } from '../designer';

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

  it('renderToRGBA leaves continuous canvases on canonical (horizontal continuous is parked)', async () => {
    const designer = useDesignerStore();
    designer.setCanvas({ widthDots: 100, heightDots: 0, dpi: 300, orientation: 'horizontal' });
    await designer.renderToRGBA();

    const docArg = renderFullSpy.mock.calls.at(-1)?.[0] as LabelDocument;
    expect(docArg.canvas.widthDots).toBe(100);
    expect(docArg.canvas.heightDots).toBe(0);
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

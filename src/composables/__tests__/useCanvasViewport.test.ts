import { effectScope } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useDesignerStore } from '@/stores/designer';
import { useMediaStore } from '@/stores/media';
import { useCanvasViewport } from '../useCanvasViewport';

/**
 * The composable uses `onScopeDispose` for the resize observer; run it
 * inside an `effectScope` so cleanup is well-defined even when no
 * component is mounted.
 */
function withScope<T>(fn: () => T): { result: T; dispose: () => void } {
  const scope = effectScope();
  const result = scope.run(fn)!;
  return { result, dispose: () => scope.stop() };
}

describe('useCanvasViewport', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('returns canonical canvas dims for vertical orientation', () => {
    const designer = useDesignerStore();
    designer.setCanvas({ widthDots: 600, heightDots: 300, dpi: 300, orientation: 'vertical' });

    const { result, dispose } = withScope(() => useCanvasViewport());
    expect(result.labelWidthDots.value).toBe(600);
    expect(result.labelHeightDots.value).toBe(300);
    dispose();
  });

  it('swaps labelWidthDots / labelHeightDots when orientation flips to horizontal', () => {
    const designer = useDesignerStore();
    designer.setCanvas({ widthDots: 600, heightDots: 300, dpi: 300, orientation: 'vertical' });
    const media = useMediaStore();

    const { result, dispose } = withScope(() => useCanvasViewport());
    expect(result.labelWidthDots.value).toBe(600);
    expect(result.labelHeightDots.value).toBe(300);

    media.setOrientation('horizontal');
    expect(result.labelWidthDots.value).toBe(300);
    expect(result.labelHeightDots.value).toBe(600);
    dispose();
  });

  it('continuous: uses media.continuousLengthMm for the growth axis on both orientations', () => {
    const designer = useDesignerStore();
    // 62mm at 300dpi → 732 dots wide; heightDots 0 → continuous.
    designer.setCanvas({ widthDots: 732, heightDots: 0, dpi: 300, orientation: 'vertical' });
    const media = useMediaStore();

    const { result, dispose } = withScope(() => useCanvasViewport());
    // Continuous defaults to 4:3 of media-width-mm; ~62 * 4/3 = 83 mm at 300dpi ≈ 980 dots.
    const verticalGrowth = result.labelHeightDots.value;
    expect(verticalGrowth).toBeGreaterThan(0);
    // Across-feed dim is the canonical widthDots.
    expect(result.labelWidthDots.value).toBe(732);

    media.setOrientation('horizontal');
    expect(result.labelWidthDots.value).toBe(verticalGrowth);
    expect(result.labelHeightDots.value).toBe(732);
    dispose();
  });
});

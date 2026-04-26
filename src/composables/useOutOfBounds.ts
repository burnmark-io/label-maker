import { computed, type ComputedRef } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import { useCanvasViewport } from '@/composables/useCanvasViewport';

/**
 * Per `amendment-canvas-sizing.md` §7 — detect objects that fall outside
 * the current canvas. The editor allows them (don't fight the user) but
 * surfaces ⚠️ in the objects panel and a toast on canvas-resize-induced
 * misses.
 *
 * Bounds compared in dot-space against the *visible* canvas — for
 * continuous labels that's `viewport.labelHeightDots` (the user's manual
 * length), not the document's `heightDots: 0`.
 */
export interface OutOfBoundsState {
  /** Set of object ids that are partially or fully out of bounds. */
  outIds: ComputedRef<Set<string>>;
  /** Subset of `outIds` that have NO portion inside the canvas. */
  fullyOutIds: ComputedRef<Set<string>>;
  /** Convenience predicate. */
  isOut: (id: string) => boolean;
  isFullyOut: (id: string) => boolean;
}

export function useOutOfBounds(): OutOfBoundsState {
  const designer = useDesignerStore();
  const viewport = useCanvasViewport();

  const outIds = computed(() => {
    const w = viewport.labelWidthDots.value;
    const h = viewport.labelHeightDots.value;
    const set = new Set<string>();
    for (const o of designer.document.objects) {
      if (!o.visible) continue;
      // Partial overlap = bounds NOT fully contained.
      const left = o.x;
      const top = o.y;
      const right = o.x + o.width;
      const bottom = o.y + o.height;
      if (left < 0 || top < 0 || right > w || bottom > h) {
        set.add(o.id);
      }
    }
    return set;
  });

  const fullyOutIds = computed(() => {
    const w = viewport.labelWidthDots.value;
    const h = viewport.labelHeightDots.value;
    const set = new Set<string>();
    for (const o of designer.document.objects) {
      if (!o.visible) continue;
      const left = o.x;
      const top = o.y;
      const right = o.x + o.width;
      const bottom = o.y + o.height;
      // Fully out = no overlap.
      if (right <= 0 || bottom <= 0 || left >= w || top >= h) {
        set.add(o.id);
      }
    }
    return set;
  });

  return {
    outIds,
    fullyOutIds,
    isOut: id => outIds.value.has(id),
    isFullyOut: id => fullyOutIds.value.has(id),
  };
}

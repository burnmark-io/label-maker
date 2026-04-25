import { watch } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import { refreshBorder } from '@/lib/shapes/insert';

/**
 * Watch label canvas dimensions and re-rasterise any active border so
 * the frame keeps tracking the label edges. Call once at app mount.
 *
 * Continuous labels (heightDots === 0) leave the border unchanged until
 * a definite height is set — there's no meaningful frame for an
 * arbitrary-length tape.
 */
export function useBorderResize(): void {
  const designer = useDesignerStore();

  watch(
    () => [designer.document.canvas.widthDots, designer.document.canvas.heightDots] as const,
    ([w, h], [prevW, prevH]) => {
      if (w === prevW && h === prevH) return;
      if (w <= 0 || h <= 0) return;
      void refreshBorder(designer, w, h);
    },
  );
}

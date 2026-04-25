import { computed, ref, watch, type Ref } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import { useDesignerStore } from '@/stores/designer';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.15;
/** Padding around the label in viewport pixels at any zoom. */
const VIEWPORT_PADDING = 48;
/** Continuous-label fallback height (used while there is no content). */
const CONTINUOUS_MIN_HEIGHT_DOTS = 240;
/** Extra dots below the lowest object on continuous labels. */
const CONTINUOUS_TAIL_DOTS = 80;

export interface ViewportState {
  /** Container size in CSS px (the available canvas area). */
  width: Ref<number>;
  height: Ref<number>;
  /** Effective label dimensions in dots — heightDots for die-cut, computed for continuous. */
  labelWidthDots: Ref<number>;
  labelHeightDots: Ref<number>;
  /** Whether the label is continuous (heightDots === 0 in the document). */
  isContinuous: Ref<boolean>;
  /** Current zoom factor (1.0 = 1 dot per CSS px). */
  zoom: Ref<number>;
  /** Stage offset that centres the label inside the viewport. */
  offsetX: Ref<number>;
  offsetY: Ref<number>;
  /** Default zoom that fits the label nicely in the viewport. */
  fitZoom: Ref<number>;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (factor: number) => void;
  resetZoom: () => void;
  /** Bind to the canvas container element so the viewport tracks its size. */
  bindContainer: (el: HTMLElement | null) => void;
}

export function useCanvasViewport(): ViewportState {
  const designer = useDesignerStore();

  const width = ref(800);
  const height = ref(600);

  const labelWidthDots = computed(() => designer.document.canvas.widthDots);

  const isContinuous = computed(() => designer.document.canvas.heightDots === 0);

  const labelHeightDots = computed(() => {
    if (!isContinuous.value) return designer.document.canvas.heightDots;
    let lowest = 0;
    for (const o of designer.document.objects) {
      if (!o.visible) continue;
      const bottom = o.y + o.height;
      if (bottom > lowest) lowest = bottom;
    }
    return Math.max(CONTINUOUS_MIN_HEIGHT_DOTS, Math.ceil(lowest) + CONTINUOUS_TAIL_DOTS);
  });

  const fitZoom = computed(() => {
    const availW = Math.max(0, width.value - VIEWPORT_PADDING * 2);
    const availH = Math.max(0, height.value - VIEWPORT_PADDING * 2);
    const zw = labelWidthDots.value > 0 ? availW / labelWidthDots.value : 1;
    const zh = labelHeightDots.value > 0 ? availH / labelHeightDots.value : 1;
    const fit = Math.min(zw, zh);
    if (!Number.isFinite(fit) || fit <= 0) return 1;
    return clamp(fit, MIN_ZOOM, MAX_ZOOM);
  });

  const zoom = ref(fitZoom.value);
  let userTouchedZoom = false;

  watch(fitZoom, (next) => {
    if (!userTouchedZoom) zoom.value = next;
  });

  watch(labelWidthDots, () => {
    userTouchedZoom = false;
    zoom.value = fitZoom.value;
  });

  const offsetX = computed(() => Math.round((width.value - labelWidthDots.value * zoom.value) / 2));
  const offsetY = computed(() =>
    Math.round((height.value - labelHeightDots.value * zoom.value) / 2),
  );

  function bindContainer(el: HTMLElement | null): void {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    width.value = rect.width;
    height.value = rect.height;
    useResizeObserver(el, (entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentRect;
      width.value = box.width;
      height.value = box.height;
    });
  }

  function zoomTo(factor: number): void {
    userTouchedZoom = true;
    zoom.value = clamp(factor, MIN_ZOOM, MAX_ZOOM);
  }

  return {
    width,
    height,
    labelWidthDots,
    labelHeightDots,
    isContinuous,
    zoom,
    offsetX,
    offsetY,
    fitZoom,
    zoomIn: () => zoomTo(zoom.value * ZOOM_STEP),
    zoomOut: () => zoomTo(zoom.value / ZOOM_STEP),
    zoomTo,
    resetZoom: () => {
      userTouchedZoom = false;
      zoom.value = fitZoom.value;
    },
    bindContainer,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

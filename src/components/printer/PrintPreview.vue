<template>
  <div class="preview">
    <header class="preview__header">
      <h3 class="preview__title">{{ t('preview.title') }}</h3>
      <button
        v-if="printer.isConnected"
        class="preview__refresh"
        type="button"
        :aria-label="t('preview.refresh')"
        :disabled="rendering"
        @click="refreshNow"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
          <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
        </svg>
      </button>
    </header>

    <p v-if="!printer.isConnected" class="preview__empty">{{ t('preview.notConnected') }}</p>

    <template v-else>
      <p v-if="!preview && rendering" class="preview__empty">{{ t('preview.rendering') }}</p>
      <p v-else-if="!preview" class="preview__empty">{{ t('preview.noPreview') }}</p>

      <template v-else>
        <p v-if="preview.assumed" class="preview__banner" role="status">
          {{ t('preview.assumedBanner', { media: preview.media.name }) }}
        </p>
        <p v-else class="preview__media">
          {{ t('preview.media', { media: preview.media.name }) }}
        </p>

        <div class="preview__canvas-wrap">
          <canvas ref="canvasRef" class="preview__canvas" />
        </div>

        <ul v-if="preview.planes.length > 1" class="preview__legend">
          <li v-for="plane in preview.planes" :key="plane.name">
            <span class="preview__swatch" :style="{ background: plane.displayColor }" />
            {{ plane.name }}
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePrinterStore } from '@/stores/printer';
import { useDesignerStore } from '@/stores/designer';
import { bitmapToRgba } from '@/lib/printer/preview';

const { t } = useI18n();
const printer = usePrinterStore();
const designer = useDesignerStore();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const rendering = ref(false);
const preview = computed(() => printer.lastPreview);

let renderToken = 0;
let scheduled: number | null = null;

async function refreshNow(): Promise<void> {
  if (!printer.isConnected) return;
  const myToken = ++renderToken;
  rendering.value = true;
  try {
    const image = await designer.renderToRGBA();
    if (myToken !== renderToken) return;
    const imageForDriver = {
      width: image.width,
      height: image.height,
      data: new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength),
    };
    await printer.refreshPreview(imageForDriver);
  } finally {
    if (renderToken === myToken) rendering.value = false;
  }
}

function scheduleRefresh(): void {
  if (scheduled !== null) return;
  scheduled = window.setTimeout(() => {
    scheduled = null;
    void refreshNow();
  }, 200);
}

function paint(): void {
  const canvas = canvasRef.value;
  const result = preview.value;
  if (!canvas || !result || result.planes.length === 0) return;

  const first = result.planes[0]!;
  canvas.width = first.bitmap.widthPx;
  canvas.height = first.bitmap.heightPx;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Paint the page white before compositing planes so the preview reads
  // as ink on paper.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const plane of result.planes) {
    const rgba = bitmapToRgba(plane.bitmap, plane.displayColor);
    const imageData = new ImageData(rgba.data, rgba.width, rgba.height);
    // Composite by drawing through an offscreen canvas — putImageData
    // overwrites alpha, which would erase earlier planes.
    const off = document.createElement('canvas');
    off.width = imageData.width;
    off.height = imageData.height;
    off.getContext('2d')?.putImageData(imageData, 0, 0);
    ctx.drawImage(off, 0, 0);
  }
}

watch(preview, () => {
  // Painting must happen after the canvas element has dimensions
  // updated by the v-if/template.
  void Promise.resolve().then(paint);
});

watch(
  () => [
    printer.isConnected,
    printer.effectiveMedia,
    designer.document,
  ] as const,
  () => {
    if (printer.isConnected) scheduleRefresh();
  },
  { deep: true },
);

onMounted(() => {
  if (printer.isConnected) scheduleRefresh();
});

onBeforeUnmount(() => {
  if (scheduled !== null) {
    window.clearTimeout(scheduled);
    scheduled = null;
  }
});
</script>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview__title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.preview__refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid transparent;
}

.preview__refresh:hover:not(:disabled) {
  background: var(--color-bg-canvas);
  border-color: var(--color-border);
  color: var(--color-text);
}

.preview__refresh:disabled {
  opacity: 0.5;
  cursor: progress;
}

.preview__empty {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.preview__banner {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  border-radius: var(--radius-md);
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: var(--color-text);
}

.preview__media {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.preview__canvas-wrap {
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: auto;
}

.preview__canvas {
  max-width: 100%;
  height: auto;
  image-rendering: pixelated;
  background: white;
}

.preview__legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.preview__legend li {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  text-transform: capitalize;
}

.preview__swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid var(--color-border);
}
</style>

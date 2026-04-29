<template>
  <section class="output-preview">
    <header v-if="printer.isConnected" class="output-preview__header">
      <button
        class="output-preview__refresh"
        type="button"
        :aria-label="t('preview.refresh')"
        :disabled="rendering"
        @click="refreshNow"
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
          <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
        </svg>
      </button>
    </header>

    <template v-if="printer.isConnected">
      <p v-if="!preview && rendering" class="output-preview__empty">{{ t('preview.rendering') }}</p>
      <p v-else-if="!preview" class="output-preview__empty">{{ t('preview.noPreview') }}</p>
      <template v-else>
        <p v-if="preview.assumed" class="output-preview__banner" role="status">
          {{ t('preview.assumedBanner', { media: preview.media.name }) }}
        </p>
        <p v-else class="output-preview__media">
          {{ t('preview.media', { media: preview.media.name }) }}
        </p>
        <div class="output-preview__canvas-wrap">
          <canvas ref="canvasRef" class="output-preview__canvas" />
        </div>
        <ul v-if="preview.planes.length > 1" class="output-preview__legend">
          <li v-for="plane in preview.planes" :key="plane.name">
            <span class="output-preview__swatch" :style="{ background: plane.displayColor }" />
            {{ plane.name }}
          </li>
        </ul>
      </template>
    </template>

    <template v-else>
      <div class="output-preview__canvas-wrap">
        <canvas ref="canvasRef" class="output-preview__canvas" />
      </div>
      <p class="output-preview__footnote">{{ t('output.previewFootnote.disconnected') }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePrinterStore } from '@/stores/printer';
import { useDesignerStore } from '@/stores/designer';
import { useDataStore } from '@/stores/data';
import { bitmapToRgba } from '@/lib/printer/preview';
import type { RawImageData } from '@burnmark-io/designer-core';

const { t } = useI18n();
const printer = usePrinterStore();
const designer = useDesignerStore();
const data = useDataStore();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const rendering = ref(false);
const preview = computed(() => printer.lastPreview);
const genericRender = shallowRef<RawImageData | null>(null);

let renderToken = 0;
let scheduled: number | null = null;

function variablesIfAny(): Record<string, string> | undefined {
  const variables = data.currentVariables;
  return Object.keys(variables).length > 0 ? variables : undefined;
}

async function refreshNow(): Promise<void> {
  const myToken = ++renderToken;
  rendering.value = true;
  try {
    const image = await designer.renderToRGBA(variablesIfAny());
    if (myToken !== renderToken) return;
    if (printer.isConnected) {
      const imageForDriver = {
        width: image.width,
        height: image.height,
        data: new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength),
      };
      await printer.refreshPreview(imageForDriver);
      genericRender.value = null;
    } else {
      genericRender.value = image;
    }
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

function paintConnected(): void {
  const canvas = canvasRef.value;
  const result = preview.value;
  if (!canvas || !result || result.planes.length === 0) return;

  const first = result.planes[0]!;
  canvas.width = first.bitmap.widthPx;
  canvas.height = first.bitmap.heightPx;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const plane of result.planes) {
    const rgba = bitmapToRgba(plane.bitmap, plane.displayColor);
    const imageData = new ImageData(rgba.data, rgba.width, rgba.height);
    const off = document.createElement('canvas');
    off.width = imageData.width;
    off.height = imageData.height;
    off.getContext('2d')?.putImageData(imageData, 0, 0);
    ctx.drawImage(off, 0, 0);
  }
}

function paintDisconnected(): void {
  const canvas = canvasRef.value;
  const image = genericRender.value;
  if (!canvas || !image) return;

  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const imageData = new ImageData(
    new Uint8ClampedArray(image.data.buffer, image.data.byteOffset, image.data.byteLength),
    image.width,
    image.height,
  );
  ctx.putImageData(imageData, 0, 0);
}

watch(preview, () => {
  void Promise.resolve().then(paintConnected);
});

watch(genericRender, () => {
  void Promise.resolve().then(paintDisconnected);
});

// Lazy-render triggers (§3.1):
// - tab active (handled by mount, since SidePanel uses v-if)
// - document changes while tab active
// - currentIndex changes while tab active
// - connection state changes
watch(
  () =>
    [printer.isConnected, printer.effectiveMedia, designer.document, data.currentIndex] as const,
  () => scheduleRefresh(),
  { deep: true },
);

onMounted(() => scheduleRefresh());

onBeforeUnmount(() => {
  if (scheduled !== null) {
    window.clearTimeout(scheduled);
    scheduled = null;
  }
});
</script>

<style scoped>
.output-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.output-preview__header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.output-preview__refresh {
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

.output-preview__refresh:hover:not(:disabled) {
  background: var(--color-bg-canvas);
  border-color: var(--color-border);
  color: var(--color-text);
}

.output-preview__refresh:disabled {
  opacity: 0.5;
  cursor: progress;
}

.output-preview__empty,
.output-preview__footnote {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.output-preview__banner {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  border-radius: var(--radius-md);
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: var(--color-text);
}

.output-preview__media {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.output-preview__canvas-wrap {
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: auto;
}

.output-preview__canvas {
  max-width: 100%;
  height: auto;
  image-rendering: pixelated;
  background: white;
}

.output-preview__legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.output-preview__legend li {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  text-transform: capitalize;
}

.output-preview__swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid var(--color-border);
}
</style>

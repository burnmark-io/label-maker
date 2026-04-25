<template>
  <div class="toolbar" role="toolbar" :aria-label="t('toolbar.addText')">
    <IconButton :label="t('toolbar.addText')" @click="addText">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    </IconButton>

    <IconButton :label="t('toolbar.addImage')" @click="onPickImage">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    </IconButton>
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      style="display: none"
      @change="onImageSelected"
    />

    <IconButton :label="t('toolbar.addBarcode')" @click="addBarcode">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="4" width="18" height="16" rx="1" />
        <line x1="7" y1="8" x2="7" y2="16" />
        <line x1="10" y1="8" x2="10" y2="16" />
        <line x1="13" y1="8" x2="13" y2="16" />
        <line x1="16" y1="8" x2="16" y2="16" />
      </svg>
    </IconButton>

    <div class="toolbar__divider" aria-hidden="true" />

    <div class="toolbar__shape-slot">
      <IconButton
        :label="t('toolbar.shapeLibrary')"
        :data-shape-library-trigger="true"
        :aria-expanded="libraryOpen"
        @click="toggleLibrary"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        >
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <circle cx="17" cy="7" r="4" />
          <path d="M3 17l4-4 4 4-4 4z" />
          <path d="M14 14h7v7h-7z" />
        </svg>
      </IconButton>
      <ShapeLibrary v-if="libraryOpen" @close="libraryOpen = false" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TextObject, BarcodeObject, ImageObject } from '@burnmark-io/designer-core';
import { useDesignerStore } from '@/stores/designer';
import IconButton from '@/components/common/IconButton.vue';
import ShapeLibrary from './ShapeLibrary.vue';

const { t } = useI18n();
const designer = useDesignerStore();
const fileInputRef = ref<HTMLInputElement | null>(null);
const libraryOpen = ref(false);

function toggleLibrary(): void {
  libraryOpen.value = !libraryOpen.value;
}

function nextDropPoint(): { x: number; y: number } {
  // Drop new objects near the centre of the label, offset slightly so
  // successive adds don't pile on top of each other.
  const c = designer.document.canvas;
  const offset = (designer.document.objects.length % 5) * 12;
  return {
    x: Math.max(8, Math.round(c.widthDots / 2) - 100 + offset),
    y: Math.max(8, Math.round((c.heightDots || 240) / 2) - 30 + offset),
  };
}

function addText(): void {
  const { x, y } = nextDropPoint();
  const id = designer.addObject<TextObject>({
    type: 'text',
    x,
    y,
    width: 240,
    height: 60,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#1c1917',
    content: 'Your text',
    fontFamily: 'Inter',
    fontSize: 36,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    verticalAlign: 'top',
    letterSpacing: 0,
    lineHeight: 1.2,
    invert: false,
    wrap: true,
    autoHeight: true,
  });
  designer.select([id]);
}

function addBarcode(): void {
  const { x, y } = nextDropPoint();
  const id = designer.addObject<BarcodeObject>({
    type: 'barcode',
    x,
    y,
    width: 160,
    height: 160,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#1c1917',
    format: 'qrcode',
    data: 'https://burnmark.io',
    options: { eclevel: 'M', scale: 4 },
  });
  designer.select([id]);
}

function onPickImage(): void {
  fileInputRef.value?.click();
}

async function onImageSelected(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const key = await designer.assetLoader.storeFromBlob(file);
    const blob = await designer.assetLoader.loadAsBlob(key);
    const bitmap = await createImageBitmap(blob);
    const aspect = bitmap.height / bitmap.width;
    bitmap.close();
    const width = Math.min(designer.document.canvas.widthDots * 0.7, 400);
    const height = width * aspect;
    const { x, y } = nextDropPoint();
    const id = designer.addObject<ImageObject>({
      type: 'image',
      x,
      y,
      width,
      height,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      color: '#1c1917',
      assetKey: key,
      fit: 'contain',
      threshold: 128,
      dither: true,
      invert: false,
    });
    designer.select([id]);
  } finally {
    input.value = '';
  }
}
</script>

<style scoped>
.toolbar {
  position: absolute;
  top: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  z-index: 5;
}

.toolbar__divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
  margin: 0 var(--space-1);
}

.toolbar__shape-slot {
  position: relative;
  display: flex;
  align-items: center;
}
</style>

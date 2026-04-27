<template>
  <div ref="containerRef" class="canvas-container">
    <VStage
      ref="stageRef"
      :config="stageConfig"
      @click="onStageClick"
      @tap="onStageClick"
      @wheel="onWheel"
      @dblclick="onStageDoubleClick"
    >
      <VLayer>
        <PaperBackground
          :width="viewport.labelWidthDots.value"
          :height="viewport.labelHeightDots.value"
          :scale="viewport.zoom.value"
          :fill="document.canvas.background"
          :corner-radius-dots="cornerRadiusDots"
        />
        <GridOverlay
          v-if="prefs.showGrid"
          :width="viewport.labelWidthDots.value"
          :height="viewport.labelHeightDots.value"
          :spacing="document.canvas.grid.spacingDots"
          :scale="viewport.zoom.value"
        />
        <PaperDirection
          v-if="viewport.isContinuous.value"
          :width="viewport.labelWidthDots.value"
          :height="viewport.labelHeightDots.value"
          :scale="viewport.zoom.value"
          :dpi="document.canvas.dpi"
        />
      </VLayer>

      <VLayer ref="objectsLayerRef">
        <CanvasObject
          v-for="obj in document.objects"
          :key="obj.id"
          :object="obj"
          :selected="designer.selection.includes(obj.id)"
          :draggable="true"
          @select="event => onObjectSelect(obj.id, event)"
          @edit="onObjectEdit(obj.id)"
          @dragstart="onObjectDragStart(obj.id)"
          @dragmove="(x, y) => onObjectDragMove(obj.id, x, y)"
          @dragend="(x, y) => onObjectDragEnd(obj.id, x, y)"
          @transformend="patch => onObjectTransformEnd(obj.id, patch)"
        />
      </VLayer>

      <VLayer :config="{ listening: false }">
        <AlignmentGuides
          v-if="dragGuides.vertical.length || dragGuides.horizontal.length"
          :vertical="dragGuides.vertical"
          :horizontal="dragGuides.horizontal"
          :width="viewport.labelWidthDots.value"
          :height="viewport.labelHeightDots.value"
          :scale="viewport.zoom.value"
        />
        <CutLine
          v-if="viewport.isContinuous.value"
          :width="viewport.labelWidthDots.value"
          :height="viewport.labelHeightDots.value"
          :scale="viewport.zoom.value"
        />
      </VLayer>

      <VLayer>
        <ContinuousResizeHandle
          v-if="viewport.isContinuous.value"
          :width="viewport.labelWidthDots.value"
          :height="viewport.labelHeightDots.value"
          :scale="viewport.zoom.value"
        />
        <SelectionTransformer
          :selected-ids="visibleSelection"
          :stage="konvaStage"
          :inv-scale="1 / viewport.zoom.value"
        />
      </VLayer>
    </VStage>

    <InlineTextEditor
      v-if="editingText"
      :object="editingText"
      :scale="viewport.zoom.value"
      :offset-x="viewport.offsetX.value"
      :offset-y="viewport.offsetY.value"
      @update:content="onEditContent"
      @finish="finishEditing"
      @cancel="cancelEditing"
    />

    <div class="canvas-zoom" role="group" :aria-label="t('canvas.zoomControls')">
      <button
        type="button"
        class="canvas-zoom__btn"
        :aria-label="t('canvas.zoomOut')"
        :title="t('canvas.zoomOut')"
        @click="viewport.zoomOut()"
      >
        −
      </button>
      <button
        type="button"
        class="canvas-zoom__btn canvas-zoom__btn--label"
        :aria-label="t('canvas.fitZoom')"
        :title="t('canvas.fitZoom')"
        @click="viewport.resetZoom()"
      >
        {{ t('canvas.zoom', { percent: zoomPercent }) }}
      </button>
      <button
        type="button"
        class="canvas-zoom__btn"
        :aria-label="t('canvas.zoomIn')"
        :title="t('canvas.zoomIn')"
        @click="viewport.zoomIn()"
      >
        +
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { isTextObject, type LabelObject, type TextObject } from '@burnmark-io/designer-core';

import PaperBackground from './PaperBackground.vue';
import GridOverlay from './GridOverlay.vue';
import PaperDirection from './PaperDirection.vue';
import CutLine from './CutLine.vue';
import ContinuousResizeHandle from './ContinuousResizeHandle.vue';
import CanvasObject from './CanvasObject.vue';
import AlignmentGuides from './AlignmentGuides.vue';
import SelectionTransformer from './SelectionTransformer.vue';
import InlineTextEditor from './InlineTextEditor.vue';

import { findSheet } from '@burnmark-io/sheet-templates';

import { useDesignerStore } from '@/stores/designer';
import { useMediaStore, dotsFromMm } from '@/stores/media';
import { usePreferencesStore } from '@/stores/preferences';
import { useCanvasViewport } from '@/composables/useCanvasViewport';
import { computeSnap } from '@/composables/useSnapping';
import type { KonvaStage } from './konva-types';

const { t } = useI18n();
const designer = useDesignerStore();
const media = useMediaStore();
const prefs = usePreferencesStore();

/**
 * Per amendment §7.6 — when the canvas size came from a sticker sheet
 * with a declared `cornerRadiusMm`, draw it as a visual guide. No
 * fallback when the media descriptor doesn't expose the field.
 */
const cornerRadiusDots = computed<number | undefined>(() => {
  if (media.source !== 'sheet' || !media.sheetCode) return undefined;
  const sheet = findSheet(media.sheetCode);
  if (!sheet?.cornerRadiusMm) return undefined;
  return dotsFromMm(sheet.cornerRadiusMm, designer.document.canvas.dpi || 300);
});

const { document } = storeToRefs(designer);

const viewport = useCanvasViewport();
const containerRef = ref<HTMLElement | null>(null);

const stageRef = ref<{ getNode(): KonvaStage } | null>(null);
const konvaStage = ref<KonvaStage | null>(null);

const stageConfig = computed(() => ({
  width: viewport.width.value,
  height: viewport.height.value,
  x: viewport.offsetX.value,
  y: viewport.offsetY.value,
  scaleX: viewport.zoom.value,
  scaleY: viewport.zoom.value,
}));

const visibleSelection = computed(() =>
  designer.selection.filter(id => !editingTextId.value || id !== editingTextId.value),
);

const editingTextId = ref<string | null>(null);
const editingText = computed<TextObject | null>(() => {
  if (!editingTextId.value) return null;
  const found = document.value.objects.find(o => o.id === editingTextId.value);
  return found && isTextObject(found) ? found : null;
});

const dragGuides = ref<{ vertical: number[]; horizontal: number[] }>({
  vertical: [],
  horizontal: [],
});

onMounted(async () => {
  if (containerRef.value) viewport.bindContainer(containerRef.value);
  await nextTick();
  if (stageRef.value) konvaStage.value = stageRef.value.getNode();
});

onBeforeUnmount(() => {
  konvaStage.value = null;
});

const zoomPercent = computed(() => Math.round(viewport.zoom.value * 100));

function onStageClick(event: {
  target?: { name?: () => string };
  evt?: { shiftKey?: boolean };
}): void {
  // Click on empty area (the stage itself or paper rect) deselects.
  const target = event.target;
  if (!target) return;
  const name = typeof target.name === 'function' ? target.name() : '';
  if (name === 'object') return;
  designer.deselect();
  if (editingTextId.value) finishEditing();
}

function onStageDoubleClick(): void {
  // Double-click on empty area: reset zoom to fit.
  viewport.resetZoom();
}

function onWheel(event: { evt: WheelEvent }): void {
  const e = event.evt;
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? 1 / 1.1 : 1.1;
  viewport.zoomTo(viewport.zoom.value * delta);
}

function onObjectSelect(id: string, event: unknown): void {
  const native = (event as { evt?: MouseEvent }).evt;
  if (native?.shiftKey) {
    if (designer.selection.includes(id)) {
      designer.select(designer.selection.filter(x => x !== id));
    } else {
      designer.select([...designer.selection, id]);
    }
  } else {
    designer.select([id]);
  }
}

function onObjectEdit(id: string): void {
  const obj = document.value.objects.find(o => o.id === id);
  if (!obj || !isTextObject(obj)) return;
  designer.select([id]);
  editingTextId.value = id;
}

function onEditContent(content: string): void {
  if (!editingTextId.value) return;
  designer.updateObject(editingTextId.value, { content });
}

function finishEditing(): void {
  editingTextId.value = null;
}

function cancelEditing(): void {
  editingTextId.value = null;
}

let dragOriginalPositions = new Map<string, { x: number; y: number }>();

function onObjectDragStart(_id: string): void {
  dragOriginalPositions = new Map();
  for (const id of designer.selection) {
    const obj = document.value.objects.find(o => o.id === id);
    if (obj) dragOriginalPositions.set(id, { x: obj.x, y: obj.y });
  }
}

function onObjectDragMove(id: string, x: number, y: number): void {
  const obj = document.value.objects.find(o => o.id === id);
  if (!obj) return;
  const others = document.value.objects;
  const snap = computeSnap({
    draggingId: id,
    x,
    y,
    width: obj.width,
    height: obj.height,
    others,
    labelWidth: viewport.labelWidthDots.value,
    labelHeight: viewport.labelHeightDots.value,
    threshold: 4 / viewport.zoom.value + 2,
    gridSpacing: prefs.snapToGrid ? document.value.canvas.grid.spacingDots : 0,
  });
  dragGuides.value = snap.guides;
  designer.updateObject(id, { x: snap.x, y: snap.y });
}

function onObjectDragEnd(id: string, x: number, y: number): void {
  dragGuides.value = { vertical: [], horizontal: [] };
  const obj = document.value.objects.find(o => o.id === id);
  if (!obj) return;
  const snap = computeSnap({
    draggingId: id,
    x,
    y,
    width: obj.width,
    height: obj.height,
    others: document.value.objects,
    labelWidth: viewport.labelWidthDots.value,
    labelHeight: viewport.labelHeightDots.value,
    threshold: 4 / viewport.zoom.value + 2,
    gridSpacing: prefs.snapToGrid ? document.value.canvas.grid.spacingDots : 0,
  });
  designer.updateObject(id, { x: snap.x, y: snap.y });
}

function onObjectTransformEnd(
  id: string,
  patch: { x: number; y: number; width: number; height: number; rotation: number },
): void {
  const updates: Partial<LabelObject> = {
    x: patch.x,
    y: patch.y,
    width: patch.width,
    height: patch.height,
    rotation: patch.rotation,
  };
  designer.updateObject(id, updates);
}

watch(
  () => designer.selection.join(','),
  () => {
    if (editingTextId.value && !designer.selection.includes(editingTextId.value)) {
      finishEditing();
    }
  },
);
</script>

<style scoped>
.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.canvas-zoom {
  position: absolute;
  bottom: var(--space-3);
  right: var(--space-3);
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.canvas-zoom__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 var(--space-2);
  background: transparent;
  border: none;
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing);
}

.canvas-zoom__btn:hover {
  background: var(--color-bg-canvas);
}

.canvas-zoom__btn--label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--weight-regular);
  color: var(--color-text-muted);
  min-width: 56px;
}
</style>

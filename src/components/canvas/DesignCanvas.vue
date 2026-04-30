<template>
  <div ref="containerRef" class="canvas-container">
    <VStage
      ref="stageRef"
      :config="stageConfig"
      @click="onStageClick"
      @tap="onStageClick"
      @wheel="onWheel"
      @dblclick="onStageDoubleClick"
      @pointerdown="onStagePointerDown"
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

      <!-- Marquee rubber-band layer — above objects, below transformer -->
      <VLayer :config="{ listening: false }">
        <VRect v-if="marquee.active" :config="marqueeRectConfig" />
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
          :selected-objects="visibleSelectionObjects"
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
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { isTextObject, type LabelObject, type TextObject } from '@burnmark-io/designer-core';

import PaperBackground from './PaperBackground.vue';
import GridOverlay from './GridOverlay.vue';
import PaperDirection from './PaperDirection.vue';
import CutLine from './CutLine.vue';
import ContinuousResizeHandle from './ContinuousResizeHandle.vue';
import CanvasObject, { type TransformEndPatch } from './CanvasObject.vue';
import AlignmentGuides from './AlignmentGuides.vue';
import SelectionTransformer from './SelectionTransformer.vue';
import InlineTextEditor from './InlineTextEditor.vue';

import { findSheet } from '@burnmark-io/sheet-templates';

import { useDesignerStore } from '@/stores/designer';
import { useMediaStore, dotsFromMm } from '@/stores/media';
import { usePreferencesStore } from '@/stores/preferences';
import { CANVAS_VIEWPORT_KEY, type ViewportState } from '@/composables/useCanvasViewport';
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

const viewport = inject<ViewportState>(CANVAS_VIEWPORT_KEY)!;
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

const visibleSelectionObjects = computed<LabelObject[]>(() =>
  document.value.objects.filter(o => visibleSelection.value.includes(o.id)),
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

/**
 * Pinch-to-zoom — captured on the container while two fingers are
 * down. Konva's own touch handling drives single-finger drags; we
 * only intercept multi-touch. Distance ratio drives `zoomTo`, which
 * keeps the label centred via the viewport's offset math.
 */
let pinchStartDistance = 0;
let pinchStartZoom = 1;

function pinchDistance(touches: TouchList): number {
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

function onTouchStart(e: TouchEvent): void {
  if (e.touches.length === 2) {
    pinchStartDistance = pinchDistance(e.touches);
    pinchStartZoom = viewport.zoom.value;
    e.preventDefault();
  }
}

function onTouchMove(e: TouchEvent): void {
  if (e.touches.length === 2 && pinchStartDistance > 0) {
    const dist = pinchDistance(e.touches);
    if (dist > 0) viewport.zoomTo((pinchStartZoom * dist) / pinchStartDistance);
    e.preventDefault();
  }
}

function onTouchEnd(e: TouchEvent): void {
  if (e.touches.length < 2) pinchStartDistance = 0;
}

onMounted(async () => {
  if (containerRef.value) {
    viewport.bindContainer(containerRef.value);
    containerRef.value.addEventListener('touchstart', onTouchStart, { passive: false });
    containerRef.value.addEventListener('touchmove', onTouchMove, { passive: false });
    containerRef.value.addEventListener('touchend', onTouchEnd);
    containerRef.value.addEventListener('touchcancel', onTouchEnd);
  }
  await nextTick();
  if (stageRef.value) konvaStage.value = stageRef.value.getNode();
});

onBeforeUnmount(() => {
  if (containerRef.value) {
    containerRef.value.removeEventListener('touchstart', onTouchStart);
    containerRef.value.removeEventListener('touchmove', onTouchMove);
    containerRef.value.removeEventListener('touchend', onTouchEnd);
    containerRef.value.removeEventListener('touchcancel', onTouchEnd);
  }
  // Clean up marquee window listeners in case a drag was in progress.
  window.removeEventListener('pointermove', onMarqueeMove);
  window.removeEventListener('pointerup', onMarqueeUp);
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
  // If the pointer just completed a marquee drag, the pointerup handler
  // already set the selection — skip the deselect here.
  if (marquee.value.dragging) return;
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
  // A click that completes a marquee drag must not override the marquee's
  // selection — the post-pointerup @click on the same object would otherwise
  // collapse the multi-selection back to a single id.
  if (marquee.value.dragging) return;
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

// ---------------------------------------------------------------------------
// Marquee (rubber-band) select
// ---------------------------------------------------------------------------

/** Threshold in canvas dots before the drag becomes a marquee. */
const MARQUEE_THRESHOLD = 3;

interface MarqueeState {
  /** Whether the marquee rect is currently visible. */
  active: boolean;
  /**
   * Whether we received a pointerdown on empty canvas and are tracking
   * pointer movement (may or may not have crossed the threshold yet).
   */
  tracking: boolean;
  /** Start point in canvas-dot coordinates. */
  startX: number;
  startY: number;
  /** Current pointer position in canvas-dot coordinates. */
  endX: number;
  endY: number;
  /** Whether Shift was held at pointerdown. */
  shiftHeld: boolean;
  /**
   * Whether we've crossed the 3-dot threshold and a marquee rect is
   * in progress. Kept true until after the @click event fires so that
   * the click handler can skip its deselect logic.
   */
  dragging: boolean;
}

const marquee = ref<MarqueeState>({
  active: false,
  tracking: false,
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
  shiftHeld: false,
  dragging: false,
});

const marqueeRectConfig = computed(() => {
  const m = marquee.value;
  const x = Math.min(m.startX, m.endX);
  const y = Math.min(m.startY, m.endY);
  const w = Math.abs(m.endX - m.startX);
  const h = Math.abs(m.endY - m.startY);
  const strokeWidth = 1.5 / viewport.zoom.value;
  return {
    x,
    y,
    width: w,
    height: h,
    stroke: '#f59e0b',
    strokeWidth,
    fill: '#f59e0b22',
    dash: [4 / viewport.zoom.value, 3 / viewport.zoom.value],
    listening: false,
  };
});

/** Convert a stage-container pixel position to canvas-dot coordinates. */
function pointerToDot(px: number, py: number): { x: number; y: number } {
  return {
    x: (px - viewport.offsetX.value) / viewport.zoom.value,
    y: (py - viewport.offsetY.value) / viewport.zoom.value,
  };
}

/** Convert a native PointerEvent's client position to canvas-dot coordinates. */
function nativeEventToDot(e: PointerEvent): { x: number; y: number } | null {
  const container = containerRef.value;
  if (!container) return null;
  const rect = container.getBoundingClientRect();
  return pointerToDot(e.clientX - rect.left, e.clientY - rect.top);
}

/**
 * True when the pointer-down target is an already-selected object — in
 * that case Konva owns the gesture (drag the selection). For unselected
 * objects we want the marquee to start instead, so the user can rubber-
 * band through transparent fills and z-depth without accidentally grabbing
 * whichever shape Konva's hit-test happened to top-pick.
 */
function isOnSelectedObject(event: {
  target?: { name?: () => string; id?: () => string };
}): boolean {
  const target = event.target;
  if (!target) return false;
  const name = typeof target.name === 'function' ? target.name() : '';
  if (name !== 'object') return false;
  const id = typeof target.id === 'function' ? target.id() : '';
  if (!id) return false;
  return designer.selection.includes(id);
}

// ---------------------------------------------------------------------------
// Marquee move/up use native window listeners instead of Konva events.
// Konva suppresses pointermove while isDragging()/isTransforming() is true
// (e.g. a stuck drag state after the browser lost focus mid-transform).
// Window listeners bypass that suppression and always fire.
// ---------------------------------------------------------------------------

function onMarqueeMove(e: PointerEvent): void {
  if (!marquee.value.tracking) return;
  const dot = nativeEventToDot(e);
  if (!dot) return;
  const dx = dot.x - marquee.value.startX;
  const dy = dot.y - marquee.value.startY;
  if (!marquee.value.dragging) {
    if (Math.hypot(dx, dy) < MARQUEE_THRESHOLD) return;
    marquee.value.dragging = true;
    marquee.value.active = true;
  }
  marquee.value.endX = dot.x;
  marquee.value.endY = dot.y;
}

function onMarqueeUp(e: PointerEvent): void {
  // Always clean up the move listener (pointerup is registered once: true).
  window.removeEventListener('pointermove', onMarqueeMove);
  if (!marquee.value.tracking) return;

  if (!marquee.value.dragging) {
    // Threshold never crossed — let the Konva @click deselect fire normally.
    marquee.value.active = false;
    marquee.value.tracking = false;
    marquee.value.dragging = false;
    return;
  }

  // Snap to the exact release position before evaluating.
  const finalDot = nativeEventToDot(e);
  if (finalDot) {
    marquee.value.endX = finalDot.x;
    marquee.value.endY = finalDot.y;
  }

  const m = marquee.value;
  const rectMinX = Math.min(m.startX, m.endX);
  const rectMinY = Math.min(m.startY, m.endY);
  const rectMaxX = Math.max(m.startX, m.endX);
  const rectMaxY = Math.max(m.startY, m.endY);

  // Find all visible, non-locked objects whose AABB intersects the rect.
  // Rotation is intentionally ignored (industry-standard marquee behaviour).
  const hits: string[] = [];
  for (const obj of document.value.objects) {
    if (!obj.visible) continue;
    if (obj.locked) continue;
    const objMaxX = obj.x + obj.width;
    const objMaxY = obj.y + obj.height;
    if (objMaxX > rectMinX && obj.x < rectMaxX && objMaxY > rectMinY && obj.y < rectMaxY) {
      hits.push(obj.id);
    }
  }

  if (hits.length > 0 || !m.shiftHeld) {
    const newSelection = m.shiftHeld ? [...new Set([...designer.selection, ...hits])] : hits;
    if (newSelection.length > 0) designer.select(newSelection);
    else designer.deselect();
  }

  // Keep dragging=true until after Konva's @click fires (which deselects on
  // empty-canvas clicks). The Konva click fires synchronously from the canvas
  // element's pointerup listener — before this window listener — so dragging
  // is already true at that point. Clear it on the next microtask.
  marquee.value.active = false;
  marquee.value.tracking = false;
  void Promise.resolve().then(() => {
    marquee.value.dragging = false;
  });
}

function onStagePointerDown(event: {
  target?: { name?: () => string };
  evt?: {
    shiftKey?: boolean;
    button?: number;
    clientX?: number;
    clientY?: number;
    pointerId?: number;
  };
}): void {
  // Skip the marquee only when the click is on an already-selected object
  // (the user is starting a drag of the selection). Clicks on unselected
  // objects start a marquee — the object becomes draggable only after it's
  // selected, so Konva won't initiate a drag on this gesture.
  if (isOnSelectedObject(event)) return;
  if (editingTextId.value) return;
  if (event.evt?.button !== undefined && event.evt.button !== 0) return;

  const pos = konvaStage.value?.getPointerPosition();
  if (!pos) return;

  const dot = pointerToDot(pos.x, pos.y);
  marquee.value = {
    active: false,
    tracking: true,
    startX: dot.x,
    startY: dot.y,
    endX: dot.x,
    endY: dot.y,
    shiftHeld: event.evt?.shiftKey ?? false,
    dragging: false,
  };

  window.addEventListener('pointermove', onMarqueeMove);
  window.addEventListener('pointerup', onMarqueeUp, { once: true });
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

function onObjectTransformEnd(id: string, patch: TransformEndPatch): void {
  const updates: Partial<LabelObject> = {
    x: patch.x,
    y: patch.y,
    width: patch.width,
    rotation: patch.rotation,
  };
  if (patch.height !== undefined) updates.height = patch.height;
  if (patch.fontSize !== undefined) {
    (updates as Partial<TextObject>).fontSize = patch.fontSize;
  }
  if (patch.letterSpacing !== undefined) {
    (updates as Partial<TextObject>).letterSpacing = patch.letterSpacing;
  }
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

/* On narrow screens the floating zoom widget collides with the
   bottom-centre CanvasActions toolbar. CanvasActions renders its
   own inline zoom controls below this breakpoint. */
@media (max-width: 640px) {
  .canvas-zoom {
    display: none;
  }
}
</style>

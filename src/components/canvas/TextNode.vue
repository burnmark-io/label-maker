<template>
  <VText
    ref="nodeRef"
    :config="config"
    @click="emit('select', $event)"
    @tap="emit('select', $event)"
    @dblclick="emit('edit')"
    @dbltap="emit('edit')"
    @dragstart="emit('dragstart')"
    @dragmove="onDragMove"
    @dragend="onDragEnd"
    @transformstart="onTransformStart"
    @transform="onTransform"
    @transformend="onTransformEnd"
  />
</template>

<script setup lang="ts">
import { computed, ref, watchPostEffect } from 'vue';
import { applyTemplate, type TextObject } from '@burnmark-io/designer-core';
import { useDataStore } from '@/stores/data';
import { useShiftKey } from '@/composables/useShiftKey';
import { useTransformContext } from '@/composables/useTransformContext';

const data = useDataStore();
const shiftKey = useShiftKey();
const { activeAnchor } = useTransformContext();

const props = defineProps<{
  object: TextObject;
  selected: boolean;
  draggable: boolean;
}>();

export interface TransformEndPatch {
  x: number;
  y: number;
  width: number;
  height?: number;
  rotation: number;
  fontSize?: number;
  letterSpacing?: number;
}

const emit = defineEmits<{
  (e: 'select', event: unknown): void;
  (e: 'edit'): void;
  (e: 'dragstart'): void;
  (e: 'dragmove', x: number, y: number): void;
  (e: 'dragend', x: number, y: number): void;
  (e: 'transformend', patch: TransformEndPatch): void;
}>();

interface KonvaTextNode {
  width(): number;
  width(n: number): void;
  height(): number;
  height(n: number): void;
  fontSize(): number;
  fontSize(n: number): void;
  scaleX(): number;
  scaleX(s: number): void;
  scaleY(): number;
  scaleY(s: number): void;
  offsetX(n: number): void;
  offsetY(n: number): void;
  x(): number;
  x(n: number): void;
  y(): number;
  y(n: number): void;
  rotation(): number;
  getStage(): { findOne(selector: string): unknown } | null;
}

interface KonvaTransformerLike {
  getActiveAnchor?(): string;
}

interface KonvaNodeRef {
  getNode(): KonvaTextNode;
}

const nodeRef = ref<KonvaNodeRef | null>(null);

const measuredHeight = ref(props.object.height ?? 0);

const renderHeight = computed(() =>
  props.object.autoHeight ? measuredHeight.value : props.object.height,
);

const config = computed(() => ({
  id: props.object.id,
  name: 'object',
  x: props.object.x + props.object.width / 2,
  y: props.object.y + renderHeight.value / 2,
  offsetX: props.object.width / 2,
  offsetY: renderHeight.value / 2,
  width: props.object.width,
  height: props.object.autoHeight ? undefined : props.object.height,
  text: applyTemplate(props.object.content, data.currentVariables),
  fontSize: props.object.fontSize,
  fontFamily: props.object.fontFamily,
  fontStyle: textFontStyle(props.object),
  align: props.object.textAlign,
  verticalAlign: props.object.verticalAlign,
  letterSpacing: props.object.letterSpacing,
  lineHeight: props.object.lineHeight,
  fill: props.object.color,
  rotation: props.object.rotation,
  opacity: props.object.opacity,
  visible: props.object.visible,
  listening: !props.object.locked,
  draggable: props.draggable && !props.object.locked,
  wrap: props.object.wrap ? 'word' : 'none',
}));

watchPostEffect(() => {
  void config.value;
  const node = nodeRef.value?.getNode();
  if (!node) return;
  if (props.object.autoHeight) {
    const h = node.height();
    if (h && h !== measuredHeight.value) measuredHeight.value = h;
  } else if (measuredHeight.value !== props.object.height) {
    measuredHeight.value = props.object.height;
  }
});

function textFontStyle(o: TextObject): string {
  const parts: string[] = [];
  if (o.fontStyle === 'italic') parts.push('italic');
  if (o.fontWeight === 'bold') parts.push('bold');
  return parts.length === 0 ? 'normal' : parts.join(' ');
}

function onDragMove(event: { target?: { x?: () => number; y?: () => number } }): void {
  const t = event.target;
  if (!t?.x || !t?.y) return;
  emit('dragmove', t.x() - props.object.width / 2, t.y() - renderHeight.value / 2);
}

function onDragEnd(event: { target?: { x?: () => number; y?: () => number } }): void {
  const t = event.target;
  if (!t?.x || !t?.y) return;
  emit('dragend', t.x() - props.object.width / 2, t.y() - renderHeight.value / 2);
}

const MIN_DIM = 10;
const MIN_FONT = 4;

const CORNER_ANCHORS = new Set(['top-left', 'top-right', 'bottom-left', 'bottom-right']);

function isCornerHandle(anchorName: string): boolean {
  return CORNER_ANCHORS.has(anchorName);
}

let dragStartWidth = 0;
let dragStartHeight = 0;
let dragStartFontSize = 0;
let dragStartLetterSpacing = 0;
let dragStartAnchor = '';
let dragStartRotationRad = 0;
// World position of the anchor opposite the dragged one — held fixed
// throughout the drag (the resize "pivot").
let pivotWorldX = 0;
let pivotWorldY = 0;
// Konva reports per-tick scale relative to the node's pre-reset state,
// so multiplying these each tick gives the absolute scale since
// transformstart even though we reset node.scaleX/Y to 1 every tick.
let cumulativeScaleX = 1;
let cumulativeScaleY = 1;

function isProportional(): boolean {
  const corner = isCornerHandle(dragStartAnchor);
  return corner !== shiftKey.value;
}

/**
 * Vector from the bbox centre to the anchor opposite the dragged one,
 * in the node's local (un-rotated) frame.
 */
function localPivotOffset(anchor: string, w: number, h: number): { x: number; y: number } {
  switch (anchor) {
    case 'top-left':
      return { x: w / 2, y: h / 2 };
    case 'top-right':
      return { x: -w / 2, y: h / 2 };
    case 'bottom-left':
      return { x: w / 2, y: -h / 2 };
    case 'bottom-right':
      return { x: -w / 2, y: -h / 2 };
    case 'middle-left':
      return { x: w / 2, y: 0 };
    case 'middle-right':
      return { x: -w / 2, y: 0 };
    case 'top-center':
      return { x: 0, y: h / 2 };
    case 'bottom-center':
      return { x: 0, y: -h / 2 };
    default:
      return { x: 0, y: 0 };
  }
}

function onTransformStart(): void {
  const node = nodeRef.value?.getNode();
  if (!node) return;
  dragStartWidth = props.object.width;
  dragStartHeight = props.object.autoHeight ? measuredHeight.value : props.object.height;
  dragStartFontSize = props.object.fontSize;
  dragStartLetterSpacing = props.object.letterSpacing;
  dragStartAnchor = activeAnchor.value;
  cumulativeScaleX = 1;
  cumulativeScaleY = 1;

  dragStartRotationRad = (props.object.rotation * Math.PI) / 180;
  const cx = props.object.x + dragStartWidth / 2;
  const cy = props.object.y + dragStartHeight / 2;
  const off = localPivotOffset(dragStartAnchor, dragStartWidth, dragStartHeight);
  const cosR = Math.cos(dragStartRotationRad);
  const sinR = Math.sin(dragStartRotationRad);
  pivotWorldX = cx + off.x * cosR - off.y * sinR;
  pivotWorldY = cy + off.x * sinR + off.y * cosR;
}

function onTransform(): void {
  const node = nodeRef.value?.getNode();
  if (!node) return;

  // When the user drags past the opposite anchor (the pivot), Konva
  // re-targets the transformer to the now-far anchor and starts
  // reporting "growth" from the new direction — that produces the
  // box-grows-upwards-past-the-pivot dance. flipEnabled: false stops
  // the visual flip but not the anchor re-target. Detect the swap and
  // hard-freeze cumulative at the floor for the rest of the drag in
  // that direction.
  const stage = node.getStage();
  const tr = stage?.findOne('Transformer') as KonvaTransformerLike | null;
  const currentAnchor = tr?.getActiveAnchor?.() ?? dragStartAnchor;
  const anchorSwapped = currentAnchor !== '' && currentAnchor !== dragStartAnchor;

  const corner = isCornerHandle(dragStartAnchor);
  const proportional = isProportional();

  const minScaleX = MIN_DIM / dragStartWidth;
  const minScaleY = MIN_DIM / dragStartHeight;
  // In proportional mode, both axes share a single floor — the larger
  // of the two minima — so they clamp together and stay in lock-step.
  // Otherwise the wider axis can keep shrinking past the taller axis's
  // floor, the cumulatives desync, and recovery on the way back out
  // ends up smaller than the user's pre-floor scale.
  const xFloor = proportional ? Math.max(minScaleX, minScaleY) : minScaleX;
  const yFloor = proportional ? Math.max(minScaleX, minScaleY) : minScaleY;

  if (anchorSwapped) {
    // Only peg the axis the user was actually dragging. For edge
    // anchors, the inactive axis stays at 1 throughout; pegging it to
    // its floor would collapse the box on that axis (the 10x10 bug).
    if (corner) {
      cumulativeScaleX = xFloor;
      cumulativeScaleY = yFloor;
    } else {
      const horizEdge = dragStartAnchor === 'middle-left' || dragStartAnchor === 'middle-right';
      if (horizEdge) cumulativeScaleX = xFloor;
      else cumulativeScaleY = yFloor;
    }
  } else {
    // Cap per-tick scale to swallow glitches Konva can report right
    // after an anchor un-swap (its internal reference is stale from
    // our floor-state mutations, so it can spike a single huge sx).
    // 10x per tick is plenty for any real drag speed.
    const sx = Math.max(0.1, Math.min(10, node.scaleX()));
    const sy = Math.max(0.1, Math.min(10, node.scaleY()));
    cumulativeScaleX *= sx;
    cumulativeScaleY *= sy;
    if (cumulativeScaleX < xFloor) cumulativeScaleX = xFloor;
    if (cumulativeScaleY < yFloor) cumulativeScaleY = yFloor;
    // Sanity ceiling so a runaway tick can't blow font sizes to 1000+.
    if (cumulativeScaleX > 50) cumulativeScaleX = 50;
    if (cumulativeScaleY > 50) cumulativeScaleY = 50;
  }

  // Reset scale so Konva renders text by layout, not by visual scaling.
  node.scaleX(1);
  node.scaleY(1);

  let newWidth: number;
  let newHeight: number;
  let newFont = dragStartFontSize;

  if (corner && proportional) {
    // Konva's keepRatio: true gives uniform scale on corner drags, so
    // cumulativeScaleX === cumulativeScaleY (modulo float noise).
    const s = cumulativeScaleX;
    newWidth = Math.max(MIN_DIM, dragStartWidth * s);
    newHeight = Math.max(MIN_DIM, dragStartHeight * s);
    newFont = Math.max(MIN_FONT, dragStartFontSize * s);
  } else if (corner && !proportional) {
    newWidth = Math.max(MIN_DIM, dragStartWidth * cumulativeScaleX);
    newHeight = Math.max(MIN_DIM, dragStartHeight * cumulativeScaleY);
  } else if (!corner && proportional) {
    const isHorizontalEdge =
      dragStartAnchor === 'middle-left' || dragStartAnchor === 'middle-right';
    const s = isHorizontalEdge ? cumulativeScaleX : cumulativeScaleY;
    newWidth = Math.max(MIN_DIM, dragStartWidth * s);
    newHeight = Math.max(MIN_DIM, dragStartHeight * s);
    newFont = Math.max(MIN_FONT, dragStartFontSize * s);
  } else {
    newWidth = Math.max(MIN_DIM, dragStartWidth * cumulativeScaleX);
    newHeight = Math.max(MIN_DIM, dragStartHeight * cumulativeScaleY);
  }

  node.width(newWidth);
  if (!props.object.autoHeight) {
    node.height(newHeight);
  }
  // Always set fontSize so toggling Shift mid-drag snaps the live font
  // back to dragStart in non-proportional mode (and re-engages scaling
  // cleanly when toggled back). dragStart is the no-op value.
  node.fontSize(newFont);

  const liveHeight = props.object.autoHeight ? node.height() : newHeight;

  // Always anchor the bbox at the pivot computed at transformstart.
  // This is robust regardless of how Konva positions the node — at the
  // floor, after an anchor swap, on autoHeight, or on edge+Shift.
  const off = localPivotOffset(dragStartAnchor, newWidth, liveHeight);
  const cosR = Math.cos(dragStartRotationRad);
  const sinR = Math.sin(dragStartRotationRad);
  node.x(pivotWorldX - (off.x * cosR - off.y * sinR));
  node.y(pivotWorldY - (off.x * sinR + off.y * cosR));

  node.offsetX(newWidth / 2);
  node.offsetY(liveHeight / 2);
}

function onTransformEnd(): void {
  const node = nodeRef.value?.getNode();
  if (!node) return;

  const proportional = isProportional();
  const newWidth = node.width();
  const newHeight = node.height();

  const patch: TransformEndPatch = {
    x: node.x() - newWidth / 2,
    y: node.y() - newHeight / 2,
    width: newWidth,
    rotation: node.rotation(),
  };
  if (!props.object.autoHeight) {
    patch.height = newHeight;
  }
  if (proportional) {
    const liveFont = Math.max(MIN_FONT, node.fontSize());
    patch.fontSize = liveFont;
    const fontScale = liveFont / dragStartFontSize;
    patch.letterSpacing = Math.max(0, dragStartLetterSpacing * fontScale);
  }

  emit('transformend', patch);
}
</script>

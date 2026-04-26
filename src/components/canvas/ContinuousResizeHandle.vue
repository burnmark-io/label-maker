<template>
  <VGroup>
    <VRect
      :config="{
        x: width / 2 - hitWidth / 2,
        y: height - hitHeight / 2,
        width: hitWidth,
        height: hitHeight,
        fill: hovered || dragging ? '#525b67' : '#94a3b8',
        cornerRadius: hitHeight / 2,
        listening: true,
        draggable: true,
      }"
      @mouseenter="onHover(true)"
      @mouseleave="onHover(false)"
      @dragstart="onDragStart"
      @dragmove="onDragMove"
      @dragend="onDragEnd"
    />
    <VText
      v-if="hovered || dragging"
      :config="{
        x: width / 2 + hitWidth / 2 + 8 / scale,
        y: height - 6 / scale,
        text: hintLabel,
        fontSize: 11 / scale,
        fontFamily: 'JetBrains Mono, monospace',
        fill: '#475569',
        listening: false,
      }"
    />
  </VGroup>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { useMediaStore, mmFromDots } from '@/stores/media';

const props = defineProps<{
  width: number;
  height: number;
  scale: number;
}>();

const { t } = useI18n();
const designer = useDesignerStore();
const media = useMediaStore();

const hovered = ref(false);
const dragging = ref(false);

/** Grab-bar dimensions in dot-space — visually constant pixel size at any zoom. */
const hitWidth = computed(() => 80 / props.scale);
const hitHeight = computed(() => 12 / props.scale);

const hintLabel = computed(() =>
  t('canvas.continuousLength', { mm: round1(media.continuousLengthMm) }),
);

function onHover(state: boolean): void {
  hovered.value = state;
}

/**
 * Konva node accessor — `.x()` / `.y()` are dual getter/setter.
 * Typed loosely here because the tighter `(): number & (n: number): void`
 * union form trips TS2300; the static type system can't see Konva's
 * actual overloads.
 */
type KonvaCoordFn = ((value?: number) => number) & ((value: number) => unknown);
interface DragNode {
  x: KonvaCoordFn;
  y: KonvaCoordFn;
}

function onDragStart(): void {
  dragging.value = true;
}

/**
 * Drag math: the Rect straddles the cut line. Its centre y in dot-space
 * equals the canvas height. So `node.y() + hitHeight/2` = new height.
 *
 * Constraints applied here (not via `dragBoundFunc` so we don't need a
 * stage handle):
 *  - Lock X to the centred position.
 *  - Floor the height at the lowest visible object's bottom + tail
 *    margin (amendment §3.4).
 */
function onDragMove(event: { target: DragNode }): void {
  const node = event.target;
  // Force X back to the centred position — single-axis drag.
  const lockedX = props.width / 2 - hitWidth.value / 2;
  if (Math.abs(node.x() - lockedX) > 0.5) node.x(lockedX);

  const newCenterY = node.y() + hitHeight.value / 2;
  const minHeightDots = computeMinHeightDots();
  const clampedDots = Math.max(newCenterY, minHeightDots);

  // Snap node back if user dragged past the floor.
  if (clampedDots !== newCenterY) {
    node.y(clampedDots - hitHeight.value / 2);
  }

  const dpi = designer.document.canvas.dpi || 300;
  const newMm = mmFromDots(clampedDots, dpi);
  if (Number.isFinite(newMm) && newMm > 0) {
    media.setContinuousLength(newMm);
  }
}

function onDragEnd(): void {
  dragging.value = false;
}

function computeMinHeightDots(): number {
  let lowest = 0;
  for (const o of designer.document.objects) {
    if (!o.visible) continue;
    const bottom = o.y + o.height;
    if (bottom > lowest) lowest = bottom;
  }
  // 16 dots breathing room past the lowest object; floor at 40 dots so
  // an empty canvas can still be made very small.
  return Math.max(40, Math.ceil(lowest) + 16);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
</script>

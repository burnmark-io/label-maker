<template>
  <VGroup>
    <!-- The grow axis follows the orientation: handle straddles the
         bottom edge in vertical mode, the right edge in horizontal mode. -->
    <VRect
      :config="{
        x: rectX,
        y: rectY,
        width: rectWidth,
        height: rectHeight,
        fill: hovered || dragging ? '#525b67' : '#94a3b8',
        cornerRadius: Math.min(rectWidth, rectHeight) / 2,
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
        x: hintX,
        y: hintY,
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

const isHorizontal = computed(() => media.orientation === 'horizontal');

/**
 * Grab-bar long axis sits along the cut line. 80 px long, 12 px thick,
 * scaled into dot-space so on-screen size stays constant at any zoom.
 */
const longSide = computed(() => 80 / props.scale);
const shortSide = computed(() => 12 / props.scale);

/** Rect geometry, swapped for horizontal vs vertical placement. */
const rectWidth = computed(() => (isHorizontal.value ? shortSide.value : longSide.value));
const rectHeight = computed(() => (isHorizontal.value ? longSide.value : shortSide.value));
const rectX = computed(() =>
  isHorizontal.value ? props.width - shortSide.value / 2 : props.width / 2 - longSide.value / 2,
);
const rectY = computed(() =>
  isHorizontal.value ? props.height / 2 - longSide.value / 2 : props.height - shortSide.value / 2,
);

/** Hover hint stays adjacent to the handle on its growth axis. */
const hintX = computed(() =>
  isHorizontal.value
    ? props.width + 6 / props.scale
    : props.width / 2 + longSide.value / 2 + 8 / props.scale,
);
const hintY = computed(() =>
  isHorizontal.value
    ? props.height / 2 + longSide.value / 2 + 8 / props.scale
    : props.height - 6 / props.scale,
);

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
 * Drag math: the Rect straddles the cut line. In vertical mode the
 * handle's centre-y in dot-space equals the canvas height; in horizontal
 * mode the centre-x equals the canvas length. The cross-axis is locked.
 *
 * Min-extent floor: max object extent on the growth axis + a small
 * tail so the cut line can't swallow visible content (amendment §3.4).
 */
function onDragMove(event: { target: DragNode }): void {
  const node = event.target;
  if (isHorizontal.value) {
    const lockedY = props.height / 2 - longSide.value / 2;
    if (Math.abs(node.y() - lockedY) > 0.5) node.y(lockedY);

    const newCenterX = node.x() + shortSide.value / 2;
    const minLengthDots = computeMinExtentDots('x');
    const clampedDots = Math.max(newCenterX, minLengthDots);
    if (clampedDots !== newCenterX) {
      node.x(clampedDots - shortSide.value / 2);
    }
    commitLength(clampedDots);
    return;
  }

  const lockedX = props.width / 2 - longSide.value / 2;
  if (Math.abs(node.x() - lockedX) > 0.5) node.x(lockedX);

  const newCenterY = node.y() + shortSide.value / 2;
  const minLengthDots = computeMinExtentDots('y');
  const clampedDots = Math.max(newCenterY, minLengthDots);
  if (clampedDots !== newCenterY) {
    node.y(clampedDots - shortSide.value / 2);
  }
  commitLength(clampedDots);
}

function onDragEnd(): void {
  dragging.value = false;
}

function commitLength(dots: number): void {
  const dpi = designer.document.canvas.dpi || 300;
  const newMm = mmFromDots(dots, dpi);
  if (Number.isFinite(newMm) && newMm > 0) {
    media.setContinuousLength(newMm);
  }
}

function computeMinExtentDots(axis: 'x' | 'y'): number {
  let max = 0;
  for (const o of designer.document.objects) {
    if (!o.visible) continue;
    const extent = axis === 'y' ? o.y + o.height : o.x + o.width;
    if (extent > max) max = extent;
  }
  // 16 dots breathing room past the furthest object; floor at 40 dots so
  // an empty canvas can still be made very small.
  return Math.max(40, Math.ceil(max) + 16);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
</script>

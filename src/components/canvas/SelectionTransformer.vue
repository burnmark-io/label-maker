<template>
  <VTransformer ref="transformerRef" :config="config" @transformstart="onTransformStart" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import type { LabelObject } from '@burnmark-io/designer-core';
import type { KonvaNode, KonvaStage } from './konva-types';
import { useTransformContext, type PerObjectSnapshot } from '@/composables/useTransformContext';

const props = defineProps<{
  selectedIds: string[];
  selectedObjects: LabelObject[];
  /** The Konva stage instance; we query nodes by `id` from it. */
  stage: KonvaStage | null;
  /** Inverse zoom — used to keep handles a consistent size. */
  invScale: number;
}>();

interface KonvaTransformer extends KonvaNode {
  nodes(nodes: KonvaNode[]): void;
  getLayer(): { batchDraw(): void } | null;
  forceUpdate(): void;
  getActiveAnchor?(): string;
}

const transformerRef = ref<{ getNode(): KonvaTransformer } | null>(null);
const { activeAnchor, groupContext } = useTransformContext();

const ALL_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const HORIZONTAL_ANCHORS = [
  'top-left',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-right',
];

/**
 * When the sole selection is an autoHeight TextObject, the vertical
 * edge anchors don't make sense — height is derived from text content
 * at render time, so dragging top/bottom-center has no stable target.
 */
const enabledAnchors = computed<string[]>(() => {
  if (props.selectedObjects.length !== 1) return ALL_ANCHORS;
  const only = props.selectedObjects[0];
  if (only.type === 'text' && only.autoHeight) return HORIZONTAL_ANCHORS;
  return ALL_ANCHORS;
});

const config = computed(() => ({
  borderStroke: '#f59e0b',
  borderStrokeWidth: 1.5,
  anchorStroke: '#f59e0b',
  anchorFill: '#ffffff',
  anchorSize: 9,
  anchorCornerRadius: 2,
  rotateAnchorOffset: 24,
  ignoreStroke: true,
  rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
  rotationSnapTolerance: 5,
  shouldOverdrawWholeArea: false,
  // Corner drags scale uniformly by default; Konva auto-inverts to
  // free-aspect when Shift is held (matches our amendment's convention
  // of corner = proportional, corner+Shift = free aspect).
  keepRatio: true,
  flipEnabled: false,
  enabledAnchors: enabledAnchors.value,
}));

function onTransformStart(): void {
  const tr = transformerRef.value?.getNode();
  if (!tr) return;
  activeAnchor.value = tr.getActiveAnchor?.() ?? '';

  // Capture group-relative context so per-object transformend handlers
  // can compute positions relative to the group centre rather than each
  // object's own centre — see §5 of amendment-multi-select-fixes.md.
  const objs = props.selectedObjects;
  if (objs.length === 0) {
    groupContext.value = null;
    return;
  }

  // Compute axis-aligned bounding box of all selected objects.
  // For a rotated object the AABB is conservative (we use its x/y/w/h
  // stored values), which is acceptable — the math stays correct.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const obj of objs) {
    if (obj.x < minX) minX = obj.x;
    if (obj.y < minY) minY = obj.y;
    if (obj.x + obj.width > maxX) maxX = obj.x + obj.width;
    if (obj.y + obj.height > maxY) maxY = obj.y + obj.height;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const perObject = new Map<string, PerObjectSnapshot>();
  for (const obj of objs) {
    const objCx = obj.x + obj.width / 2;
    const objCy = obj.y + obj.height / 2;
    perObject.set(obj.id, {
      offsetX: objCx - cx,
      offsetY: objCy - cy,
      width: obj.width,
      height: obj.height,
      rotation: obj.rotation,
    });
  }

  groupContext.value = { centre: { x: cx, y: cy }, perObject };
}

async function syncSelection(): Promise<void> {
  const tr = transformerRef.value?.getNode();
  if (!tr || !props.stage) return;
  await nextTick();
  const nodes: KonvaNode[] = [];
  for (const id of props.selectedIds) {
    const node = props.stage.findOne(`#${id}`);
    if (node) nodes.push(node);
  }
  tr.nodes(nodes);
  tr.getLayer()?.batchDraw();
}

watch(
  () => [props.selectedIds.join(','), props.stage],
  () => {
    void syncSelection();
  },
);

onMounted(() => {
  void syncSelection();
});
</script>

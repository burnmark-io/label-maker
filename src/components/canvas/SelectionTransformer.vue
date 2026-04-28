<template>
  <VTransformer ref="transformerRef" :config="config" @transformstart="onTransformStart" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import type { LabelObject } from '@burnmark-io/designer-core';
import type { KonvaNode, KonvaStage } from './konva-types';
import { useTransformContext } from '@/composables/useTransformContext';

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
const { activeAnchor } = useTransformContext();

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

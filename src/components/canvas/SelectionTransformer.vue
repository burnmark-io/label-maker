<template>
  <VTransformer ref="transformerRef" :config="config" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import type { KonvaNode, KonvaStage } from './konva-types';

const props = defineProps<{
  selectedIds: string[];
  /** The Konva stage instance; we query nodes by `id` from it. */
  stage: KonvaStage | null;
  /** Inverse zoom — used to keep handles a consistent size. */
  invScale: number;
}>();

interface KonvaTransformer extends KonvaNode {
  nodes(nodes: KonvaNode[]): void;
  getLayer(): { batchDraw(): void } | null;
  forceUpdate(): void;
}

const transformerRef = ref<{ getNode(): KonvaTransformer } | null>(null);

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
  keepRatio: false,
}));

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

<template>
  <VImage
    v-if="image"
    ref="nodeRef"
    :config="config"
    @click="emit('select', $event)"
    @tap="emit('select', $event)"
    @dragstart="emit('dragstart')"
    @dragmove="onDragMove"
    @dragend="onDragEnd"
    @transformend="onTransformEnd"
  />
  <VRect
    v-else
    :config="placeholderConfig"
    @click="emit('select', $event)"
    @tap="emit('select', $event)"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ImageObject } from '@burnmark-io/designer-core';
import { useDesignerStore } from '@/stores/designer';
import { useTransformContext } from '@/composables/useTransformContext';

const props = defineProps<{
  object: ImageObject;
  selected: boolean;
  draggable: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', event: unknown): void;
  (e: 'dragstart'): void;
  (e: 'dragmove', x: number, y: number): void;
  (e: 'dragend', x: number, y: number): void;
  (
    e: 'transformend',
    patch: { x: number; y: number; width: number; height: number; rotation: number },
  ): void;
}>();

interface KonvaNodeRef {
  getNode(): {
    width(): number;
    height(): number;
    scaleX(): number;
    scaleY(): number;
    x(): number;
    y(): number;
    rotation(): number;
    scaleX(s: number): void;
    scaleY(s: number): void;
  };
}

const nodeRef = ref<KonvaNodeRef | null>(null);

const designer = useDesignerStore();
const { groupContext } = useTransformContext();
const image = ref<HTMLImageElement | null>(null);

watch(
  () => props.object.assetKey,
  async key => {
    if (!key) {
      image.value = null;
      return;
    }
    try {
      image.value = await designer.assetLoader.loadAsImage(key);
    } catch {
      image.value = null;
    }
  },
  { immediate: true },
);

const config = computed(() => ({
  id: props.object.id,
  name: 'object',
  x: props.object.x + props.object.width / 2,
  y: props.object.y + props.object.height / 2,
  offsetX: props.object.width / 2,
  offsetY: props.object.height / 2,
  width: props.object.width,
  height: props.object.height,
  rotation: props.object.rotation,
  opacity: props.object.opacity,
  visible: props.object.visible,
  listening: !props.object.locked,
  draggable: props.draggable && !props.object.locked,
  image: image.value,
}));

const placeholderConfig = computed(() => ({
  id: props.object.id,
  name: 'object',
  x: props.object.x + props.object.width / 2,
  y: props.object.y + props.object.height / 2,
  offsetX: props.object.width / 2,
  offsetY: props.object.height / 2,
  width: props.object.width,
  height: props.object.height,
  rotation: props.object.rotation,
  opacity: props.object.opacity,
  visible: props.object.visible,
  listening: !props.object.locked,
  fill: '#fafaf9',
  stroke: '#d6d3d1',
  strokeWidth: 1,
  dash: [6, 4],
  strokeScaleEnabled: false,
}));

function onDragMove(event: { target?: { x?: () => number; y?: () => number } }): void {
  const t = event.target;
  if (!t?.x || !t?.y) return;
  emit('dragmove', t.x() - props.object.width / 2, t.y() - props.object.height / 2);
}

function onDragEnd(event: { target?: { x?: () => number; y?: () => number; width?: () => number; height?: () => number } }): void {
  const t = event.target;
  if (!t?.x || !t?.y) return;
  const renderedWidth = t.width ? t.width() : props.object.width;
  const renderedHeight = t.height ? t.height() : props.object.height;
  emit('dragend', t.x() - renderedWidth / 2, t.y() - renderedHeight / 2);
}

function onTransformEnd(): void {
  const node = nodeRef.value?.getNode();
  if (!node) return;
  const sx = node.scaleX();
  const sy = node.scaleY();
  const newWidth = Math.max(8, node.width() * sx);
  const newHeight = Math.max(8, node.height() * sy);
  node.scaleX(1);
  node.scaleY(1);

  const ctx = groupContext.value;
  const snap = ctx?.perObject.get(props.object.id);
  let x: number;
  let y: number;
  if (ctx && snap) {
    const scaleX = newWidth / snap.width;
    const scaleY = newHeight / snap.height;
    const dRotDeg = node.rotation() - snap.rotation;
    const dRotRad = (dRotDeg * Math.PI) / 180;
    const ox = snap.offsetX * scaleX;
    const oy = snap.offsetY * scaleY;
    const cosD = Math.cos(dRotRad);
    const sinD = Math.sin(dRotRad);
    const newCx = ctx.centre.x + (ox * cosD - oy * sinD);
    const newCy = ctx.centre.y + (ox * sinD + oy * cosD);
    x = newCx - newWidth / 2;
    y = newCy - newHeight / 2;
  } else {
    x = node.x() - newWidth / 2;
    y = node.y() - newHeight / 2;
  }

  emit('transformend', {
    x,
    y,
    width: newWidth,
    height: newHeight,
    rotation: node.rotation(),
  });
}
</script>

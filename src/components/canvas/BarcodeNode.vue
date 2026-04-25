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
import { BarcodeEngine, type BarcodeObject } from '@burnmark-io/designer-core';

const engine = new BarcodeEngine();

const props = defineProps<{
  object: BarcodeObject;
  selected: boolean;
  draggable: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', event: unknown): void;
  (e: 'dragstart'): void;
  (e: 'dragmove', x: number, y: number): void;
  (e: 'dragend', x: number, y: number): void;
  (e: 'transformend', patch: { x: number; y: number; width: number; height: number; rotation: number }): void;
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
const image = ref<ImageBitmap | HTMLImageElement | null>(null);

watch(
  () => [props.object.format, props.object.data, JSON.stringify(props.object.options)],
  async () => {
    if (!props.object.data) {
      image.value = null;
      return;
    }
    try {
      const result = await engine.renderToImage(
        props.object.format,
        props.object.data,
        props.object.options,
      );
      image.value = result.image as ImageBitmap | HTMLImageElement;
    } catch {
      image.value = null;
    }
  },
  { immediate: true },
);

const config = computed(() => ({
  id: props.object.id,
  name: 'object',
  x: props.object.x,
  y: props.object.y,
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
  x: props.object.x,
  y: props.object.y,
  width: props.object.width,
  height: props.object.height,
  fill: '#fafaf9',
  stroke: '#d6d3d1',
  strokeWidth: 1,
  dash: [6, 4],
  rotation: props.object.rotation,
  opacity: props.object.opacity,
  visible: props.object.visible,
  listening: !props.object.locked,
  strokeScaleEnabled: false,
}));

function onDragMove(event: { target?: { x?: () => number; y?: () => number } }): void {
  const t = event.target;
  if (!t?.x || !t?.y) return;
  emit('dragmove', t.x(), t.y());
}

function onDragEnd(event: { target?: { x?: () => number; y?: () => number } }): void {
  const t = event.target;
  if (!t?.x || !t?.y) return;
  emit('dragend', t.x(), t.y());
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
  emit('transformend', {
    x: node.x(),
    y: node.y(),
    width: newWidth,
    height: newHeight,
    rotation: node.rotation(),
  });
}
</script>

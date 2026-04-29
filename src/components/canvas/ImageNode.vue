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
import { computeFit } from '@/lib/image/fit';

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

const config = computed(() => {
  const img = image.value;
  const source = img ? { width: img.naturalWidth, height: img.naturalHeight } : null;
  const fit = computeFit({
    fit: props.object.fit,
    bbox: { width: props.object.width, height: props.object.height },
    source,
  });
  return {
    id: props.object.id,
    name: 'object',
    x: props.object.x + props.object.width / 2,
    y: props.object.y + props.object.height / 2,
    rotation: props.object.rotation,
    opacity: props.object.opacity,
    visible: props.object.visible,
    listening: !props.object.locked,
    draggable: props.draggable && !props.object.locked,
    image: img,
    width: fit.width,
    height: fit.height,
    offsetX: fit.offsetX,
    offsetY: fit.offsetY,
    cropX: fit.cropX,
    cropY: fit.cropY,
    cropWidth: fit.cropWidth,
    cropHeight: fit.cropHeight,
  };
});

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

function onDragEnd(event: { target?: { x?: () => number; y?: () => number } }): void {
  const t = event.target;
  if (!t?.x || !t?.y) return;
  emit('dragend', t.x() - props.object.width / 2, t.y() - props.object.height / 2);
}

function onTransformEnd(): void {
  const node = nodeRef.value?.getNode();
  if (!node) return;
  const sx = node.scaleX();
  const sy = node.scaleY();
  // Multiply against the stored bbox dims, not node.width()/height():
  // for non-fill fit modes the Konva node renders at the inner-image
  // size, not the bbox. The user-facing transform is "scale the bbox";
  // the image then re-fits inside.
  const newWidth = Math.max(8, props.object.width * sx);
  const newHeight = Math.max(8, props.object.height * sy);
  node.scaleX(1);
  node.scaleY(1);
  emit('transformend', {
    x: node.x() - newWidth / 2,
    y: node.y() - newHeight / 2,
    width: newWidth,
    height: newHeight,
    rotation: node.rotation(),
  });
}
</script>

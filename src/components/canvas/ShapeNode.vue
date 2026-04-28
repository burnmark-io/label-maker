<template>
  <VRect
    v-if="object.shape === 'rectangle'"
    ref="nodeRef"
    :config="rectConfig"
    @click="emit('select', $event)"
    @tap="emit('select', $event)"
    @dragstart="emit('dragstart')"
    @dragmove="onDragMove"
    @dragend="onDragEnd"
    @transformend="onTransformEnd"
  />
  <VEllipse
    v-else-if="object.shape === 'ellipse'"
    ref="nodeRef"
    :config="ellipseConfig"
    @click="emit('select', $event)"
    @tap="emit('select', $event)"
    @dragstart="emit('dragstart')"
    @dragmove="onDragMove"
    @dragend="onDragEnd"
    @transformend="onTransformEnd"
  />
  <VLine
    v-else-if="object.shape === 'line'"
    ref="nodeRef"
    :config="lineConfig"
    @click="emit('select', $event)"
    @tap="emit('select', $event)"
    @dragstart="emit('dragstart')"
    @dragmove="onDragMove"
    @dragend="onDragEnd"
    @transformend="onTransformEnd"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ShapeObject } from '@burnmark-io/designer-core';

const props = defineProps<{
  object: ShapeObject;
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

const baseConfig = computed(() => ({
  id: props.object.id,
  name: 'object',
  rotation: props.object.rotation,
  opacity: props.object.opacity,
  visible: props.object.visible,
  listening: !props.object.locked,
  draggable: props.draggable && !props.object.locked,
  fill: props.object.fill ? props.object.color : undefined,
  stroke: props.object.color,
  strokeWidth: props.object.fill ? 0 : props.object.strokeWidth,
  strokeScaleEnabled: false,
}));

const rectConfig = computed(() => ({
  ...baseConfig.value,
  x: props.object.x + props.object.width / 2,
  y: props.object.y + props.object.height / 2,
  offsetX: props.object.width / 2,
  offsetY: props.object.height / 2,
  width: props.object.width,
  height: props.object.height,
  cornerRadius: props.object.cornerRadius ?? 0,
}));

const ellipseConfig = computed(() => ({
  ...baseConfig.value,
  x: props.object.x + props.object.width / 2,
  y: props.object.y + props.object.height / 2,
  radiusX: props.object.width / 2,
  radiusY: props.object.height / 2,
}));

const lineConfig = computed(() => {
  const dir = props.object.lineDirection ?? 'horizontal';
  let points: number[];
  if (dir === 'vertical') {
    points = [props.object.width / 2, 0, props.object.width / 2, props.object.height];
  } else if (dir === 'diagonal-ltr') {
    points = [0, 0, props.object.width, props.object.height];
  } else if (dir === 'diagonal-rtl') {
    points = [props.object.width, 0, 0, props.object.height];
  } else {
    points = [0, props.object.height / 2, props.object.width, props.object.height / 2];
  }
  return {
    ...baseConfig.value,
    x: props.object.x + props.object.width / 2,
    y: props.object.y + props.object.height / 2,
    offsetX: props.object.width / 2,
    offsetY: props.object.height / 2,
    points,
    fill: undefined,
    stroke: props.object.color,
    strokeWidth: Math.max(1, props.object.strokeWidth),
    lineCap: 'round',
  };
});

// All shapes render with centre offset — translate back to top-left for storage.
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
  const newWidth = Math.max(8, node.width() * sx);
  const newHeight = Math.max(8, node.height() * sy);
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

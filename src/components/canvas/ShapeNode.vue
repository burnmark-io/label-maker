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
  x: props.object.x,
  y: props.object.y,
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
    x: props.object.x,
    y: props.object.y,
    points,
    fill: undefined,
    stroke: props.object.color,
    strokeWidth: Math.max(1, props.object.strokeWidth),
    lineCap: 'round',
  };
});

function onDragMove(event: { target?: { x?: () => number; y?: () => number } }): void {
  const t = event.target;
  if (!t?.x || !t?.y) return;
  let x = t.x();
  let y = t.y();
  // For ellipses, the node origin is the center — translate back to top-left.
  if (props.object.shape === 'ellipse') {
    x -= props.object.width / 2;
    y -= props.object.height / 2;
  }
  emit('dragmove', x, y);
}

function onDragEnd(event: { target?: { x?: () => number; y?: () => number } }): void {
  const t = event.target;
  if (!t?.x || !t?.y) return;
  let x = t.x();
  let y = t.y();
  if (props.object.shape === 'ellipse') {
    x -= props.object.width / 2;
    y -= props.object.height / 2;
  }
  emit('dragend', x, y);
}

function onTransformEnd(): void {
  const node = nodeRef.value?.getNode();
  if (!node) return;
  const sx = node.scaleX();
  const sy = node.scaleY();
  let nodeWidth = node.width();
  let nodeHeight = node.height();
  // Ellipse stores radii — but Konva's `width()` returns the full size in v9.
  const newWidth = Math.max(8, nodeWidth * sx);
  const newHeight = Math.max(8, nodeHeight * sy);
  node.scaleX(1);
  node.scaleY(1);
  let x = node.x();
  let y = node.y();
  if (props.object.shape === 'ellipse') {
    x -= newWidth / 2;
    y -= newHeight / 2;
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

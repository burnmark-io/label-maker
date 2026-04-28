<template>
  <VText
    ref="nodeRef"
    :config="config"
    @click="emit('select', $event)"
    @tap="emit('select', $event)"
    @dblclick="emit('edit')"
    @dbltap="emit('edit')"
    @dragstart="emit('dragstart')"
    @dragmove="onDragMove"
    @dragend="onDragEnd"
    @transformend="onTransformEnd"
  />
</template>

<script setup lang="ts">
import { computed, ref, watchPostEffect } from 'vue';
import { applyTemplate, type TextObject } from '@burnmark-io/designer-core';
import { useDataStore } from '@/stores/data';

const data = useDataStore();

const props = defineProps<{
  object: TextObject;
  selected: boolean;
  draggable: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', event: unknown): void;
  (e: 'edit'): void;
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

// For autoHeight text the stored object.height is stale until Konva measures
// the rendered text. We read the natural height post-render so the rotation
// pivot stays at the visual centre even as content/font/wrap changes.
const measuredHeight = ref(props.object.height ?? 0);

const renderHeight = computed(() =>
  props.object.autoHeight ? measuredHeight.value : props.object.height,
);

const config = computed(() => ({
  id: props.object.id,
  name: 'object',
  x: props.object.x + props.object.width / 2,
  y: props.object.y + renderHeight.value / 2,
  offsetX: props.object.width / 2,
  offsetY: renderHeight.value / 2,
  width: props.object.width,
  height: props.object.autoHeight ? undefined : props.object.height,
  text: applyTemplate(props.object.content, data.currentVariables),
  fontSize: props.object.fontSize,
  fontFamily: props.object.fontFamily,
  fontStyle: textFontStyle(props.object),
  align: props.object.textAlign,
  verticalAlign: props.object.verticalAlign,
  letterSpacing: props.object.letterSpacing,
  lineHeight: props.object.lineHeight,
  fill: props.object.color,
  rotation: props.object.rotation,
  opacity: props.object.opacity,
  visible: props.object.visible,
  listening: !props.object.locked,
  draggable: props.draggable && !props.object.locked,
  wrap: props.object.wrap ? 'word' : 'none',
}));

watchPostEffect(() => {
  // Touch reactive deps so this re-runs after every Konva config change.
  void config.value;
  const node = nodeRef.value?.getNode();
  if (!node) return;
  if (props.object.autoHeight) {
    const h = node.height();
    if (h && h !== measuredHeight.value) measuredHeight.value = h;
  } else if (measuredHeight.value !== props.object.height) {
    measuredHeight.value = props.object.height;
  }
});

function textFontStyle(o: TextObject): string {
  const parts: string[] = [];
  if (o.fontStyle === 'italic') parts.push('italic');
  if (o.fontWeight === 'bold') parts.push('bold');
  return parts.length === 0 ? 'normal' : parts.join(' ');
}

function onDragMove(event: { target?: { x?: () => number; y?: () => number } }): void {
  const t = event.target;
  if (!t?.x || !t?.y) return;
  emit('dragmove', t.x() - props.object.width / 2, t.y() - renderHeight.value / 2);
}

function onDragEnd(event: { target?: { x?: () => number; y?: () => number } }): void {
  const t = event.target;
  if (!t?.x || !t?.y) return;
  emit('dragend', t.x() - props.object.width / 2, t.y() - renderHeight.value / 2);
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

<template>
  <TextNode
    v-if="object.type === 'text'"
    :object="object"
    :selected="selected"
    :draggable="draggable"
    @select="emit('select', $event)"
    @edit="emit('edit')"
    @dragstart="emit('dragstart')"
    @dragmove="onDragMove"
    @dragend="onDragEnd"
    @transformend="onTransformEnd"
  />
  <ImageNode
    v-else-if="object.type === 'image'"
    :object="object"
    :selected="selected"
    :draggable="draggable"
    @select="emit('select', $event)"
    @dragstart="emit('dragstart')"
    @dragmove="onDragMove"
    @dragend="onDragEnd"
    @transformend="onTransformEnd"
  />
  <BarcodeNode
    v-else-if="object.type === 'barcode'"
    :object="object"
    :selected="selected"
    :draggable="draggable"
    @select="emit('select', $event)"
    @dragstart="emit('dragstart')"
    @dragmove="onDragMove"
    @dragend="onDragEnd"
    @transformend="onTransformEnd"
  />
  <ShapeNode
    v-else-if="object.type === 'shape'"
    :object="object"
    :selected="selected"
    :draggable="draggable"
    @select="emit('select', $event)"
    @dragstart="emit('dragstart')"
    @dragmove="onDragMove"
    @dragend="onDragEnd"
    @transformend="onTransformEnd"
  />
</template>

<script setup lang="ts">
import type { LabelObject } from '@burnmark-io/designer-core';
import TextNode from './TextNode.vue';
import ImageNode from './ImageNode.vue';
import BarcodeNode from './BarcodeNode.vue';
import ShapeNode from './ShapeNode.vue';

defineProps<{
  object: LabelObject;
  selected: boolean;
  draggable: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', event: unknown): void;
  (e: 'edit'): void;
  (e: 'dragstart'): void;
  (e: 'dragmove', x: number, y: number): void;
  (e: 'dragend', x: number, y: number): void;
  (e: 'transformend', patch: { x: number; y: number; width: number; height: number; rotation: number }): void;
}>();

function onDragMove(x: number, y: number): void {
  emit('dragmove', x, y);
}

function onDragEnd(x: number, y: number): void {
  emit('dragend', x, y);
}

function onTransformEnd(patch: { x: number; y: number; width: number; height: number; rotation: number }): void {
  emit('transformend', patch);
}
</script>

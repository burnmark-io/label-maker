<template>
  <textarea
    ref="textareaRef"
    v-model="value"
    class="inline-editor"
    :style="style"
    @blur="emit('finish')"
    @keydown.escape.prevent="emit('cancel')"
    @keydown.enter.exact.prevent="emit('finish')"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { TextObject } from '@burnmark-io/designer-core';

const props = defineProps<{
  object: TextObject;
  /** Stage scale (zoom). */
  scale: number;
  /** Stage position offset. */
  offsetX: number;
  offsetY: number;
}>();

const emit = defineEmits<{
  (e: 'update:content', content: string): void;
  (e: 'finish'): void;
  (e: 'cancel'): void;
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const value = ref(props.object.content);

watch(value, (next) => {
  emit('update:content', next);
});

const style = computed(() => {
  const left = props.offsetX + props.object.x * props.scale;
  const top = props.offsetY + props.object.y * props.scale;
  const width = props.object.width * props.scale;
  const height = Math.max(24, props.object.height * props.scale);
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    minHeight: `${height}px`,
    fontSize: `${props.object.fontSize * props.scale}px`,
    fontFamily: props.object.fontFamily,
    fontWeight: props.object.fontWeight,
    fontStyle: props.object.fontStyle,
    textAlign: props.object.textAlign,
    color: props.object.color,
    lineHeight: String(props.object.lineHeight),
  };
});

onMounted(async () => {
  await nextTick();
  textareaRef.value?.focus();
  textareaRef.value?.select();
});
</script>

<style scoped>
.inline-editor {
  position: absolute;
  margin: 0;
  padding: 0;
  border: 2px solid var(--color-primary);
  border-radius: 2px;
  background: white;
  resize: none;
  outline: none;
  box-shadow: var(--shadow-md);
  letter-spacing: inherit;
  z-index: 10;
}
</style>

<template>
  <div class="inline-editor-wrapper" :style="wrapperStyle">
    <div
      ref="editorRef"
      class="inline-editor"
      contenteditable="plaintext-only"
      :style="editorStyle"
      @input="onInput"
      @blur="emit('finish')"
      @keydown.escape.prevent="emit('cancel')"
      @keydown.enter.exact.prevent="emit('finish')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
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

const editorRef = ref<HTMLDivElement | null>(null);

const wrapperStyle = computed(() => {
  const left = props.offsetX + props.object.x * props.scale;
  const top = props.offsetY + props.object.y * props.scale;
  const width = props.object.width * props.scale;
  const height = props.object.height * props.scale;
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    minHeight: `${height}px`,
    justifyContent:
      props.object.verticalAlign === 'middle'
        ? 'center'
        : props.object.verticalAlign === 'bottom'
          ? 'flex-end'
          : 'flex-start',
  };
});

const editorStyle = computed(
  (): Record<string, string> => ({
    fontSize: `${props.object.fontSize * props.scale}px`,
    fontFamily: props.object.fontFamily,
    fontWeight: props.object.fontWeight,
    fontStyle: props.object.fontStyle,
    textAlign: props.object.textAlign,
    color: props.object.color,
    lineHeight: String(props.object.lineHeight),
    letterSpacing: `${(props.object.letterSpacing ?? 0) * props.scale}px`,
    whiteSpace: props.object.wrap ? 'pre-wrap' : 'pre',
    wordBreak: props.object.wrap ? 'break-word' : 'normal',
  }),
);

function onInput(event: Event): void {
  const el = event.target as HTMLElement;
  emit('update:content', el.innerText);
}

onMounted(async () => {
  await nextTick();
  const el = editorRef.value;
  if (!el) return;
  el.textContent = props.object.content;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
});
</script>

<style scoped>
.inline-editor-wrapper {
  position: absolute;
  display: flex;
  flex-direction: column;
  pointer-events: none;
  z-index: 10;
}

.inline-editor {
  margin: 0;
  padding: 0;
  background: white;
  outline: none;
  box-shadow:
    0 0 0 2px var(--color-primary),
    var(--shadow-md);
  border-radius: 2px;
  pointer-events: auto;
  width: 100%;
}
</style>

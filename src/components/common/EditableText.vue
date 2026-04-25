<template>
  <span class="editable" :class="{ 'editable--editing': editing }">
    <button
      v-if="!editing"
      type="button"
      class="editable__display"
      :title="editLabel"
      :aria-label="editLabel"
      @click.stop="startEdit"
      @keydown.enter.prevent="startEdit"
      @keydown.space.prevent="startEdit"
    >
      <span class="editable__text">{{ value || placeholder }}</span>
      <span class="editable__pencil" aria-hidden="true">✎</span>
    </button>
    <input
      v-else
      ref="inputRef"
      v-model="draft"
      type="text"
      class="editable__input"
      :aria-label="editLabel"
      @keydown.enter.prevent="commit"
      @keydown.escape.prevent="cancel"
      @blur="commit"
      @click.stop
      @mousedown.stop
    />
  </span>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    value: string;
    /** ARIA / tooltip label for the trigger and the input. */
    editLabel: string;
    /** Shown when the value is empty (also used as input placeholder). */
    placeholder?: string;
    /** Open into edit mode immediately on mount — used after "Add column"
     *  to focus the freshly-created header without the user clicking. */
    autoEdit?: boolean;
  }>(),
  { placeholder: '', autoEdit: false },
);

const emit = defineEmits<{
  (e: 'update', next: string): void;
}>();

const editing = ref(false);
const draft = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

async function startEdit(): Promise<void> {
  draft.value = props.value;
  editing.value = true;
  await nextTick();
  inputRef.value?.focus();
  inputRef.value?.select();
}

function commit(): void {
  if (!editing.value) return;
  editing.value = false;
  const next = draft.value.trim();
  // Empty input reverts to the previous value — most uses (dataset name,
  // column header) require a non-empty string.
  if (!next || next === props.value) return;
  emit('update', next);
}

function cancel(): void {
  if (!editing.value) return;
  editing.value = false;
  draft.value = props.value;
}

watch(
  () => props.autoEdit,
  open => {
    if (open) void startEdit();
  },
  { immediate: true },
);
</script>

<style scoped>
.editable {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.editable__display {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  min-width: 0;
}

.editable__display:hover {
  background: rgba(0, 0, 0, 0.05);
}

.editable__display:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.editable__text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.editable__pencil {
  font-size: 11px;
  color: var(--color-text-muted);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--easing);
  flex-shrink: 0;
}

.editable__display:hover .editable__pencil,
.editable__display:focus-visible .editable__pencil {
  opacity: 1;
}

.editable__input {
  width: 100%;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-bg-panel);
  color: var(--color-text);
  font: inherit;
}

.editable__input:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
}
</style>

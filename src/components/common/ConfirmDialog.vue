<template>
  <Modal :open="open" size="sm" :title="title" :close-label="cancelLabel" @close="onCancel">
    <p v-if="message" class="confirm__message">{{ message }}</p>

    <template #footer>
      <button type="button" class="confirm__btn confirm__btn--ghost" @click="onCancel">
        {{ cancelLabel }}
      </button>
      <button
        v-if="secondaryLabel"
        type="button"
        class="confirm__btn"
        :class="`confirm__btn--${secondaryTone ?? 'primary'}`"
        @click="onSecondary"
      >
        {{ secondaryLabel }}
      </button>
      <button
        type="button"
        class="confirm__btn"
        :class="`confirm__btn--${primaryButtonTone}`"
        @click="onConfirm"
      >
        {{ primaryButtonLabel }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Modal from './Modal.vue';
import type { DialogTone } from '@/composables/useConfirm';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    cancelLabel: string;
    // Binary confirm shape:
    confirmLabel?: string;
    tone?: DialogTone;
    // Ternary choose shape:
    primaryLabel?: string;
    secondaryLabel?: string;
    primaryTone?: DialogTone;
    secondaryTone?: DialogTone;
  }>(),
  { message: '', tone: 'primary' },
);

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'secondary'): void;
  (e: 'cancel'): void;
}>();

const primaryButtonLabel = computed(() => props.primaryLabel ?? props.confirmLabel ?? '');
const primaryButtonTone = computed<DialogTone>(() => props.primaryTone ?? props.tone ?? 'primary');

function onConfirm(): void {
  emit('confirm');
}

function onSecondary(): void {
  emit('secondary');
}

function onCancel(): void {
  emit('cancel');
}
</script>

<style scoped>
.confirm__message {
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: 1.5;
  margin: 0;
}

.confirm__btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  border: 1px solid transparent;
}

.confirm__btn--ghost {
  background: transparent;
  color: var(--color-text-secondary);
}

.confirm__btn--ghost:hover {
  background: var(--color-bg-canvas);
  color: var(--color-text);
}

.confirm__btn--primary {
  background: var(--color-primary);
  color: white;
}

.confirm__btn--primary:hover {
  background: var(--color-primary-hover);
}

.confirm__btn--danger {
  background: var(--color-error);
  color: white;
}

.confirm__btn--danger:hover {
  filter: brightness(0.92);
}
</style>

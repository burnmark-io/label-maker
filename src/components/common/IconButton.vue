<template>
  <button
    type="button"
    class="icon-btn"
    :class="{ 'icon-btn--active': active }"
    :aria-label="label"
    :aria-pressed="active === undefined ? undefined : active"
    :disabled="disabled"
    :title="title ?? label"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();
</script>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  border: 1px solid transparent;
  transition:
    background var(--duration-fast) var(--easing),
    color var(--duration-fast) var(--easing),
    border-color var(--duration-fast) var(--easing);
}

.icon-btn:hover:not(:disabled) {
  background: var(--color-bg-canvas);
  color: var(--color-text);
  border-color: var(--color-border);
}

.icon-btn--active {
  background: var(--color-primary-light);
  color: var(--color-primary-text);
  border-color: var(--color-primary-light);
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>

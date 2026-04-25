<template>
  <label class="toggle">
    <span class="toggle__label">{{ label }}</span>
    <input
      type="checkbox"
      class="toggle__input"
      :checked="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="toggle__track" aria-hidden="true">
      <span class="toggle__thumb" />
    </span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();
</script>

<style scoped>
.toggle {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  cursor: pointer;
  user-select: none;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.toggle__label {
  flex: 1;
}

.toggle__input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle__track {
  position: relative;
  width: 32px;
  height: 18px;
  background: var(--color-border-strong);
  border-radius: 999px;
  transition: background var(--duration-fast) var(--easing);
}

.toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 999px;
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-fast) var(--easing);
}

.toggle__input:checked ~ .toggle__track {
  background: var(--color-primary);
}

.toggle__input:checked ~ .toggle__track .toggle__thumb {
  transform: translateX(14px);
}

.toggle__input:focus-visible ~ .toggle__track {
  box-shadow: var(--focus-ring);
}
</style>

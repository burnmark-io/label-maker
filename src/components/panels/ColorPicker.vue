<template>
  <div class="color-picker">
    <span class="color-picker__label">{{ label }}</span>
    <div class="color-picker__swatches">
      <button
        v-for="color in palette"
        :key="color.value"
        type="button"
        :title="color.name"
        :aria-label="color.name"
        :aria-pressed="value === color.value"
        class="color-picker__swatch"
        :class="{ 'color-picker__swatch--active': value === color.value }"
        :style="{ background: color.value }"
        @click="emit('update:value', color.value)"
      />
      <input
        type="color"
        class="color-picker__input"
        :value="value"
        @input="emit('update:value', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
}>();

const emit = defineEmits<{
  (e: 'update:value', value: string): void;
}>();

/**
 * Thermal-friendly palette. Black is the default for monochrome printers.
 * Red is the second plane on Brother QL with DK-22251. The greys give a
 * sense of how mid-tones threshold at print time.
 */
const palette = [
  { name: 'Black', value: '#1c1917' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Dark grey', value: '#57534e' },
  { name: 'Light grey', value: '#a8a29e' },
];
</script>

<style scoped>
.color-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.color-picker__label {
  display: block;
}

.color-picker__swatches {
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-picker__swatch {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  border: 2px solid white;
  box-shadow: 0 0 0 1px var(--color-border);
  cursor: pointer;
  transition: transform var(--duration-fast) var(--easing);
}

.color-picker__swatch:hover {
  transform: scale(1.08);
}

.color-picker__swatch--active {
  box-shadow: 0 0 0 2px var(--color-primary);
}

.color-picker__input {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}
</style>

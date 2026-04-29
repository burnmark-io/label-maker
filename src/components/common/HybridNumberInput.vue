<template>
  <div class="hybrid" :class="{ 'hybrid--mixed': mixed }">
    <input
      ref="numberRef"
      type="number"
      class="hybrid__number"
      :value="mixed ? '' : displayValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :placeholder="mixed ? '—' : undefined"
      :aria-label="ariaLabel"
      @change="onNumberChange"
    />
    <input
      v-if="!mixed"
      type="range"
      class="hybrid__slider"
      :value="clampedValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @input="onSliderInput"
    />
    <span v-if="suffix && !mixed" class="hybrid__suffix" aria-hidden="true">{{ suffix }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min: number;
    max: number;
    step?: number;
    /** When true, render in mixed-value state (multi-select with differing values). */
    mixed?: boolean;
    disabled?: boolean;
    ariaLabel: string;
    suffix?: string;
    /** Display formatter for the number input (e.g. percent for opacity 0–1). */
    format?: (v: number) => number;
    /** Inverse of `format` — convert displayed value back to model value. */
    parse?: (v: number) => number;
  }>(),
  { step: 1, mixed: false, disabled: false, suffix: '' },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
}>();

const numberRef = ref<HTMLInputElement | null>(null);

const clampedValue = computed(() => clamp(props.modelValue, props.min, props.max));

const displayValue = computed<number>(() => {
  if (props.format) return props.format(clampedValue.value);
  return clampedValue.value;
});

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function commit(displayed: number): void {
  if (Number.isNaN(displayed)) return;
  const raw = props.parse ? props.parse(displayed) : displayed;
  const clamped = clamp(raw, props.min, props.max);
  if (clamped === props.modelValue) return;
  emit('update:modelValue', clamped);
}

function onNumberChange(event: Event): void {
  const el = event.target as HTMLInputElement;
  const v = Number(el.value);
  if (Number.isNaN(v)) {
    // Restore the displayed value if the input is empty / unparseable.
    el.value = String(displayValue.value);
    return;
  }
  commit(v);
  // Rewrite the input with the clamped, post-commit value so out-of-range
  // typed values snap visually to the bound.
  el.value = String(displayValue.value);
}

function onSliderInput(event: Event): void {
  const v = Number((event.target as HTMLInputElement).value);
  // Slider always emits in display units when format/parse are in use —
  // but a slider can't render the raw model space directly, so keep the
  // slider bound to model units and convert only the number input.
  // i.e. for opacity (model 0–1, display 0–100), the slider operates on
  // 0–100 (its min/max are passed in display units), and parse() converts
  // back to model units on commit.
  commit(v);
}
</script>

<style scoped>
.hybrid {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-transform: none;
  letter-spacing: 0;
}

.hybrid__number {
  width: 64px;
  flex-shrink: 0;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-panel);
  color: var(--color-text);
  font-size: var(--text-sm);
  font-family: inherit;
}

.hybrid__number:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
}

.hybrid__slider {
  flex: 1;
  min-width: 0;
}

.hybrid__suffix {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.hybrid--mixed .hybrid__number {
  font-style: italic;
  color: var(--color-text-muted);
}
</style>

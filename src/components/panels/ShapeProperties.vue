<template>
  <div class="props">
    <div class="shape-picker" role="group" :aria-label="t('properties.shape.type')">
      <button
        v-for="option in shapeOptions"
        :key="option.value"
        type="button"
        class="shape-picker__chip"
        :class="{ 'shape-picker__chip--active': object.shape === option.value }"
        :aria-pressed="object.shape === option.value"
        :aria-label="option.label"
        :title="option.label"
        @click="update('shape', option.value)"
      >
        <span class="shape-picker__icon" aria-hidden="true">{{ option.icon }}</span>
        <span class="shape-picker__label">{{ option.label }}</span>
      </button>
    </div>

    <ToggleField
      v-if="object.shape !== 'line'"
      :label="t('properties.shape.fill')"
      :model-value="object.fill"
      @update:model-value="update('fill', $event)"
    />

    <ColorPicker
      :label="t('properties.color')"
      :value="object.color"
      @update:value="update('color', $event)"
    />

    <label v-if="!object.fill || object.shape === 'line'" class="props__field">
      <span>{{ t('properties.shape.strokeWidth') }}</span>
      <input
        type="number"
        min="1"
        max="40"
        :value="object.strokeWidth"
        class="props__input"
        @change="update('strokeWidth', clamp(Number(($event.target as HTMLInputElement).value), 1, 40))"
      />
    </label>

    <label v-if="object.shape === 'rectangle'" class="props__field">
      <span>{{ t('properties.shape.cornerRadius') }}</span>
      <HybridNumberInput
        :model-value="object.cornerRadius ?? 0"
        :min="0"
        :max="80"
        :step="1"
        :ariaLabel="t('properties.shape.cornerRadius')"
        @update:model-value="update('cornerRadius', $event)"
      />
    </label>

    <label v-if="object.shape === 'line'" class="props__field">
      <span>{{ t('properties.shape.lineDirection') }}</span>
      <select
        :value="object.lineDirection ?? 'horizontal'"
        class="props__input"
        @change="
          update(
            'lineDirection',
            ($event.target as HTMLSelectElement).value as ShapeObject['lineDirection'],
          )
        "
      >
        <option value="horizontal">{{ t('properties.shape.lineHorizontal') }}</option>
        <option value="vertical">{{ t('properties.shape.lineVertical') }}</option>
        <option value="diagonal-ltr">{{ t('properties.shape.lineDiagonalLtr') }}</option>
        <option value="diagonal-rtl">{{ t('properties.shape.lineDiagonalRtl') }}</option>
      </select>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ShapeObject } from '@burnmark-io/designer-core';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import ToggleField from './ToggleField.vue';
import ColorPicker from './ColorPicker.vue';
import HybridNumberInput from '@/components/common/HybridNumberInput.vue';

const props = defineProps<{ object: ShapeObject }>();
const { t } = useI18n();
const designer = useDesignerStore();

const shapeOptions = computed(() => [
  { value: 'rectangle' as const, icon: '▢', label: t('toolbar.shapeRectangle') },
  { value: 'ellipse' as const, icon: '○', label: t('toolbar.shapeCircle') },
  { value: 'line' as const, icon: '╱', label: t('toolbar.shapeLine') },
]);

function update<K extends keyof ShapeObject>(key: K, value: ShapeObject[K]): void {
  designer.updateObject(props.object.id, { [key]: value } as Partial<ShapeObject>);
}

function clamp(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo;
  return Math.min(Math.max(v, lo), hi);
}
</script>

<style scoped>
@import './properties-panel.css';

.shape-picker {
  display: flex;
  gap: var(--space-2);
}

.shape-picker__chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-2) var(--space-1);
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  text-transform: none;
  letter-spacing: 0;
  transition:
    background var(--duration-fast) var(--easing),
    border-color var(--duration-fast) var(--easing),
    color var(--duration-fast) var(--easing);
}

.shape-picker__chip:hover {
  border-color: var(--color-primary);
  color: var(--color-text);
}

.shape-picker__chip--active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary-text);
}

.shape-picker__icon {
  font-size: 20px;
  line-height: 1;
}

.shape-picker__label {
  font-weight: var(--weight-medium);
}
</style>

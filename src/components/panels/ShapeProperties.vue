<template>
  <div class="props">
    <label class="props__field">
      <span>{{ t('properties.shape.type') }}</span>
      <select
        :value="object.shape"
        class="props__input"
        @change="
          update('shape', ($event.target as HTMLSelectElement).value as ShapeObject['shape'])
        "
      >
        <option value="rectangle">{{ t('toolbar.shapeRectangle') }}</option>
        <option value="ellipse">{{ t('toolbar.shapeCircle') }}</option>
        <option value="line">{{ t('toolbar.shapeLine') }}</option>
      </select>
    </label>

    <ToggleField
      v-if="object.shape !== 'line'"
      :label="t('properties.shape.fill')"
      :model-value="object.fill"
      @update:model-value="update('fill', $event)"
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

    <ColorPicker
      :label="t('properties.color')"
      :value="object.color"
      @update:value="update('color', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ShapeObject } from '@burnmark-io/designer-core';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import ToggleField from './ToggleField.vue';
import ColorPicker from './ColorPicker.vue';
import HybridNumberInput from '@/components/common/HybridNumberInput.vue';

const props = defineProps<{ object: ShapeObject }>();
const { t } = useI18n();
const designer = useDesignerStore();

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
</style>

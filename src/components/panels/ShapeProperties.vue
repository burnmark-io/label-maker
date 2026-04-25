<template>
  <div class="props">
    <label class="props__field">
      <span>{{ t('properties.shape.type') }}</span>
      <select
        :value="object.shape"
        class="props__input"
        @change="update('shape', ($event.target as HTMLSelectElement).value as ShapeObject['shape'])"
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
      <span>{{ t('properties.shape.strokeWidth') }} ({{ object.strokeWidth }})</span>
      <input
        type="range"
        min="1"
        max="40"
        :value="object.strokeWidth"
        class="props__input"
        @input="update('strokeWidth', Number(($event.target as HTMLInputElement).value))"
      />
    </label>

    <label v-if="object.shape === 'rectangle'" class="props__field">
      <span>{{ t('properties.shape.cornerRadius') }} ({{ object.cornerRadius ?? 0 }})</span>
      <input
        type="range"
        min="0"
        max="80"
        :value="object.cornerRadius ?? 0"
        class="props__input"
        @input="update('cornerRadius', Number(($event.target as HTMLInputElement).value))"
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

const props = defineProps<{ object: ShapeObject }>();
const { t } = useI18n();
const designer = useDesignerStore();

function update<K extends keyof ShapeObject>(key: K, value: ShapeObject[K]): void {
  designer.updateObject(props.object.id, { [key]: value } as Partial<ShapeObject>);
}
</script>

<style scoped>
@import './properties-panel.css';
</style>

<template>
  <div class="props">
    <label class="props__field">
      <span>{{ t('properties.image.fit') }}</span>
      <select
        :value="object.fit"
        class="props__input"
        @change="update('fit', ($event.target as HTMLSelectElement).value as ImageObject['fit'])"
      >
        <option value="contain">{{ t('properties.image.fitContain') }}</option>
        <option value="cover">{{ t('properties.image.fitCover') }}</option>
        <option value="fill">{{ t('properties.image.fitFill') }}</option>
        <option value="none">{{ t('properties.image.fitNone') }}</option>
      </select>
    </label>

    <label class="props__field">
      <span>{{ t('properties.image.threshold') }} ({{ object.threshold }})</span>
      <input
        type="range"
        min="0"
        max="255"
        :value="object.threshold"
        class="props__input"
        @input="update('threshold', Number(($event.target as HTMLInputElement).value))"
      />
    </label>

    <ToggleField
      :label="t('properties.image.dither')"
      :model-value="object.dither"
      @update:model-value="update('dither', $event)"
    />
    <ToggleField
      :label="t('properties.image.invert')"
      :model-value="object.invert"
      @update:model-value="update('invert', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ImageObject } from '@burnmark-io/designer-core';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import ToggleField from './ToggleField.vue';

const props = defineProps<{ object: ImageObject }>();
const { t } = useI18n();
const designer = useDesignerStore();

function update<K extends keyof ImageObject>(key: K, value: ImageObject[K]): void {
  designer.updateObject(props.object.id, { [key]: value } as Partial<ImageObject>);
}
</script>

<style scoped>
@import './properties-panel.css';
</style>

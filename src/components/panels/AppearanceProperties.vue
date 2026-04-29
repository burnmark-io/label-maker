<template>
  <div class="props">
    <h3 class="props__section-heading">{{ t('properties.appearance') }}</h3>
    <label class="props__field">
      <span>{{ t('properties.opacity') }}</span>
      <HybridNumberInput
        :model-value="opacityDisplay"
        :min="0"
        :max="100"
        :step="1"
        suffix="%"
        :ariaLabel="t('properties.opacity')"
        @update:model-value="onOpacityChange"
      />
    </label>

    <ToggleField
      :label="t('properties.visible')"
      :model-value="object.visible"
      @update:model-value="update('visible', $event)"
    />
    <ToggleField
      :label="t('properties.locked')"
      :model-value="object.locked"
      @update:model-value="update('locked', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LabelObject } from '@burnmark-io/designer-core';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import HybridNumberInput from '@/components/common/HybridNumberInput.vue';
import ToggleField from './ToggleField.vue';

const props = defineProps<{ object: LabelObject }>();
const { t } = useI18n();
const designer = useDesignerStore();

const opacityDisplay = computed(() => Math.round((props.object.opacity ?? 1) * 100));

function onOpacityChange(percent: number): void {
  update('opacity', Math.max(0, Math.min(1, percent / 100)));
}

function update<K extends keyof LabelObject>(key: K, value: LabelObject[K]): void {
  designer.updateObject(props.object.id, { [key]: value } as Partial<LabelObject>);
}
</script>

<style scoped>
@import './properties-panel.css';
</style>

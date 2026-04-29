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
        :mixed="opacityMixed"
        suffix="%"
        :ariaLabel="t('properties.opacity')"
        @update:model-value="onOpacityChange"
      />
    </label>

    <ToggleField
      :label="t('properties.visible')"
      :model-value="firstObject.visible"
      @update:model-value="updateAll('visible', $event)"
    />
    <ToggleField
      :label="t('properties.locked')"
      :model-value="firstObject.locked"
      @update:model-value="updateAll('locked', $event)"
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

const props = defineProps<{ objects: readonly LabelObject[] }>();
const { t } = useI18n();
const designer = useDesignerStore();

const firstObject = computed(() => props.objects[0]!);

const opacityMixed = computed(() => {
  if (props.objects.length < 2) return false;
  const first = props.objects[0]!.opacity ?? 1;
  return props.objects.some(o => (o.opacity ?? 1) !== first);
});

const opacityDisplay = computed(() => Math.round((firstObject.value.opacity ?? 1) * 100));

function onOpacityChange(percent: number): void {
  const opacity = Math.max(0, Math.min(1, percent / 100));
  updateAll('opacity', opacity);
}

function updateAll<K extends keyof LabelObject>(key: K, value: LabelObject[K]): void {
  for (const obj of props.objects) {
    designer.updateObject(obj.id, { [key]: value } as Partial<LabelObject>);
  }
}
</script>

<style scoped>
@import './properties-panel.css';
</style>

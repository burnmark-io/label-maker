<template>
  <div class="props">
    <label class="props__field">
      <span>{{ t('properties.name') }}</span>
      <input
        type="text"
        class="props__input"
        :value="object.name ?? ''"
        :placeholder="object.type"
        @input="update('name', ($event.target as HTMLInputElement).value || undefined)"
      />
    </label>

    <div class="props__row">
      <label class="props__field">
        <span>{{ t('properties.x') }}</span>
        <input
          type="number"
          class="props__input"
          :value="Math.round(object.x)"
          @change="update('x', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label class="props__field">
        <span>{{ t('properties.y') }}</span>
        <input
          type="number"
          class="props__input"
          :value="Math.round(object.y)"
          @change="update('y', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
    </div>

    <div class="props__row">
      <label class="props__field">
        <span>{{ t('properties.width') }}</span>
        <input
          type="number"
          min="1"
          class="props__input"
          :value="Math.round(object.width)"
          @change="update('width', Math.max(1, Number(($event.target as HTMLInputElement).value)))"
        />
      </label>
      <label class="props__field">
        <span>{{ t('properties.height') }}</span>
        <input
          type="number"
          min="1"
          class="props__input"
          :value="Math.round(object.height)"
          @change="update('height', Math.max(1, Number(($event.target as HTMLInputElement).value)))"
        />
      </label>
    </div>

    <label class="props__field">
      <span>{{ t('properties.rotation') }}</span>
      <HybridNumberInput
        :model-value="Math.round(object.rotation)"
        :min="-180"
        :max="180"
        :step="1"
        suffix="°"
        :ariaLabel="t('properties.rotation')"
        @update:model-value="update('rotation', $event)"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import type { LabelObject } from '@burnmark-io/designer-core';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import HybridNumberInput from '@/components/common/HybridNumberInput.vue';

const props = defineProps<{ object: LabelObject }>();
const { t } = useI18n();
const designer = useDesignerStore();

function update<K extends keyof LabelObject>(key: K, value: LabelObject[K]): void {
  designer.updateObject(props.object.id, { [key]: value } as Partial<LabelObject>);
}
</script>

<style scoped>
@import './properties-panel.css';
</style>

<template>
  <div class="properties-panel">
    <h2 class="panel__title">{{ t('panel.properties') }}</h2>
    <p v-if="!selected" class="panel__empty">{{ t('panel.noSelection') }}</p>
    <template v-else>
      <CommonProperties :object="selected" />
      <TextProperties v-if="selected.type === 'text'" :object="selected" />
      <ImageProperties v-else-if="selected.type === 'image'" :object="selected" />
      <BarcodeProperties v-else-if="selected.type === 'barcode'" :object="selected" />
      <ShapeProperties v-else-if="selected.type === 'shape'" :object="selected" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import type { LabelObject } from '@burnmark-io/designer-core';
import CommonProperties from './CommonProperties.vue';
import TextProperties from './TextProperties.vue';
import ImageProperties from './ImageProperties.vue';
import BarcodeProperties from './BarcodeProperties.vue';
import ShapeProperties from './ShapeProperties.vue';

const { t } = useI18n();
const designer = useDesignerStore();

const selected = computed<LabelObject | undefined>(() => {
  const id = designer.selection[0];
  if (!id) return undefined;
  return designer.document.objects.find((o) => o.id === id);
});
</script>

<style scoped>
.properties-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.panel__title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.panel__empty {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  padding: var(--space-4) 0;
}
</style>

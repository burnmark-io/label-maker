<template>
  <div class="properties-panel">
    <h2 class="panel__title">{{ t('panel.properties') }}</h2>
    <p v-if="!selected" class="panel__empty">{{ t('panel.noSelection') }}</p>
    <div v-else class="properties-panel__form">
      <p class="properties-panel__type">{{ selected.type }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import type { LabelObject } from '@burnmark-io/designer-core';

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
  gap: var(--space-3);
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
}

.properties-panel__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.properties-panel__type {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: var(--weight-medium);
}
</style>

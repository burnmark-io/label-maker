<template>
  <div class="properties-panel">
    <p class="panel__empty">{{ t('properties.empty') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<style scoped>
.properties-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.panel__empty {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>

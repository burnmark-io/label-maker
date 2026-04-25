<template>
  <div class="data-panel">
    <h2 class="panel__title">{{ t('panel.data') }}</h2>
    <p class="panel__empty">{{ t('common.loading') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<style scoped>
.data-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.panel__title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.panel__empty {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>

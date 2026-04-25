<template>
  <div class="canvas-area">
    <div class="canvas-area__placeholder">
      <span aria-hidden="true">🏷️</span>
      <p>{{ t('panel.emptyObjects') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<style scoped>
.canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-area__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  border-radius: var(--radius-lg);
  background: var(--color-bg-panel);
  border: 1px dashed var(--color-border-strong);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  box-shadow: var(--shadow-sm);
}

.canvas-area__placeholder span {
  font-size: 32px;
  line-height: 1;
}
</style>

<template>
  <header class="topbar" role="banner">
    <div class="topbar__brand">
      <span class="topbar__logo" aria-hidden="true">🏷️</span>
      <span class="topbar__name">{{ t('app.name') }}</span>
    </div>

    <div class="topbar__center">
      <PrinterStatus />
    </div>

    <div class="topbar__actions">
      <IconButton
        :label="t('topbar.undo')"
        :disabled="!designer.canUndo"
        :title="t('topbar.undo')"
        @click="designer.undo()"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
        </svg>
      </IconButton>
      <IconButton
        :label="t('topbar.redo')"
        :disabled="!designer.canRedo"
        :title="t('topbar.redo')"
        @click="designer.redo()"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 15-6.7L21 13" />
        </svg>
      </IconButton>

      <button class="topbar__btn" type="button" :aria-label="t('topbar.help')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span class="topbar__btn-label">{{ t('topbar.help') }}</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import IconButton from '@/components/common/IconButton.vue';
import PrinterStatus from '@/components/printer/PrinterStatus.vue';
import { useDesignerStore } from '@/stores/designer';

const { t } = useI18n();
const designer = useDesignerStore();
</script>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--topbar-height);
  padding: 0 var(--space-4);
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
  gap: var(--space-4);
  flex-shrink: 0;
}

.topbar__brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 180px;
}

.topbar__logo {
  font-size: 22px;
  line-height: 1;
}

.topbar__name {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  letter-spacing: -0.01em;
}

.topbar__center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.topbar__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 180px;
  justify-content: flex-end;
}

.topbar__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  border: 1px solid transparent;
  background: transparent;
  transition:
    background var(--duration-fast) var(--easing),
    border-color var(--duration-fast) var(--easing);
}

.topbar__btn:hover {
  background: var(--color-bg-canvas);
  border-color: var(--color-border);
}

.topbar__btn--primary {
  background: var(--color-primary);
  color: white;
}

.topbar__btn--primary:hover {
  background: var(--color-primary-hover);
  border-color: transparent;
}

@media (max-width: 720px) {
  .topbar__btn-label {
    display: none;
  }
  .topbar__brand {
    min-width: auto;
  }
}
</style>

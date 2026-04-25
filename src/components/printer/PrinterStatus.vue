<template>
  <button class="status" type="button" :title="label">
    <span class="status__dot" :class="`status__dot--${dotClass}`" aria-hidden="true" />
    <span class="status__label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePrinterStore } from '@/stores/printer';

const { t } = useI18n();
const printer = usePrinterStore();

const dotClass = computed(() => {
  switch (printer.state.status) {
    case 'connected':
      return 'green';
    case 'paired':
    case 'connecting':
      return 'yellow';
    case 'error':
      return 'red';
    default:
      return 'gray';
  }
});

const label = computed(() => {
  const s = printer.state;
  switch (s.status) {
    case 'connected':
      if (s.media) return t('printer.connectedWithMedia', { model: s.model, media: s.media });
      return t('printer.connectedSelectMedia', { model: s.model });
    case 'paired':
      return t('printer.paired', { model: s.model });
    case 'connecting':
      return t('printer.connecting');
    case 'error':
      return t('printer.error', { model: s.model });
    default:
      return t('printer.disconnected');
  }
});
</script>

<style scoped>
.status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  transition: background var(--duration-fast) var(--easing);
}

.status:hover {
  background: var(--color-bg-panel);
  color: var(--color-text);
}

.status__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.status__dot--green {
  background: var(--color-success);
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.15);
}

.status__dot--yellow {
  background: var(--color-warning);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
}

.status__dot--red {
  background: var(--color-error);
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.18);
}

.status__dot--gray {
  background: var(--color-text-muted);
}

.status__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}
</style>

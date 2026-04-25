<template>
  <button
    class="status"
    type="button"
    :title="label"
    :aria-expanded="open"
    aria-haspopup="dialog"
  >
    <span class="status__dot" :class="`status__dot--${dotClass}`" aria-hidden="true" />
    <span class="status__label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePrinterStore } from '@/stores/printer';

defineProps<{ open?: boolean }>();

const { t } = useI18n();
const printer = usePrinterStore();

const dotClass = computed(() => {
  switch (printer.connection.kind) {
    case 'connected':
      return 'green';
    case 'connecting':
      return 'yellow';
    case 'error':
      return 'red';
    default:
      return printer.lastPaired ? 'yellow' : 'gray';
  }
});

const label = computed(() => {
  const c = printer.connection;
  if (c.kind === 'connected') {
    const media = printer.effectiveMedia;
    if (media) return t('printer.connectedWithMedia', { model: c.model, media: media.name });
    return t('printer.connectedSelectMedia', { model: c.model });
  }
  if (c.kind === 'connecting') return t('printer.connecting');
  if (c.kind === 'error') {
    return c.model ? t('printer.error', { model: c.model }) : t('printer.errorGeneric');
  }
  if (printer.lastPaired) {
    return t('printer.paired', { model: printer.lastPaired.model });
  }
  return t('printer.disconnected');
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

.status[aria-expanded='true'] {
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

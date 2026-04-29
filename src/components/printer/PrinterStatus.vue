<template>
  <button
    class="status"
    type="button"
    :title="tooltip"
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
import { FAMILIES_WITH_STATUS_POLLING } from '@/lib/printer/registry';
import { localisedErrorMessage } from '@/composables/usePrinterErrors';

defineProps<{ open?: boolean }>();

const { t } = useI18n();
const printer = usePrinterStore();

type PillState = 'disconnected' | 'connecting' | 'ready' | 'warning' | 'error';

const pillState = computed<PillState>(() => {
  const c = printer.connection;
  if (c.kind === 'disconnected') return 'disconnected';
  if (c.kind === 'connecting') return 'connecting';
  if (c.kind === 'error') return 'error';
  // connected — derive from the last poll. Pre-first-tick (lastStatus
  // null) we show ready rather than "unknown" to avoid a yellow flash
  // every time someone reconnects.
  if (!FAMILIES_WITH_STATUS_POLLING.has(c.family)) return 'ready';
  const status = printer.lastStatus;
  if (!status) return 'ready';
  if (!status.ready) return 'error';
  if (status.errors.length > 0) return 'warning';
  return 'ready';
});

const dotClass = computed(() => {
  switch (pillState.value) {
    case 'ready':
      return 'green';
    case 'warning':
      return 'yellow';
    case 'error':
      return 'red';
    case 'connecting':
      return 'yellow';
    case 'disconnected':
      return printer.lastPaired ? 'yellow' : 'gray';
  }
});

const primaryErrorMessage = computed(() => {
  const status = printer.lastStatus;
  const first = status?.errors[0];
  if (!first) return null;
  return localisedErrorMessage(first, t);
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

/**
 * Native title tooltip — surfaces the primary error first when there
 * is one (the user wants to know *why* the dot is red without opening
 * the popover); falls back to the connection label otherwise.
 */
const tooltip = computed(() => primaryErrorMessage.value ?? label.value);
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

@media (max-width: 720px) {
  .status {
    padding: var(--space-2);
    gap: 0;
  }
  .status__label {
    display: none;
  }
}
</style>

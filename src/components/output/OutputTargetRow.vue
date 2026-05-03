<template>
  <li class="row" :class="{ 'row--active': active }">
    <button
      class="row__btn"
      type="button"
      :aria-pressed="active"
      :aria-expanded="expanded"
      @click="emit('select')"
    >
      <span class="row__dot" :class="`row__dot--${dotClass}`" aria-hidden="true" />
      <span class="row__stack">
        <span class="row__label">{{ label }}</span>
        <span class="row__sub">{{ subLabel }}</span>
      </span>
    </button>
    <ul v-if="errorMessages.length > 0" class="row__errors">
      <li v-for="(msg, idx) in errorMessages" :key="idx">{{ msg }}</li>
    </ul>
    <slot v-if="expanded" name="card" />
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Connection, EngineSlotState } from '@/stores/printer';
import { localisedErrorMessage } from '@/composables/usePrinterErrors';

const props = defineProps<{
  connection: Connection;
  slot: EngineSlotState;
  active: boolean;
  expanded: boolean;
}>();

const emit = defineEmits<{ (e: 'select'): void }>();

const { t } = useI18n();

type DotClass = 'green' | 'yellow' | 'red' | 'gray';

const dotClass = computed<DotClass>(() => {
  const status = props.connection.status;
  if (!status) return 'gray';
  if (!status.ready) return 'red';
  if (status.errors.length > 0) return 'yellow';
  return 'green';
});

const label = computed(() => {
  const conn = props.connection;
  const base = conn.nickname ?? conn.model;
  return props.slot.role === 'primary' ? base : `${base} — ${props.slot.role}`;
});

const subLabel = computed(() => {
  const m = props.slot.selectedMedia ?? props.slot.detectedMedia;
  if (m) return m.name;
  return t('printer.noMediaDetected');
});

const errorMessages = computed<string[]>(() => {
  if (!props.active) return [];
  const errs = props.connection.status?.errors ?? [];
  return errs.map(e => localisedErrorMessage(e, t));
});
</script>

<style scoped>
.row {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.row--active {
  background: var(--color-bg-canvas);
}

.row__btn {
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  font-size: var(--text-sm);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.row__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.row__dot--green {
  background: var(--color-success);
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.15);
}

.row__dot--yellow {
  background: var(--color-warning);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
}

.row__dot--red {
  background: var(--color-error);
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.18);
}

.row__dot--gray {
  background: var(--color-text-muted);
}

.row__stack {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.row__label {
  font-weight: var(--weight-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row__sub {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row__errors {
  margin: 0;
  padding: 0 0 0 var(--space-3);
  list-style: disc;
  font-size: var(--text-xs);
  color: var(--color-error);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>

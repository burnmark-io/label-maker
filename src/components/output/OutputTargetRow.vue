<template>
  <li class="row" :class="{ 'row--active': active }">
    <div class="row__head">
      <button class="row__btn" type="button" :aria-pressed="active" @click="emit('select')">
        <span class="row__dot" :class="`row__dot--${dotClass}`" aria-hidden="true" />
        <span class="row__stack">
          <span class="row__label-line">
            <span class="row__label">{{ label }}</span>
            <span v-if="chipKey" class="row__chip" :class="`row__chip--${chipKey}`">
              {{ t(`support.chip.${chipKey}`) }}
            </span>
          </span>
          <span class="row__sub">{{ subLabel }}</span>
        </span>
      </button>
      <button
        v-if="collapsible"
        class="row__toggle"
        type="button"
        :aria-expanded="expanded"
        :aria-label="expanded ? t('output.row.collapse') : t('output.row.expand')"
        @click="emit('toggle-expand')"
      >
        <span class="row__chevron" :class="{ 'row__chevron--open': expanded }" aria-hidden="true"
          >▾</span
        >
      </button>
    </div>
    <ul v-if="errorMessages.length > 0" class="row__errors">
      <li v-for="(msg, idx) in errorMessages" :key="idx">{{ msg }}</li>
    </ul>
    <button
      v-if="ctaKey"
      class="row__cta"
      :class="`row__cta--${ctaKey}`"
      type="button"
      @click="emit('open-support')"
    >
      {{ t(`support.cta.${ctaKey}`) }}
    </button>
    <slot v-if="expanded" name="card" />
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Connection, EngineSlotState } from '@/stores/printer';
import { localisedErrorMessage } from '@/composables/usePrinterErrors';
import { getEffectiveSupport } from '@/lib/support';

const props = defineProps<{
  connection: Connection;
  slot: EngineSlotState;
  active: boolean;
  expanded: boolean;
  /** Whether this row has a paper card to fold; gates the chevron. */
  collapsible: boolean;
}>();

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'open-support'): void;
  (e: 'toggle-expand'): void;
}>();

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

type NonVerifiedKey = 'partial' | 'broken' | 'untested';

/** Per §1.5, worse-of-chassis-or-engine; null when verified (chip + CTA hide). */
const effectiveStatus = computed(() => getEffectiveSupport(props.connection, props.slot).status);

const chipKey = computed<NonVerifiedKey | null>(() => {
  const s = effectiveStatus.value;
  return s === 'verified' ? null : s;
});

const ctaKey = computed<NonVerifiedKey | null>(() => {
  const s = effectiveStatus.value;
  return s === 'verified' ? null : s;
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

.row__head {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  width: 100%;
}

.row__btn {
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.row__toggle {
  appearance: none;
  background: none;
  border: none;
  padding: var(--space-1);
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-muted);
  transition: background var(--duration-fast) var(--easing);
}

.row__toggle:hover {
  background: var(--color-bg-panel);
  color: var(--color-text);
}

.row__chevron {
  display: inline-block;
  font-size: var(--text-xs);
  transition: transform var(--duration-fast) var(--easing);
}

.row__chevron--open {
  transform: rotate(180deg);
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

.row__label-line {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
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

.row__chip {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  line-height: 1.4;
}

.row__chip--partial {
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-warning);
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.row__chip--broken {
  background: rgba(220, 38, 38, 0.1);
  color: var(--color-error);
  border: 1px solid rgba(220, 38, 38, 0.4);
}

.row__chip--untested {
  background: var(--color-bg-panel);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
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

.row__cta {
  appearance: none;
  background: none;
  border: none;
  padding: 0 var(--space-1);
  margin-left: calc(8px + var(--space-2));
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
  text-align: left;
  align-self: flex-start;
  border-radius: var(--radius-sm);
  transition: opacity var(--duration-fast) var(--easing);
}

.row__cta:hover {
  opacity: 0.75;
}

.row__cta--untested {
  color: var(--color-text-secondary);
}

.row__cta--partial {
  color: var(--color-warning);
}

.row__cta--broken {
  color: var(--color-error);
}
</style>

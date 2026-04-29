<template>
  <div v-if="hasData" class="source-row">
    <span class="source-row__label">{{ t('output.source.label') }}</span>
    <div class="source-row__segmented" role="radiogroup" :aria-label="t('output.source.label')">
      <button
        v-for="opt in options"
        :key="opt.kind"
        type="button"
        role="radio"
        :aria-checked="opt.kind === currentKind"
        class="source-row__segment"
        :class="{ 'source-row__segment--active': opt.kind === currentKind }"
        @click="onPick(opt.kind)"
      >
        {{ opt.label }}
      </button>
    </div>
    <div v-if="currentKind === 'range'" class="source-row__range">
      <label class="source-row__range-field">
        <span class="source-row__range-label">{{ t('output.source.rangeFrom') }}</span>
        <input
          ref="fromInputRef"
          v-model.number="fromInput"
          type="number"
          min="1"
          :max="rowCount"
          class="source-row__range-input"
          @blur="onRangeBlur"
        />
      </label>
      <label class="source-row__range-field">
        <span class="source-row__range-label">{{ t('output.source.rangeTo') }}</span>
        <input
          v-model.number="toInput"
          type="number"
          min="1"
          :max="rowCount"
          class="source-row__range-input"
          @blur="onRangeBlur"
        />
      </label>
      <span v-if="adjustedNote" class="source-row__note" role="status">{{ adjustedNote }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDataStore } from '@/stores/data';
import { usePrintConfigStore, type OutputSelection } from '@/stores/print-config';

const { t } = useI18n();
const data = useDataStore();
const config = usePrintConfigStore();

const hasData = computed(() => data.rows.length > 0);
const rowCount = computed(() => data.rows.length);

const options = computed(() => [
  { kind: 'active' as const, label: t('output.source.active') },
  { kind: 'all' as const, label: t('output.source.all') },
  { kind: 'range' as const, label: t('output.source.range') },
]);

const currentKind = computed<OutputSelection['kind']>(() => config.outputSelection.kind);

// Local mirrors for the range inputs so blur-clamp can rewrite them
// without fighting v-model on every keystroke.
const fromInput = ref<number | string>(1);
const toInput = ref<number | string>(rowCount.value || 1);
const fromInputRef = ref<HTMLInputElement | null>(null);
const adjustedNote = ref<string>('');
let noteTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => config.outputSelection,
  sel => {
    if (sel.kind === 'range') {
      fromInput.value = sel.from;
      toInput.value = sel.to;
    }
  },
  { immediate: true },
);

function onPick(kind: OutputSelection['kind']): void {
  if (kind === 'range') {
    const sel = config.outputSelection;
    if (sel.kind === 'range') {
      // already a range — leave it
      return;
    }
    const from = 1;
    const to = Math.max(1, rowCount.value);
    fromInput.value = from;
    toInput.value = to;
    config.setOutputSelection({ kind: 'range', from, to });
  } else {
    config.setOutputSelection({ kind });
  }
}

function onRangeBlur(): void {
  const total = rowCount.value;
  if (total === 0) return;
  const rawFrom =
    fromInput.value === '' || fromInput.value == null ? 1 : Number(fromInput.value);
  const rawTo =
    toInput.value === '' || toInput.value == null ? total : Number(toInput.value);
  const from = Math.min(Math.max(1, Math.round(rawFrom) || 1), total);
  const to = Math.min(Math.max(from, Math.round(rawTo) || from), total);
  const wasAdjusted = from !== rawFrom || to !== rawTo;
  fromInput.value = from;
  toInput.value = to;
  config.setOutputSelection({ kind: 'range', from, to });

  if (wasAdjusted) {
    adjustedNote.value = t('output.source.rangeAdjusted', { from, to });
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      adjustedNote.value = '';
      noteTimer = null;
    }, 3000);
  }
}
</script>

<style scoped>
.source-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.source-row__label {
  font-weight: var(--weight-medium);
}

.source-row__segmented {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-bg-canvas);
}

.source-row__segment {
  flex: 1;
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  border-right: 1px solid var(--color-border);
  cursor: pointer;
}

.source-row__segment:last-child {
  border-right: 0;
}

.source-row__segment--active {
  background: var(--color-primary);
  color: white;
}

.source-row__range {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  flex-wrap: wrap;
}

.source-row__range-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.source-row__range-label {
  font-weight: var(--weight-medium);
}

.source-row__range-input {
  width: 4.5rem;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  background: var(--color-bg-panel);
  color: var(--color-text);
}

.source-row__note {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  font-style: italic;
}
</style>

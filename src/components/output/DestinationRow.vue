<template>
  <div v-if="showRow" class="destination-row">
    <div v-if="config.showDestinationToggle" class="destination-row__toggle-wrap">
      <span class="destination-row__label">{{ t('output.destination.label') }}</span>
      <div
        class="destination-row__toggle"
        role="radiogroup"
        :aria-label="t('output.destination.label')"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="config.effectiveDestination === 'thermal'"
          class="destination-row__seg"
          :class="{ 'destination-row__seg--active': config.effectiveDestination === 'thermal' }"
          @click="onPick('thermal')"
        >
          {{ t('output.destination.thermal') }}
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="config.effectiveDestination === 'sheet'"
          class="destination-row__seg"
          :class="{ 'destination-row__seg--active': config.effectiveDestination === 'sheet' }"
          @click="onPick('sheet')"
        >
          {{ t('output.destination.sheet') }}
        </button>
      </div>
    </div>
    <button
      v-if="config.sheetPossible && config.sheetTemplate"
      type="button"
      class="destination-row__change"
      @click="emit('open-sheet-picker')"
    >
      {{
        t('output.destination.sheetCurrent', {
          brand: config.sheetTemplate.brand,
          part: config.sheetTemplate.part,
        })
      }}
    </button>
    <button
      v-else-if="!config.thermalPossible && !config.sheetPossible"
      type="button"
      class="destination-row__cta"
      @click="emit('open-sheet-picker')"
    >
      {{ t('output.destination.setupSheet') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePrintConfigStore, type PrintDestination } from '@/stores/print-config';

const { t } = useI18n();
const config = usePrintConfigStore();

const emit = defineEmits<{
  (e: 'open-sheet-picker'): void;
}>();

// The row is rendered when there's anything to show: the toggle (both
// possible), the change link (sheet configured), or the first-run CTA
// (neither configured). When only thermal is possible and no sheet is
// set up, the row collapses entirely — destination is implicitly
// thermal and there's nothing for the user to do.
const showRow = computed(
  () =>
    config.showDestinationToggle ||
    config.sheetPossible ||
    (!config.thermalPossible && !config.sheetPossible),
);

function onPick(d: PrintDestination): void {
  config.destination = d;
}
</script>

<style scoped>
.destination-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.destination-row__toggle-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.destination-row__label {
  font-weight: var(--weight-medium);
}

.destination-row__toggle {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-bg-canvas);
}

.destination-row__seg {
  flex: 1;
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  border-right: 1px solid var(--color-border);
  cursor: pointer;
}

.destination-row__seg:last-child {
  border-right: 0;
}

.destination-row__seg--active {
  background: var(--color-primary);
  color: white;
}

.destination-row__change,
.destination-row__cta {
  align-self: flex-start;
  padding: 0;
  background: transparent;
  border: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
}

.destination-row__cta {
  font-weight: var(--weight-medium);
  color: var(--color-primary);
  text-decoration: none;
}
</style>

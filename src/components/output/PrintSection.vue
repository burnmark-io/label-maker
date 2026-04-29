<template>
  <section v-if="showSection" class="output-print">
    <h3 class="output-print__heading">{{ t('output.print.heading') }}</h3>
    <DestinationRow @open-sheet-picker="emit('open-sheet-picker')" />
    <SourceRow />
    <div class="output-print__fields">
      <label class="output-print__field">
        <span class="output-print__label">{{ t('output.print.copies') }}</span>
        <input
          v-model.number="config.copies"
          type="number"
          min="1"
          max="30"
          class="output-print__input"
        />
      </label>
      <label class="output-print__field">
        <span class="output-print__label">{{ t('output.print.density') }}</span>
        <select v-model="config.density" class="output-print__input">
          <option value="light">{{ t('actions.densityLight') }}</option>
          <option value="normal">{{ t('actions.densityNormal') }}</option>
          <option value="dark">{{ t('actions.densityDark') }}</option>
        </select>
      </label>
    </div>
    <p v-if="showSummary" class="output-print__summary">{{ summaryText }}</p>
    <button
      class="output-print__action"
      type="button"
      :disabled="!canPrint"
      :title="canPrint ? '' : disabledReason"
      @click="onPrint"
    >
      {{ buttonLabel }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePrinterStore } from '@/stores/printer';
import { useDesignerStore } from '@/stores/designer';
import { useDataStore } from '@/stores/data';
import { usePrintConfigStore } from '@/stores/print-config';
import { useToast } from '@/composables/useToast';
import SourceRow from './SourceRow.vue';
import DestinationRow from './DestinationRow.vue';
import { renderSheet } from '@/services/export/sheet-render';
import { useSheetViewer } from '@/composables/useSheetViewer';

const sheetViewer = useSheetViewer();

const emit = defineEmits<{
  (e: 'open-sheet-picker'): void;
}>();

const { t } = useI18n();
const printer = usePrinterStore();
const designer = useDesignerStore();
const data = useDataStore();
const config = usePrintConfigStore();
const { show, update, dismiss } = useToast();

// Section is visible when there's any output destination available —
// either a connected thermal printer or a configured sheet template.
// The DestinationRow's first-run CTA covers the "neither" state.
const showSection = computed<boolean>(
  () => config.thermalPossible || config.sheetPossible,
);

const canPrint = computed<boolean>(() => {
  if (printer.isPrinting) return false;
  if (config.effectiveDestination === 'thermal') {
    return printer.isConnected && Boolean(printer.effectiveMedia);
  }
  // Sheet destination: requires a configured template; printer
  // connectivity is irrelevant.
  return config.sheetPossible;
});

const buttonLabel = computed(() => {
  if (config.effectiveDestination === 'sheet') {
    if (config.count <= 1) return t('output.button.printToSheet');
    return t('output.button.printToSheetWithCounts', {
      labels: config.count,
      pages: config.pageCount,
    });
  }
  return config.count > 1
    ? t('output.button.printNLabels', { n: config.count })
    : t('output.button.print');
});

const showSummary = computed(() => config.count > 1);

const summaryText = computed(() => {
  const rows = data.rows.length;
  if (rows === 0) {
    return t('output.summary.copiesOnly', { count: config.count });
  }
  return t('output.summary.rowsAndCopies', {
    rows: config.rowsForSelection.length,
    copies: config.copies,
    count: config.count,
  });
});

const disabledReason = computed<string>(() => {
  if (!printer.isConnected) return t('actions.printNoPrinter');
  if (!printer.effectiveMedia) return t('actions.printNoMedia');
  return '';
});

async function onPrint(): Promise<void> {
  if (!canPrint.value) return;
  if (config.effectiveDestination === 'sheet') {
    await onPrintToSheet();
    return;
  }
  const toastId = show(t('actions.printingTo', { model: printer.model ?? '' }), 'info', {
    sticky: true,
  });
  try {
    const variables = data.currentVariables;
    const rgba = await designer.renderToRGBA(
      Object.keys(variables).length > 0 ? variables : undefined,
    );
    const image = {
      width: rgba.width,
      height: rgba.height,
      data: new Uint8Array(rgba.data.buffer, rgba.data.byteOffset, rgba.data.byteLength),
    };
    const cps = Math.max(1, Math.min(30, config.copies || 1));
    await printer.print(image, { copies: cps, density: config.density });
    update(toastId, { message: t('actions.printSuccess'), kind: 'success', sticky: false });
    window.setTimeout(() => dismiss(toastId), 4000);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    update(toastId, {
      message: t('actions.printFailed', { error: message }),
      kind: 'error',
      sticky: false,
    });
    window.setTimeout(() => dismiss(toastId), 6000);
  }
}

async function onPrintToSheet(): Promise<void> {
  const sheet = config.sheetTemplate;
  if (!sheet) {
    emit('open-sheet-picker');
    return;
  }
  try {
    const indices = config.rowsForSelection;
    const rows = indices.map(i => data.rows[i]!).filter(Boolean);
    const result = await renderSheet(designer, {
      sheet,
      rows,
      mapping: data.mapping,
      copies: Math.max(1, config.copies || 1),
    });
    const fileName = `${designer.document.name}-${sheet.brand}-${sheet.part}.pdf`
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-');
    sheetViewer.show({
      blob: result.blob,
      fileName,
      sheetLabel: `${sheet.brand} ${sheet.part}`,
      totalLabels: result.totalLabels,
      pageCount: result.pageCount,
      labelsPerPage: result.labelsPerPage,
      emptyOnLastPage: result.emptyOnLastPage,
    });
  } catch (err) {
    show(err instanceof Error ? err.message : String(err), 'error');
  }
}
</script>

<style scoped>
.output-print {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.output-print__heading {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.output-print__fields {
  display: flex;
  gap: var(--space-3);
}

.output-print__field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.output-print__label {
  font-weight: var(--weight-medium);
}

.output-print__input {
  font-size: var(--text-sm);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text);
}

.output-print__summary {
  margin: 0;
  padding: var(--space-1) 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-border);
  text-align: center;
}

.output-print__action {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  background: var(--color-primary);
  color: white;
  border: 1px solid transparent;
}

.output-print__action:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.output-print__action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

<template>
  <section class="output-save-as-file">
    <header class="output-save-as-file__header">
      <h3 class="output-save-as-file__heading">{{ t('output.saveAsFile.heading') }}</h3>
      <select
        v-if="data.rows.length > 0"
        class="output-save-as-file__source"
        :value="selectionValue"
        :aria-label="t('output.source.label')"
        @change="onSourceChange"
      >
        <option value="active">{{ t('output.source.active') }}</option>
        <option value="all">{{ t('output.source.all') }}</option>
        <option value="range">{{ rangeOptionLabel }}</option>
      </select>
    </header>
    <div class="output-save-as-file__buttons">
      <button class="output-save-as-file__btn" type="button" @click="onExportPng">
        {{ t('output.saveAsFile.png') }}
      </button>
      <button class="output-save-as-file__btn" type="button" @click="onExportPdf">
        {{ t('output.saveAsFile.pdf') }}
      </button>
      <button
        v-if="showLabelButton"
        class="output-save-as-file__btn"
        type="button"
        @click="onExportLabel"
      >
        {{ t('output.saveAsFile.label') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { useDataStore } from '@/stores/data';
import { usePrintConfigStore } from '@/stores/print-config';
import { useToast } from '@/composables/useToast';
import { downloadBlob, safeFileName } from '@/services/file-download';
import { exportPdfBatch } from '@/services/export/pdf-batch';
import { exportPngBatch } from '@/services/export/png-batch';

const { t } = useI18n();
const designer = useDesignerStore();
const data = useDataStore();
const config = usePrintConfigStore();
const { show } = useToast();

// .label / .bnmk are single-document formats — exporting them per row
// would just be N copies of the same file. Hide when Source is anything
// other than Active.
const showLabelButton = computed(
  () => data.rows.length === 0 || config.outputSelection.kind === 'active',
);

const selectionValue = computed(() => config.outputSelection.kind);

const rangeOptionLabel = computed(() => {
  const sel = config.outputSelection;
  if (sel.kind === 'range') {
    return t('output.saveAsFile.rangeOption', { from: sel.from, to: sel.to });
  }
  return t('output.source.range');
});

function onSourceChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value as 'active' | 'all' | 'range';
  if (value === 'range') {
    const sel = config.outputSelection;
    if (sel.kind === 'range') return;
    config.setOutputSelection({
      kind: 'range',
      from: 1,
      to: Math.max(1, data.rows.length),
    });
  } else {
    config.setOutputSelection({ kind: value });
  }
}

function selectedRowsForExport(): Record<string, string>[] {
  const indices = config.rowsForSelection;
  if (indices.length === 0) return [];
  return indices.map(i => data.rows[i]!).filter(Boolean);
}

async function onExportPng(): Promise<void> {
  try {
    const rows = selectedRowsForExport();
    const result = await exportPngBatch(designer, rows, data.mapping, safeFileName(designer.document.name));
    const ext = result.zipped ? 'zip' : 'png';
    downloadBlob(result.blob, `${safeFileName(designer.document.name)}.${ext}`);
    if (result.errors.size > 0) {
      show(
        t('output.saveAsFile.errorsToast', {
          ok: result.count,
          total: rows.length || 1,
          failed: result.errors.size,
        }),
        'error',
      );
    } else {
      show(t('export.pngDownloaded'), 'success');
    }
  } catch (err) {
    show(err instanceof Error ? err.message : String(err), 'error');
  }
}

async function onExportPdf(): Promise<void> {
  try {
    const rows = selectedRowsForExport();
    const blob = await exportPdfBatch(designer, rows, data.mapping);
    downloadBlob(blob, `${safeFileName(designer.document.name)}.pdf`);
    show(t('export.pdfDownloaded'), 'success');
  } catch (err) {
    show(err instanceof Error ? err.message : String(err), 'error');
  }
}

function onExportLabel(): void {
  try {
    const json = designer.toJSON();
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, `${safeFileName(designer.document.name)}.label`);
    show(t('export.labelDownloaded'), 'success');
  } catch (err) {
    show(err instanceof Error ? err.message : String(err), 'error');
  }
}
</script>

<style scoped>
.output-save-as-file {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.output-save-as-file__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.output-save-as-file__heading {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.output-save-as-file__source {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-canvas);
  color: var(--color-text);
}

.output-save-as-file__buttons {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.output-save-as-file__btn {
  flex: 1;
  min-width: 60px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
}

.output-save-as-file__btn:hover {
  background: var(--color-bg-canvas);
}
</style>

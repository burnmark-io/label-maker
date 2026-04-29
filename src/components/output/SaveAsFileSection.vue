<template>
  <section class="output-save-as-file">
    <h3 class="output-save-as-file__heading">{{ t('output.saveAsFile.heading') }}</h3>
    <div class="output-save-as-file__buttons">
      <button class="output-save-as-file__btn" type="button" @click="onExportPng">
        {{ t('output.saveAsFile.png') }}
      </button>
      <button class="output-save-as-file__btn" type="button" @click="onExportPdf">
        {{ t('output.saveAsFile.pdf') }}
      </button>
      <button class="output-save-as-file__btn" type="button" @click="onExportLabel">
        {{ t('output.saveAsFile.label') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { useDataStore } from '@/stores/data';
import { useToast } from '@/composables/useToast';
import { downloadBlob, safeFileName } from '@/services/file-download';
import { applyMappingToRow } from '@/services/column-mapper';

const { t } = useI18n();
const designer = useDesignerStore();
const data = useDataStore();
const { show } = useToast();

async function onExportPng(): Promise<void> {
  try {
    const blob = await designer.exportPng();
    downloadBlob(blob, `${safeFileName(designer.document.name)}.png`);
    show(t('export.pngDownloaded'), 'success');
  } catch (err) {
    show(err instanceof Error ? err.message : String(err), 'error');
  }
}

async function onExportPdf(): Promise<void> {
  try {
    const rows =
      data.rows.length > 0 ? data.rows.map(row => applyMappingToRow(row, data.mapping)) : undefined;
    const blob = await designer.exportPdf(rows);
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

.output-save-as-file__heading {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
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

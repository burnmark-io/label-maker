<template>
  <div class="data-panel">
    <section class="data-panel__section">
      <h3 class="data-panel__heading">{{ t('data.placeholders.title') }}</h3>
      <p v-if="data.placeholders.length === 0" class="data-panel__empty">
        {{ t('data.placeholders.empty', { token: PLACEHOLDER_TOKEN_NAME }) }}
      </p>
      <ul v-else class="data-panel__chips">
        <li v-for="ph in data.placeholders" :key="ph" class="data-panel__chip">
          <code>{{ formatPlaceholder(ph) }}</code>
        </li>
      </ul>
    </section>

    <section class="data-panel__section">
      <DatasetSwitcher @open-editor="editorOpen = true" @import-file="onClickDropzone" />
    </section>

    <section class="data-panel__section">
      <div
        class="dropzone"
        :class="{ 'dropzone--active': isDragging, 'dropzone--busy': importing }"
        role="button"
        :tabindex="0"
        :aria-label="t('data.import.dropzoneAria')"
        @click="onClickDropzone"
        @keydown.enter.prevent="onClickDropzone"
        @keydown.space.prevent="onClickDropzone"
        @dragenter.prevent.stop="setDragging(true)"
        @dragover.prevent.stop="setDragging(true)"
        @dragleave.prevent.stop="onDragLeave"
        @drop.prevent.stop="onDrop"
      >
        <span class="dropzone__icon" aria-hidden="true">📂</span>
        <p class="dropzone__line">{{ t('data.import.dropPrompt') }}</p>
        <p class="dropzone__hint">{{ t('data.import.dropHint') }}</p>
        <input
          ref="fileInput"
          type="file"
          accept=".csv,.tsv,.xlsx,.xls"
          class="dropzone__input"
          @change="onFileChange"
        />
      </div>
      <div class="data-panel__import-extras">
        <button
          v-if="canBootstrapManual"
          type="button"
          class="data-panel__bootstrap"
          @click="onBootstrapManual"
        >
          {{ t('data.import.manualBootstrap') }}
        </button>
        <button
          type="button"
          class="data-panel__template"
          :disabled="data.placeholders.length === 0"
          :title="
            data.placeholders.length === 0
              ? t('data.template.disabledTooltip', { token: PLACEHOLDER_TOKEN_GENERIC })
              : t('data.template.download')
          "
          @click="onDownloadTemplate"
        >
          ⬇ {{ t('data.template.download') }}
        </button>
      </div>
      <p v-if="importError" class="data-panel__error">{{ importError.message }}</p>
    </section>

    <section v-if="data.hasData" class="data-panel__section">
      <LimitBanner v-if="data.limited" :cta="t('data.rows.feedbackCta')">
        {{
          t('data.rows.limitMessage', {
            shown: data.rows.length,
            total: data.lastImport?.totalRowsInFile ?? data.rows.length,
          })
        }}
      </LimitBanner>

      <div class="data-panel__row-card">
        <ul class="data-panel__row-summary">
          <li v-for="entry in compactRow" :key="entry.placeholder">
            <span class="data-panel__row-key">{{ entry.placeholder }}</span>
            <span class="data-panel__row-value">{{ entry.value }}</span>
          </li>
          <li v-if="extraCount > 0" class="data-panel__row-extra" :title="extraTooltip">
            … (+{{ extraCount }} more)
          </li>
        </ul>
      </div>

      <div class="data-panel__preview-controls">
        <button
          type="button"
          class="data-panel__step"
          :aria-label="t('data.preview.previous')"
          @click="data.step(-1)"
        >
          ‹
        </button>
        <span class="data-panel__index">
          {{
            t('data.preview.position', {
              current: data.currentIndex + 1,
              total: data.rows.length,
            })
          }}
        </span>
        <button
          type="button"
          class="data-panel__step"
          :aria-label="t('data.preview.next')"
          @click="data.step(1)"
        >
          ›
        </button>
        <label class="data-panel__toggle">
          <input type="checkbox" :checked="data.previewEnabled" @change="data.togglePreview()" />
          {{ t('data.preview.toggle') }}
        </label>
      </div>

      <div class="data-panel__row-actions">
        <button
          type="button"
          class="data-panel__row-action"
          :disabled="data.rows.length >= data.ROW_LIMIT"
          @click="data.addRowToActive()"
        >
          + {{ t('data.rowsAddInline') }}
        </button>
        <button type="button" class="data-panel__row-action" @click="editorOpen = true">
          ✏️ {{ t('data.editor.title') }}
        </button>
      </div>

      <ColumnMapper v-if="data.placeholders.length > 0 && data.headers.length > 0" />

      <button type="button" class="data-panel__primary" @click="emit('open-batch')">
        {{ t('data.batch.open') }}
      </button>
    </section>

    <ImportChoiceDialog
      :open="importDialog.open.value"
      :ctx="importDialog.ctx.value"
      @choose="importDialog.resolve"
      @cancel="importDialog.cancel"
    />
    <DataEditorDialog
      :open="editorOpen"
      @close="editorOpen = false"
      @import-file="onImportFromEditor"
    />
    <ConfirmDialog
      :open="confirmer.open.value"
      :title="confirmer.options.value?.title ?? ''"
      :message="confirmer.options.value?.message ?? ''"
      :confirm-label="confirmer.options.value?.confirmLabel ?? ''"
      :cancel-label="confirmer.options.value?.cancelLabel ?? ''"
      :tone="confirmer.options.value?.tone ?? 'primary'"
      @confirm="confirmer.resolve"
      @cancel="confirmer.cancel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDataStore } from '@/stores/data';
import { useDesignerStore } from '@/stores/designer';
import { usePreferencesStore } from '@/stores/preferences';
import {
  useCsvImport,
  type ImportDecision,
  type ImportRouteContext,
} from '@/composables/useCsvImport';
import { buildCsvTemplate } from '@/services/csv-template';
import { downloadBlob } from '@/services/file-download';
import ColumnMapper from './ColumnMapper.vue';
import DatasetSwitcher from './DatasetSwitcher.vue';
import ImportChoiceDialog from './ImportChoiceDialog.vue';
import DataEditorDialog from './DataEditorDialog.vue';
import LimitBanner from '@/components/common/LimitBanner.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import { useConfirm } from '@/composables/useConfirm';

const emit = defineEmits<{
  (e: 'open-batch'): void;
}>();

const { t } = useI18n();
const data = useDataStore();
const designer = useDesignerStore();
const prefs = usePreferencesStore();

// Vue's template parser splits `{{...}}` even inside string literals, so
// the literal token sample for the i18n placeholder is built from parts
// here and passed in as a value.
const PLACEHOLDER_TOKEN_NAME = `${'{{'}name${'}}'}`;
const PLACEHOLDER_TOKEN_GENERIC = `${'{{'}placeholder${'}}'}`;

// Active route-context for the import dialog. Exposed as a small bag of
// refs so the dropzone handler can `await` the user's choice.
const importDialog = (() => {
  const open = ref(false);
  const ctx = ref<ImportRouteContext | null>(null);
  let resolver: ((d: ImportDecision) => void) | null = null;

  function ask(input: ImportRouteContext): Promise<ImportDecision> {
    ctx.value = input;
    open.value = true;
    return new Promise<ImportDecision>(resolve => {
      resolver = resolve;
    });
  }

  function resolve(action: 'append' | 'new', remember: boolean): void {
    if (remember) prefs.csvImportBehavior = action;
    open.value = false;
    resolver?.({ kind: action });
    resolver = null;
  }

  function cancel(): void {
    open.value = false;
    resolver?.({ kind: 'cancel' });
    resolver = null;
  }

  return { open, ctx, ask, resolve, cancel };
})();

const confirmer = useConfirm();

const {
  isImporting: importing,
  error: importError,
  importFiles,
} = useCsvImport({
  onAsk: importDialog.ask,
  onEvictManual: name =>
    confirmer.confirm({
      title: t('data.switcher.confirmEvictManual', { name }),
      confirmLabel: t('common.confirm'),
      cancelLabel: t('common.cancel'),
      tone: 'danger',
    }),
});

const editorOpen = ref(false);

const OPEN = '{{';
const CLOSE = '}}';
function formatPlaceholder(ph: string): string {
  return `${OPEN}${ph}${CLOSE}`;
}

const COMPACT_ROW_LIMIT = 4;
const compactRow = computed<{ placeholder: string; value: string }[]>(() => {
  const vars = data.currentVariables;
  const ordered = data.placeholders.filter(ph => ph in vars);
  return ordered
    .slice(0, COMPACT_ROW_LIMIT)
    .map(ph => ({ placeholder: ph, value: vars[ph] ?? '' }));
});
const extraCount = computed(() => {
  const vars = data.currentVariables;
  const total = data.placeholders.filter(ph => ph in vars).length;
  return Math.max(0, total - COMPACT_ROW_LIMIT);
});
const extraTooltip = computed(() => {
  const vars = data.currentVariables;
  const ordered = data.placeholders.filter(ph => ph in vars);
  return ordered
    .slice(COMPACT_ROW_LIMIT)
    .map(ph => `${ph}: ${vars[ph] ?? ''}`)
    .join('\n');
});

const canBootstrapManual = computed(() => {
  if (data.placeholders.length === 0) return false;
  const ds = data.activeDataset;
  if (!ds) return true;
  return ds.rows.length === 0;
});

function onBootstrapManual(): void {
  let ds = data.activeDataset;
  if (!ds || (ds.source !== 'manual' && ds.rows.length === 0)) {
    const created = data.createDataset({
      source: 'manual',
      headers: [...data.placeholders],
      rows: [{}],
    });
    if (created) data.setActiveDataset(created.id);
    ds = data.activeDataset;
  } else if (ds.rows.length === 0) {
    // Existing manual set with no rows — seed one.
    data.addRowToActive();
  }
  editorOpen.value = true;
}

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

function setDragging(value: boolean): void {
  isDragging.value = value;
}

function onDragLeave(event: DragEvent): void {
  const related = event.relatedTarget as Node | null;
  const target = event.currentTarget as Node | null;
  if (target && related && target.contains(related)) return;
  isDragging.value = false;
}

async function onDrop(event: DragEvent): Promise<void> {
  isDragging.value = false;
  await importFiles(event.dataTransfer?.files ?? null);
}

function onClickDropzone(): void {
  fileInput.value?.click();
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  await importFiles(input.files);
  input.value = '';
}

function onImportFromEditor(): void {
  editorOpen.value = false;
  fileInput.value?.click();
}

function onDownloadTemplate(): void {
  if (data.placeholders.length === 0) return;
  const { filename, csv } = buildCsvTemplate(data.placeholders, designer.document.name);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}
</script>

<style scoped>
.data-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.data-panel__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.data-panel__heading {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.data-panel__empty {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.data-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.data-panel__chip code {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-primary-text);
  background: var(--color-primary-subtle);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-4);
  background: var(--color-bg-canvas);
  border: 2px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--easing),
    background var(--duration-fast) var(--easing);
  color: var(--color-text-secondary);
  text-align: center;
}

.dropzone:hover,
.dropzone--active {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
  color: var(--color-text);
}

.dropzone--busy {
  opacity: 0.7;
  pointer-events: none;
}

.dropzone__icon {
  font-size: 28px;
  line-height: 1;
}

.dropzone__line {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
}

.dropzone__hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.dropzone__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.data-panel__import-extras {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.data-panel__bootstrap {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  text-align: left;
  padding: var(--space-1) 0;
}

.data-panel__bootstrap:hover {
  color: var(--color-primary-text);
}

.data-panel__template {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px var(--space-2);
  margin-left: auto;
}

.data-panel__template:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary-text);
}

.data-panel__template:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.data-panel__row-card {
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
}

.data-panel__row-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  list-style: none;
  padding: 0;
}

.data-panel__row-summary li {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-xs);
}

.data-panel__row-key {
  font-family: var(--font-mono);
  color: var(--color-primary-text);
  flex-shrink: 0;
}

.data-panel__row-value {
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.data-panel__row-extra {
  color: var(--color-text-muted);
  cursor: help;
}

.data-panel__preview-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.data-panel__step {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  font-size: var(--text-base);
  color: var(--color-text);
}

.data-panel__step:hover {
  background: var(--color-primary-subtle);
}

.data-panel__index {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--color-text-secondary);
  flex: 1;
}

.data-panel__toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.data-panel__row-actions {
  display: flex;
  gap: var(--space-2);
}

.data-panel__row-action {
  flex: 1;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-panel);
  font-size: var(--text-xs);
  color: var(--color-text);
  text-align: center;
}

.data-panel__row-action:hover:not(:disabled) {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.data-panel__row-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.data-panel__primary {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: white;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.data-panel__primary:hover {
  background: var(--color-primary-hover);
}

.data-panel__error {
  font-size: var(--text-xs);
  color: var(--color-error);
}
</style>

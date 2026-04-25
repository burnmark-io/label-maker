<template>
  <Modal :open="open" size="lg" :close-label="t('common.close')" @close="onClose">
    <template #title>
      <DatasetSwitcher @open-editor="noop" @import-file="emit('import-file')" />
    </template>

    <div class="editor">
      <p v-if="!data.activeDataset" class="editor__empty">
        {{ t('data.switcher.noActiveHint') }}
      </p>

      <template v-else>
        <p v-if="data.placeholders.length === 0" class="editor__hint">
          {{ t('data.editor.noPlaceholders') }}
        </p>

        <LimitBanner v-if="data.limited" :cta="t('data.rows.feedbackCta')">
          {{
            t('data.rows.limitMessage', {
              shown: data.rows.length,
              total: data.lastImport?.totalRowsInFile ?? data.rows.length,
            })
          }}
        </LimitBanner>

        <p v-if="data.rows.length === 0 && data.headers.length > 0" class="editor__hint">
          {{ t('data.editor.addRowsHint') }}
        </p>

        <div v-if="data.headers.length > 0" class="editor__table-wrap">
          <table class="editor__table">
            <thead>
              <tr>
                <th class="editor__th editor__th--idx" scope="col">#</th>
                <th v-for="header in data.headers" :key="header" class="editor__th" scope="col">
                  <div class="editor__col-name">{{ header }}</div>
                  <div class="editor__col-mapping">
                    <select
                      :value="placeholderForColumn(header)"
                      :aria-label="t('data.editor.remapColumn')"
                      class="editor__col-select"
                      @change="onRemap(header, $event)"
                    >
                      <option value="">{{ t('data.editor.unusedColumn') }}</option>
                      <option v-for="ph in data.placeholders" :key="ph" :value="ph">
                        {{ formatPlaceholder(ph) }}
                      </option>
                    </select>
                  </div>
                </th>
                <th class="editor__th editor__th--actions" scope="col">
                  <span class="visually-hidden">{{ t('data.editor.rowActions') }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rIndex) in data.rows" :key="rIndex">
                <td class="editor__td editor__td--idx">{{ rIndex + 1 }}</td>
                <td v-for="header in data.headers" :key="header" class="editor__td">
                  <input
                    :value="row[header] ?? ''"
                    type="text"
                    class="editor__cell"
                    @input="onCellInput(rIndex, header, $event)"
                  />
                </td>
                <td class="editor__td editor__td--actions">
                  <button
                    type="button"
                    class="editor__row-btn"
                    :title="t('data.editor.moveRowUp')"
                    :aria-label="t('data.editor.moveRowUp')"
                    :disabled="rIndex === 0"
                    @click="data.moveActiveRow(rIndex, -1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="editor__row-btn"
                    :title="t('data.editor.moveRowDown')"
                    :aria-label="t('data.editor.moveRowDown')"
                    :disabled="rIndex === data.rows.length - 1"
                    @click="data.moveActiveRow(rIndex, 1)"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    class="editor__row-btn"
                    :title="t('data.editor.duplicateRow')"
                    :aria-label="t('data.editor.duplicateRow')"
                    :disabled="data.rows.length >= data.ROW_LIMIT"
                    @click="data.duplicateActiveRow(rIndex)"
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    class="editor__row-btn editor__row-btn--danger"
                    :title="t('data.editor.deleteRow')"
                    :aria-label="t('data.editor.deleteRow')"
                    @click="data.deleteActiveRow(rIndex)"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="atRowCap" class="editor__cap">
          {{ t('data.editor.rowAtCap', { limit: data.ROW_LIMIT }) }}
        </p>
      </template>
    </div>

    <template #footer>
      <button type="button" class="btn-ghost" :disabled="!canAddRow" @click="data.addRowToActive()">
        {{ t('data.editor.addRow') }}
      </button>
      <button v-if="canAddColumn" type="button" class="btn-ghost" @click="onAddColumn">
        {{ t('data.editor.addColumn') }}
      </button>
      <span class="editor__footer-spacer" />
      <button type="button" class="btn-primary" @click="onClose">
        {{ t('data.editor.done') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/common/Modal.vue';
import LimitBanner from '@/components/common/LimitBanner.vue';
import DatasetSwitcher from './DatasetSwitcher.vue';
import { useDataStore } from '@/stores/data';

defineProps<{ open: boolean }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'import-file'): void;
}>();

const { t } = useI18n();
const data = useDataStore();

const atRowCap = computed(() => data.rows.length >= data.ROW_LIMIT);
const canAddRow = computed(
  () => !!data.activeDataset && data.headers.length > 0 && !atRowCap.value,
);
const canAddColumn = computed(() => data.activeDataset?.source === 'manual');

const OPEN = '{{';
const CLOSE = '}}';
function formatPlaceholder(ph: string): string {
  return `${OPEN}${ph}${CLOSE}`;
}

function placeholderForColumn(header: string): string {
  for (const [ph, col] of Object.entries(data.mapping)) {
    if (col === header) return ph;
  }
  return '';
}

function onRemap(header: string, event: Event): void {
  const next = (event.target as HTMLSelectElement).value;
  // Clear any other placeholder currently mapped to this header.
  const previous = placeholderForColumn(header);
  if (previous && previous !== next) data.setColumnFor(previous, null);
  if (next) data.setColumnFor(next, header);
}

function onCellInput(rowIndex: number, header: string, event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  data.updateActiveRow(rowIndex, header, value);
}

function onAddColumn(): void {
  const proposed = window.prompt(t('data.editor.addColumnPrompt'), '');
  if (proposed == null) return;
  data.addColumnToActive(proposed.trim() || undefined);
}

function onClose(): void {
  emit('close');
}

function noop(): void {
  /* DatasetSwitcher's open-editor event from inside the popup is a no-op
     — we're already in the editor; the menu just lets users switch sets. */
}
</script>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 200px;
}

.editor__empty,
.editor__hint {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.editor__cap {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin: 0;
}

.editor__table-wrap {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-height: 60vh;
}

.editor__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: var(--color-bg-panel);
}

.editor__th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-bg-canvas);
  text-align: left;
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.editor__th--idx {
  width: 36px;
  text-align: center;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.editor__th--actions {
  width: 140px;
}

.editor__col-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.editor__col-mapping {
  margin-top: 4px;
}

.editor__col-select {
  width: 100%;
  padding: 2px var(--space-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-panel);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.editor__td {
  padding: 0;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.editor__td--idx {
  text-align: center;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.editor__cell {
  width: 100%;
  padding: var(--space-2);
  border: none;
  background: transparent;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.editor__cell:focus {
  outline: none;
  background: var(--color-primary-subtle);
}

.editor__td--actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  padding: var(--space-1);
}

.editor__row-btn {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.editor__row-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text);
}

.editor__row-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.editor__row-btn--danger:hover:not(:disabled) {
  color: var(--color-error);
}

.editor__footer-spacer {
  flex: 1;
}

.btn-ghost {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font-size: var(--text-sm);
  border: 1px solid var(--color-border);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-bg-canvas);
}

.btn-ghost:disabled {
  color: var(--color-text-muted);
  cursor: not-allowed;
  border-color: transparent;
}

.btn-primary {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  font-size: var(--text-sm);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>

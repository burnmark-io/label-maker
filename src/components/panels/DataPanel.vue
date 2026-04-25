<template>
  <div class="data-panel">
    <h2 class="panel__title">{{ t('panel.data') }}</h2>

    <section class="data-panel__section">
      <h3 class="data-panel__heading">{{ t('data.placeholders.title') }}</h3>
      <p v-if="data.placeholders.length === 0" class="data-panel__empty">
        {{ t('data.placeholders.empty') }}
      </p>
      <ul v-else class="data-panel__chips">
        <li
          v-for="ph in data.placeholders"
          :key="ph"
          class="data-panel__chip"
        >
          <code>{{ formatPlaceholder(ph) }}</code>
        </li>
      </ul>
    </section>

    <section class="data-panel__section">
      <h3 class="data-panel__heading">{{ t('data.import.title') }}</h3>
      <div
        class="dropzone"
        :class="{ 'dropzone--active': isDragging, 'dropzone--busy': importing }"
        role="button"
        :tabindex="0"
        :aria-label="t('data.import.dropzoneAria')"
        @click="onClickDropzone"
        @keydown.enter.prevent="onClickDropzone"
        @keydown.space.prevent="onClickDropzone"
        @dragenter.prevent="setDragging(true)"
        @dragover.prevent="setDragging(true)"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
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
      <p v-if="importError" class="data-panel__error">{{ importError.message }}</p>
    </section>

    <section v-if="data.hasData" class="data-panel__section">
      <header class="data-panel__heading-row">
        <h3 class="data-panel__heading">{{ t('data.rows.title') }}</h3>
        <button
          v-if="data.hasData"
          type="button"
          class="data-panel__link-btn"
          @click="data.clear()"
        >
          {{ t('data.rows.clear') }}
        </button>
      </header>
      <p class="data-panel__file">
        {{
          data.lastImport?.fileName
            ? t('data.rows.summary', {
                file: data.lastImport.fileName,
                rows: data.rows.length,
              })
            : t('data.rows.summaryShort', { rows: data.rows.length })
        }}
      </p>

      <LimitBanner v-if="data.limited" :cta="t('data.rows.feedbackCta')">
        {{
          t('data.rows.limitMessage', {
            shown: data.rows.length,
            total: data.lastImport?.totalRowsInFile ?? data.rows.length,
          })
        }}
      </LimitBanner>

      <div class="data-panel__preview-controls">
        <button
          type="button"
          class="data-panel__step"
          :aria-label="t('data.preview.previous')"
          @click="data.step(-1)"
        >‹</button>
        <span class="data-panel__index">
          {{ t('data.preview.position', {
            current: data.currentIndex + 1,
            total: data.rows.length,
          }) }}
        </span>
        <button
          type="button"
          class="data-panel__step"
          :aria-label="t('data.preview.next')"
          @click="data.step(1)"
        >›</button>
        <label class="data-panel__toggle">
          <input
            type="checkbox"
            :checked="data.previewEnabled"
            @change="data.togglePreview()"
          />
          {{ t('data.preview.toggle') }}
        </label>
      </div>

      <ColumnMapper v-if="data.placeholders.length > 0" />

      <button
        type="button"
        class="data-panel__primary"
        @click="emit('open-batch')"
      >
        {{ t('data.batch.open') }}
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDataStore } from '@/stores/data';
import { useCsvImport } from '@/composables/useCsvImport';
import ColumnMapper from './ColumnMapper.vue';
import LimitBanner from '@/components/common/LimitBanner.vue';

const emit = defineEmits<{
  (e: 'open-batch'): void;
}>();

const { t } = useI18n();
const data = useDataStore();
const { isImporting: importing, error: importError, importFiles } = useCsvImport();

const OPEN = '{{';
const CLOSE = '}}';
function formatPlaceholder(ph: string): string {
  return `${OPEN}${ph}${CLOSE}`;
}

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

function setDragging(value: boolean): void {
  isDragging.value = value;
}

function onDragLeave(event: DragEvent): void {
  // Only clear when actually leaving the dropzone, not just crossing a child.
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
</script>

<style scoped>
.data-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.panel__title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.data-panel__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.data-panel__heading,
.data-panel__heading-row h3 {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.data-panel__heading-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
}

.data-panel__empty,
.data-panel__file {
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
  transition: border-color var(--duration-fast) var(--easing),
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

.data-panel__link-btn {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
}

.data-panel__link-btn:hover {
  color: var(--color-text);
  text-decoration: underline;
}

.data-panel__error {
  font-size: var(--text-xs);
  color: var(--color-error);
}
</style>

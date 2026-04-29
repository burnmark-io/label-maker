<template>
  <div class="actions">
    <div ref="printRootRef" class="actions__print">
      <button
        class="actions__btn actions__btn--primary"
        type="button"
        :disabled="printer.isPrinting"
        :title="
          printer.isConnected
            ? t('actions.printConnected', { model: printer.model ?? '' })
            : t('actions.printNoPrinter')
        "
        @click="onPrint"
        @contextmenu.prevent="optionsOpen = true"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        {{ t('topbar.print') }}
      </button>
      <button
        class="actions__btn actions__btn--primary actions__btn--caret-primary"
        type="button"
        :aria-label="t('actions.printOptions')"
        @click="optionsOpen = !optionsOpen"
      >
        <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor" aria-hidden="true">
          <path d="M2 4l4 4 4-4z" />
        </svg>
      </button>
      <div v-if="optionsOpen" class="actions__options" role="dialog">
        <label class="actions__field">
          {{ t('actions.copies') }}
          <input v-model.number="copies" type="number" min="1" max="30" class="actions__input" />
        </label>
        <label class="actions__field">
          {{ t('actions.density') }}
          <select v-model="density" class="actions__input">
            <option value="light">{{ t('actions.densityLight') }}</option>
            <option value="normal">{{ t('actions.densityNormal') }}</option>
            <option value="dark">{{ t('actions.densityDark') }}</option>
          </select>
        </label>
        <button
          v-if="data.hasData"
          class="actions__btn actions__btn--full"
          type="button"
          @click="onPrintBatch"
        >
          {{ t('actions.printBatch', { count: data.rows.length }) }}
        </button>
        <button class="actions__btn actions__btn--full" type="button" @click="optionsOpen = false">
          {{ t('common.close') }}
        </button>
      </div>
    </div>

    <div ref="saveRootRef" class="actions__save">
      <button class="actions__btn" type="button" @click="onSave">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        {{ t('topbar.save') }}
      </button>
      <button
        class="actions__btn actions__btn--caret"
        type="button"
        :aria-label="t('actions.saveOptions')"
        @click="dropdownOpen = !dropdownOpen"
      >
        <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor" aria-hidden="true">
          <path d="M2 4l4 4 4-4z" />
        </svg>
      </button>
      <ul v-if="dropdownOpen" class="actions__dropdown" role="menu" @click="dropdownOpen = false">
        <li>
          <button type="button" role="menuitem" @click="onNewLabel">
            {{ t('actions.newLabel') }}
          </button>
        </li>
        <li class="actions__divider" aria-hidden="true" />
        <li>
          <button type="button" role="menuitem" @click="onSave">
            {{ t('actions.saveCurrent') }}
          </button>
        </li>
        <li>
          <button
            type="button"
            role="menuitem"
            :disabled="library.isFull"
            :title="library.isFull ? t('library.cantSaveAsNew') : ''"
            @click="onSaveAsNew"
          >
            {{ t('actions.saveAsNew') }}
          </button>
        </li>
        <li>
          <button type="button" role="menuitem" @click="emit('open-library')">
            {{ t('topbar.library') }}
          </button>
        </li>
        <li class="actions__divider" aria-hidden="true" />
        <li>
          <button type="button" role="menuitem" @click="onImport">
            {{ t('actions.import') }}
          </button>
        </li>
        <li class="actions__divider" aria-hidden="true" />
        <li>
          <button type="button" role="menuitem" @click="onExportPdf">
            {{ t('actions.exportPdf') }}
          </button>
        </li>
        <li>
          <button type="button" role="menuitem" @click="onExportPng">
            {{ t('actions.exportPng') }}
          </button>
        </li>
        <li>
          <button type="button" role="menuitem" @click="onExportLabel">
            {{ t('actions.exportLabel') }}
          </button>
        </li>
        <li>
          <button type="button" role="menuitem" @click="onExportZip">
            {{ t('actions.exportZip') }}
          </button>
        </li>
        <li class="actions__divider" aria-hidden="true" />
        <li>
          <button type="button" role="menuitem" @click="emit('open-sheet')">
            {{ t('actions.printSheet') }}
          </button>
        </li>
        <li>
          <button type="button" role="menuitem" @click="emit('open-share')">
            {{ t('topbar.share') }}
          </button>
        </li>
      </ul>
    </div>

    <div class="actions__zoom" role="group" :aria-label="t('canvas.zoomControls')">
      <button
        type="button"
        class="actions__btn actions__zoom-btn"
        :aria-label="t('canvas.zoomOut')"
        :title="t('canvas.zoomOut')"
        @click="viewport.zoomOut()"
      >
        −
      </button>
      <button
        type="button"
        class="actions__btn actions__zoom-btn actions__zoom-btn--label"
        :aria-label="t('canvas.fitZoom')"
        :title="t('canvas.fitZoom')"
        @click="viewport.resetZoom()"
      >
        {{ t('canvas.zoom', { percent: zoomPercent }) }}
      </button>
      <button
        type="button"
        class="actions__btn actions__zoom-btn"
        :aria-label="t('canvas.zoomIn')"
        :title="t('canvas.zoomIn')"
        @click="viewport.zoomIn()"
      >
        +
      </button>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept=".label,.zip,application/json,application/zip"
      class="actions__file-input"
      aria-hidden="true"
      tabindex="-1"
      @change="onFilePicked"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePrinterStore } from '@/stores/printer';
import { useDesignerStore } from '@/stores/designer';
import { useDataStore } from '@/stores/data';
import { useLibraryStore, LibraryFullError } from '@/stores/library';
import { useToast } from '@/composables/useToast';
import { useDocumentLifecycle } from '@/composables/useDocumentLifecycle';
import { useLabelImport } from '@/composables/useLabelImport';
import { CANVAS_VIEWPORT_KEY, type ViewportState } from '@/composables/useCanvasViewport';
import { downloadBlob, safeFileName } from '@/services/file-download';
import { applyMappingToRow } from '@/services/column-mapper';
import { captureCanvasThumbnail } from '@/services/thumbnail';

const emit = defineEmits<{
  (e: 'open-batch'): void;
  (e: 'open-sheet'): void;
  (e: 'open-share'): void;
  (e: 'open-library'): void;
}>();

const { t } = useI18n();
const printer = usePrinterStore();
const designer = useDesignerStore();
const data = useDataStore();
const library = useLibraryStore();
const { show, update, dismiss } = useToast();
const lifecycle = useDocumentLifecycle();
const labelImport = useLabelImport();

const viewport = inject<ViewportState>(CANVAS_VIEWPORT_KEY)!;
const zoomPercent = computed(() => Math.round(viewport.zoom.value * 100));

const dropdownOpen = ref(false);
const optionsOpen = ref(false);
const copies = ref(1);
const density = ref<'light' | 'normal' | 'dark'>('normal');
const printRootRef = ref<HTMLElement | null>(null);
const saveRootRef = ref<HTMLElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

async function onPrint(): Promise<void> {
  if (!printer.isConnected) {
    show(t('actions.printNoPrinter'), 'info');
    emit('open-sheet');
    return;
  }
  if (!printer.effectiveMedia) {
    show(t('actions.printNoMedia'), 'error');
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
    const cps = Math.max(1, Math.min(30, copies.value || 1));
    await printer.print(image, { copies: cps, density: density.value });
    update(toastId, {
      message: t('actions.printSuccess'),
      kind: 'success',
      sticky: false,
    });
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

function onPrintBatch(): void {
  optionsOpen.value = false;
  emit('open-batch');
}

async function persistCurrentDoc(successKey: string): Promise<void> {
  const thumbnail = await captureCanvasThumbnail(designer);
  try {
    await library.save(designer.document, { thumbnail });
    show(t(successKey), 'success');
  } catch (err) {
    if (err instanceof LibraryFullError) {
      show(t('library.fullToast'), 'error');
      emit('open-library');
    } else {
      show(err instanceof Error ? err.message : String(err), 'error');
    }
  }
}

async function onSave(): Promise<void> {
  await persistCurrentDoc('library.saved');
}

function onImport(): void {
  fileInputRef.value?.click();
}

async function onFilePicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  await labelImport.runImport(file);
}

async function onNewLabel(): Promise<void> {
  if (!(await lifecycle.confirmDestructiveSwap())) return;
  lifecycle.newBlankDocument();
  show(t('library.newLabelToast'), 'success');
}

async function onSaveAsNew(): Promise<void> {
  if (library.isFull) {
    show(t('library.cantSaveAsNew'), 'error');
    emit('open-library');
    return;
  }
  lifecycle.assignNewId();
  await persistCurrentDoc('library.savedAsNew');
}

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

async function onExportZip(): Promise<void> {
  try {
    const result = await designer.exportBundled();
    downloadBlob(result.blob, `${safeFileName(designer.document.name)}.zip`);
    if (result.missing.length > 0) {
      show(t('export.zipMissing', { count: result.missing.length }), 'info');
    } else {
      show(t('export.zipDownloaded'), 'success');
    }
  } catch (err) {
    show(err instanceof Error ? err.message : String(err), 'error');
  }
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target as Node;
  if (printRootRef.value && !printRootRef.value.contains(target)) {
    optionsOpen.value = false;
  }
  if (saveRootRef.value && !saveRootRef.value.contains(target)) {
    dropdownOpen.value = false;
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));
</script>

<style scoped>
.actions {
  position: absolute;
  bottom: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  z-index: 5;
}

.actions__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  border: 1px solid transparent;
  background: transparent;
  transition:
    background var(--duration-fast) var(--easing),
    border-color var(--duration-fast) var(--easing);
}

.actions__btn:hover:not(:disabled) {
  background: var(--color-bg-canvas);
  border-color: var(--color-border);
}

.actions__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.actions__btn--primary {
  background: var(--color-primary);
  color: white;
}

.actions__btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: transparent;
}

.actions__btn--full {
  width: 100%;
  justify-content: center;
}

.actions__print {
  position: relative;
  display: inline-flex;
  align-items: stretch;
}

.actions__btn--caret-primary {
  padding: 0 var(--space-2);
  margin-left: -2px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.actions__print > .actions__btn--primary:first-child {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.actions__options {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  min-width: 220px;
  padding: var(--space-3);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.actions__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-secondary);
}

.actions__input {
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  background: var(--color-bg-canvas);
  color: var(--color-text);
}

.actions__save {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  border-radius: var(--radius-md);
  overflow: visible;
}

.actions__btn--caret {
  padding: 0 var(--space-2);
  margin-left: -2px;
  color: var(--color-text-secondary);
}

.actions__dropdown {
  position: absolute;
  bottom: calc(100% + 4px);
  right: 0;
  list-style: none;
  margin: 0;
  padding: var(--space-1);
  min-width: 220px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.actions__dropdown li {
  display: block;
}

.actions__dropdown button {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  text-align: left;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.actions__dropdown button:hover {
  background: var(--color-bg-canvas);
}

.actions__divider {
  height: 1px;
  background: var(--color-border);
  margin: var(--space-1) 0;
}

.actions__file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
  opacity: 0;
}

/* Inline zoom controls — only visible on narrow viewports where the
   floating canvas-zoom widget is hidden to avoid overlap with this
   toolbar. The desktop zoom widget stays in DesignCanvas. */
.actions__zoom {
  display: none;
  align-items: stretch;
  border-left: 1px solid var(--color-border);
  margin-left: var(--space-1);
  padding-left: var(--space-1);
}

.actions__zoom-btn {
  padding: var(--space-1) var(--space-2);
  min-width: 32px;
  justify-content: center;
}

.actions__zoom-btn--label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--weight-regular);
  color: var(--color-text-secondary);
  min-width: 48px;
}

@media (max-width: 640px) {
  .actions__zoom {
    display: inline-flex;
  }
}
</style>

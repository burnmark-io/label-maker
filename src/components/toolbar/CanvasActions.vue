<template>
  <div class="actions">
    <div ref="printRootRef" class="actions__print">
      <button
        class="actions__btn actions__btn--primary"
        :class="{ 'actions__btn--blocked': blockedByError }"
        type="button"
        :disabled="!canPrint"
        :title="printButtonTitle"
        @click="onPrint"
        @contextmenu.prevent="optionsOpen = true"
      >
        <svg
          v-if="blockedByError"
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
          <path
            d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <svg
          v-else
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
        {{ printButtonLabel }}
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
        <DestinationRow @open-sheet-picker="emit('open-sheet')" />
        <SourceRow />
        <label class="actions__field">
          {{ t('actions.copies') }}
          <input
            v-model.number="config.copies"
            type="number"
            min="1"
            max="30"
            class="actions__input"
          />
        </label>
        <label class="actions__field">
          {{ t('actions.density') }}
          <select v-model="config.density" class="actions__input">
            <option value="light">{{ t('actions.densityLight') }}</option>
            <option value="normal">{{ t('actions.densityNormal') }}</option>
            <option value="dark">{{ t('actions.densityDark') }}</option>
          </select>
        </label>
        <p v-if="config.count > 1" class="actions__summary">{{ summaryText }}</p>
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
        <li class="actions__divider" aria-hidden="true" />
        <li>
          <button type="button" role="menuitem" @click="onNewLabel">
            {{ t('actions.newLabel') }}
          </button>
        </li>
        <li>
          <button type="button" role="menuitem" @click="emit('open-library')">
            {{ t('topbar.library') }}
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePrinterStore } from '@/stores/printer';
import { useDesignerStore } from '@/stores/designer';
import { useDataStore } from '@/stores/data';
import { usePrintConfigStore } from '@/stores/print-config';
import { useLibraryStore, LibraryFullError } from '@/stores/library';
import { useToast } from '@/composables/useToast';
import { useDocumentLifecycle } from '@/composables/useDocumentLifecycle';
import { useLabelImport } from '@/composables/useLabelImport';
import { localisedErrorMessage } from '@/composables/usePrinterErrors';
import { FAMILIES_WITH_STATUS_POLLING } from '@/lib/printer/registry';
import { CANVAS_VIEWPORT_KEY, type ViewportState } from '@/composables/useCanvasViewport';
import { captureCanvasThumbnail } from '@/services/thumbnail';
import SourceRow from '@/components/output/SourceRow.vue';
import DestinationRow from '@/components/output/DestinationRow.vue';
import { renderSheet } from '@/services/export/sheet-render';
import { useSheetViewer } from '@/composables/useSheetViewer';

const sheetViewer = useSheetViewer();

const emit = defineEmits<{
  (e: 'open-batch'): void;
  (e: 'open-sheet'): void;
  (e: 'open-library'): void;
}>();

const { t } = useI18n();
const printer = usePrinterStore();
const designer = useDesignerStore();
const data = useDataStore();
const config = usePrintConfigStore();
const library = useLibraryStore();
const { show, update, dismiss } = useToast();
const lifecycle = useDocumentLifecycle();
const labelImport = useLabelImport();

const viewport = inject<ViewportState>(CANVAS_VIEWPORT_KEY)!;
const zoomPercent = computed(() => Math.round(viewport.zoom.value * 100));

const dropdownOpen = ref(false);
const optionsOpen = ref(false);
const printRootRef = ref<HTMLElement | null>(null);
const saveRootRef = ref<HTMLElement | null>(null);

/**
 * Print button is blocked by a polled error when the printer is
 * connected, its family supports status polling, and the most recent
 * status reports `ready: false` or any errors. Pre-first-tick (no
 * lastStatus yet) does NOT block — letting the user fire a
 * speculative print with the existing media is better UX than dead-
 * locking on "waiting for status".
 */
const blockedByError = computed(() => {
  // Thermal status guard only applies when output is going to thermal.
  if (config.effectiveDestination !== 'thermal') return false;
  const c = printer.connection;
  if (c.kind !== 'connected') return false;
  if (!FAMILIES_WITH_STATUS_POLLING.has(c.family)) return false;
  const status = printer.lastStatus;
  if (!status) return false;
  return !status.ready || status.errors.length > 0;
});

const canPrint = computed(() => {
  if (printer.isPrinting || blockedByError.value) return false;
  if (config.effectiveDestination === 'sheet') {
    return config.sheetPossible;
  }
  // Thermal: matches the historical "always enabled when not printing,
  // not blocked" behaviour — connection failure is communicated via the
  // toast on click, not button-disabled.
  return true;
});

const printButtonLabel = computed(() => {
  if (config.effectiveDestination === 'sheet') {
    if (config.count <= 1) return t('output.button.printToSheet');
    return t('output.button.printToSheetWithCounts', {
      labels: config.count,
      pages: config.pageCount,
    });
  }
  return config.count > 1
    ? t('output.button.printNLabels', { n: config.count })
    : t('topbar.print');
});

const summaryText = computed(() => {
  if (data.rows.length === 0) {
    return t('output.summary.copiesOnly', { count: config.count });
  }
  return t('output.summary.rowsAndCopies', {
    rows: config.rowsForSelection.length,
    copies: config.copies,
    count: config.count,
  });
});

const printButtonTitle = computed(() => {
  if (blockedByError.value) {
    const errors = printer.lastStatus?.errors ?? [];
    const first = errors[0];
    const reason = first ? localisedErrorMessage(first, t) : t('actions.printBlockedGeneric');
    if (errors.length > 1) {
      return t('actions.printBlockedWithMore', { reason, count: errors.length - 1 });
    }
    return reason;
  }
  return printer.isConnected
    ? t('actions.printConnected', { model: printer.model ?? '' })
    : t('actions.printNoPrinter');
});

async function onPrint(): Promise<void> {
  if (config.effectiveDestination === 'sheet') {
    await onPrintToSheet();
    return;
  }
  if (!printer.isConnected) {
    // Per §3.4 the legacy no-thermal-fallback emit('open-sheet') is gone:
    // when neither thermal nor sheet is possible, the DestinationRow CTA
    // already drives the user into setup before they reach this button.
    show(t('actions.printNoPrinter'), 'info');
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
    const cps = Math.max(1, Math.min(30, config.copies || 1));
    await printer.print(image, { copies: cps, density: config.density });
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

async function onPrintToSheet(): Promise<void> {
  const sheet = config.sheetTemplate;
  if (!sheet) {
    emit('open-sheet');
    return;
  }
  optionsOpen.value = false;
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

async function onNewLabel(): Promise<void> {
  const choice = await lifecycle.confirmSwapWithSave();
  if (choice === 'cancel') return;
  if (choice === 'save') {
    const ok = await labelImport.saveCurrentToLibrary();
    if (!ok) return;
  }
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

/* Print button while a polled error blocks printing. The triangle
 * icon already conveys the warning shape; the colour shift cues that
 * "this disabled state is informational, not just busy". */
.actions__btn--primary.actions__btn--blocked {
  background: var(--color-error);
  color: white;
}

.actions__btn--primary.actions__btn--blocked:disabled {
  opacity: 0.85;
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

.actions__summary {
  margin: var(--space-1) 0 0;
  padding-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-border);
  text-align: center;
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

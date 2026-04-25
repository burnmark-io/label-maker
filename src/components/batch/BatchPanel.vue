<template>
  <Modal :open="open" size="lg" :title="t('batch.title')" @close="emit('close')">
    <div class="batch">
      <header class="batch__head">
        <p class="batch__summary">
          {{ t('batch.summary', { count: data.rows.length }) }}
        </p>
        <LimitBanner v-if="data.limited" :cta="t('data.rows.feedbackCta')">
          {{
            t('data.rows.limitMessage', {
              shown: data.rows.length,
              total: data.lastImport?.totalRowsInFile ?? data.rows.length,
            })
          }}
        </LimitBanner>
      </header>

      <div v-if="status.kind !== 'idle'" class="batch__progress" role="status">
        <div class="batch__progress-bar">
          <div
            class="batch__progress-fill"
            :class="{ 'batch__progress-fill--error': status.kind === 'error' }"
            :style="{ width: `${(status.completed / Math.max(1, status.total)) * 100}%` }"
          />
        </div>
        <span class="batch__progress-label">
          {{
            status.kind === 'error'
              ? t('batch.error', { message: status.message ?? '' })
              : t('batch.progress', { current: status.completed, total: status.total })
          }}
        </span>
      </div>

      <div ref="gridRef" class="batch__grid" role="list" @scroll.passive="onScroll">
        <div class="batch__virtual" :style="{ height: `${totalHeight}px` }">
          <div class="batch__row-window" :style="{ transform: `translateY(${windowOffsetY}px)` }">
            <article
              v-for="entry in visibleEntries"
              :key="entry.index"
              class="batch__card"
              role="listitem"
              :class="{
                'batch__card--printing': entry.index === status.currentIndex && status.kind === 'printing',
                'batch__card--done': isDone(entry.index),
                'batch__card--error': errors[entry.index],
              }"
            >
              <div class="batch__card-thumb-wrap">
                <img
                  v-if="thumbnails[entry.index]"
                  :src="thumbnails[entry.index]!"
                  :alt="t('batch.thumbnailAlt', { row: entry.index + 1 })"
                  class="batch__thumb"
                />
                <div v-else class="batch__thumb batch__thumb--placeholder">
                  <span aria-hidden="true">…</span>
                </div>
              </div>
              <div class="batch__card-meta">
                <span class="batch__card-index">#{{ entry.index + 1 }}</span>
                <span v-if="entry.label" class="batch__card-label">{{ entry.label }}</span>
                <span v-if="errors[entry.index]" class="batch__card-error">{{ errors[entry.index] }}</span>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <button type="button" class="batch__btn" @click="emit('close')">
        {{ t('common.close') }}
      </button>
      <button
        v-if="status.kind === 'printing'"
        type="button"
        class="batch__btn batch__btn--ghost"
        @click="cancel"
      >
        {{ t('batch.cancel') }}
      </button>
      <button
        v-else
        type="button"
        class="batch__btn batch__btn--primary"
        :disabled="!canPrint"
        :title="canPrint ? '' : t('batch.cantPrint')"
        @click="startPrint"
      >
        {{ t('batch.printAll') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { renderBatch, type BatchResult } from '@burnmark-io/designer-core';
import { useDataStore } from '@/stores/data';
import { useDesignerStore } from '@/stores/designer';
import { usePrinterStore } from '@/stores/printer';
import { useToast } from '@/composables/useToast';
import { applyMappingToRow } from '@/services/column-mapper';
import LimitBanner from '@/components/common/LimitBanner.vue';
import Modal from '@/components/common/Modal.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const { t } = useI18n();
const data = useDataStore();
const designer = useDesignerStore();
const printer = usePrinterStore();
const { show } = useToast();

interface BatchStatus {
  kind: 'idle' | 'printing' | 'done' | 'error';
  total: number;
  completed: number;
  currentIndex: number;
  message?: string;
}

const status = ref<BatchStatus>({ kind: 'idle', total: 0, completed: 0, currentIndex: -1 });
const errors = ref<Record<number, string>>({});
const thumbnails = ref<Record<number, string>>({});
const cancelled = ref(false);

const canPrint = computed(
  () => printer.isConnected && data.rows.length > 0 && status.value.kind !== 'printing',
);

function isDone(index: number): boolean {
  if (status.value.kind === 'idle') return false;
  return index < status.value.completed && !errors.value[index];
}

const ROW_HEIGHT = 168;
const COLUMNS = 3;
const OVERSCAN = 2;

const gridRef = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const containerHeight = ref(420);

watch(
  () => props.open,
  async (open) => {
    if (open) {
      await nextTick();
      if (gridRef.value) containerHeight.value = gridRef.value.clientHeight;
      void buildPreviewThumbnails();
    } else {
      reset();
    }
  },
);

const entries = computed(() =>
  data.rows.map((row, index) => {
    const variables = applyMappingToRow(row, data.mapping);
    const firstNonEmpty = Object.values(variables).find((v) => v && v.trim().length > 0);
    return { index, row, variables, label: firstNonEmpty ?? '' };
  }),
);

const totalRows = computed(() => Math.ceil(entries.value.length / COLUMNS));
const totalHeight = computed(() => totalRows.value * ROW_HEIGHT);

const visibleEntries = computed(() => {
  const startRow = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN);
  const visibleRowCount = Math.ceil(containerHeight.value / ROW_HEIGHT) + OVERSCAN * 2;
  const endRow = Math.min(totalRows.value, startRow + visibleRowCount);
  return entries.value.slice(startRow * COLUMNS, endRow * COLUMNS);
});

const windowOffsetY = computed(() => {
  const startRow = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN);
  return startRow * ROW_HEIGHT;
});

function onScroll(event: Event): void {
  const el = event.target as HTMLElement;
  scrollTop.value = el.scrollTop;
  containerHeight.value = el.clientHeight;
}

function reset(): void {
  status.value = { kind: 'idle', total: 0, completed: 0, currentIndex: -1 };
  errors.value = {};
  cancelled.value = false;
  for (const url of Object.values(thumbnails.value)) URL.revokeObjectURL(url);
  thumbnails.value = {};
}

async function buildPreviewThumbnails(): Promise<void> {
  // Render the first handful of rows up front so the preview grid is
  // populated immediately. The full grid is virtual-scrolled; visible
  // entries beyond the initial set are rendered lazily on scroll.
  const initial = entries.value.slice(0, 12);
  for (const entry of initial) {
    if (!props.open) break;
    if (thumbnails.value[entry.index]) continue;
    try {
      const png = await designer.exportPng(entry.variables, 0.4);
      thumbnails.value[entry.index] = URL.createObjectURL(png);
    } catch {
      // Thumbnails are best-effort; skip on failure.
    }
  }
}

watch(
  visibleEntries,
  async (visible) => {
    if (!props.open) return;
    for (const entry of visible) {
      if (thumbnails.value[entry.index]) continue;
      try {
        const png = await designer.exportPng(entry.variables, 0.4);
        thumbnails.value[entry.index] = URL.createObjectURL(png);
      } catch {
        // best-effort
      }
    }
  },
);

async function startPrint(): Promise<void> {
  if (!printer.isConnected) {
    show(t('actions.printNoPrinter'), 'info');
    return;
  }
  if (data.rows.length === 0) return;

  cancelled.value = false;
  errors.value = {};
  status.value = {
    kind: 'printing',
    total: data.rows.length,
    completed: 0,
    currentIndex: -1,
  };

  const rowsForBatch = data.rows.map((row) => applyMappingToRow(row, data.mapping));

  try {
    // Cast: pinia's setup-store typing strips the LabelDesigner's private
    // fields, but the runtime instance is the real class.
    const generator: AsyncGenerator<BatchResult> = renderBatch(
      designer.designer as unknown as Parameters<typeof renderBatch>[0],
      rowsForBatch,
    );
    for await (const result of generator) {
      if (cancelled.value) break;
      status.value = { ...status.value, currentIndex: result.index };
      try {
        const image = {
          width: result.image.width,
          height: result.image.height,
          data:
            result.image.data instanceof Uint8Array
              ? result.image.data
              : new Uint8Array(
                  result.image.data.buffer,
                  result.image.data.byteOffset,
                  result.image.data.byteLength,
                ),
        };
        await printer.print(image);
      } catch (err) {
        errors.value = {
          ...errors.value,
          [result.index]: err instanceof Error ? err.message : String(err),
        };
      }
      status.value = {
        ...status.value,
        completed: status.value.completed + 1,
      };
    }
    if (cancelled.value) {
      status.value = { ...status.value, kind: 'idle' };
    } else {
      status.value = { ...status.value, kind: 'done' };
      show(t('batch.success', { count: status.value.completed }), 'success');
    }
  } catch (err) {
    status.value = {
      ...status.value,
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function cancel(): void {
  cancelled.value = true;
}

onBeforeUnmount(() => {
  for (const url of Object.values(thumbnails.value)) URL.revokeObjectURL(url);
});
</script>

<style scoped>
.batch {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.batch__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.batch__summary {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.batch__progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.batch__progress-bar {
  height: 6px;
  background: var(--color-bg-canvas);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.batch__progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width var(--duration-base) var(--easing);
}

.batch__progress-fill--error {
  background: var(--color-error);
}

.batch__progress-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.batch__grid {
  position: relative;
  height: 420px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-canvas);
  padding: var(--space-2);
}

.batch__virtual {
  position: relative;
  width: 100%;
}

.batch__row-window {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  padding-right: var(--space-2);
}

.batch__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  height: 160px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color var(--duration-fast) var(--easing);
}

.batch__card--printing {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
}

.batch__card--done {
  border-color: var(--color-success);
}

.batch__card--error {
  border-color: var(--color-error);
}

.batch__card-thumb-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.batch__thumb {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  image-rendering: crisp-edges;
}

.batch__thumb--placeholder {
  color: var(--color-text-muted);
  font-size: var(--text-base);
}

.batch__card-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--text-xs);
}

.batch__card-index {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.batch__card-label {
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.batch__card-error {
  color: var(--color-error);
  font-size: var(--text-xs);
}

.batch__btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text);
}

.batch__btn:hover {
  background: var(--color-bg-canvas);
}

.batch__btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.batch__btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.batch__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.batch__btn--ghost {
  background: transparent;
}
</style>

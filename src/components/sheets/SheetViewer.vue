<template>
  <Modal :open="open" size="lg" :title="t('output.sheetViewer.title')" @close="onClose">
    <div class="sheet-viewer">
      <p class="sheet-viewer__summary">{{ summaryText }}</p>
      <iframe
        v-if="blobUrl"
        ref="iframeRef"
        class="sheet-viewer__frame"
        :title="t('output.sheetViewer.title')"
        :src="blobUrl"
      />
    </div>
    <template #footer>
      <button type="button" class="sheet-viewer__btn" @click="onClose">
        {{ t('output.sheetViewer.close') }}
      </button>
      <button type="button" class="sheet-viewer__btn" :disabled="!blobUrl" @click="onDownload">
        {{ t('output.sheetViewer.download') }}
      </button>
      <button
        type="button"
        class="sheet-viewer__btn sheet-viewer__btn--primary"
        :disabled="!blobUrl"
        @click="onPrint"
      >
        {{ t('output.sheetViewer.print') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/common/Modal.vue';
import { downloadBlob } from '@/services/file-download';

interface SheetViewerPayload {
  blob: Blob;
  fileName: string;
  /** Sheet brand + part for the summary line ("Avery L7160"). */
  sheetLabel: string;
  totalLabels: number;
  pageCount: number;
  labelsPerPage: number;
  emptyOnLastPage: number;
}

const props = defineProps<{
  open: boolean;
  payload: SheetViewerPayload | null;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

const { t } = useI18n();

const blobUrl = ref<string | null>(null);
const iframeRef = ref<HTMLIFrameElement | null>(null);

watch(
  () => props.payload,
  payload => {
    if (blobUrl.value) {
      URL.revokeObjectURL(blobUrl.value);
      blobUrl.value = null;
    }
    if (payload) {
      blobUrl.value = URL.createObjectURL(payload.blob);
    }
  },
  { immediate: true },
);

const summaryText = computed(() => {
  const p = props.payload;
  if (!p) return '';
  if (p.emptyOnLastPage > 0) {
    return t('output.sheetViewer.summaryEmptySlots', {
      labels: p.totalLabels,
      sheet: p.sheetLabel,
      perPage: p.labelsPerPage,
      pages: p.pageCount,
      empty: p.emptyOnLastPage,
      lastPage: p.pageCount,
    });
  }
  return t('output.sheetViewer.summary', {
    labels: p.totalLabels,
    sheet: p.sheetLabel,
    perPage: p.labelsPerPage,
    pages: p.pageCount,
  });
});

function onClose(): void {
  emit('close');
}

function onDownload(): void {
  if (!props.payload) return;
  downloadBlob(props.payload.blob, props.payload.fileName);
}

function onPrint(): void {
  // The iframe carries the embedded PDF viewer; use its print() so the
  // browser surfaces the system print dialog with the rendered sheet.
  iframeRef.value?.contentWindow?.print();
}
</script>

<style scoped>
.sheet-viewer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: 70vh;
  min-height: 400px;
}

.sheet-viewer__summary {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.sheet-viewer__frame {
  flex: 1;
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-canvas);
}

.sheet-viewer__btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
}

.sheet-viewer__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sheet-viewer__btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}
</style>

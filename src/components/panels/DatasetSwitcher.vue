<template>
  <div ref="rootRef" class="switcher" :class="{ 'switcher--open': open }">
    <div class="switcher__trigger-wrap">
      <EditableText
        v-if="data.activeDataset"
        class="switcher__active-name"
        :value="data.activeDataset.name"
        :edit-label="t('data.switcher.rename')"
        @update="onRenameActive"
      />
      <button
        type="button"
        class="switcher__trigger"
        :aria-haspopup="true"
        :aria-expanded="open"
        :aria-label="t('data.switcher.menuLabel')"
        @click="toggle"
      >
        <span v-if="!data.activeDataset" class="switcher__name">
          {{ t('data.switcher.noActive') }}
        </span>
        <span class="switcher__count">{{ countSummary }}</span>
        <span class="switcher__chevron" aria-hidden="true">▾</span>
      </button>
    </div>

    <div v-if="open" class="switcher__menu" role="menu">
      <ul v-if="data.datasets.length > 0" class="switcher__list">
        <li v-for="ds in data.datasets" :key="ds.id" class="switcher__item">
          <div
            class="switcher__item-main"
            :class="{ 'switcher__item-main--active': ds.id === activeId }"
          >
            <button
              type="button"
              class="switcher__item-pick"
              role="menuitemradio"
              :aria-checked="ds.id === activeId"
              @click="onPick(ds.id)"
            >
              <span class="switcher__item-meta">{{ rowsLabel(ds.rows.length) }}</span>
            </button>
            <EditableText
              class="switcher__item-name"
              :value="ds.name"
              :edit-label="t('data.switcher.rename')"
              @update="data.renameDataset(ds.id, $event)"
            />
          </div>
          <div class="switcher__row-actions">
            <button
              type="button"
              class="switcher__row-action"
              :title="t('data.switcher.duplicate')"
              :aria-label="t('data.switcher.duplicate')"
              @click="onDuplicate(ds.id)"
            >
              ⧉
            </button>
            <button
              type="button"
              class="switcher__row-action switcher__row-action--danger"
              :title="t('data.switcher.delete')"
              :aria-label="t('data.switcher.delete')"
              @click="onDelete(ds.id, ds.name)"
            >
              🗑
            </button>
          </div>
        </li>
      </ul>

      <footer class="switcher__footer">
        <button
          type="button"
          class="switcher__footer-btn"
          :disabled="data.datasets.length >= data.DATASET_LIMIT"
          @click="onNewManual"
        >
          {{ t('data.switcher.newManual') }}
        </button>
        <button type="button" class="switcher__footer-btn" @click="emit('import-file')">
          {{ t('data.switcher.importFile') }}
        </button>
        <button
          v-if="data.datasets.length > 0"
          type="button"
          class="switcher__footer-btn switcher__footer-btn--danger"
          @click="onResetAll"
        >
          {{ t('data.switcher.resetAll') }}
        </button>
      </footer>
    </div>

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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDataStore } from '@/stores/data';
import EditableText from '@/components/common/EditableText.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import { useConfirm } from '@/composables/useConfirm';

const emit = defineEmits<{
  (e: 'open-editor'): void;
  (e: 'import-file'): void;
}>();

const { t } = useI18n();
const data = useDataStore();
const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const confirmer = useConfirm();

const confirms = {
  deleteDataset: (name: string) =>
    confirmer.confirm({
      title: t('data.switcher.delete'),
      message: t('data.switcher.confirmDelete', { name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      tone: 'danger',
    }),
  resetAll: () =>
    confirmer.confirm({
      title: t('data.switcher.resetAll'),
      message: t('data.switcher.confirmReset'),
      confirmLabel: t('data.switcher.resetAll'),
      cancelLabel: t('common.cancel'),
      tone: 'danger',
    }),
  evictManual: (name: string) =>
    confirmer.confirm({
      title: t('data.switcher.confirmEvictManual', { name }),
      confirmLabel: t('common.confirm'),
      cancelLabel: t('common.cancel'),
      tone: 'danger',
    }),
};

const activeId = computed(() => data.activeDataset?.id ?? null);

const countSummary = computed(() => {
  const ds = data.activeDataset;
  const counter = t('data.switcher.datasetCount', {
    used: data.datasets.length,
    total: data.DATASET_LIMIT,
  });
  if (!ds) return counter;
  return `${rowsLabel(ds.rows.length)} · ${counter}`;
});

function rowsLabel(n: number): string {
  if (n === 0) return t('data.switcher.activeEmpty', { name: '' }).replace('· ', '');
  if (n === 1) return t('data.switcher.activeOne', { name: '' }).replace('· ', '');
  return t('data.switcher.active', { name: '', count: n }).replace('· ', '');
}

function toggle(): void {
  open.value = !open.value;
}

function close(): void {
  open.value = false;
}

function onPick(id: string): void {
  data.setActiveDataset(id);
  close();
}

function onRenameActive(next: string): void {
  if (!data.activeDataset) return;
  data.renameDataset(data.activeDataset.id, next);
}

async function onDuplicate(id: string): Promise<void> {
  const victim = data.peekEvictionVictim();
  if (victim?.source === 'manual') {
    if (!(await confirms.evictManual(victim.name))) return;
  }
  data.duplicateDataset(id);
  close();
}

async function onDelete(id: string, name: string): Promise<void> {
  if (!(await confirms.deleteDataset(name))) return;
  data.removeDataset(id);
}

function onNewManual(): void {
  const created = data.createDataset({
    source: 'manual',
    headers: [],
    rows: [],
    name: undefined,
  });
  if (created) data.setActiveDataset(created.id);
  close();
  emit('open-editor');
}

async function onResetAll(): Promise<void> {
  if (!(await confirms.resetAll())) return;
  data.resetAll();
  close();
}

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return;
  const root = rootRef.value;
  if (root && !root.contains(event.target as Node)) close();
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) close();
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick);
  document.removeEventListener('keydown', onKey);
});
</script>

<style scoped>
.switcher {
  position: relative;
  display: flex;
  flex-direction: column;
}

.switcher__trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  color: var(--color-text);
  font-size: var(--text-sm);
  text-align: left;
  width: 100%;
}

.switcher__trigger:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.switcher__name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: var(--weight-medium);
}

.switcher__count {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.switcher__chevron {
  font-size: 10px;
  color: var(--color-text-muted);
  transition: transform var(--duration-fast) var(--easing);
}

.switcher--open .switcher__chevron {
  transform: rotate(180deg);
}

.switcher__menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 50;
  margin-top: 4px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 60vh;
}

.switcher__list {
  list-style: none;
  padding: var(--space-1);
  margin: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.switcher__item {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: var(--radius-sm);
}

.switcher__item:hover {
  background: var(--color-bg-canvas);
}

.switcher__item-main {
  flex: 1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-text);
  text-align: left;
  background: transparent;
}

.switcher__item-main--active {
  background: var(--color-primary-subtle);
  color: var(--color-primary-text);
  font-weight: var(--weight-medium);
}

.switcher__item-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.switcher__item-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.switcher__row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-right: var(--space-1);
}

.switcher__row-action {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.switcher__row-action:hover {
  color: var(--color-text);
  background: rgba(0, 0, 0, 0.05);
}

.switcher__row-action--danger:hover {
  color: var(--color-error);
}

.switcher__footer {
  border-top: 1px solid var(--color-border);
  padding: var(--space-1);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.switcher__footer-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text);
  text-align: left;
  background: transparent;
  border-radius: var(--radius-sm);
}

.switcher__footer-btn:hover:not(:disabled) {
  background: var(--color-bg-canvas);
}

.switcher__footer-btn:disabled {
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.switcher__footer-btn--danger {
  color: var(--color-error);
}

.switcher__footer-btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.08);
}
</style>

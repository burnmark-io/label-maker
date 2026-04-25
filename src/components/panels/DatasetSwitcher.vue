<template>
  <div ref="rootRef" class="switcher" :class="{ 'switcher--open': open }">
    <button
      type="button"
      class="switcher__trigger"
      :aria-haspopup="true"
      :aria-expanded="open"
      :aria-label="t('data.switcher.menuLabel')"
      @click="toggle"
    >
      <span class="switcher__name">{{ activeLabel }}</span>
      <span class="switcher__count">{{ t('data.switcher.datasetCount', counters) }}</span>
      <span class="switcher__chevron" aria-hidden="true">▾</span>
    </button>

    <div v-if="open" class="switcher__menu" role="menu">
      <ul v-if="data.datasets.length > 0" class="switcher__list">
        <li v-for="ds in data.datasets" :key="ds.id" class="switcher__item">
          <button
            type="button"
            class="switcher__item-main"
            :class="{ 'switcher__item-main--active': ds.id === activeId }"
            role="menuitemradio"
            :aria-checked="ds.id === activeId"
            @click="onPick(ds.id)"
          >
            <span class="switcher__item-name">{{ ds.name }}</span>
            <span class="switcher__item-meta">{{ rowsLabel(ds.rows.length) }}</span>
          </button>
          <div class="switcher__row-actions">
            <button
              type="button"
              class="switcher__row-action"
              :title="t('data.switcher.rename')"
              :aria-label="t('data.switcher.rename')"
              @click="onRename(ds.id, ds.name)"
            >
              ✎
            </button>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDataStore } from '@/stores/data';

const emit = defineEmits<{
  (e: 'open-editor'): void;
  (e: 'import-file'): void;
}>();

const { t } = useI18n();
const data = useDataStore();
const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const activeId = computed(() => data.activeDataset?.id ?? null);

const activeLabel = computed(() => {
  const ds = data.activeDataset;
  if (!ds) return t('data.switcher.noActive');
  if (ds.rows.length === 0) return t('data.switcher.activeEmpty', { name: ds.name });
  if (ds.rows.length === 1) return t('data.switcher.activeOne', { name: ds.name });
  return t('data.switcher.active', { name: ds.name, count: ds.rows.length });
});

const counters = computed(() => ({
  used: data.datasets.length,
  total: data.DATASET_LIMIT,
}));

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

function onRename(id: string, current: string): void {
  const next = window.prompt(t('data.switcher.renamePrompt'), current);
  if (next == null) return;
  data.renameDataset(id, next);
}

function onDuplicate(id: string): void {
  const target = data.datasets.find(d => d.id === id);
  data.duplicateDataset(id, {
    onEvictManual: victim =>
      window.confirm(t('data.switcher.confirmEvictManual', { name: victim.name })),
  });
  if (target) close();
}

function onDelete(id: string, name: string): void {
  if (!window.confirm(t('data.switcher.confirmDelete', { name }))) return;
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

function onResetAll(): void {
  if (!window.confirm(t('data.switcher.confirmReset'))) return;
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

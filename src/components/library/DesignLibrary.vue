<template>
  <Modal :open="open" size="lg" :title="t('library.title')" @close="emit('close')">
    <div class="library">
      <header class="library__head">
        <p class="library__counter">
          {{ t('library.counter', { used: library.entries.length, total: library.MAX_SLOTS }) }}
        </p>
        <p v-if="library.isFull" class="library__hint">{{ t('library.fullHint') }}</p>
      </header>

      <LimitBanner v-if="library.isFull" :cta="t('library.feedbackCta')">
        {{ t('library.fullMessage') }}
      </LimitBanner>

      <ul class="library__grid">
        <li
          v-for="entry in library.entries"
          :key="entry.id"
          class="library__slot"
          :class="{ 'library__slot--current': entry.id === designer.document.id }"
        >
          <button
            type="button"
            class="library__open"
            :aria-label="t('library.openLabel', { name: entry.name })"
            @click="onOpen(entry.id)"
          >
            <div class="library__thumb">
              <img v-if="entry.thumbnail" :src="entry.thumbnail" alt="" />
              <span v-else class="library__thumb-placeholder">🏷️</span>
            </div>
          </button>
          <div class="library__meta">
            <input
              :value="entry.name"
              class="library__name"
              :aria-label="t('library.nameLabel')"
              @change="
                onRename(entry.id, ($event.target as HTMLInputElement).value, entry.description)
              "
            />
            <input
              :value="entry.description ?? ''"
              class="library__description"
              :placeholder="t('library.descriptionPlaceholder')"
              :aria-label="t('library.descriptionLabel')"
              @change="onRename(entry.id, entry.name, ($event.target as HTMLInputElement).value)"
            />
            <span class="library__updated">{{ formatDate(entry.updatedAt) }}</span>
          </div>
          <button
            type="button"
            class="library__delete"
            :aria-label="t('library.delete', { name: entry.name })"
            @click="onDelete(entry.id)"
          >
            ×
          </button>
        </li>

        <li v-for="i in emptySlots" :key="`empty-${i}`" class="library__slot library__slot--empty">
          <button
            type="button"
            class="library__plus"
            :disabled="!hasUnsavedToSave"
            :aria-label="t('library.newSlot')"
            @click="onSaveCurrent"
          >
            <span aria-hidden="true">+</span>
            <span class="library__plus-label">{{ t('library.newSlot') }}</span>
          </button>
        </li>
      </ul>
    </div>

    <template #footer>
      <button type="button" class="library__btn" @click="emit('close')">
        {{ t('common.close') }}
      </button>
      <button
        type="button"
        class="library__btn library__btn--primary"
        :disabled="library.isFull && !designAlreadyExists"
        :title="library.isFull && !designAlreadyExists ? t('library.cantSave') : ''"
        @click="onSaveCurrent"
      >
        {{ designAlreadyExists ? t('library.update') : t('library.save') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLibraryStore, LibraryFullError } from '@/stores/library';
import { useDesignerStore } from '@/stores/designer';
import { useToast } from '@/composables/useToast';
import LimitBanner from '@/components/common/LimitBanner.vue';
import Modal from '@/components/common/Modal.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const { t, locale } = useI18n();
const library = useLibraryStore();
const designer = useDesignerStore();
const { show } = useToast();

const emptySlots = computed(() => Math.max(0, library.MAX_SLOTS - library.entries.length));

const designAlreadyExists = computed(() =>
  library.entries.some(e => e.id === designer.document.id),
);

const hasUnsavedToSave = computed(() => !library.isFull || designAlreadyExists.value);

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(locale.value, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleDateString();
  }
}

async function buildThumbnail(): Promise<string | undefined> {
  try {
    const blob = await designer.exportPng(undefined, 0.25);
    return await blobToDataUrl(blob);
  } catch {
    return undefined;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function onSaveCurrent(): Promise<void> {
  const thumbnail = await buildThumbnail();
  try {
    await library.save(designer.document, { thumbnail });
    show(t('library.saved'), 'success');
  } catch (err) {
    if (err instanceof LibraryFullError) {
      show(t('library.fullToast'), 'error');
    } else {
      show(err instanceof Error ? err.message : String(err), 'error');
    }
  }
}

async function onOpen(id: string): Promise<void> {
  const doc = await library.loadDesign(id);
  if (!doc) {
    show(t('library.openFailed'), 'error');
    return;
  }
  designer.loadDocument(doc);
  designer.clearHistory();
  emit('close');
}

async function onDelete(id: string): Promise<void> {
  if (typeof window !== 'undefined' && !window.confirm(t('library.confirmDelete'))) {
    return;
  }
  await library.deleteDesign(id);
  show(t('library.deleted'), 'success');
}

async function onRename(id: string, name: string, description: string | undefined): Promise<void> {
  await library.rename(id, name.trim() || t('library.untitled'), description);
}

// Lazy load when first opened.
import { watch } from 'vue';
watch(
  () => props.open,
  async isOpen => {
    if (isOpen && !library.loaded) await library.load();
  },
  { immediate: true },
);
</script>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.library__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.library__counter {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
}

.library__hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
  padding: 0;
  list-style: none;
  margin: 0;
}

.library__slot {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color var(--duration-fast) var(--easing);
}

.library__slot--current {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15);
}

.library__slot--empty {
  background: var(--color-bg-canvas);
  border: 2px dashed var(--color-border-strong);
  align-items: stretch;
  justify-content: center;
}

.library__open {
  display: block;
  background: transparent;
  padding: 0;
  border: none;
}

.library__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  background: white;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.library__thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.library__thumb-placeholder {
  font-size: 28px;
  color: var(--color-text-muted);
}

.library__meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.library__name,
.library__description {
  font-size: var(--text-sm);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 2px var(--space-1);
  color: var(--color-text);
}

.library__name {
  font-weight: var(--weight-semibold);
}

.library__description {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.library__name:hover,
.library__name:focus,
.library__description:hover,
.library__description:focus {
  background: var(--color-bg-canvas);
  border-color: var(--color-border);
  outline: none;
}

.library__updated {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.library__delete {
  position: absolute;
  top: var(--space-1);
  right: var(--space-1);
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1;
}

.library__delete:hover {
  background: var(--color-error);
  color: white;
  border-color: var(--color-error);
}

.library__plus {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  width: 100%;
  min-height: 160px;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 28px;
}

.library__plus:hover:not(:disabled) {
  background: var(--color-primary-subtle);
  color: var(--color-primary-text);
}

.library__plus:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.library__plus-label {
  font-size: var(--text-sm);
}

.library__btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
}

.library__btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.library__btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

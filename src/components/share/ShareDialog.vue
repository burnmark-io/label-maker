<template>
  <Modal :open="open" size="md" :title="t('share.title')" @close="emit('close')">
    <div class="share">
      <p class="share__hint">{{ t('share.hint') }}</p>

      <template v-if="url">
        <div class="share__url-row">
          <input
            ref="urlInput"
            type="text"
            class="share__url"
            readonly
            :value="url"
            :aria-label="t('share.urlLabel')"
            @focus="onFocus"
          />
          <button
            type="button"
            class="share__btn"
            @click="onCopy"
          >
            {{ copied ? t('share.copied') : t('share.copy') }}
          </button>
        </div>
        <p class="share__meta">
          {{ t('share.size', { size: url.length, limit: maxLength }) }}
        </p>
      </template>

      <p v-else-if="error === 'too-large'" class="share__error">
        {{ t('share.tooLarge') }}
      </p>
      <p v-else-if="error" class="share__error">{{ error }}</p>
    </div>

    <template #footer>
      <button type="button" class="share__btn" @click="emit('close')">
        {{ t('common.close') }}
      </button>
      <button
        v-if="error === 'too-large'"
        type="button"
        class="share__btn share__btn--primary"
        @click="onExportLabel"
      >
        {{ t('share.exportLabel') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { useToast } from '@/composables/useToast';
import {
  buildShareUrl,
  MAX_ENCODED_LENGTH,
  ShareTooLargeError,
} from '@/services/share-encoder';
import { downloadBlob, safeFileName } from '@/services/file-download';
import Modal from '@/components/common/Modal.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const { t } = useI18n();
const designer = useDesignerStore();
const { show } = useToast();

const url = ref<string | null>(null);
const error = ref<string | null>(null);
const copied = ref(false);
const maxLength = MAX_ENCODED_LENGTH;
const urlInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      url.value = null;
      error.value = null;
      copied.value = false;
      return;
    }
    try {
      url.value = buildShareUrl(designer.document, window.location.origin);
      error.value = null;
      await nextTick();
      urlInput.value?.select();
    } catch (err) {
      url.value = null;
      if (err instanceof ShareTooLargeError) {
        error.value = 'too-large';
      } else {
        error.value = err instanceof Error ? err.message : String(err);
      }
    }
  },
);

function onFocus(event: FocusEvent): void {
  (event.target as HTMLInputElement).select();
}

async function onCopy(): Promise<void> {
  if (!url.value) return;
  try {
    await navigator.clipboard.writeText(url.value);
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 1500);
  } catch {
    urlInput.value?.select();
    document.execCommand('copy');
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 1500);
  }
}

function onExportLabel(): void {
  const json = designer.toJSON();
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `${safeFileName(designer.document.name)}.label`);
  show(t('export.labelDownloaded'), 'success');
  emit('close');
}
</script>

<style scoped>
.share {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.share__hint {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.share__url-row {
  display: flex;
  gap: var(--space-2);
}

.share__url {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  background: var(--color-bg-canvas);
}

.share__meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.share__error {
  font-size: var(--text-sm);
  color: var(--color-text);
  padding: var(--space-3);
  background: var(--color-primary-subtle);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary-light);
}

.share__btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
}

.share__btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}
</style>

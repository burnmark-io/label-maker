<template>
  <Modal
    :open="open"
    size="sm"
    :title="t('reset.title')"
    :close-label="t('common.close')"
    @close="onClose"
  >
    <div class="reset">
      <p class="reset__body">{{ t('reset.body') }}</p>
      <p class="reset__warning">{{ t('reset.warning') }}</p>

      <label class="reset__label" for="reset-confirm">
        {{ t('reset.confirmLabel', { word: confirmWord }) }}
      </label>
      <input
        id="reset-confirm"
        v-model="typed"
        type="text"
        class="reset__input"
        autocomplete="off"
        :disabled="busy"
      />
    </div>

    <template #footer>
      <button type="button" class="btn btn--ghost" :disabled="busy" @click="onClose">
        {{ t('reset.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn--danger"
        :disabled="!canConfirm || busy"
        @click="onSubmit"
      >
        {{ busy ? t('reset.resetting') : t('reset.submit') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from './Modal.vue';
import { useCryptoStore } from '@/stores/crypto';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();
const { t } = useI18n();
const crypto = useCryptoStore();

// Untranslated keyword — same string in every locale so QA only has to
// test one path. The label that *introduces* the word is translated.
const confirmWord = 'reset';

const typed = ref('');
const busy = ref(false);

const canConfirm = computed(() => typed.value.trim().toLowerCase() === confirmWord);

watch(
  () => props.open,
  isOpen => {
    if (!isOpen) {
      typed.value = '';
      busy.value = false;
    }
  },
);

function onClose(): void {
  if (busy.value) return;
  emit('close');
}

async function onSubmit(): Promise<void> {
  if (!canConfirm.value || busy.value) return;
  busy.value = true;
  try {
    await crypto.resetAllUserData();
    if (typeof window !== 'undefined') window.location.reload();
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.reset {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text);
}

.reset__body {
  margin: 0;
}

.reset__warning {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-canvas);
  border-left: 3px solid var(--color-danger, #c0392b);
  border-radius: var(--radius-sm);
  color: var(--color-text);
}

.reset__label {
  font-weight: var(--weight-medium);
}

.reset__input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  font-size: var(--text-base);
  color: var(--color-text);
}

.btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-weight: var(--weight-medium);
  border: 1px solid transparent;
  cursor: pointer;
}

.btn--ghost {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--color-bg-canvas);
}

.btn--danger {
  background: var(--color-danger, #c0392b);
  color: white;
}

.btn--danger:hover:not(:disabled) {
  filter: brightness(0.95);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

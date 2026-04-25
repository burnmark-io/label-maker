<template>
  <Modal :open="open" size="sm" :title="t('data.import.dialogTitle')" @close="onCancel">
    <p class="import-dialog__intro">
      {{
        t('data.import.dialogIntro', {
          file: ctx?.fileName ?? '',
          rows: ctx?.parsed.rows.length ?? 0,
        })
      }}
    </p>

    <div class="import-dialog__actions">
      <button type="button" class="import-dialog__choice" @click="choose('append')">
        <span class="import-dialog__choice-title">
          {{ t('data.import.appendTo', { name: ctx?.activeName ?? '' }) }}
        </span>
        <span class="import-dialog__choice-hint">{{ t('data.import.appendHint') }}</span>
      </button>
      <button type="button" class="import-dialog__choice" @click="choose('new')">
        <span class="import-dialog__choice-title">{{ t('data.import.newSet') }}</span>
        <span class="import-dialog__choice-hint">{{ t('data.import.newSetHint') }}</span>
      </button>
    </div>

    <label class="import-dialog__remember">
      <input v-model="remember" type="checkbox" />
      <span>{{ t('data.import.remember') }}</span>
    </label>

    <template #footer>
      <button type="button" class="btn-ghost" @click="onCancel">
        {{ t('common.cancel') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/common/Modal.vue';
import type { ImportRouteContext } from '@/composables/useCsvImport';

const props = defineProps<{
  open: boolean;
  ctx: ImportRouteContext | null;
}>();

const emit = defineEmits<{
  (e: 'choose', action: 'append' | 'new', remember: boolean): void;
  (e: 'cancel'): void;
}>();

const { t } = useI18n();
const remember = ref(false);

watch(
  () => props.open,
  isOpen => {
    if (isOpen) remember.value = false;
  },
);

function choose(action: 'append' | 'new'): void {
  emit('choose', action, remember.value);
}

function onCancel(): void {
  emit('cancel');
}
</script>

<style scoped>
.import-dialog__intro {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-3);
}

.import-dialog__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.import-dialog__choice {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.import-dialog__choice:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.import-dialog__choice-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.import-dialog__choice-hint {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.import-dialog__remember {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: var(--space-3);
  cursor: pointer;
}

.btn-ghost {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.btn-ghost:hover {
  background: var(--color-bg-canvas);
  color: var(--color-text);
}
</style>

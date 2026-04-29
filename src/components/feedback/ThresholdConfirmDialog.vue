<template>
  <Modal
    :open="threshold.open.value"
    size="sm"
    :title="title"
    :close-label="t('output.threshold.cancel')"
    @close="onCancel"
  >
    <p class="threshold__body">{{ body }}</p>
    <label class="threshold__skip">
      <input v-model="dontAskAgain" type="checkbox" />
      <span>{{ t('output.threshold.dontAskAgain') }}</span>
    </label>
    <template #footer>
      <button type="button" class="threshold__btn threshold__btn--ghost" @click="onCancel">
        {{ t('output.threshold.cancel') }}
      </button>
      <button type="button" class="threshold__btn threshold__btn--primary" @click="onConfirm">
        {{ confirmLabel }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/common/Modal.vue';
import { useThresholdConfirm } from '@/composables/useThresholdConfirm';

const { t } = useI18n();
const threshold = useThresholdConfirm();
const dontAskAgain = ref(false);

const title = computed(() => {
  const ctx = threshold.context.value;
  return ctx ? t('output.threshold.title', { count: ctx.count }) : '';
});

const body = computed(() => {
  const ctx = threshold.context.value;
  if (!ctx) return '';
  if (ctx.destination === 'sheet') {
    return t('output.threshold.bodySheet', {
      labels: ctx.count,
      pages: ctx.pageCount ?? 0,
      sheet: ctx.sheetLabel ?? '',
    });
  }
  if (ctx.printerModel) {
    return t('output.threshold.bodyThermal', { count: ctx.count, model: ctx.printerModel });
  }
  return t('output.threshold.bodyThermalNoModel', { count: ctx.count });
});

const confirmLabel = computed(() => {
  const ctx = threshold.context.value;
  return ctx ? t('output.threshold.confirm', { count: ctx.count }) : t('output.threshold.cancel');
});

function onConfirm(): void {
  threshold.accept(dontAskAgain.value);
  dontAskAgain.value = false;
}

function onCancel(): void {
  threshold.decline();
  dontAskAgain.value = false;
}
</script>

<style scoped>
.threshold__body {
  margin: 0 0 var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: 1.5;
}

.threshold__skip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.threshold__btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  border: 1px solid transparent;
}

.threshold__btn--ghost {
  background: transparent;
  color: var(--color-text-secondary);
}

.threshold__btn--ghost:hover {
  background: var(--color-bg-canvas);
  color: var(--color-text);
}

.threshold__btn--primary {
  background: var(--color-primary);
  color: white;
}

.threshold__btn--primary:hover {
  background: var(--color-primary-hover);
}
</style>

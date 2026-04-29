<template>
  <Transition name="toast">
    <div v-if="progress.isVisible.value" class="print-progress" role="status" aria-live="polite">
      <div class="print-progress__body">
        <p class="print-progress__message">{{ message }}</p>
        <div v-if="state.kind === 'printing'" class="print-progress__bar">
          <div
            class="print-progress__bar-fill"
            :style="{ width: `${percent}%` }"
            :aria-valuenow="state.completed"
            :aria-valuemin="0"
            :aria-valuemax="state.total"
            role="progressbar"
          />
        </div>
      </div>
      <div class="print-progress__actions">
        <button
          v-if="state.kind === 'printing' || state.kind === 'generating-sheet'"
          type="button"
          class="print-progress__btn"
          @click="onCancel"
        >
          {{ t('progress.cancel') }}
        </button>
        <button
          v-if="state.kind === 'error' && state.canResume"
          type="button"
          class="print-progress__btn print-progress__btn--primary"
          @click="onResume"
        >
          {{ t('progress.resume', { row: (state.errorRowIndex ?? 0) + 1 }) }}
        </button>
        <button
          v-if="state.kind === 'error' || state.kind === 'cancelled' || state.kind === 'success'"
          type="button"
          class="print-progress__btn"
          @click="onDismiss"
        >
          {{ t('progress.dismiss') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePrintProgress } from '@/composables/usePrintProgress';

const { t } = useI18n();
const progress = usePrintProgress();
const state = progress.state;

const percent = computed(() => {
  const s = state.value;
  if (s.total <= 0) return 0;
  return Math.min(100, Math.round((s.completed / s.total) * 100));
});

const message = computed(() => {
  const s = state.value;
  switch (s.kind) {
    case 'generating-sheet':
      return t('progress.generatingSheet');
    case 'printing':
      if (s.copiesPerRow > 1) {
        return t('progress.printing', {
          total: s.total,
          row: s.rowIndex + 1,
          rowsTotal: s.rowsTotal,
          copy: s.copy,
          copies: s.copiesPerRow,
        });
      }
      return t('progress.printingSimple', {
        total: s.total,
        row: s.rowIndex + 1,
        rowsTotal: s.rowsTotal,
      });
    case 'error':
      return t('progress.errorRow', {
        row: (s.errorRowIndex ?? 0) + 1,
        message: s.errorMessage ?? '',
      });
    case 'cancelled':
      return t('progress.cancelled', { printed: s.completed, total: s.total });
    case 'success':
      return t('progress.successCount', { count: s.completed });
    default:
      return '';
  }
});

function onCancel(): void {
  progress.cancel();
}

function onResume(): void {
  progress.resume();
}

function onDismiss(): void {
  progress.dismiss();
}

// Auto-dismiss success after 4s.
watch(
  () => state.value.kind,
  kind => {
    if (kind === 'success') {
      window.setTimeout(() => {
        if (progress.state.value.kind === 'success') progress.dismiss();
      }, 4000);
    }
  },
);
</script>

<style scoped>
.print-progress {
  position: fixed;
  bottom: var(--space-4);
  right: var(--space-4);
  z-index: 50;
  min-width: 320px;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.print-progress__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.print-progress__message {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.print-progress__bar {
  height: 4px;
  background: var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.print-progress__bar-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width var(--duration-fast) var(--easing);
}

.print-progress__actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.print-progress__btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  border: 1px solid var(--color-border);
  background: var(--color-bg-canvas);
  color: var(--color-text);
}

.print-progress__btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity var(--duration-fast) var(--easing);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}
</style>

<template>
  <section v-if="printer.isConnected" class="output-print">
    <h3 class="output-print__heading">{{ t('output.print.heading') }}</h3>
    <div class="output-print__fields">
      <label class="output-print__field">
        <span class="output-print__label">{{ t('output.print.copies') }}</span>
        <input
          v-model.number="config.copies"
          type="number"
          min="1"
          max="30"
          class="output-print__input"
        />
      </label>
      <label class="output-print__field">
        <span class="output-print__label">{{ t('output.print.density') }}</span>
        <select v-model="config.density" class="output-print__input">
          <option value="light">{{ t('actions.densityLight') }}</option>
          <option value="normal">{{ t('actions.densityNormal') }}</option>
          <option value="dark">{{ t('actions.densityDark') }}</option>
        </select>
      </label>
    </div>
    <button
      class="output-print__action"
      type="button"
      :disabled="!canPrint"
      :title="canPrint ? '' : disabledReason"
      @click="onPrint"
    >
      {{ t('output.print.action') }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePrinterStore } from '@/stores/printer';
import { useDesignerStore } from '@/stores/designer';
import { useDataStore } from '@/stores/data';
import { usePrintConfigStore } from '@/stores/print-config';
import { useToast } from '@/composables/useToast';

const { t } = useI18n();
const printer = usePrinterStore();
const designer = useDesignerStore();
const data = useDataStore();
const config = usePrintConfigStore();
const { show, update, dismiss } = useToast();

const canPrint = computed<boolean>(
  () => printer.isConnected && Boolean(printer.effectiveMedia) && !printer.isPrinting,
);

const disabledReason = computed<string>(() => {
  if (!printer.isConnected) return t('actions.printNoPrinter');
  if (!printer.effectiveMedia) return t('actions.printNoMedia');
  return '';
});

async function onPrint(): Promise<void> {
  if (!canPrint.value) return;
  const toastId = show(t('actions.printingTo', { model: printer.model ?? '' }), 'info', {
    sticky: true,
  });
  try {
    const variables = data.currentVariables;
    const rgba = await designer.renderToRGBA(
      Object.keys(variables).length > 0 ? variables : undefined,
    );
    const image = {
      width: rgba.width,
      height: rgba.height,
      data: new Uint8Array(rgba.data.buffer, rgba.data.byteOffset, rgba.data.byteLength),
    };
    const cps = Math.max(1, Math.min(30, config.copies || 1));
    await printer.print(image, { copies: cps, density: config.density });
    update(toastId, { message: t('actions.printSuccess'), kind: 'success', sticky: false });
    window.setTimeout(() => dismiss(toastId), 4000);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    update(toastId, {
      message: t('actions.printFailed', { error: message }),
      kind: 'error',
      sticky: false,
    });
    window.setTimeout(() => dismiss(toastId), 6000);
  }
}
</script>

<style scoped>
.output-print {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.output-print__heading {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.output-print__fields {
  display: flex;
  gap: var(--space-3);
}

.output-print__field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.output-print__label {
  font-weight: var(--weight-medium);
}

.output-print__input {
  font-size: var(--text-sm);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text);
}

.output-print__action {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  background: var(--color-primary);
  color: white;
  border: 1px solid transparent;
}

.output-print__action:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.output-print__action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

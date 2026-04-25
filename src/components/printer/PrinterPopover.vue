<template>
  <div ref="rootRef" class="popover">
    <PrinterStatus class="popover__trigger" :open="open" @click="toggle" />
    <transition name="popover-fade">
      <div
        v-if="open"
        class="popover__panel"
        role="dialog"
        :aria-label="t('printer.popoverTitle')"
      >
        <div v-if="!printer.isConnected" class="popover__section">
          <p class="popover__heading">{{ t('printer.connectHeading') }}</p>
          <button class="popover__btn popover__btn--primary" type="button" @click="connectUsb">
            {{ t('printer.connectUsb') }}
          </button>
          <button
            v-if="serialAvailable"
            class="popover__btn"
            type="button"
            :title="t('printer.connectSerialHint')"
            @click="connectSerial"
          >
            {{ t('printer.connectSerial') }}
          </button>
          <p v-if="!usbAvailable" class="popover__note">{{ t('printer.noWebUsb') }}</p>
          <p v-if="connectError" class="popover__error">{{ connectError }}</p>
        </div>

        <div v-else class="popover__section">
          <p class="popover__heading">{{ printer.model }}</p>
          <MediaSelector />
          <button class="popover__btn" type="button" @click="disconnect">
            {{ t('printer.disconnect') }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import PrinterStatus from './PrinterStatus.vue';
import MediaSelector from './MediaSelector.vue';
import { usePrinterStore } from '@/stores/printer';
import {
  isWebSerialAvailable,
  isWebUsbAvailable,
  requestUsbPrinter,
} from '@/lib/printer/connect';
import { openBrotherQLViaSerial } from '@/lib/printer/drivers';

const { t } = useI18n();
const printer = usePrinterStore();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const connectError = ref<string | null>(null);

const usbAvailable = computed(() => isWebUsbAvailable());
const serialAvailable = computed(() => isWebSerialAvailable());

function toggle(): void {
  open.value = !open.value;
  connectError.value = null;
}

function close(): void {
  open.value = false;
  connectError.value = null;
}

async function connectUsb(): Promise<void> {
  connectError.value = null;
  printer.setConnecting();
  try {
    const adapter = await requestUsbPrinter();
    printer.setAdapter(adapter);
    await printer.refreshStatus();
    close();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The user dismissing the picker shows up as NotFoundError — treat
    // as a quiet cancel, not an error.
    if (err instanceof Error && err.name === 'NotFoundError') {
      printer.setAdapter(null);
      return;
    }
    printer.setError(message);
    connectError.value = message;
  }
}

async function connectSerial(): Promise<void> {
  connectError.value = null;
  printer.setConnecting();
  try {
    const adapter = await openBrotherQLViaSerial();
    printer.setAdapter(adapter);
    await printer.refreshStatus();
    close();
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') {
      printer.setAdapter(null);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    printer.setError(message);
    connectError.value = message;
  }
}

async function disconnect(): Promise<void> {
  await printer.disconnect();
  close();
}

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return;
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    close();
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
});
</script>

<style scoped>
.popover {
  position: relative;
  display: inline-flex;
}

.popover__trigger {
  display: inline-flex;
}

.popover__panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 280px;
  max-width: 360px;
  padding: var(--space-3);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 50;
}

.popover__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.popover__heading {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.popover__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  transition: background var(--duration-fast) var(--easing);
}

.popover__btn:hover {
  background: var(--color-bg);
}

.popover__btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: transparent;
}

.popover__btn--primary:hover {
  background: var(--color-primary-hover);
}

.popover__note {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.popover__error {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-error);
}

.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity var(--duration-fast) var(--easing),
    transform var(--duration-fast) var(--easing);
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -4px);
}
</style>

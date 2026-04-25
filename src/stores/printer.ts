import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * Printer connection state. Phase 4 will fill this in with real WebUSB /
 * Web Serial connection logic and driver-specific adapters. Phase 1 just
 * scaffolds the store so the UI can render a placeholder status.
 */
export type PrinterStatus =
  | { status: 'disconnected' }
  | { status: 'paired'; model: string; lastSeen: string }
  | { status: 'connecting'; model: string }
  | { status: 'connected'; model: string; media?: string; assumed: boolean }
  | { status: 'error'; model: string; message: string };

export const usePrinterStore = defineStore('printer', () => {
  const state = ref<PrinterStatus>({ status: 'disconnected' });

  const isConnected = computed(() => state.value.status === 'connected');
  const isPaired = computed(() => state.value.status === 'paired');

  function setStatus(next: PrinterStatus): void {
    state.value = next;
  }

  return {
    state,
    isConnected,
    isPaired,
    setStatus,
  };
});

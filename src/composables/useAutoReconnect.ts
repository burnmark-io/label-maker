import { onMounted } from 'vue';
import { usePrinterStore } from '@/stores/printer';
import { isWebUsbAvailable, tryReconnectUsb } from '@/lib/printer/connect';

/**
 * On app load, try to reopen the most recently paired USB printer
 * without prompting. `navigator.usb.getDevices()` returns devices the
 * user has already authorised — no user gesture required.
 *
 * If the printer is found and opened, the store also fires a status
 * refresh so detected media propagates immediately.
 */
export function useAutoReconnect(): void {
  const printer = usePrinterStore();

  onMounted(async () => {
    if (!isWebUsbAvailable()) return;
    // Skip if we already have an adapter (e.g. HMR, double-mount).
    if (printer.adapter) return;

    try {
      const adapter = await tryReconnectUsb();
      if (!adapter) return;
      printer.setAdapter(adapter);
      await printer.refreshStatus();
    } catch (err) {
      console.warn('[burnmark] auto-reconnect failed', err);
    }
  });
}

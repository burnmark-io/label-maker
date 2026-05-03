import { onMounted } from 'vue';
import { usePrinterStore } from '@/stores/printer';
import { tryReconnectAllUsb } from '@/lib/printer/connect';
import { useBrowserCapabilities } from './useBrowserCapabilities';

/**
 * On app load, reopen every previously paired USB printer in parallel.
 * `navigator.usb.getDevices()` returns devices the user has already
 * authorised — no user gesture required.
 *
 * Single-printer users get the same UX as today (one entry, one
 * adapter). Multi-printer users see all their paired devices restored
 * concurrently. Failed entries are logged but kept in the persisted
 * `last-connections` list (plan §6.2 ghost-card data) — currently
 * surfaced only via the persisted list, not yet rendered as ghost
 * cards in the popover (deferred).
 *
 * After each successful adapter, fires a status refresh so detected
 * media propagates immediately.
 */
export function useAutoReconnect(): void {
  const printer = usePrinterStore();
  const { webUsb } = useBrowserCapabilities();

  onMounted(async () => {
    if (!webUsb.value) return;
    // Skip if anything is already connected (HMR, double-mount).
    if (printer.connections.size > 0) return;

    try {
      const adapters = await tryReconnectAllUsb();
      for (const adapter of adapters) {
        printer.addConnection(adapter);
      }
      // Single status refresh for the active slot — Step 3's polling
      // loop will catch up the rest within one tick.
      if (printer.connections.size > 0) {
        await printer.refreshStatus();
      }
    } catch (err) {
      console.warn('[burnmark] auto-reconnect failed', err);
    }
  });
}

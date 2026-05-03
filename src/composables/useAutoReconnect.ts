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
      // Snapshot the persisted records before the addConnection loop
      // mutates them — we want the *prior session's* fingerprints so
      // per-slot media (keyed by fingerprint+role) round-trips. The
      // upserts inside addConnection will rewrite the same records
      // afterwards.
      const priorRecords = [...printer.lastConnections];
      const adapters = await tryReconnectAllUsb();
      for (const adapter of adapters) {
        // Match by family+model — accepts the realistic-distribution
        // collision (two of the exact same model fall to whichever
        // record sorts first; nicknames are the user-driven
        // tiebreaker per plan §2.6).
        const match = priorRecords.find(
          r => r.family === adapter.family && r.model === adapter.model,
        );
        printer.addConnection(adapter, { fingerprintHint: match?.fingerprint });
      }
      // Refresh every connection in parallel so each row's status dot
      // hydrates immediately — otherwise non-active rows show grey for
      // up to POLL_INTERVAL_MS while waiting for their first poll.
      if (printer.connections.size > 0) {
        await printer.refreshAllStatus();
      }
    } catch (err) {
      console.warn('[burnmark] auto-reconnect failed', err);
    }
  });
}

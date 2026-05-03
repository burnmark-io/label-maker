import { ref } from 'vue';
import type { PrinterAdapter } from '@thermal-label/contracts';

import { usePrinterStore, type Connection } from '@/stores/printer';
import { requestUsbPrinter } from '@/lib/printer/connect';
import { openBrotherQLViaSerial } from '@/lib/printer/drivers';
import { identifyByVidPid } from '@/lib/printer/registry';

/**
 * Shared helpers for the unified output target menu (plan local-4 §5.1).
 *
 * Wraps the connect / disconnect plumbing so the menu's row markup
 * stays presentational. `runConnect` mirrors the pre-refactor helper
 * from `PrinterPopover.vue` lines 365–390 — lift-and-shift, not new
 * behaviour.
 */
export function useOutputTargetActions() {
  const printer = usePrinterStore();
  const connectError = ref<string | null>(null);

  function clearError(): void {
    connectError.value = null;
  }

  async function runConnect(open: () => Promise<PrinterAdapter>, additive: boolean): Promise<void> {
    connectError.value = null;
    if (!additive) printer.setConnecting();
    try {
      const adapter = await open();
      if (additive) {
        printer.addConnection(adapter);
      } else {
        printer.setAdapter(adapter);
      }
      await printer.refreshStatus();
    } catch (err) {
      if (err instanceof Error && err.name === 'NotFoundError') {
        // OS picker dismissed — quiet cancel.
        if (!additive) printer.setAdapter(null);
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      if (!additive) printer.setError(message);
      connectError.value = message;
    }
  }

  async function connectUsb(additive = false): Promise<void> {
    await runConnect(requestUsbPrinter, additive);
  }

  async function connectSerial(additive = false): Promise<void> {
    await runConnect(openBrotherQLViaSerial, additive);
  }

  async function removeConnection(id: string): Promise<void> {
    const conn = printer.getConnection(id);
    if (!conn) return;
    const fingerprint = conn.fingerprint;
    try {
      await conn.adapter.close();
    } catch (err) {
      console.warn('[burnmark] close failed', err);
    }
    printer.removeConnection(id);
    // Manual disconnect = "I'm done with this printer." Drop our own
    // persisted record AND revoke the browser-level WebUSB pairing
    // — without forget(), `navigator.usb.getDevices()` would still
    // return the device on next boot and `useAutoReconnect` would
    // open it again. USB unplug / transport drop don't take this
    // path and keep the pairing intact.
    printer.forgetLastConnection(fingerprint);
    await forgetUsbPairingFor(conn);
  }

  /**
   * Revoke the browser-level WebUSB permission for any paired device
   * matching this connection's family + model. Match is fuzzy by
   * design (vid/pid → family/model name) — DeviceEntry doesn't carry
   * a serial number, and `printer.fingerprint` is internal-only. For
   * the realistic distribution (1-2 printers, rarely two of the same
   * model) this matches exactly the device the user disconnected.
   */
  async function forgetUsbPairingFor(conn: Connection): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.usb) return;
    try {
      const devices = await navigator.usb.getDevices();
      for (const d of devices) {
        const entry = identifyByVidPid(d.vendorId, d.productId);
        if (!entry) continue;
        if (entry.family !== conn.family) continue;
        if (entry.device.name !== conn.model) continue;
        const forgettable = d as USBDevice & { forget?: () => Promise<void> };
        if (typeof forgettable.forget === 'function') {
          await forgettable.forget();
        }
      }
    } catch (err) {
      console.warn('[burnmark] usb forget failed', err);
    }
  }

  return {
    connectError,
    clearError,
    runConnect,
    connectUsb,
    connectSerial,
    removeConnection,
  };
}

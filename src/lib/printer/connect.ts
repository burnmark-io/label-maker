import type { PrinterAdapter } from '@thermal-label/contracts';

import { getAllUsbFilters, identifyByVidPid } from './registry';
import { openFromUSBDevice } from './drivers';

/**
 * Show the WebUSB picker filtered to every supported family. User-gesture
 * required (must be called from a click handler).
 */
export async function requestUsbPrinter(): Promise<PrinterAdapter> {
  if (!navigator.usb) {
    throw new Error('WebUSB is not available in this browser');
  }
  const filters = getAllUsbFilters();
  const device = await navigator.usb.requestDevice({ filters });
  return openFromUSBDevice(device);
}

/**
 * Find a previously paired USBDevice and open it. Returns `null` if no
 * known device is paired. Safe to call on app load (no user gesture
 * needed for `getDevices()`).
 *
 * Single-adapter convenience used by callers that only ever want one
 * connection. For multi-printer restore see `tryReconnectAllUsb`.
 */
export async function tryReconnectUsb(): Promise<PrinterAdapter | null> {
  const all = await tryReconnectAllUsb();
  return all[0] ?? null;
}

/**
 * Reopen every previously paired USBDevice in parallel. Returns the
 * adapters that opened successfully — failed entries are logged and
 * dropped. Used by the multi-printer auto-reconnect path (plan §2.4 /
 * §6.2): on boot, every persisted record is replayed concurrently.
 *
 * Single-printer users see exactly today's behaviour: one paired
 * device, one adapter returned.
 */
export async function tryReconnectAllUsb(): Promise<PrinterAdapter[]> {
  if (!navigator.usb) return [];
  const devices = await navigator.usb.getDevices();
  const known = devices.filter(d => identifyByVidPid(d.vendorId, d.productId));
  const settled = await Promise.allSettled(known.map(d => openFromUSBDevice(d)));
  const adapters: PrinterAdapter[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') adapters.push(r.value);
    else console.warn('[burnmark] failed to reopen paired device', r.reason);
  }
  return adapters;
}

/** True if the browser exposes WebUSB. */
export function isWebUsbAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.usb;
}

/** True if the browser exposes Web Serial. */
export function isWebSerialAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serial;
}

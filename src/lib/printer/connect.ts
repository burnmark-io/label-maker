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
 */
export async function tryReconnectUsb(): Promise<PrinterAdapter | null> {
  if (!navigator.usb) return null;
  const devices = await navigator.usb.getDevices();
  for (const device of devices) {
    if (identifyByVidPid(device.vendorId, device.productId)) {
      try {
        return await openFromUSBDevice(device);
      } catch (err) {
        console.warn('[burnmark] failed to reopen paired device', err);
      }
    }
  }
  return null;
}

/** True if the browser exposes WebUSB. */
export function isWebUsbAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.usb;
}

/** True if the browser exposes Web Serial. */
export function isWebSerialAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serial;
}

import type { PrinterAdapter } from '@thermal-label/contracts';
import {
  fromUSBDevice as brotherFromUSB,
  WebBrotherQLPrinter,
} from '@thermal-label/brother-ql-web';
import { fromUSBDevice as labelwriterFromUSB } from '@thermal-label/labelwriter-web';
import { fromUSBDevice as labelmanagerFromUSB } from '@thermal-label/labelmanager-web';
import { DEVICES as BROTHER_DEVICES } from '@thermal-label/brother-ql-core';
import { WebSerialTransport } from '@thermal-label/transport/web';

import { identifyByVidPid, type PrinterFamily } from './registry';

/**
 * Open a `PrinterAdapter` from an already-paired `USBDevice`. Looks up
 * the family by VID/PID and dispatches to the right driver entry point.
 */
export async function openFromUSBDevice(usbDevice: USBDevice): Promise<PrinterAdapter> {
  const entry = identifyByVidPid(usbDevice.vendorId, usbDevice.productId);
  if (!entry) {
    throw new Error(
      `Unsupported USB device VID=0x${usbDevice.vendorId.toString(16)} PID=0x${usbDevice.productId.toString(16)}`,
    );
  }
  return openFromUSBDeviceForFamily(usbDevice, entry.family);
}

export async function openFromUSBDeviceForFamily(
  usbDevice: USBDevice,
  family: PrinterFamily,
): Promise<PrinterAdapter> {
  switch (family) {
    case 'brother-ql':
      return brotherFromUSB(usbDevice);
    case 'labelwriter':
      return labelwriterFromUSB(usbDevice);
    case 'labelmanager':
      return labelmanagerFromUSB(usbDevice);
  }
}

/**
 * Open a Brother QL via Web Serial — for the QL-820NWB Bluetooth SPP
 * pairing. The OS-level pairing must already exist; the browser shows a
 * port picker that includes paired SPP devices alongside wired serial
 * ports.
 */
export async function openBrotherQLViaSerial(): Promise<PrinterAdapter> {
  const transport = await WebSerialTransport.request();
  // The serial transport doesn't expose VID/PID, so we assume QL-820NWB
  // — that is the only Brother QL with Bluetooth SPP. If a future model
  // adds web-serial transport, add a small selector here.
  return new WebBrotherQLPrinter(BROTHER_DEVICES.QL_820NWB, transport);
}

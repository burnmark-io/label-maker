import { DEVICES as BROTHER_DEVICES, MEDIA as BROTHER_MEDIA } from '@thermal-label/brother-ql-core';
import {
  DEVICES as LABELWRITER_DEVICES,
  MEDIA as LABELWRITER_MEDIA,
} from '@thermal-label/labelwriter-core';
import {
  DEVICES as LABELMANAGER_DEVICES,
  MEDIA as LABELMANAGER_MEDIA,
} from '@thermal-label/labelmanager-core';
import { buildUsbFilters } from '@thermal-label/transport';
import type { DeviceDescriptor, MediaDescriptor } from '@thermal-label/contracts';

export type PrinterFamily = 'brother-ql' | 'labelwriter' | 'labelmanager';

export interface RegistryEntry {
  family: PrinterFamily;
  device: DeviceDescriptor;
}

const ALL: RegistryEntry[] = [
  ...Object.values(BROTHER_DEVICES).map((d) => ({ family: 'brother-ql' as const, device: d })),
  ...Object.values(LABELWRITER_DEVICES).map((d) => ({ family: 'labelwriter' as const, device: d })),
  ...Object.values(LABELMANAGER_DEVICES).map((d) => ({
    family: 'labelmanager' as const,
    device: d,
  })),
];

const ALL_DEVICES: DeviceDescriptor[] = ALL.map((entry) => entry.device);

/** Combined USB filter set across every supported family. */
export function getAllUsbFilters(): USBDeviceFilter[] {
  return buildUsbFilters(ALL_DEVICES);
}

/** Identify a USB device by VID/PID. */
export function identifyByVidPid(vid: number, pid: number): RegistryEntry | undefined {
  return ALL.find((entry) => entry.device.vid === vid && entry.device.pid === pid);
}

/**
 * Driver families that have media auto-detection on the web. Used by the
 * UI to decide whether to surface the manual media selector by default.
 */
export const FAMILIES_WITH_DETECTION: ReadonlySet<PrinterFamily> = new Set(['brother-ql']);

/**
 * Whether a family supports Web Serial in the browser. Brother's
 * QL-820NWB(c) speak Bluetooth SPP, listed by the OS-paired serial
 * picker; the others are USB-only.
 */
export const FAMILIES_WITH_WEB_SERIAL: ReadonlySet<PrinterFamily> = new Set(['brother-ql']);

/** All media descriptors known for a family. */
export function getMediaForFamily(family: PrinterFamily): MediaDescriptor[] {
  switch (family) {
    case 'brother-ql':
      return Object.values(BROTHER_MEDIA);
    case 'labelwriter':
      return Object.values(LABELWRITER_MEDIA);
    case 'labelmanager':
      return Object.values(LABELMANAGER_MEDIA);
  }
}

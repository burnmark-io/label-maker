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
  ...Object.values(BROTHER_DEVICES).map(d => ({ family: 'brother-ql' as const, device: d })),
  ...Object.values(LABELWRITER_DEVICES).map(d => ({ family: 'labelwriter' as const, device: d })),
  ...Object.values(LABELMANAGER_DEVICES).map(d => ({
    family: 'labelmanager' as const,
    device: d,
  })),
];

const ALL_DEVICES: DeviceDescriptor[] = ALL.map(entry => entry.device);

/** Combined USB filter set across every supported family. */
export function getAllUsbFilters(): USBDeviceFilter[] {
  return buildUsbFilters(ALL_DEVICES);
}

/** Identify a USB device by VID/PID. */
export function identifyByVidPid(vid: number, pid: number): RegistryEntry | undefined {
  return ALL.find(entry => entry.device.vid === vid && entry.device.pid === pid);
}

/**
 * Driver families that have media auto-detection on the web. Used by the
 * UI to decide whether to surface the manual media selector by default.
 */
export const FAMILIES_WITH_DETECTION: ReadonlySet<PrinterFamily> = new Set(['brother-ql']);

/**
 * Driver families that support periodic status polling. All three
 * supported families implement getStatus() with structured errors;
 * Brother QL and LabelWriter 550 also report detectedMedia.
 *
 * See `amendment-printer-status-polling.md §3.6` for the per-protocol
 * breakdown.
 */
export const FAMILIES_WITH_STATUS_POLLING: ReadonlySet<PrinterFamily> = new Set([
  'brother-ql',
  'labelwriter',
  'labelmanager',
]);

/**
 * Per-model exclusions from periodic polling. A model whose key is in
 * this set does NOT poll even if its family is in
 * `FAMILIES_WITH_STATUS_POLLING`.
 *
 * Empty in v1 — architectural seam for the future case where a specific
 * model within a polling family turns out to misbehave on status
 * queries (e.g. firmware that hangs the bulk pipe under repeated
 * `getStatus()` calls).
 */
export const PER_MODEL_STATUS_POLLING_EXCLUSIONS: ReadonlySet<string> = new Set<string>();

/** Compose the model key used by `PER_MODEL_STATUS_POLLING_EXCLUSIONS`. */
export function modelKey(family: PrinterFamily, model: string): string {
  return `${family}:${model}`;
}

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

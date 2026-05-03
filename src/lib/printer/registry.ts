import {
  DEVICE_REGISTRY as BROTHER_REGISTRY,
  DEVICES as BROTHER_DEVICES,
  MEDIA as BROTHER_MEDIA,
  PROTOCOLS as BROTHER_PROTOCOLS,
  findDevice as findBrother,
} from '@thermal-label/brother-ql-core';
import {
  REGISTRY_LW as LABELWRITER_REGISTRY,
  DEVICES as LABELWRITER_DEVICES,
  MEDIA as LABELWRITER_MEDIA,
  PROTOCOLS as LABELWRITER_PROTOCOLS,
  findDevice as findLabelwriter,
} from '@thermal-label/labelwriter-core';
import {
  DEVICE_REGISTRY_DATA as LABELMANAGER_REGISTRY,
  DEVICES as LABELMANAGER_DEVICES,
  MEDIA as LABELMANAGER_MEDIA,
  PROTOCOLS as LABELMANAGER_PROTOCOLS,
  findDevice as findLabelmanager,
} from '@thermal-label/labelmanager-core';
import { buildUsbFilters } from '@thermal-label/transport';
import {
  resolveSupportedDevices,
  type DeviceEntry,
  type MediaDescriptor,
  type SupportedDevice,
  type TransportType,
} from '@thermal-label/contracts';

export type PrinterFamily = 'brother-ql' | 'labelwriter' | 'labelmanager';

export interface RegistryEntry {
  family: PrinterFamily;
  device: DeviceEntry;
}

export interface SupportedEntry {
  family: PrinterFamily;
  supported: SupportedDevice;
}

/**
 * Transports this runtime can drive in the browser. `usb` covers Web
 * USB; `serial` covers Web Serial including Bluetooth-SPP devices the
 * OS pre-pairs into the serial picker. Expand when we add Web TCP or
 * Web Bluetooth GATT.
 */
const RUNTIME_TRANSPORTS: ReadonlySet<TransportType> = new Set(['usb', 'serial']);

/**
 * Per-family supported-device tables. Each entry is a `SupportedDevice`
 * with per-engine `drivable` flags and `drivableTransports` /
 * `undrivableTransports` arrays — drives the picker badges and engine
 * slot construction at pair time.
 */
export const SUPPORTED_BROTHER: readonly SupportedDevice[] = resolveSupportedDevices(
  BROTHER_REGISTRY,
  BROTHER_PROTOCOLS,
  RUNTIME_TRANSPORTS,
);
export const SUPPORTED_LABELWRITER: readonly SupportedDevice[] = resolveSupportedDevices(
  LABELWRITER_REGISTRY,
  LABELWRITER_PROTOCOLS,
  RUNTIME_TRANSPORTS,
);
export const SUPPORTED_LABELMANAGER: readonly SupportedDevice[] = resolveSupportedDevices(
  LABELMANAGER_REGISTRY,
  LABELMANAGER_PROTOCOLS,
  RUNTIME_TRANSPORTS,
);

const ALL: RegistryEntry[] = [
  ...Object.values(BROTHER_DEVICES).map(d => ({ family: 'brother-ql' as const, device: d })),
  ...Object.values(LABELWRITER_DEVICES).map(d => ({ family: 'labelwriter' as const, device: d })),
  ...Object.values(LABELMANAGER_DEVICES).map(d => ({
    family: 'labelmanager' as const,
    device: d,
  })),
];

const ALL_DEVICES: DeviceEntry[] = ALL.map(entry => entry.device);

/** Combined USB filter set across every supported family. */
export function getAllUsbFilters(): USBDeviceFilter[] {
  return buildUsbFilters(ALL_DEVICES);
}

/** Identify a USB device by VID/PID. Delegates to each driver's `findDevice` so hex-string parsing stays inside the driver. */
export function identifyByVidPid(vid: number, pid: number): RegistryEntry | undefined {
  const b = findBrother(vid, pid);
  if (b) return { family: 'brother-ql', device: b };
  const w = findLabelwriter(vid, pid);
  if (w) return { family: 'labelwriter', device: w };
  const m = findLabelmanager(vid, pid);
  if (m) return { family: 'labelmanager', device: m };
  return undefined;
}

function supportedTableFor(family: PrinterFamily): readonly SupportedDevice[] {
  switch (family) {
    case 'brother-ql':
      return SUPPORTED_BROTHER;
    case 'labelwriter':
      return SUPPORTED_LABELWRITER;
    case 'labelmanager':
      return SUPPORTED_LABELMANAGER;
  }
}

/**
 * Look up a device in the resolved supported-device table. Useful when
 * the store needs per-engine `drivable` flags or per-transport
 * drivability hints for a connected device.
 */
export function findSupported(family: PrinterFamily, name: string): SupportedDevice | undefined {
  return supportedTableFor(family).find(d => d.name === name);
}

/**
 * Per-model exclusions from periodic polling. A model whose key is in
 * this set does NOT poll even though `getStatus()` exists.
 *
 * Empty in v1 — architectural seam for the future case where a specific
 * model's firmware misbehaves on repeated status queries (e.g. hangs
 * the bulk pipe). Drop into this set rather than gating by family.
 */
export const PER_MODEL_STATUS_POLLING_EXCLUSIONS: ReadonlySet<string> = new Set<string>();

/** Compose the model key used by `PER_MODEL_STATUS_POLLING_EXCLUSIONS`. */
export function modelKey(family: PrinterFamily, model: string): string {
  return `${family}:${model}`;
}

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

/**
 * Media compatible with a specific engine — filters the family list
 * down to entries whose `targetModels` overlap the engine's
 * `mediaCompatibility`. An engine without `mediaCompatibility` accepts
 * the whole family; a media without `targetModels` fits every device
 * in the family. Both rules are documented on the contracts.
 *
 * Example: an LW 450's `lw-450` engine has `mediaCompatibility: ['lw']`,
 * which excludes the family's D1 tape entries (those target `['d1']`)
 * — so the LW 450's picker doesn't list D1 cartridges.
 */
export function getMediaForEngine(
  family: PrinterFamily,
  engine: { mediaCompatibility?: readonly string[] },
): MediaDescriptor[] {
  const all = getMediaForFamily(family);
  if (!engine.mediaCompatibility || engine.mediaCompatibility.length === 0) return all;
  const compat = new Set(engine.mediaCompatibility);
  return all.filter(m => {
    if (!m.targetModels || m.targetModels.length === 0) return true;
    return m.targetModels.some(t => compat.has(t));
  });
}

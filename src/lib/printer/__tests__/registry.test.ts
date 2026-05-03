import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_BROTHER,
  SUPPORTED_LABELMANAGER,
  SUPPORTED_LABELWRITER,
  findSupported,
  getAllUsbFilters,
  getMediaForFamily,
  identifyByVidPid,
} from '../registry';

describe('printer registry', () => {
  it('identifies a Brother QL by VID/PID (QL-820NWBc)', () => {
    const entry = identifyByVidPid(0x04f9, 0x209d);
    expect(entry?.family).toBe('brother-ql');
    expect(entry?.device.name).toBe('QL-820NWBc');
  });

  it('identifies a Dymo LabelWriter (LW 450)', () => {
    const entry = identifyByVidPid(0x0922, 0x0020); // 2338 / 32
    expect(entry?.family).toBe('labelwriter');
    expect(entry?.device.name).toBe('LabelWriter 450');
  });

  it('returns undefined for unknown VID/PID', () => {
    expect(identifyByVidPid(0xdead, 0xbeef)).toBeUndefined();
  });

  it('union of USB filters covers every family', () => {
    const filters = getAllUsbFilters();
    const vids = new Set(filters.map(f => f.vendorId));
    expect(vids.has(0x04f9)).toBe(true); // Brother
    expect(vids.has(0x0922)).toBe(true); // Dymo
  });

  it('returns family-specific media lists', () => {
    expect(getMediaForFamily('brother-ql').length).toBeGreaterThan(0);
    expect(getMediaForFamily('labelwriter').length).toBeGreaterThan(0);
    expect(getMediaForFamily('labelmanager').length).toBeGreaterThan(0);
  });

  it('exposes resolveSupportedDevices output per family', () => {
    expect(SUPPORTED_BROTHER.length).toBeGreaterThan(0);
    expect(SUPPORTED_LABELWRITER.length).toBeGreaterThan(0);
    expect(SUPPORTED_LABELMANAGER.length).toBeGreaterThan(0);
    // Every supported device has at least one drivable transport on this runtime.
    for (const d of [...SUPPORTED_BROTHER, ...SUPPORTED_LABELWRITER, ...SUPPORTED_LABELMANAGER]) {
      expect(d.drivableTransports.length).toBeGreaterThan(0);
      expect(d.engines.some(e => e.drivable)).toBe(true);
    }
  });

  it('marks the QL-820NWBc engine as drivable (ql-raster)', () => {
    const ql820 = findSupported('brother-ql', 'QL-820NWBc');
    expect(ql820).toBeDefined();
    expect(ql820?.engines[0]?.drivable).toBe(true);
    expect(ql820?.engines[0]?.protocol).toBe('ql-raster');
  });
});

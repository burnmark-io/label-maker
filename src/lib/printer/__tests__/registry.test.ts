import { describe, expect, it } from 'vitest';
import {
  FAMILIES_WITH_DETECTION,
  FAMILIES_WITH_WEB_SERIAL,
  getAllUsbFilters,
  getMediaForFamily,
  identifyByVidPid,
} from '../registry';

describe('printer registry', () => {
  it('identifies a Brother QL by VID/PID (QL-820NWB)', () => {
    const entry = identifyByVidPid(0x04f9, 0x20a7); // 1273 / 8359
    expect(entry?.family).toBe('brother-ql');
    expect(entry?.device.name).toBe('QL-820NWB');
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
    const vids = new Set(filters.map((f) => f.vendorId));
    expect(vids.has(0x04f9)).toBe(true); // Brother
    expect(vids.has(0x0922)).toBe(true); // Dymo
  });

  it('returns family-specific media lists', () => {
    expect(getMediaForFamily('brother-ql').length).toBeGreaterThan(0);
    expect(getMediaForFamily('labelwriter').length).toBeGreaterThan(0);
    expect(getMediaForFamily('labelmanager').length).toBeGreaterThan(0);
  });

  it('flags brother-ql as supporting auto-detection and web-serial', () => {
    expect(FAMILIES_WITH_DETECTION.has('brother-ql')).toBe(true);
    expect(FAMILIES_WITH_WEB_SERIAL.has('brother-ql')).toBe(true);
    expect(FAMILIES_WITH_DETECTION.has('labelwriter')).toBe(false);
    expect(FAMILIES_WITH_WEB_SERIAL.has('labelmanager')).toBe(false);
  });
});

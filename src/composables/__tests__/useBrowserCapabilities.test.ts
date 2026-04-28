import { afterEach, describe, expect, it } from 'vitest';

import { useBrowserCapabilities } from '../useBrowserCapabilities';

interface NavigatorPatch {
  usb?: object;
  serial?: object;
  bluetooth?: object;
  userAgent?: string;
}

const original = {
  usb: 'usb' in navigator ? (navigator as unknown as { usb: unknown }).usb : undefined,
  serial: 'serial' in navigator ? (navigator as unknown as { serial: unknown }).serial : undefined,
  bluetooth:
    'bluetooth' in navigator
      ? (navigator as unknown as { bluetooth: unknown }).bluetooth
      : undefined,
  userAgent: navigator.userAgent,
};

function patchNavigator(patch: NavigatorPatch): void {
  if ('usb' in patch) {
    if (patch.usb === undefined) delete (navigator as unknown as { usb?: unknown }).usb;
    else (navigator as unknown as { usb: unknown }).usb = patch.usb;
  }
  if ('serial' in patch) {
    if (patch.serial === undefined) delete (navigator as unknown as { serial?: unknown }).serial;
    else (navigator as unknown as { serial: unknown }).serial = patch.serial;
  }
  if ('bluetooth' in patch) {
    if (patch.bluetooth === undefined)
      delete (navigator as unknown as { bluetooth?: unknown }).bluetooth;
    else (navigator as unknown as { bluetooth: unknown }).bluetooth = patch.bluetooth;
  }
  if (patch.userAgent !== undefined) {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => patch.userAgent,
    });
  }
}

afterEach(() => {
  // Reset navigator to its pre-test shape.
  if (original.usb === undefined) delete (navigator as unknown as { usb?: unknown }).usb;
  else (navigator as unknown as { usb: unknown }).usb = original.usb;
  if (original.serial === undefined) delete (navigator as unknown as { serial?: unknown }).serial;
  else (navigator as unknown as { serial: unknown }).serial = original.serial;
  if (original.bluetooth === undefined)
    delete (navigator as unknown as { bluetooth?: unknown }).bluetooth;
  else (navigator as unknown as { bluetooth: unknown }).bluetooth = original.bluetooth;
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () => original.userAgent,
  });
});

describe('useBrowserCapabilities', () => {
  it('reflects navigator transport presence', () => {
    patchNavigator({ usb: {}, serial: undefined, bluetooth: undefined });
    const caps = useBrowserCapabilities();
    expect(caps.webUsb.value).toBe(true);
    expect(caps.webSerial.value).toBe(false);
    expect(caps.webBluetooth.value).toBe(false);
    expect(caps.hasAnyTransport.value).toBe(true);
  });

  it('hasAnyTransport is false when neither usb nor serial', () => {
    patchNavigator({ usb: undefined, serial: undefined, bluetooth: undefined });
    const caps = useBrowserCapabilities();
    expect(caps.hasAnyTransport.value).toBe(false);
  });

  it('hasAnyTransport is true when only serial is available', () => {
    patchNavigator({ usb: undefined, serial: {}, bluetooth: undefined });
    const caps = useBrowserCapabilities();
    expect(caps.hasAnyTransport.value).toBe(true);
  });

  it('detects edge from Edg/ token before chrome fall-through', () => {
    patchNavigator({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    });
    const caps = useBrowserCapabilities();
    expect(caps.browser.value).toBe('edge');
  });

  it('detects opera from OPR/ token', () => {
    patchNavigator({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0',
    });
    const caps = useBrowserCapabilities();
    expect(caps.browser.value).toBe('opera');
  });

  it('detects chrome', () => {
    patchNavigator({
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    });
    const caps = useBrowserCapabilities();
    expect(caps.browser.value).toBe('chrome');
  });

  it('detects firefox', () => {
    patchNavigator({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
    });
    const caps = useBrowserCapabilities();
    expect(caps.browser.value).toBe('firefox');
  });

  it('detects safari (Safari/ without Chrome/)', () => {
    patchNavigator({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
    });
    const caps = useBrowserCapabilities();
    expect(caps.browser.value).toBe('safari');
  });

  it('falls back to other for unknown UA', () => {
    patchNavigator({ userAgent: 'CustomBot/1.0' });
    const caps = useBrowserCapabilities();
    expect(caps.browser.value).toBe('other');
  });
});

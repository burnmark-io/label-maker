import { computed, type ComputedRef } from 'vue';

export type Browser = 'chrome' | 'edge' | 'firefox' | 'safari' | 'opera' | 'other';

export interface BrowserCapabilities {
  webUsb: ComputedRef<boolean>;
  webSerial: ComputedRef<boolean>;
  webBluetooth: ComputedRef<boolean>;
  hasAnyTransport: ComputedRef<boolean>;
  browser: ComputedRef<Browser>;
}

/**
 * Reactive view of the browser's printer-transport capabilities. Module-
 * load-time stable in practice — refs are computed so tests can mock the
 * navigator and re-read.
 *
 * UA detection is best-effort and only used to tailor the
 * browser-not-supported copy — never as a security gate.
 */
export function useBrowserCapabilities(): BrowserCapabilities {
  const webUsb = computed(() => typeof navigator !== 'undefined' && 'usb' in navigator);
  const webSerial = computed(() => typeof navigator !== 'undefined' && 'serial' in navigator);
  const webBluetooth = computed(
    () => typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  );
  const hasAnyTransport = computed(() => webUsb.value || webSerial.value);
  const browser = computed<Browser>(() => detectBrowser());
  return { webUsb, webSerial, webBluetooth, hasAnyTransport, browser };
}

function detectBrowser(): Browser {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  // Edg/ and OPR/ also contain Chrome/ — check the more-specific brands
  // before falling through to chrome.
  if (/Edg\//.test(ua)) return 'edge';
  if (/OPR\//.test(ua)) return 'opera';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'safari';
  return 'other';
}

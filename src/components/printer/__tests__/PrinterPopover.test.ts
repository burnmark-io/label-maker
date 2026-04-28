import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { nextTick } from 'vue';

import en from '@/i18n/locales/en.json';
import PrinterPopover from '../PrinterPopover.vue';
import { PRINTER_HELP_URL } from '@/lib/printer/help';

interface NavigatorPatch {
  usb?: object;
  serial?: object;
  userAgent?: string;
}

const original = {
  usb: 'usb' in navigator ? (navigator as unknown as { usb: unknown }).usb : undefined,
  serial: 'serial' in navigator ? (navigator as unknown as { serial: unknown }).serial : undefined,
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
  if (patch.userAgent !== undefined) {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => patch.userAgent,
    });
  }
}

function mountPopover() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  const wrapper = mount(PrinterPopover, {
    global: { plugins: [i18n] },
  });
  return wrapper;
}

async function openPopover(wrapper: ReturnType<typeof mountPopover>) {
  await wrapper.find('.popover__trigger').trigger('click');
  await nextTick();
}

describe('PrinterPopover render branches', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    if (original.usb === undefined) delete (navigator as unknown as { usb?: unknown }).usb;
    else (navigator as unknown as { usb: unknown }).usb = original.usb;
    if (original.serial === undefined) delete (navigator as unknown as { serial?: unknown }).serial;
    else (navigator as unknown as { serial: unknown }).serial = original.serial;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => original.userAgent,
    });
    vi.restoreAllMocks();
  });

  it('renders both buttons when both transports are present', async () => {
    patchNavigator({
      usb: {},
      serial: {},
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    });
    const wrapper = mountPopover();
    await openPopover(wrapper);

    const buttons = wrapper.findAll('.popover__btn');
    expect(buttons.length).toBe(2);
    expect(buttons[0]!.text()).toContain('USB');
    expect(buttons[1]!.text()).toContain('Bluetooth');
    expect(wrapper.text()).not.toContain('Connecting a printer needs');
  });

  it('renders only USB when serial is unavailable', async () => {
    patchNavigator({
      usb: {},
      serial: undefined,
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    });
    const wrapper = mountPopover();
    await openPopover(wrapper);

    const buttons = wrapper.findAll('.popover__btn');
    expect(buttons.length).toBe(1);
    expect(buttons[0]!.text()).toContain('USB');
  });

  it('renders only Serial when WebUSB is unavailable (Firefox Nightly)', async () => {
    patchNavigator({
      usb: undefined,
      serial: {},
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
    });
    const wrapper = mountPopover();
    await openPopover(wrapper);

    const buttons = wrapper.findAll('.popover__btn');
    expect(buttons.length).toBe(1);
    expect(buttons[0]!.text()).toContain('Bluetooth');
    expect(buttons[0]!.classes()).toContain('popover__btn--primary');
  });

  it('shows the unsupported-browser panel when neither transport is present', async () => {
    patchNavigator({
      usb: undefined,
      serial: undefined,
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    });
    const wrapper = mountPopover();
    await openPopover(wrapper);

    expect(wrapper.findAll('.popover__btn').length).toBe(0);
    expect(wrapper.text()).toContain('Connecting a printer needs Chrome, Edge, or Opera');
  });

  it('shows Firefox-specific copy when neither transport is present on Firefox', async () => {
    patchNavigator({
      usb: undefined,
      serial: undefined,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
    });
    const wrapper = mountPopover();
    await openPopover(wrapper);

    expect(wrapper.text()).toContain('Firefox Nightly');
  });

  it('shows Safari-specific copy when neither transport is present on Safari', async () => {
    patchNavigator({
      usb: undefined,
      serial: undefined,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
    });
    const wrapper = mountPopover();
    await openPopover(wrapper);

    expect(wrapper.text()).toContain("Safari and iOS browsers don't support");
  });

  it('toggles the "Why this is?" expander', async () => {
    patchNavigator({
      usb: undefined,
      serial: undefined,
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    });
    const wrapper = mountPopover();
    await openPopover(wrapper);

    const why = wrapper.find('.popover__why');
    expect(wrapper.find('.popover__why-body').exists()).toBe(false);
    await why.trigger('click');
    expect(wrapper.find('.popover__why-body').exists()).toBe(true);
    expect(wrapper.find('.popover__why-body').text()).toContain('WebUSB and WebSerial');
  });

  it('shows help link with correct attributes when there is a connect error', async () => {
    patchNavigator({
      usb: {},
      serial: {},
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    });
    // Force connectUsb to fail with a non-NotFoundError so the error path renders.
    const connectModule = await import('@/lib/printer/connect');
    vi.spyOn(connectModule, 'requestUsbPrinter').mockRejectedValueOnce(
      new Error('Failed to claim interface 0: Access denied'),
    );

    const wrapper = mountPopover();
    await openPopover(wrapper);
    const usbBtn = wrapper.findAll('.popover__btn').find((b) => b.text().includes('USB'))!;
    await usbBtn.trigger('click');
    await nextTick();
    await nextTick();

    const link = wrapper.find('.popover__help-link');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe(PRINTER_HELP_URL);
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import type { PrinterAdapter } from '@thermal-label/contracts';

import { usePrinterStore } from '@/stores/printer';
import { useAutoReconnect } from '../useAutoReconnect';

vi.mock('@/lib/printer/connect', () => ({
  tryReconnectUsb: vi.fn(),
}));

vi.mock('../useBrowserCapabilities', () => ({
  useBrowserCapabilities: () => ({
    webUsb: { value: true },
    webSerial: { value: false },
    webBluetooth: { value: false },
    hasAnyTransport: { value: true },
    browser: { value: 'chrome' },
  }),
}));

import { tryReconnectUsb } from '@/lib/printer/connect';

const mockedTryReconnect = vi.mocked(tryReconnectUsb);

const Harness = defineComponent({
  setup() {
    useAutoReconnect();
    return () => h('div');
  },
});

function makeAdapter(): PrinterAdapter {
  return {
    family: 'brother-ql',
    model: 'QL-820NWB',
    connected: true,
    device: {
      name: 'QL-820NWB',
      family: 'brother-ql',
      vid: 0x04f9,
      pid: 0x20a7,
      transports: ['usb', 'webusb'],
    },
    getStatus: vi.fn(async () => ({
      ready: true,
      mediaLoaded: true,
      detectedMedia: undefined,
      errors: [],
      rawBytes: new Uint8Array(),
    })),
    print: vi.fn(async () => undefined),
    createPreview: vi.fn(async () => ({
      planes: [],
      media: { id: 'm', name: 'm', widthMm: 62, type: 'continuous' },
      assumed: true,
    })),
    close: vi.fn(async () => undefined),
  } as unknown as PrinterAdapter;
}

describe('useAutoReconnect', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedTryReconnect.mockReset();
  });

  it('attaches the reconnected adapter on mount', async () => {
    const adapter = makeAdapter();
    mockedTryReconnect.mockResolvedValueOnce(adapter);

    const wrapper = mount(Harness);
    await nextTick();
    await Promise.resolve();
    await Promise.resolve();

    const printer = usePrinterStore();
    expect(printer.adapter).toBe(adapter);
    expect(printer.isConnected).toBe(true);
    wrapper.unmount();
  });

  it('does nothing when no paired device is found', async () => {
    mockedTryReconnect.mockResolvedValueOnce(null);

    const wrapper = mount(Harness);
    await nextTick();
    await Promise.resolve();

    const printer = usePrinterStore();
    expect(printer.adapter).toBeNull();
    expect(printer.isConnected).toBe(false);
    wrapper.unmount();
  });

  it('logs and continues when reconnect throws', async () => {
    mockedTryReconnect.mockRejectedValueOnce(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const wrapper = mount(Harness);
    await nextTick();
    await Promise.resolve();

    const printer = usePrinterStore();
    expect(printer.adapter).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    wrapper.unmount();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type {
  MediaDescriptor,
  PreviewResult,
  PrinterAdapter,
  PrinterStatus,
  RawImageData,
} from '@thermal-label/contracts';

import { usePrinterStore } from '../printer';

function makeMedia(overrides: Partial<MediaDescriptor> = {}): MediaDescriptor {
  return {
    id: 'm1',
    name: 'Test media',
    widthMm: 62,
    type: 'continuous',
    ...overrides,
  };
}

interface MockAdapter extends PrinterAdapter {
  getStatus: ReturnType<typeof vi.fn>;
  print: ReturnType<typeof vi.fn>;
  createPreview: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function makeAdapter(
  opts: {
    family?: string;
    model?: string;
    vid?: number;
    pid?: number;
    status?: Partial<PrinterStatus>;
    preview?: PreviewResult;
  } = {},
): MockAdapter {
  const adapter: MockAdapter = {
    family: opts.family ?? 'brother-ql',
    model: opts.model ?? 'QL-820NWB',
    connected: true,
    device: {
      name: opts.model ?? 'QL-820NWB',
      family: opts.family ?? 'brother-ql',
      vid: opts.vid ?? 0x04f9,
      pid: opts.pid ?? 0x20a7,
      transports: ['usb', 'webusb'],
    },
    getStatus: vi.fn(
      async (): Promise<PrinterStatus> => ({
        ready: true,
        mediaLoaded: true,
        detectedMedia: opts.status?.detectedMedia,
        errors: [],
        rawBytes: new Uint8Array(),
        ...opts.status,
      }),
    ),
    print: vi.fn(async () => undefined),
    createPreview: vi.fn(
      async () =>
        opts.preview ?? {
          planes: [],
          media: makeMedia(),
          assumed: false,
        },
    ),
    close: vi.fn(async () => undefined),
  } as unknown as MockAdapter;
  return adapter;
}

describe('printer store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
  });

  it('starts disconnected', () => {
    const store = usePrinterStore();
    expect(store.connection.kind).toBe('disconnected');
    expect(store.isConnected).toBe(false);
    expect(store.adapter).toBeNull();
  });

  it('attaches an adapter and resolves family from registry', () => {
    const store = usePrinterStore();
    const adapter = makeAdapter();
    store.setAdapter(adapter);

    expect(store.isConnected).toBe(true);
    expect(store.family).toBe('brother-ql');
    expect(store.model).toBe('QL-820NWB');
    expect(window.localStorage.getItem('burnmark.lastConnected')).toContain('QL-820NWB');
  });

  it('refreshStatus pulls detected media into the store', async () => {
    const store = usePrinterStore();
    const detected = makeMedia({ id: 'detected', name: '62mm continuous' });
    store.setAdapter(makeAdapter({ status: { detectedMedia: detected } }));

    await store.refreshStatus();
    expect(store.detectedMedia?.id).toBe('detected');
    expect(store.effectiveMedia?.id).toBe('detected');
  });

  it('manual media selection overrides detected media', async () => {
    const store = usePrinterStore();
    const detected = makeMedia({ id: 'auto', name: 'auto media' });
    const manual = makeMedia({ id: 'manual', name: 'manual media' });
    store.setAdapter(makeAdapter({ status: { detectedMedia: detected } }));
    await store.refreshStatus();
    store.setSelectedMedia(manual);
    expect(store.effectiveMedia?.id).toBe('manual');
  });

  it('refreshPreview stores the driver preview result', async () => {
    const store = usePrinterStore();
    const preview: PreviewResult = {
      planes: [],
      media: makeMedia(),
      assumed: true,
    };
    store.setAdapter(makeAdapter({ preview }));

    const image: RawImageData = {
      width: 4,
      height: 4,
      data: new Uint8Array(64),
    };
    await store.refreshPreview(image);
    expect(store.lastPreview).toEqual(preview);
  });

  it('print() forwards effective media and options to the adapter', async () => {
    const store = usePrinterStore();
    const adapter = makeAdapter();
    store.setAdapter(adapter);
    const media = makeMedia({ id: 'pick' });
    store.setSelectedMedia(media);

    const image: RawImageData = {
      width: 1,
      height: 1,
      data: new Uint8Array([0]),
    };
    await store.print(image, { copies: 3, density: 'dark' });

    expect(adapter.print).toHaveBeenCalledWith(image, media, {
      copies: 3,
      density: 'dark',
    });
    expect(store.isPrinting).toBe(false);
  });

  it('disconnect closes the adapter and clears state', async () => {
    const store = usePrinterStore();
    const adapter = makeAdapter();
    store.setAdapter(adapter);
    await store.disconnect();
    expect(adapter.close).toHaveBeenCalled();
    expect(store.adapter).toBeNull();
    expect(store.isConnected).toBe(false);
  });

  it('records last paired model and survives next session', () => {
    const store = usePrinterStore();
    store.setAdapter(makeAdapter({ model: 'LabelWriter 450', vid: 0x0922, pid: 0x0020 }));
    expect(store.lastPaired?.model).toBe('LabelWriter 450');

    setActivePinia(createPinia());
    const next = usePrinterStore();
    expect(next.lastPaired?.model).toBe('LabelWriter 450');
  });
});

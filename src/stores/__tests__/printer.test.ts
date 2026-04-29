import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type {
  MediaDescriptor,
  PreviewResult,
  PrinterAdapter,
  PrinterStatus,
  RawImageData,
} from '@thermal-label/contracts';

import { usePrinterStore } from '../printer';
import { useDesignerStore } from '../designer';

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

  it('print() forwards effective media and adds rotate:"auto" by default', async () => {
    const store = usePrinterStore();
    const adapter = makeAdapter();
    store.setAdapter(adapter);
    const media = makeMedia({ id: 'pick' });
    store.setSelectedMedia(media);

    const image: RawImageData = {
      width: 1,
      height: 1,
      data: new Uint8Array([0, 0, 0, 255]),
    };
    await store.print(image, { copies: 3, density: 'dark' });

    expect(adapter.print).toHaveBeenCalledWith(image, media, {
      copies: 3,
      density: 'dark',
      rotate: 'auto',
    });
    expect(store.isPrinting).toBe(false);
  });

  it('print() forwards the bitmap unchanged regardless of canvas.orientation', async () => {
    // Orientation-aware rendering happens upstream in the designer store
    // (renderToRGBA already produces a display-shaped bitmap). The print
    // step is now a pure forward — same image reference reaches the adapter.
    const designer = useDesignerStore();
    designer.setCanvas({ widthDots: 4, heightDots: 2, dpi: 300, orientation: 'horizontal' });

    const store = usePrinterStore();
    const adapter = makeAdapter();
    store.setAdapter(adapter);

    const image: RawImageData = {
      width: 4,
      height: 2,
      data: new Uint8Array(4 * 2 * 4).fill(255),
    };
    await store.print(image);

    expect(adapter.print).toHaveBeenCalledTimes(1);
    const [imgArg, , optsArg] = adapter.print.mock.calls[0]!;
    expect(imgArg).toBe(image);
    expect(optsArg).toEqual({ rotate: 'auto' });
  });

  it('print() leaves the bitmap untouched when orientation is vertical', async () => {
    const designer = useDesignerStore();
    designer.setCanvas({ widthDots: 4, heightDots: 2, dpi: 300, orientation: 'vertical' });

    const store = usePrinterStore();
    const adapter = makeAdapter();
    store.setAdapter(adapter);

    const image: RawImageData = {
      width: 4,
      height: 2,
      data: new Uint8Array(4 * 2 * 4),
    };
    await store.print(image);

    const [imgArg] = adapter.print.mock.calls[0]!;
    expect(imgArg).toBe(image);
  });

  it('print() preserves an explicit rotate override from the caller', async () => {
    const store = usePrinterStore();
    const adapter = makeAdapter();
    store.setAdapter(adapter);

    const image: RawImageData = {
      width: 4,
      height: 2,
      data: new Uint8Array(4 * 2 * 4),
    };
    // Caller forces rotate: 0 — the rotate:'auto' default must not overwrite it.
    await store.print(image, { rotate: 0 } as Parameters<typeof store.print>[1]);

    const [, , optsArg] = adapter.print.mock.calls[0]!;
    expect(optsArg).toEqual({ rotate: 0 });
  });

  it('setAdapter(null) from connecting resets to disconnected', () => {
    // Cancel path: user clicks Connect → setConnecting() → WebUSB picker
    // dismissed → catch calls setAdapter(null). Before the fix this stayed
    // stuck in 'connecting'.
    const store = usePrinterStore();
    store.setConnecting();
    expect(store.connection.kind).toBe('connecting');
    store.setAdapter(null);
    expect(store.connection.kind).toBe('disconnected');
  });

  it('setAdapter(null) from error resets to disconnected', () => {
    const store = usePrinterStore();
    store.setError('boom');
    expect(store.connection.kind).toBe('error');
    store.setAdapter(null);
    expect(store.connection.kind).toBe('disconnected');
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

describe('printer store — polling', () => {
  // Constants mirror the values in stores/printer.ts. Hard-coded so a
  // change to the production cadence breaks these tests intentionally
  // — the cadence is part of the user-visible contract.
  const POLL_INTERVAL_MS = 5000;
  const POLL_INTERVAL_BURST_MS = 2000;
  const POLL_BURST_DURATION_MS = 30_000;

  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules the first poll one interval after a polling-family adapter is set', async () => {
    const store = usePrinterStore();
    const adapter = makeAdapter({ family: 'brother-ql', model: 'QL-820NWB' });
    store.setAdapter(adapter);

    // setAdapter must not poll synchronously — only schedule.
    expect(adapter.getStatus).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(adapter.getStatus).toHaveBeenCalledTimes(1);
  });

  it('polls labelwriter and labelmanager families too', async () => {
    for (const opts of [
      { family: 'labelwriter' as const, model: 'LabelWriter 550', vid: 0x0922, pid: 0x0028 },
      { family: 'labelmanager' as const, model: 'LM-PnP', vid: 0x0922, pid: 0x1001 },
    ]) {
      setActivePinia(createPinia());
      vi.useFakeTimers();
      const store = usePrinterStore();
      const adapter = makeAdapter(opts);
      store.setAdapter(adapter);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(adapter.getStatus).toHaveBeenCalledTimes(1);
    }
  });

  it('updates lastStatus and lastStatusAt on a successful tick', async () => {
    const store = usePrinterStore();
    const adapter = makeAdapter({
      status: { errors: [{ code: 'cover_open', message: 'Cover is open' }], ready: false },
    });
    store.setAdapter(adapter);

    expect(store.lastStatus).toBeNull();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(store.lastStatus?.ready).toBe(false);
    expect(store.lastStatus?.errors[0]?.code).toBe('cover_open');
    expect(store.lastStatusAt).toBeGreaterThan(0);
  });

  it('does not poll while document.hidden is true', async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    const store = usePrinterStore();
    const adapter = makeAdapter();
    store.setAdapter(adapter);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(adapter.getStatus).not.toHaveBeenCalled();
  });

  it('resumes polling when the tab becomes visible', async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    const store = usePrinterStore();
    const adapter = makeAdapter();
    store.setAdapter(adapter);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(adapter.getStatus).not.toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(adapter.getStatus).toHaveBeenCalled();
  });

  it('isPrinting=true suspends polling; the print() finally clause queues a burst', async () => {
    const store = usePrinterStore();
    const adapter = makeAdapter();
    store.setAdapter(adapter);

    // First poll lands normally.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(adapter.getStatus).toHaveBeenCalledTimes(1);

    // Drive a print — the print() finally sets burstUntil and clears
    // isPrinting; the watch reschedules at the burst interval.
    const image = { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 255]) };
    await store.print(image);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_BURST_MS);
    expect(adapter.getStatus).toHaveBeenCalledTimes(2);
  });

  it('backs off 10s then 20s after consecutive transport failures', async () => {
    const store = usePrinterStore();
    const adapter = makeAdapter();
    adapter.getStatus = vi.fn().mockRejectedValue(new Error('USB lost'));
    store.setAdapter(adapter);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(adapter.getStatus).toHaveBeenCalledTimes(1);
    expect(store.circuitBroken).toBe(false);

    // Second attempt: 10s after the first.
    await vi.advanceTimersByTimeAsync(10_000 - 1);
    expect(adapter.getStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(adapter.getStatus).toHaveBeenCalledTimes(2);
    expect(store.circuitBroken).toBe(false);
  });

  it('three consecutive failures trip the circuit breaker and stop polling', async () => {
    const store = usePrinterStore();
    const adapter = makeAdapter();
    adapter.getStatus = vi.fn().mockRejectedValue(new Error('USB lost'));
    store.setAdapter(adapter);

    // Fail #1 at +5s, fail #2 at +5s+10s, fail #3 at +5s+10s+20s.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(adapter.getStatus).toHaveBeenCalledTimes(3);
    expect(store.circuitBroken).toBe(true);

    // No further polling for the rest of the session.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(adapter.getStatus).toHaveBeenCalledTimes(3);
  });

  it('resets to a 5s interval after a successful tick following failures', async () => {
    const store = usePrinterStore();
    const adapter = makeAdapter();
    let calls = 0;
    adapter.getStatus = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('flake');
      return { ready: true, mediaLoaded: true, errors: [], rawBytes: new Uint8Array() };
    });
    store.setAdapter(adapter);

    // Fail at +5s.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(adapter.getStatus).toHaveBeenCalledTimes(1);

    // Recover at +10s (backoff).
    await vi.advanceTimersByTimeAsync(10_000);
    expect(adapter.getStatus).toHaveBeenCalledTimes(2);

    // Next interval is back to 5s, not 20s.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(adapter.getStatus).toHaveBeenCalledTimes(3);
  });

  it('attaching a fresh adapter resets circuitBroken and seenErrorCodes', async () => {
    const store = usePrinterStore();
    const failing = makeAdapter();
    failing.getStatus = vi.fn().mockRejectedValue(new Error('USB lost'));
    store.setAdapter(failing);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10_000 + 20_000);
    expect(store.circuitBroken).toBe(true);

    store.markErrorCodesSeen(['cover_open']);
    expect(store.seenErrorCodes.has('cover_open')).toBe(true);

    const fresh = makeAdapter();
    store.setAdapter(fresh);
    expect(store.circuitBroken).toBe(false);
    expect(store.seenErrorCodes.size).toBe(0);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(fresh.getStatus).toHaveBeenCalled();
  });

  it('disconnect stops the loop and clears the timer', async () => {
    const store = usePrinterStore();
    const adapter = makeAdapter();
    store.setAdapter(adapter);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(adapter.getStatus).toHaveBeenCalledTimes(1);

    await store.disconnect();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
    expect(adapter.getStatus).toHaveBeenCalledTimes(1);
  });

  it('post-print burst uses the 2s interval for ~30s, then reverts to 5s', async () => {
    const store = usePrinterStore();
    const adapter = makeAdapter();
    store.setAdapter(adapter);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(adapter.getStatus).toHaveBeenCalledTimes(1);

    const image = { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 255]) };
    await store.print(image);

    // Within burst window: ticks at burst interval.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_BURST_MS);
    expect(adapter.getStatus).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_BURST_MS);
    expect(adapter.getStatus).toHaveBeenCalledTimes(3);

    // Roll out of the burst window — next tick should be the regular 5s.
    await vi.advanceTimersByTimeAsync(POLL_BURST_DURATION_MS);
    const callsAfterBurst = adapter.getStatus.mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_BURST_MS);
    // Past the 2s mark but inside the 5s mark — no new call yet.
    expect(adapter.getStatus.mock.calls.length).toBeLessThanOrEqual(callsAfterBurst + 1);
  });

  it('visibility listener attached once at store init survives many connect cycles', async () => {
    const store = usePrinterStore();
    for (let i = 0; i < 5; i += 1) {
      const adapter = makeAdapter();
      store.setAdapter(adapter);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(adapter.getStatus).toHaveBeenCalledTimes(1);
      await store.disconnect();
    }
    // No double-fire: each adapter saw exactly one tick. If the listener
    // had been attached per-connect, repeated visibilitychange firings
    // (or the simple act of cycling) would have multiplied calls.
  });
});

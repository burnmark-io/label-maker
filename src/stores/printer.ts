import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import type {
  MediaDescriptor,
  PreviewResult,
  PrinterAdapter,
  PrinterStatus,
  PrintOptions,
  RawImageData,
} from '@thermal-label/contracts';

import {
  PER_MODEL_STATUS_POLLING_EXCLUSIONS,
  modelKey,
  type PrinterFamily,
} from '@/lib/printer/registry';

const POLL_INTERVAL_MS = 5000;
const POLL_INTERVAL_BURST_MS = 2000;
const POLL_BURST_DURATION_MS = 30_000;
const POLL_BACKOFF_MS = [10_000, 20_000, 60_000] as const;
/** Three transport failures in a row trips the session-scoped breaker. */
const POLL_FAILS_BEFORE_BREAKER = 3;

/**
 * PrintOptions shape augmented with the cross-driver `rotate` override
 * shared by `@thermal-label/{brother-ql,labelmanager,labelwriter}-core@^0.3.0`.
 * Each family extends `PrintOptions` with this same field, so passing it
 * via the structural `PrinterAdapter.print` signature is safe — TS just
 * needs the broader type to express the call.
 */
type BridgedPrintOptions = PrintOptions & { rotate?: 'auto' | 0 | 90 | 180 | 270 };

/**
 * Printer store — owns the live `PrinterAdapter` (when one is connected),
 * the most recent `PrinterStatus` / `PreviewResult`, and the user's
 * manual media selection.
 */
export type ConnectionState =
  | { kind: 'disconnected' }
  | { kind: 'connecting' }
  | { kind: 'connected'; family: PrinterFamily; model: string }
  | { kind: 'error'; family?: PrinterFamily; model?: string; message: string };

const LAST_CONNECTED_KEY = 'burnmark.lastConnected';

interface LastConnected {
  family: PrinterFamily;
  model: string;
}

function readLastConnected(): LastConnected | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_CONNECTED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastConnected;
    if (!parsed.family || !parsed.model) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLastConnected(value: LastConnected | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(LAST_CONNECTED_KEY);
    else window.localStorage.setItem(LAST_CONNECTED_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export const usePrinterStore = defineStore('printer', () => {
  const connection = ref<ConnectionState>({ kind: 'disconnected' });
  const adapter = shallowRef<PrinterAdapter | null>(null);
  const detectedMedia = shallowRef<MediaDescriptor | null>(null);
  const selectedMedia = shallowRef<MediaDescriptor | null>(null);
  const lastPreview = shallowRef<PreviewResult | null>(null);
  const isPrinting = ref(false);
  const lastPaired = ref<LastConnected | null>(readLastConnected());

  // ---- Polling state ----

  const lastStatus = shallowRef<PrinterStatus | null>(null);
  const lastStatusAt = ref<number>(0);
  const burstUntil = ref<number>(0);
  /**
   * Session-scoped breaker. Trips when a printer's `getStatus()` throws
   * `POLL_FAILS_BEFORE_BREAKER` times in a row — connection itself stays
   * up so direct prints remain possible. Reset on the next manual or
   * auto reconnect (`setAdapter(non-null)`).
   */
  const circuitBroken = ref<boolean>(false);
  /**
   * Error codes that have already been surfaced as a first-occurrence
   * toast in this session. Drives "toast once per code, not every poll"
   * behaviour in the status pill component (§4.3). Cleared on
   * (re)connect; the consumer clears it when the errors array empties.
   */
  const seenErrorCodes = shallowRef<ReadonlySet<string>>(new Set<string>());

  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveFailures = 0;
  /**
   * Active push-status subscription. Brother QL over USB emits a
   * status frame after every print job and (per firmware) some
   * lid/media events, all of which flow into the read loop and out
   * via `onStatus`. Polling continues alongside as the cadence floor;
   * push is purely additive — when it fires sooner than the next poll
   * tick, the UI catches up without waiting.
   */
  let unsubscribePush: (() => void) | null = null;

  function applyStatus(status: PrinterStatus): void {
    // Same status object can arrive via two paths when push and
    // polling are both active (the response to getStatus() flows
    // through the push subscription too). Identity-dedup before
    // committing avoids double reactive notifications.
    if (lastStatus.value === status) return;
    lastStatus.value = status;
    lastStatusAt.value = Date.now();
    detectedMedia.value = status.detectedMedia ?? null;
  }

  const isConnected = computed(() => connection.value.kind === 'connected');
  const family = computed<PrinterFamily | null>(() =>
    connection.value.kind === 'connected' ? connection.value.family : null,
  );
  const model = computed(() =>
    connection.value.kind === 'connected' ? connection.value.model : null,
  );

  /**
   * Effective media used for preview/print — manual selection wins, then
   * detected, then null (driver will fall back to its default).
   */
  const effectiveMedia = computed<MediaDescriptor | null>(
    () => selectedMedia.value ?? detectedMedia.value ?? null,
  );

  function setAdapter(next: PrinterAdapter | null): void {
    // Tear down any existing push subscription before swapping adapters
    // so the old read loop's notifications don't leak into the new one's
    // state.
    if (unsubscribePush) {
      unsubscribePush();
      unsubscribePush = null;
    }

    adapter.value = next;
    if (next) {
      const fam = next.family as PrinterFamily;
      connection.value = { kind: 'connected', family: fam, model: next.model };
      lastPaired.value = { family: fam, model: next.model };
      writeLastConnected(lastPaired.value);
      // Fresh adapter = fresh chance for status polling / push.
      circuitBroken.value = false;
      consecutiveFailures = 0;
      seenErrorCodes.value = new Set<string>();

      // Subscribe to push frames if the adapter supports it. This is
      // additive — polling still runs as the cadence floor; push just
      // delivers state changes the moment the read loop sees them
      // (post-print frames, any spontaneous events).
      if (typeof next.onStatus === 'function') {
        unsubscribePush = next.onStatus(applyStatus);
      }
      startPolling();
    } else {
      stopPolling();
      lastStatus.value = null;
      lastStatusAt.value = 0;
      seenErrorCodes.value = new Set<string>();
      detectedMedia.value = null;
      // Clear the override too — selectedMedia carries driver-specific
      // fields, so leaving it set across a disconnect risks handing a
      // Brother descriptor to a LabelWriter on the next connect.
      selectedMedia.value = null;
      lastPreview.value = null;
      // Always reset to 'disconnected'. The previous `connected`-only
      // guard stranded the cancel path (setConnecting → setAdapter(null)
      // on NotFoundError) in 'connecting' forever.
      connection.value = { kind: 'disconnected' };
    }
  }

  function setConnecting(): void {
    connection.value = { kind: 'connecting' };
  }

  function setError(message: string): void {
    const fam = connection.value.kind === 'connected' ? connection.value.family : undefined;
    const mdl = connection.value.kind === 'connected' ? connection.value.model : undefined;
    connection.value = { kind: 'error', family: fam, model: mdl, message };
  }

  function setDetectedMedia(media: MediaDescriptor | null): void {
    detectedMedia.value = media;
  }

  function setSelectedMedia(media: MediaDescriptor | null): void {
    selectedMedia.value = media;
  }

  function setPreview(preview: PreviewResult | null): void {
    lastPreview.value = preview;
  }

  function clearLastPaired(): void {
    lastPaired.value = null;
    writeLastConnected(null);
  }

  /**
   * Pull the live status. Assigns the full `PrinterStatus` to
   * `lastStatus` (read by every UI surface) and propagates
   * `detectedMedia`. Re-throws transport failures so the polling loop
   * can drive backoff/breaker; existing single-shot callers
   * (`useAutoReconnect`, the connect flow in `PrinterPopover`) already
   * wrap this in try/catch.
   *
   * `selectedMedia` is intentionally not cleared — auto-detection is a
   * suggestion, not a lock (canvas-sizing amendment §2.2). The override
   * is cleared only on disconnect (`setAdapter(null)`).
   */
  async function refreshStatus(): Promise<void> {
    if (!adapter.value) return;
    const status = await adapter.value.getStatus();
    applyStatus(status);
  }

  async function refreshPreview(image: RawImageData): Promise<void> {
    if (!adapter.value) {
      lastPreview.value = null;
      return;
    }
    try {
      const result = await adapter.value.createPreview(
        image,
        effectiveMedia.value ? { media: effectiveMedia.value } : undefined,
      );
      lastPreview.value = result;
    } catch (err) {
      console.warn('[burnmark] createPreview failed', err);
      lastPreview.value = null;
    }
  }

  async function print(image: RawImageData, options?: PrintOptions): Promise<void> {
    if (!adapter.value) throw new Error('No printer connected');
    isPrinting.value = true;
    try {
      // Canvas-orientation bridging (D47 sub-note): the bitmap arrives
      // here already at display dimensions (the designer store's
      // `renderToRGBA` clones the doc with swapped widthDots/heightDots
      // for horizontal die-cut canvases). We just pass `rotate: 'auto'`
      // so the driver's `pickRotation` heuristic — which keys off
      // `media.defaultOrientation` — can rotate landscape input back to
      // portrait for printers that need it. Caller-supplied `rotate`
      // wins over the default.
      const bridgedOptions: BridgedPrintOptions = {
        ...(options ?? {}),
        rotate: (options as BridgedPrintOptions | undefined)?.rotate ?? 'auto',
      };
      await adapter.value.print(image, effectiveMedia.value ?? undefined, bridgedOptions);
    } finally {
      // Burst-poll for 30 s after a print so any post-print error
      // (cutter jam, end-of-roll) surfaces quickly. The watch on
      // `isPrinting` reschedules polling.
      burstUntil.value = Date.now() + POLL_BURST_DURATION_MS;
      isPrinting.value = false;
    }
  }

  // ---- Polling loop ----

  function shouldPoll(): boolean {
    if (connection.value.kind !== 'connected') return false;
    if (
      PER_MODEL_STATUS_POLLING_EXCLUSIONS.has(
        modelKey(connection.value.family, connection.value.model),
      )
    ) {
      return false;
    }
    if (typeof document !== 'undefined' && document.hidden) return false;
    if (isPrinting.value) return false;
    if (circuitBroken.value) return false;
    return true;
  }

  function scheduleNextPoll(): void {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    if (!shouldPoll()) return;
    let interval: number;
    if (consecutiveFailures > 0) {
      const idx = Math.min(consecutiveFailures - 1, POLL_BACKOFF_MS.length - 1);
      interval = POLL_BACKOFF_MS[idx]!;
    } else if (Date.now() < burstUntil.value) {
      interval = POLL_INTERVAL_BURST_MS;
    } else {
      interval = POLL_INTERVAL_MS;
    }
    pollTimer = setTimeout(() => {
      void tick();
    }, interval);
  }

  async function tick(): Promise<void> {
    pollTimer = null;
    if (!shouldPoll()) return;
    try {
      await refreshStatus();
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures += 1;
      console.warn('[burnmark] poll getStatus failed', err);
      if (consecutiveFailures >= POLL_FAILS_BEFORE_BREAKER) {
        circuitBroken.value = true;
        // Connection itself stays up — direct prints can still be
        // attempted without a working status query. Reset on the next
        // setAdapter(non-null) (manual or auto reconnect).
        return;
      }
    }
    scheduleNextPoll();
  }

  function startPolling(): void {
    consecutiveFailures = 0;
    scheduleNextPoll();
  }

  function stopPolling(): void {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  /** Mark error codes as already-surfaced. Used by the toast wiring. */
  function markErrorCodesSeen(codes: readonly string[]): void {
    if (codes.length === 0) return;
    const next = new Set(seenErrorCodes.value);
    for (const c of codes) next.add(c);
    seenErrorCodes.value = next;
  }

  /** Reset the seen-codes set. Called when the errors array empties. */
  function clearSeenErrorCodes(): void {
    if (seenErrorCodes.value.size === 0) return;
    seenErrorCodes.value = new Set<string>();
  }

  // Pause polling during a print job, resume (with burst window) after.
  // Reusing `isPrinting` avoids a parallel printJobInFlight flag — the
  // burst timer is set in `print()`'s finally clause just above.
  watch(isPrinting, busy => {
    if (busy) stopPolling();
    else scheduleNextPoll();
  });

  // Visibility listener attached once at store init (not per-connect)
  // to avoid leak/stale-handler issues across connect/disconnect cycles.
  // Both branches gate internally via shouldPoll().
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopPolling();
      else scheduleNextPoll();
    });
  }

  async function disconnect(): Promise<void> {
    const current = adapter.value;
    if (!current) return;
    try {
      await current.close();
    } catch (err) {
      console.warn('[burnmark] close failed', err);
    }
    setAdapter(null);
  }

  return {
    connection,
    adapter,
    detectedMedia,
    selectedMedia,
    effectiveMedia,
    lastPreview,
    isPrinting,
    lastPaired,
    lastStatus,
    lastStatusAt,
    circuitBroken,
    seenErrorCodes,
    isConnected,
    family,
    model,

    setAdapter,
    setConnecting,
    setError,
    setDetectedMedia,
    setSelectedMedia,
    setPreview,
    clearLastPaired,
    refreshStatus,
    refreshPreview,
    print,
    disconnect,
    markErrorCodesSeen,
    clearSeenErrorCodes,
  };
});

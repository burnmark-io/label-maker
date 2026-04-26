import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type {
  MediaDescriptor,
  PreviewResult,
  PrinterAdapter,
  PrintOptions,
  RawImageData,
} from '@thermal-label/contracts';

import { identifyByVidPid, type PrinterFamily } from '@/lib/printer/registry';

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
    adapter.value = next;
    if (next) {
      const entry = next.device
        ? identifyByVidPid(next.device.vid ?? -1, next.device.pid ?? -1)
        : undefined;
      const fam: PrinterFamily =
        (entry?.family as PrinterFamily | undefined) ?? (next.family as PrinterFamily);
      connection.value = { kind: 'connected', family: fam, model: next.model };
      lastPaired.value = { family: fam, model: next.model };
      writeLastConnected(lastPaired.value);
    } else {
      detectedMedia.value = null;
      // Clear the override too — selectedMedia carries driver-specific
      // fields, so leaving it set across a disconnect risks handing a
      // Brother descriptor to a LabelWriter on the next connect.
      selectedMedia.value = null;
      lastPreview.value = null;
      if (connection.value.kind === 'connected') {
        connection.value = { kind: 'disconnected' };
      }
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

  async function refreshStatus(): Promise<void> {
    if (!adapter.value) return;
    try {
      const status = await adapter.value.getStatus();
      detectedMedia.value = status.detectedMedia ?? null;
      // Don't clear `selectedMedia` here — auto-detection is a
      // suggestion, not a lock (canvas-sizing amendment §2.2). When the
      // user has explicitly overridden detected media (e.g. their roll
      // is DK-22251 two-colour but the printer reports DK-22205), that
      // override should survive every status refresh. The override is
      // cleared only on disconnect (`setAdapter(null)`).
    } catch (err) {
      console.warn('[burnmark] getStatus failed', err);
    }
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
      await adapter.value.print(image, effectiveMedia.value ?? undefined, options);
    } finally {
      isPrinting.value = false;
    }
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
  };
});

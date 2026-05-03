import { defineStore } from 'pinia';
import { computed, markRaw, reactive, ref, shallowReactive, shallowRef, watch } from 'vue';
import type {
  DeviceEntry,
  MediaDescriptor,
  PreviewResult,
  PrintEngine,
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
 */
type BridgedPrintOptions = PrintOptions & { rotate?: 'auto' | 0 | 90 | 180 | 270 };

export type ConnectionId = string;
export type SlotRole = string;

export interface EngineSlotState {
  role: SlotRole;
  engine: PrintEngine;
  detectedMedia: MediaDescriptor | null;
  selectedMedia: MediaDescriptor | null;
}

export interface Connection {
  id: ConnectionId;
  adapter: PrinterAdapter;
  family: PrinterFamily;
  model: string;
  device: DeviceEntry | null;
  /**
   * Stable identifier for this physical device across sessions. Used
   * to disambiguate two-of-the-same-model and to resolve
   * `Document.metadata.targetSlot` on document load. See plan §2.6.
   */
  fingerprint: string;
  nickname: string | null;
  slots: Map<SlotRole, EngineSlotState>;
  status: PrinterStatus | null;
  statusAt: number;
  consecutiveFailures: number;
  circuitBroken: boolean;
  /** Burst-poll deadline; reset after each print. */
  burstUntil: number;
  isPrinting: boolean;
  seenErrorCodes: ReadonlySet<string>;
}

export interface ActiveSlotRef {
  connectionId: ConnectionId;
  role: SlotRole;
}

/**
 * Session-wide pre-adapter state — the popover button needs a UX
 * signal between "user clicked Connect" and "adapter landed". Once
 * any adapter exists, kind transitions to 'idle' (UI reflects via
 * the connections map).
 */
type PendingConnect =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'error'; family?: PrinterFamily; model?: string; message: string };

/**
 * Backward-compatible single-connection state shape. Derived from
 * `pendingConnect` + `activeSlot` + the connections map. Existing
 * single-printer consumers (~80% of users per plan §0.5) keep reading
 * `printer.connection` and see exactly what they did before.
 */
export type ConnectionState =
  | { kind: 'disconnected' }
  | { kind: 'connecting' }
  | { kind: 'connected'; family: PrinterFamily; model: string }
  | { kind: 'error'; family?: PrinterFamily; model?: string; message: string };

/**
 * Old single-entry localStorage key (pre-multi-printer). Kept for
 * one-shot migration on first read; never written.
 */
const LEGACY_LAST_CONNECTED_KEY = 'burnmark.lastConnected';

/**
 * New multi-entry localStorage key (plan §6.2). One record per paired
 * printer, replayed on boot in parallel.
 */
const LAST_CONNECTIONS_KEY = 'burnmark.last-connections';

export interface LastConnectionRecord {
  family: PrinterFamily;
  model: string;
  /** §2.6 fingerprint — disambiguates two-of-the-same-model. */
  fingerprint: string;
  /** Which transport pairing was used. Drives reconnect path. */
  transportKind: 'usb' | 'serial';
  /** Optional transport-specific address; surface for diagnostics. */
  address?: string;
  /** Optional user-assigned name; load-bearing when fingerprint isn't stable. */
  nickname?: string;
}

function readLastConnections(): LastConnectionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LAST_CONNECTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LastConnectionRecord[];
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (r): r is LastConnectionRecord =>
            !!r && typeof r === 'object' && !!r.family && !!r.model && !!r.fingerprint,
        );
      }
    }
    // Migrate from the old single-entry key on first read.
    const legacy = window.localStorage.getItem(LEGACY_LAST_CONNECTED_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as { family?: PrinterFamily; model?: string };
      if (parsed?.family && parsed?.model) {
        const migrated: LastConnectionRecord = {
          family: parsed.family,
          model: parsed.model,
          // Synthesize a fingerprint so the new shape is well-formed.
          // Real fingerprint replaces this on the next addConnection.
          fingerprint: `${parsed.family}-${parsed.model}-legacy`,
          transportKind: 'usb',
        };
        writeLastConnections([migrated]);
        return [migrated];
      }
    }
  } catch {
    // Fall through to empty.
  }
  return [];
}

function writeLastConnections(records: LastConnectionRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (records.length === 0) {
      window.localStorage.removeItem(LAST_CONNECTIONS_KEY);
    } else {
      window.localStorage.setItem(LAST_CONNECTIONS_KEY, JSON.stringify(records));
    }
  } catch {
    // ignore
  }
}

function mintConnectionId(): ConnectionId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `c_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

/**
 * Mint a fingerprint for a connection. Prefers a stable identifier
 * surfaced by the transport (USB serial number, device path, etc.);
 * otherwise falls back to a random UUID prefixed with the model.
 *
 * The random fallback is unique within a session but does not survive
 * disconnect/reconnect — for those cases plan §2.6 falls back to a
 * user-assigned nickname, set via `setConnectionNickname`.
 */
function mintFingerprint(adapter: PrinterAdapter, hint: string | null): string {
  if (hint && hint.trim().length > 0) return hint;
  return `${adapter.family}-${adapter.model}-${mintConnectionId()}`;
}

/**
 * Build the engine slot map for a connection. Single-engine devices
 * fabricate a `'primary'` slot; composite devices materialise one slot
 * per `device.engines` entry. If the adapter has no `device` (e.g. a
 * raw TCP connection), we still fabricate `'primary'` so the slot
 * abstraction is uniform.
 */
function buildSlots(device: DeviceEntry | null): Map<SlotRole, EngineSlotState> {
  const slots = new Map<SlotRole, EngineSlotState>();
  const engines = device?.engines ?? [];
  if (engines.length === 0) {
    slots.set('primary', {
      role: 'primary',
      engine: {
        role: 'primary',
        protocol: '',
        dpi: 300,
        headDots: 0,
      },
      detectedMedia: null,
      selectedMedia: null,
    });
    return slots;
  }
  for (const engine of engines) {
    slots.set(engine.role, {
      role: engine.role,
      engine,
      detectedMedia: null,
      selectedMedia: null,
    });
  }
  return slots;
}

export const usePrinterStore = defineStore('printer', () => {
  // ---- Multi-connection core state ----

  /**
   * Live connections, keyed by ConnectionId. Use shallowReactive so
   * the Map's identity is reactive without deep-tracking per-connection
   * fields (which we mutate granularly via dedicated setters).
   */
  const connections = shallowReactive(new Map<ConnectionId, Connection>());

  /**
   * Print destination — references a slot inside `connections`. Null
   * when no connections exist. Promoted by the user via the destination
   * picker (plan §2.5); auto-set to the first slot of a new connection
   * when there's no current activeSlot.
   */
  const activeSlot = ref<ActiveSlotRef | null>(null);

  /**
   * Pre-adapter session state. UI reflects "connecting" / "error"
   * here; once an adapter lands the connection materialises in
   * `connections` and `pendingConnect` returns to 'idle'.
   */
  const pendingConnect = ref<PendingConnect>({ kind: 'idle' });

  /**
   * Persisted pairing records — one per printer the user has paired,
   * surviving reload. On boot, each record is replayed in parallel
   * via the auto-reconnect composable.
   */
  const lastConnections = ref<LastConnectionRecord[]>(readLastConnections());

  /**
   * BC accessor: the first persisted record, used by the status pill
   * to show "{model} — plug in to reconnect" when no live connection
   * exists. Null when the list is empty.
   */
  const lastPaired = computed<LastConnectionRecord | null>(
    () => lastConnections.value[0] ?? null,
  );
  const lastPreview = shallowRef<PreviewResult | null>(null);

  /**
   * Scratch media slots used when callers set detected/selected media
   * before any adapter has connected. Tests rely on this single-shot
   * setter pattern; production callers (PrinterPopover, the connect
   * flow) always have an adapter first.
   *
   * On `addConnection` the scratch values flow into the new
   * connection's primary slot (mirroring pre-refactor "set on store,
   * adapter inherits" semantics) and the scratch is cleared.
   */
  const scratchDetectedMedia = shallowRef<MediaDescriptor | null>(null);
  const scratchSelectedMedia = shallowRef<MediaDescriptor | null>(null);

  /** Per-connection poll timers. */
  const pollTimers = new Map<ConnectionId, ReturnType<typeof setTimeout>>();
  /** Per-connection push subscriptions. */
  const unsubscribePush = new Map<ConnectionId, () => void>();

  // ---- Helpers ----

  function getConnection(id: ConnectionId): Connection | undefined {
    return connections.get(id);
  }

  function activeConnection(): Connection | null {
    if (!activeSlot.value) return null;
    return connections.get(activeSlot.value.connectionId) ?? null;
  }

  function activeSlotState(): EngineSlotState | null {
    const conn = activeConnection();
    if (!conn || !activeSlot.value) return null;
    return conn.slots.get(activeSlot.value.role) ?? null;
  }

  function totalSlotCount(): number {
    let n = 0;
    for (const c of connections.values()) n += c.slots.size;
    return n;
  }

  function applyStatus(connectionId: ConnectionId, status: PrinterStatus): void {
    const conn = connections.get(connectionId);
    if (!conn) return;
    if (conn.status === status) return;
    conn.status = markRaw(status);
    conn.statusAt = Date.now();
    // Detected media is chassis-level today (PrinterStatus has no
    // per-engine field — see plan §0.6 spike). Mirror it onto the
    // primary slot when there's exactly one slot; otherwise leave
    // each slot's detectedMedia alone (the Duo case is deferred per
    // §0.5). This keeps single-printer behaviour identical to before.
    if (conn.slots.size === 1) {
      const only = conn.slots.values().next().value as EngineSlotState | undefined;
      if (only) only.detectedMedia = status.detectedMedia ?? null;
    }
  }

  // ---- Multi-connection write API ----

  function addConnection(
    adapter: PrinterAdapter,
    opts?: {
      fingerprintHint?: string;
      nickname?: string;
      transportKind?: 'usb' | 'serial';
      address?: string;
    },
  ): ConnectionId {
    const id = mintConnectionId();
    const family = adapter.family as PrinterFamily;
    const device = adapter.device ?? null;
    const slots = buildSlots(device);
    // Inherit any scratch media into the primary slot — preserves the
    // pre-refactor pattern of "set media on the store, adapter
    // inherits on connect" used by tests and a couple of UI flows.
    if (slots.size === 1) {
      const only = slots.values().next().value as EngineSlotState | undefined;
      if (only) {
        if (scratchDetectedMedia.value) only.detectedMedia = scratchDetectedMedia.value;
        if (scratchSelectedMedia.value) only.selectedMedia = scratchSelectedMedia.value;
      }
    }
    scratchDetectedMedia.value = null;
    scratchSelectedMedia.value = null;

    // markRaw on adapter / device / status payloads so Vue's reactive()
    // doesn't replace their identity with a proxy — tests assert
    // `printer.adapter === originalAdapter` and several call sites rely
    // on referential equality.
    const conn = reactive<Connection>({
      id,
      adapter: markRaw(adapter),
      family,
      model: adapter.model,
      device: device ? markRaw(device) : null,
      fingerprint: mintFingerprint(adapter, opts?.fingerprintHint ?? null),
      nickname: opts?.nickname ?? null,
      slots,
      status: null,
      statusAt: 0,
      consecutiveFailures: 0,
      circuitBroken: false,
      burstUntil: 0,
      isPrinting: false,
      seenErrorCodes: new Set<string>(),
    }) as Connection;
    connections.set(id, conn);

    if (typeof adapter.onStatus === 'function') {
      const unsub = adapter.onStatus(s => applyStatus(id, s));
      unsubscribePush.set(id, unsub);
    }

    // Promote the first slot of a brand-new connection if no destination
    // is currently set, so `printer.print()` resolves without UI work.
    if (!activeSlot.value) {
      const firstRole = conn.slots.keys().next().value as SlotRole | undefined;
      if (firstRole !== undefined) {
        activeSlot.value = { connectionId: id, role: firstRole };
      }
    }

    upsertLastConnection({
      family,
      model: adapter.model,
      fingerprint: conn.fingerprint,
      transportKind: opts?.transportKind ?? 'usb',
      address: opts?.address,
      nickname: opts?.nickname,
    });
    pendingConnect.value = { kind: 'idle' };

    scheduleNextPoll(id);
    return id;
  }

  function removeConnection(id: ConnectionId): void {
    const conn = connections.get(id);
    if (!conn) return;
    stopPolling(id);
    const unsub = unsubscribePush.get(id);
    if (unsub) {
      unsub();
      unsubscribePush.delete(id);
    }
    connections.delete(id);
    if (activeSlot.value?.connectionId === id) {
      // Pick the first slot of any remaining connection, or null.
      const next = connections.values().next().value as Connection | undefined;
      if (next) {
        const firstRole = next.slots.keys().next().value as SlotRole | undefined;
        activeSlot.value = firstRole !== undefined
          ? { connectionId: next.id, role: firstRole }
          : null;
      } else {
        activeSlot.value = null;
        // Last connection just left — clear any preview that was tied
        // to its driver, matching today's setAdapter(null) semantics.
        lastPreview.value = null;
      }
    }
  }

  function setActiveSlot(slot: ActiveSlotRef | null): void {
    if (slot === null) {
      activeSlot.value = null;
      return;
    }
    const conn = connections.get(slot.connectionId);
    if (!conn || !conn.slots.has(slot.role)) return;
    activeSlot.value = { connectionId: slot.connectionId, role: slot.role };
  }

  function setSelectedMediaForSlot(
    slot: ActiveSlotRef,
    media: MediaDescriptor | null,
  ): void {
    const conn = connections.get(slot.connectionId);
    const s = conn?.slots.get(slot.role);
    if (!conn || !s) return;
    s.selectedMedia = media;
  }

  function setConnectionNickname(id: ConnectionId, nickname: string | null): void {
    const conn = connections.get(id);
    if (!conn) return;
    conn.nickname = nickname && nickname.trim().length > 0 ? nickname : null;
  }

  function effectiveMediaForSlot(slot: ActiveSlotRef): MediaDescriptor | null {
    const conn = connections.get(slot.connectionId);
    const s = conn?.slots.get(slot.role);
    if (!s) return null;
    return s.selectedMedia ?? s.detectedMedia ?? null;
  }

  // ---- Backward-compatible facade (single-connection consumers) ----

  /**
   * Single-connection projection of the multi-connection state. Reads
   * the active slot's connection — exactly what the pre-refactor
   * single-adapter store exposed.
   */
  const connection = computed<ConnectionState>(() => {
    const conn = activeConnection();
    if (conn) return { kind: 'connected', family: conn.family, model: conn.model };
    if (pendingConnect.value.kind === 'connecting') return { kind: 'connecting' };
    if (pendingConnect.value.kind === 'error') {
      return {
        kind: 'error',
        family: pendingConnect.value.family,
        model: pendingConnect.value.model,
        message: pendingConnect.value.message,
      };
    }
    return { kind: 'disconnected' };
  });

  const adapter = computed<PrinterAdapter | null>(() => activeConnection()?.adapter ?? null);

  const isConnected = computed(() => activeConnection() !== null);
  const family = computed<PrinterFamily | null>(() => activeConnection()?.family ?? null);
  const model = computed<string | null>(() => activeConnection()?.model ?? null);

  const detectedMedia = computed<MediaDescriptor | null>(() => {
    const s = activeSlotState();
    return s ? s.detectedMedia : scratchDetectedMedia.value;
  });
  const selectedMedia = computed<MediaDescriptor | null>(() => {
    const s = activeSlotState();
    return s ? s.selectedMedia : scratchSelectedMedia.value;
  });
  const effectiveMedia = computed<MediaDescriptor | null>(() => {
    const s = activeSlotState();
    if (s) return s.selectedMedia ?? s.detectedMedia ?? null;
    return scratchSelectedMedia.value ?? scratchDetectedMedia.value ?? null;
  });

  const lastStatus = computed<PrinterStatus | null>(() => activeConnection()?.status ?? null);
  const lastStatusAt = computed<number>(() => activeConnection()?.statusAt ?? 0);
  const circuitBroken = computed<boolean>(() => activeConnection()?.circuitBroken ?? false);
  const seenErrorCodes = computed<ReadonlySet<string>>(
    () => activeConnection()?.seenErrorCodes ?? new Set<string>(),
  );

  const isPrinting = computed<boolean>(() => activeConnection()?.isPrinting ?? false);

  function setConnecting(): void {
    pendingConnect.value = { kind: 'connecting' };
  }

  function setError(message: string): void {
    const conn = activeConnection();
    pendingConnect.value = {
      kind: 'error',
      family: conn?.family,
      model: conn?.model,
      message,
    };
  }

  /**
   * BC shim for the pre-refactor single-adapter API. `setAdapter(adapter)`
   * adds the connection and makes its first slot active; `setAdapter(null)`
   * removes the active connection (matching old "disconnect" semantics).
   * Multi-connection callers should use `addConnection` / `removeConnection`
   * directly.
   */
  function setAdapter(next: PrinterAdapter | null): void {
    if (next) {
      // BC semantics: replace the active connection, don't accumulate.
      // Multi-connection callers use addConnection() directly.
      const current = activeConnection();
      if (current) removeConnection(current.id);
      addConnection(next);
    } else {
      const conn = activeConnection();
      if (conn) removeConnection(conn.id);
      else pendingConnect.value = { kind: 'idle' };
    }
  }

  function setDetectedMedia(media: MediaDescriptor | null): void {
    const s = activeSlotState();
    if (s) {
      s.detectedMedia = media;
      return;
    }
    scratchDetectedMedia.value = media;
  }

  function setSelectedMedia(media: MediaDescriptor | null): void {
    if (activeSlot.value) {
      setSelectedMediaForSlot(activeSlot.value, media);
      return;
    }
    scratchSelectedMedia.value = media;
  }

  function setPreview(preview: PreviewResult | null): void {
    lastPreview.value = preview;
  }

  function upsertLastConnection(record: LastConnectionRecord): void {
    const next = lastConnections.value.filter(r => r.fingerprint !== record.fingerprint);
    next.unshift(record);
    lastConnections.value = next;
    writeLastConnections(next);
  }

  /** Plan §6.2 "Forget this printer" — remove from the persisted list. */
  function forgetLastConnection(fingerprint: string): void {
    const next = lastConnections.value.filter(r => r.fingerprint !== fingerprint);
    if (next.length === lastConnections.value.length) return;
    lastConnections.value = next;
    writeLastConnections(next);
  }

  /** BC: clear the entire persisted list. Equivalent to forgetting every printer. */
  function clearLastPaired(): void {
    lastConnections.value = [];
    writeLastConnections([]);
  }

  /**
   * Pull live status for the active connection. Single-shot — re-throws
   * transport failures so the polling loop can drive backoff/breaker.
   */
  async function refreshStatus(): Promise<void> {
    const conn = activeConnection();
    if (!conn) return;
    const status = await conn.adapter.getStatus();
    applyStatus(conn.id, status);
  }

  async function refreshPreview(image: RawImageData): Promise<void> {
    const conn = activeConnection();
    if (!conn) {
      lastPreview.value = null;
      return;
    }
    try {
      const media = effectiveMedia.value;
      const result = await conn.adapter.createPreview(
        image,
        media ? { media } : undefined,
      );
      lastPreview.value = result;
    } catch (err) {
      console.warn('[burnmark] createPreview failed', err);
      lastPreview.value = null;
    }
  }

  async function print(image: RawImageData, options?: PrintOptions): Promise<void> {
    const conn = activeConnection();
    const slot = activeSlotState();
    if (!conn || !slot) throw new Error('No printer connected');
    conn.isPrinting = true;
    try {
      const bridgedOptions: BridgedPrintOptions = {
        ...(options ?? {}),
        rotate: (options as BridgedPrintOptions | undefined)?.rotate ?? 'auto',
        // Plan §5: pass `engine: slot.role` so composite devices route
        // to the right head. Single-engine devices use `'primary'` as a
        // sentinel — the contract treats it as a no-op and drivers
        // ignore it.
        ...(slot.role !== 'primary' ? { engine: slot.role } : {}),
      };
      const slotMedia = slot.selectedMedia ?? slot.detectedMedia ?? undefined;
      await conn.adapter.print(image, slotMedia, bridgedOptions);
    } finally {
      conn.burstUntil = Date.now() + POLL_BURST_DURATION_MS;
      conn.isPrinting = false;
    }
  }

  // ---- Per-connection polling ----

  function shouldPoll(id: ConnectionId): boolean {
    const conn = connections.get(id);
    if (!conn) return false;
    if (PER_MODEL_STATUS_POLLING_EXCLUSIONS.has(modelKey(conn.family, conn.model))) {
      return false;
    }
    if (typeof document !== 'undefined' && document.hidden) return false;
    if (conn.isPrinting) return false;
    if (conn.circuitBroken) return false;
    return true;
  }

  function scheduleNextPoll(id: ConnectionId): void {
    const existing = pollTimers.get(id);
    if (existing !== undefined) {
      clearTimeout(existing);
      pollTimers.delete(id);
    }
    const conn = connections.get(id);
    if (!conn) return;
    if (!shouldPoll(id)) return;
    let interval: number;
    if (conn.consecutiveFailures > 0) {
      const idx = Math.min(conn.consecutiveFailures - 1, POLL_BACKOFF_MS.length - 1);
      interval = POLL_BACKOFF_MS[idx]!;
    } else if (Date.now() < conn.burstUntil) {
      interval = POLL_INTERVAL_BURST_MS;
    } else {
      interval = POLL_INTERVAL_MS;
    }
    const timer = setTimeout(() => {
      void tick(id);
    }, interval);
    pollTimers.set(id, timer);
  }

  async function tick(id: ConnectionId): Promise<void> {
    pollTimers.delete(id);
    const conn = connections.get(id);
    if (!conn) return;
    if (!shouldPoll(id)) return;
    try {
      const status = await conn.adapter.getStatus();
      applyStatus(id, status);
      conn.consecutiveFailures = 0;
    } catch (err) {
      conn.consecutiveFailures += 1;
      console.warn('[burnmark] poll getStatus failed', err);
      if (conn.consecutiveFailures >= POLL_FAILS_BEFORE_BREAKER) {
        conn.circuitBroken = true;
        return;
      }
    }
    scheduleNextPoll(id);
  }

  function stopPolling(id: ConnectionId): void {
    const timer = pollTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      pollTimers.delete(id);
    }
  }

  function rescheduleAllPolls(): void {
    for (const id of connections.keys()) scheduleNextPoll(id);
  }

  function stopAllPolls(): void {
    for (const id of pollTimers.keys()) stopPolling(id);
  }

  /** Mark error codes as already-surfaced. Used by the toast wiring. */
  function markErrorCodesSeen(codes: readonly string[]): void {
    if (codes.length === 0) return;
    const conn = activeConnection();
    if (!conn) return;
    const next = new Set(conn.seenErrorCodes);
    for (const c of codes) next.add(c);
    conn.seenErrorCodes = next;
  }

  /** Reset the seen-codes set for the active connection. */
  function clearSeenErrorCodes(): void {
    const conn = activeConnection();
    if (!conn) return;
    if (conn.seenErrorCodes.size === 0) return;
    conn.seenErrorCodes = new Set<string>();
  }

  // Pause polling during a print on the active connection only —
  // matching today's behaviour. Other connections keep polling.
  watch(isPrinting, busy => {
    const conn = activeConnection();
    if (!conn) return;
    if (busy) stopPolling(conn.id);
    else scheduleNextPoll(conn.id);
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAllPolls();
      else rescheduleAllPolls();
    });
  }

  async function disconnect(): Promise<void> {
    const conn = activeConnection();
    if (!conn) return;
    try {
      await conn.adapter.close();
    } catch (err) {
      console.warn('[burnmark] close failed', err);
    }
    removeConnection(conn.id);
  }

  async function disconnectAll(): Promise<void> {
    const ids = [...connections.keys()];
    for (const id of ids) {
      const conn = connections.get(id);
      if (!conn) continue;
      try {
        await conn.adapter.close();
      } catch (err) {
        console.warn('[burnmark] close failed', err);
      }
      removeConnection(id);
    }
  }

  return {
    // multi-connection surface
    connections,
    activeSlot,
    totalSlotCount,
    addConnection,
    removeConnection,
    setActiveSlot,
    setSelectedMediaForSlot,
    setConnectionNickname,
    effectiveMediaForSlot,
    getConnection,
    disconnectAll,
    lastConnections,
    forgetLastConnection,

    // backward-compatible single-connection surface
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

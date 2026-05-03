<template>
  <div ref="rootRef" class="popover">
    <PrinterStatus class="popover__trigger" :open="open" @click="toggle" />
    <transition name="popover-fade">
      <div v-if="open" class="popover__panel" role="dialog" :aria-label="t('printer.popoverTitle')">
        <!-- Disconnected, no transports -->
        <div v-if="!hasAnyTransport" class="popover__section">
          <p class="popover__heading">{{ t('printer.unsupportedBrowser.title') }}</p>
          <p class="popover__note">{{ unsupportedCopy }}</p>
          <p class="popover__note">{{ t('printer.unsupportedBrowser.body') }}</p>
          <button
            class="popover__why"
            type="button"
            :aria-expanded="whyOpen"
            @click="whyOpen = !whyOpen"
          >
            {{ t('printer.unsupportedBrowser.whyExpander') }}
            <span aria-hidden="true">{{ whyOpen ? '▴' : '▾' }}</span>
          </button>
          <p v-if="whyOpen" class="popover__why-body">
            {{ t('printer.unsupportedBrowser.whyExplanation') }}
          </p>
        </div>

        <!-- Disconnected: initial connect prompt -->
        <div v-else-if="!printer.isConnected" class="popover__section">
          <p class="popover__heading">{{ t('printer.connectHeading') }}</p>
          <button
            v-if="webUsb"
            class="popover__btn popover__btn--primary"
            type="button"
            @click="connectUsb"
          >
            {{ t('printer.connectUsb') }}
          </button>
          <button
            v-if="webSerial"
            class="popover__btn"
            :class="{ 'popover__btn--primary': !webUsb }"
            type="button"
            :title="t('printer.connectSerialHint')"
            @click="connectSerial"
          >
            {{ t('printer.connectSerial') }}
          </button>
          <p v-if="connectError" class="popover__error">
            {{ connectError }}
            <a
              class="popover__help-link"
              :href="PRINTER_HELP_URL"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ t('printer.helpLink') }} ↗
            </a>
          </p>
        </div>

        <!--
          Connected — single-slot path renders verbatim today's popover
          (per plan §0.5: "single-printer user must not be able to tell
          the refactor happened"). Multi-slot path renders chassis-chip-
          grouped slot cards.
        -->
        <template v-else>
          <div v-if="totalSlotCount === 1" class="popover__section">
            <p class="popover__heading">{{ printer.model }}</p>
            <p v-if="detectedName" class="popover__detected">
              {{ t('printer.detectedMedia', { name: detectedName }) }}
            </p>
            <p v-else class="popover__note">{{ t('printer.noMediaDetected') }}</p>
            <ul v-if="errorMessages.length > 0" class="popover__errors">
              <li v-for="(msg, idx) in errorMessages" :key="idx">{{ msg }}</li>
            </ul>
            <p v-if="lastCheckedLabel" class="popover__note popover__note--checked">
              {{ lastCheckedLabel }}
            </p>
            <p class="popover__hint">{{ t('printer.changeSizeHint') }}</p>
            <button class="popover__btn" type="button" @click="disconnectActive">
              {{ t('printer.disconnect') }}
            </button>
          </div>

          <ul v-else class="popover__section popover__slots popover__slots--flat">
            <li
              v-for="entry in flatSlotEntries"
              :key="entry.key"
              class="popover__slot"
              :class="{ 'popover__slot--active': isActive(entry.connectionId, entry.role) }"
            >
              <button
                class="popover__slot-btn"
                type="button"
                @click="promote(entry.connectionId, entry.role)"
                :aria-pressed="isActive(entry.connectionId, entry.role)"
              >
                <span class="popover__slot-label">{{ entry.label }}</span>
                <span
                  v-if="isActive(entry.connectionId, entry.role)"
                  class="popover__active-tag"
                >
                  {{ t('printer.activeSlot') }}
                </span>
              </button>
              <button
                class="popover__chip-btn"
                type="button"
                @click="removeConnection(entry.connectionId)"
                :title="t('printer.disconnect')"
              >
                {{ t('printer.disconnect') }}
              </button>
            </li>
            <li v-if="errorMessages.length > 0" class="popover__slot popover__slot--meta">
              <ul class="popover__errors">
                <li v-for="(msg, idx) in errorMessages" :key="idx">{{ msg }}</li>
              </ul>
            </li>
            <li v-if="lastCheckedLabel" class="popover__slot popover__slot--meta">
              <p class="popover__note popover__note--checked">{{ lastCheckedLabel }}</p>
            </li>
          </ul>

          <!--
            Pair-another always reachable from the connected state,
            per plan §4.1 ("rails not walls"). Renders as a quiet
            secondary button so single-printer users barely notice it.
          -->
          <div class="popover__section popover__pair-another">
            <button
              v-if="webUsb"
              class="popover__btn popover__btn--quiet"
              type="button"
              @click="pairAnotherUsb"
            >
              {{ t('printer.pairAnother') }}
            </button>
            <button
              v-if="webSerial && !webUsb"
              class="popover__btn popover__btn--quiet"
              type="button"
              @click="pairAnotherSerial"
            >
              {{ t('printer.pairAnother') }}
            </button>
            <p v-if="connectError" class="popover__error">{{ connectError }}</p>
          </div>
        </template>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import PrinterStatus from './PrinterStatus.vue';
import { usePrinterStore } from '@/stores/printer';
import { requestUsbPrinter } from '@/lib/printer/connect';
import { openBrotherQLViaSerial } from '@/lib/printer/drivers';
import { useBrowserCapabilities } from '@/composables/useBrowserCapabilities';
import { useToast } from '@/composables/useToast';
import { localisedErrorMessage } from '@/composables/usePrinterErrors';
import { PRINTER_HELP_URL } from '@/lib/printer/help';

const { t } = useI18n();
const printer = usePrinterStore();
const { show } = useToast();
const { webUsb, webSerial, hasAnyTransport, browser } = useBrowserCapabilities();

const open = ref(false);
const whyOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const connectError = ref<string | null>(null);

const detectedName = computed(() => printer.detectedMedia?.name ?? null);
const totalSlotCount = computed(() => printer.totalSlotCount());

interface FlatSlotEntry {
  key: string;
  connectionId: string;
  role: string;
  label: string;
}

/**
 * Flat list of every slot across every connection. With no
 * composite-chassis users in the wild (Duo/Twin per plan §0.5) every
 * connection contributes exactly one entry, so the multi-slot popover
 * is just a flat list of cards rather than a chassis-grouped tree.
 */
const flatSlotEntries = computed<FlatSlotEntry[]>(() => {
  const out: FlatSlotEntry[] = [];
  for (const conn of printer.connections.values()) {
    for (const slot of conn.slots.values()) {
      const baseLabel = conn.nickname ?? `${conn.model} · ${shortFingerprint(conn.fingerprint)}`;
      const label = slot.role === 'primary' ? baseLabel : `${baseLabel} — ${slot.role}`;
      out.push({
        key: `${conn.id}:${slot.role}`,
        connectionId: conn.id,
        role: slot.role,
        label,
      });
    }
  }
  return out;
});

function isActive(connectionId: string, role: string): boolean {
  return (
    printer.activeSlot?.connectionId === connectionId && printer.activeSlot?.role === role
  );
}

function promote(connectionId: string, role: string): void {
  printer.setActiveSlot({ connectionId, role });
}

function shortFingerprint(fp: string): string {
  // Last 4 chars — enough to disambiguate two-of-the-same-model in
  // the common case while staying short enough to read at a glance.
  return fp.slice(-4);
}

async function removeConnection(id: string): Promise<void> {
  const conn = printer.getConnection(id);
  if (!conn) return;
  try {
    await conn.adapter.close();
  } catch (err) {
    console.warn('[burnmark] close failed', err);
  }
  printer.removeConnection(id);
  if (printer.connections.size === 0) close();
}

const errorMessages = computed<string[]>(() => {
  const errs = printer.lastStatus?.errors ?? [];
  return errs.map(e => localisedErrorMessage(e, t));
});

const now = ref(Date.now());
let tickHandle: ReturnType<typeof setInterval> | null = null;
function startTicker(): void {
  if (tickHandle !== null) return;
  now.value = Date.now();
  tickHandle = setInterval(() => {
    now.value = Date.now();
  }, 1000);
}
function stopTicker(): void {
  if (tickHandle === null) return;
  clearInterval(tickHandle);
  tickHandle = null;
}

const lastCheckedLabel = computed<string | null>(() => {
  if (!printer.lastStatusAt) return null;
  const seconds = Math.max(0, Math.round((now.value - printer.lastStatusAt) / 1000));
  return t('printer.lastCheckedSeconds', { seconds });
});

watch(
  () => printer.lastStatus,
  status => {
    if (!status) return;
    if (status.errors.length === 0) {
      printer.clearSeenErrorCodes();
      return;
    }
    if (open.value) return;
    const seen = printer.seenErrorCodes;
    const fresh = status.errors.filter(e => !seen.has(e.code));
    if (fresh.length === 0) return;
    for (const err of fresh) {
      show(localisedErrorMessage(err, t), 'error');
    }
    printer.markErrorCodesSeen(fresh.map(e => e.code));
  },
);

watch(
  () => printer.circuitBroken,
  broken => {
    if (broken) show(t('printer.statusUnavailable'), 'info');
  },
);

const unsupportedCopy = computed(() => {
  switch (browser.value) {
    case 'firefox':
      return t('printer.unsupportedBrowser.perBrowser.firefox');
    case 'safari':
      return t('printer.unsupportedBrowser.perBrowser.safari');
    default:
      return t('printer.unsupportedBrowser.perBrowser.other');
  }
});

function toggle(): void {
  open.value = !open.value;
  connectError.value = null;
  whyOpen.value = false;
  if (open.value) {
    startTicker();
    const errs = printer.lastStatus?.errors ?? [];
    if (errs.length > 0) {
      printer.markErrorCodesSeen(errs.map(e => e.code));
    }
  } else {
    stopTicker();
  }
}

function close(): void {
  open.value = false;
  connectError.value = null;
  whyOpen.value = false;
  stopTicker();
}

async function connectUsb(): Promise<void> {
  await runConnect(requestUsbPrinter, /*additive*/ false);
}

async function connectSerial(): Promise<void> {
  await runConnect(openBrotherQLViaSerial, /*additive*/ false);
}

async function pairAnotherUsb(): Promise<void> {
  await runConnect(requestUsbPrinter, /*additive*/ true);
}

async function pairAnotherSerial(): Promise<void> {
  await runConnect(openBrotherQLViaSerial, /*additive*/ true);
}

/**
 * Unified connect helper. `additive=true` adds another connection
 * alongside any existing ones (the "Pair another printer" path).
 * `additive=false` follows the pre-refactor "replace whatever's
 * connected" semantics used from the disconnected popover.
 */
async function runConnect(
  open: () => Promise<import('@thermal-label/contracts').PrinterAdapter>,
  additive: boolean,
): Promise<void> {
  connectError.value = null;
  if (!additive) printer.setConnecting();
  try {
    const adapter = await open();
    if (additive) {
      printer.addConnection(adapter);
    } else {
      printer.setAdapter(adapter);
    }
    await printer.refreshStatus();
    if (!additive) close();
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') {
      // User dismissed the picker — quiet cancel.
      if (!additive) printer.setAdapter(null);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (!additive) printer.setError(message);
    connectError.value = message;
  }
}

async function disconnectActive(): Promise<void> {
  await printer.disconnect();
  close();
}

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return;
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    close();
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  stopTicker();
});
</script>

<style scoped>
.popover {
  position: relative;
  display: inline-flex;
}

.popover__trigger {
  display: inline-flex;
}

.popover__panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 280px;
  max-width: 360px;
  padding: var(--space-3);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.popover__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.popover__pair-another {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-2);
}

.popover__heading {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.popover__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  transition: background var(--duration-fast) var(--easing);
}

.popover__btn:hover {
  background: var(--color-bg);
}

.popover__btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: transparent;
}

.popover__btn--primary:hover {
  background: var(--color-primary-hover);
}

.popover__btn--quiet {
  background: transparent;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.popover__btn--quiet:hover {
  background: var(--color-bg-canvas);
  color: var(--color-text);
}

.popover__chip-btn {
  appearance: none;
  background: none;
  border: none;
  padding: 2px 4px;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  cursor: pointer;
}

.popover__chip-btn:hover {
  color: var(--color-text);
  text-decoration: underline;
}

.popover__slots {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.popover__slot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.popover__slot--active {
  background: var(--color-bg-canvas);
  box-shadow: inset 2px 0 0 var(--color-primary);
}

.popover__slot--meta {
  display: block;
  padding: 0 var(--space-2);
}

.popover__slot-btn {
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.popover__slot-label {
  font-weight: var(--weight-medium);
}

.popover__active-tag {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.popover__note {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.popover__detected {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.popover__hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-style: italic;
}

.popover__errors {
  margin: 0;
  padding: 0 0 0 var(--space-3);
  list-style: disc;
  font-size: var(--text-xs);
  color: var(--color-error);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.popover__note--checked {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.popover__error {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-error);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.popover__help-link {
  color: var(--color-primary);
  text-decoration: underline;
  font-weight: var(--weight-medium);
}

.popover__help-link:hover {
  color: var(--color-primary-hover);
}

.popover__why {
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-primary);
  cursor: pointer;
  text-align: left;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.popover__why:hover {
  color: var(--color-primary-hover);
}

.popover__why-body {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.popover-fade-enter-active,
.popover-fade-leave-active {
  transition:
    opacity var(--duration-fast) var(--easing),
    transform var(--duration-fast) var(--easing);
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -4px);
}
</style>

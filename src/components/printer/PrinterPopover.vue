<template>
  <div ref="rootRef" class="popover">
    <PrinterStatus class="popover__trigger" :open="open" @click="toggle" />
    <transition name="popover-fade">
      <div v-if="open" class="popover__panel" role="dialog" :aria-label="t('printer.popoverTitle')">
        <div v-if="!printer.isConnected" class="popover__section">
          <template v-if="hasAnyTransport">
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
          </template>
          <template v-else>
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
          </template>
        </div>

        <div v-else class="popover__section">
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
          <button class="popover__btn" type="button" @click="disconnect">
            {{ t('printer.disconnect') }}
          </button>
        </div>
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

const errorMessages = computed<string[]>(() => {
  const errs = printer.lastStatus?.errors ?? [];
  return errs.map(e => localisedErrorMessage(e, t));
});

/**
 * "Last checked Ns ago" — uses a 1s ticking ref so the relative
 * timestamp updates while the popover is open. The ref starts/stops
 * with the popover visibility to avoid an idle interval.
 */
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

/**
 * First-occurrence toasts. Watch the full status object — a fresh
 * tick replaces it (shallowRef, no deep mutation), so the watcher
 * fires on every poll.
 */
watch(
  () => printer.lastStatus,
  status => {
    if (!status) return;
    if (status.errors.length === 0) {
      printer.clearSeenErrorCodes();
      return;
    }
    // Suppress toasts while the popover is open — the user is already
    // looking at the same errors there. The codes are marked seen on
    // popover open, so re-opening doesn't re-fire either.
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

// Circuit breaker — one-time, non-blocking notice so the user knows
// status updates have stopped without spelling out the underlying
// transport problem.
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
    // Errors visible in the popover count as "user has seen them" —
    // suppress any future toast for those codes (§4.3).
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
  connectError.value = null;
  printer.setConnecting();
  try {
    const adapter = await requestUsbPrinter();
    printer.setAdapter(adapter);
    await printer.refreshStatus();
    close();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The user dismissing the picker shows up as NotFoundError — treat
    // as a quiet cancel, not an error.
    if (err instanceof Error && err.name === 'NotFoundError') {
      printer.setAdapter(null);
      return;
    }
    printer.setError(message);
    connectError.value = message;
  }
}

async function connectSerial(): Promise<void> {
  connectError.value = null;
  printer.setConnecting();
  try {
    const adapter = await openBrotherQLViaSerial();
    printer.setAdapter(adapter);
    await printer.refreshStatus();
    close();
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') {
      printer.setAdapter(null);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    printer.setError(message);
    connectError.value = message;
  }
}

async function disconnect(): Promise<void> {
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
}

.popover__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
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

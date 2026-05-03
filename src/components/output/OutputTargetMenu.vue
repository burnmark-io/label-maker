<template>
  <div ref="rootRef" class="output-menu">
    <button
      class="output-menu__trigger"
      type="button"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :title="triggerTooltip"
      @click="toggle"
    >
      <span v-if="activeTarget.kind === 'sheet'" class="output-menu__icon" aria-hidden="true"
        >📄</span
      >
      <span
        v-else
        class="output-menu__dot"
        :class="`output-menu__dot--${triggerDotClass}`"
        aria-hidden="true"
      />
      <span class="output-menu__label">{{ triggerLabel }}</span>
      <span class="output-menu__chevron" aria-hidden="true">▾</span>
    </button>

    <transition name="output-menu-fade">
      <div
        v-if="open"
        class="output-menu__panel"
        role="dialog"
        :aria-label="t('output.menu.title')"
      >
        <p class="output-menu__heading">{{ t('output.targets.heading') }}</p>

        <!-- Thermal slot rows -->
        <ul v-if="thermalEntries.length > 0" class="output-menu__list">
          <template v-for="entry in thermalEntries" :key="entry.key">
            <OutputTargetRow
              :slot="entry.slot"
              :connection="entry.connection"
              :active="isThermalRowActive(entry)"
              :expanded="isThermalRowActive(entry)"
              @select="onSelectThermal(entry)"
            >
              <template #card>
                <OutputTargetPaperCard
                  v-if="isThermalRowActive(entry)"
                  kind="thermal"
                  :connection-id="entry.connectionId"
                  :role="entry.role"
                  :last-checked-label="lastCheckedLabel"
                  @pick-media="close"
                  @disconnect="onDisconnect"
                />
              </template>
            </OutputTargetRow>
          </template>
        </ul>

        <hr v-if="thermalEntries.length > 0" class="output-menu__divider" />

        <!-- Sheet target row — always present -->
        <ul class="output-menu__list">
          <li
            class="output-menu__sheet-row"
            :class="{ 'output-menu__sheet-row--active': activeTarget.kind === 'sheet' }"
          >
            <button
              type="button"
              class="output-menu__sheet-btn"
              :aria-pressed="activeTarget.kind === 'sheet'"
              :aria-expanded="activeTarget.kind === 'sheet'"
              @click="onSelectSheet"
            >
              <span class="output-menu__icon" aria-hidden="true">📄</span>
              <span class="output-menu__stack">
                <span class="output-menu__sheet-label">{{ t('output.sheet.row.title') }}</span>
                <span class="output-menu__sheet-sub">{{ sheetSubLabel }}</span>
              </span>
            </button>
            <OutputTargetPaperCard
              v-if="showSheetCard"
              kind="sheet"
              @change-sheet="sheetPickerOpen = true"
              @pick-custom="onPickedCustom"
            />
          </li>
        </ul>

        <hr class="output-menu__divider" />

        <!-- Disconnected: explainer + transport CTAs -->
        <div v-if="!hasAnyTransport && thermalEntries.length === 0" class="output-menu__connect">
          <p class="output-menu__note">{{ t('printer.unsupportedBrowser.title') }}</p>
          <p class="output-menu__note">{{ unsupportedCopy }}</p>
          <button
            class="output-menu__why"
            type="button"
            :aria-expanded="whyOpen"
            @click="whyOpen = !whyOpen"
          >
            {{ t('printer.unsupportedBrowser.whyExpander') }}
            <span aria-hidden="true">{{ whyOpen ? '▴' : '▾' }}</span>
          </button>
          <p v-if="whyOpen" class="output-menu__why-body">
            {{ t('printer.unsupportedBrowser.whyExplanation') }}
          </p>
        </div>

        <div v-else class="output-menu__connect">
          <button
            v-if="webUsb"
            class="output-menu__btn"
            :class="{ 'output-menu__btn--primary': thermalEntries.length === 0 }"
            type="button"
            @click="onConnectUsb"
          >
            {{ thermalEntries.length === 0 ? t('output.connect.cta') : t('printer.pairAnother') }}
          </button>
          <button
            v-if="webSerial"
            class="output-menu__btn"
            :class="{ 'output-menu__btn--primary': thermalEntries.length === 0 && !webUsb }"
            type="button"
            :title="t('printer.connectSerialHint')"
            @click="onConnectSerial"
          >
            {{ t('printer.connectSerial') }}
          </button>
          <p v-if="connectError" class="output-menu__error">{{ connectError }}</p>
        </div>
      </div>
    </transition>

    <SheetPickerDialog
      :open="sheetPickerOpen"
      @close="sheetPickerOpen = false"
      @select="onSheetPicked"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { findSheet, type SheetTemplate } from '@burnmark-io/sheet-templates';

import { useMediaStore } from '@/stores/media';
import { usePrinterStore, type Connection, type EngineSlotState } from '@/stores/printer';
import { usePrintConfigStore } from '@/stores/print-config';
import { useBrowserCapabilities } from '@/composables/useBrowserCapabilities';
import { useToast } from '@/composables/useToast';
import { useOutputTargetActions } from '@/composables/useOutputTargetActions';
import { localisedErrorMessage } from '@/composables/usePrinterErrors';

import OutputTargetRow from './OutputTargetRow.vue';
import OutputTargetPaperCard from './OutputTargetPaperCard.vue';
import SheetPickerDialog from '@/components/media/SheetPickerDialog.vue';

const { t } = useI18n();
const media = useMediaStore();
const printer = usePrinterStore();
const printConfig = usePrintConfigStore();
const { show } = useToast();
const { webUsb, webSerial, hasAnyTransport, browser } = useBrowserCapabilities();
const {
  connectError,
  runConnect,
  removeConnection: removeConnectionAction,
  clearError,
} = useOutputTargetActions();

const open = ref(false);
const whyOpen = ref(false);
const sheetPickerOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);

interface ThermalEntry {
  key: string;
  connectionId: string;
  role: string;
  connection: Connection;
  slot: EngineSlotState;
}

/**
 * Flat list of every slot across every connection. Single-engine
 * printers contribute one row per connection (the realistic case
 * per `project_printer_distribution`); composite chassis would
 * contribute one per engine.
 */
const thermalEntries = computed<ThermalEntry[]>(() => {
  const out: ThermalEntry[] = [];
  for (const conn of printer.connections.values()) {
    for (const slot of conn.slots.values()) {
      out.push({
        key: `${conn.id}:${slot.role}`,
        connectionId: conn.id,
        role: slot.role,
        connection: conn,
        slot,
      });
    }
  }
  return out;
});

/**
 * Plan §2.2 resolution rule, extended for custom: the PDF row covers
 * paper output, with two ways to set dimensions — pick a sticker
 * sheet (`source === 'sheet'`) or type custom dims
 * (`source === 'custom'`). Either makes the PDF row the active
 * target. Otherwise fall through to the thermal `activeSlot`.
 */
type ActiveTarget =
  | { kind: 'thermal'; connectionId: string; role: string }
  | { kind: 'sheet' }
  | { kind: 'none' };

const activeTarget = computed<ActiveTarget>(() => {
  if (media.source === 'sheet' || media.source === 'custom') return { kind: 'sheet' };
  const a = printer.activeSlot;
  if (a) return { kind: 'thermal', connectionId: a.connectionId, role: a.role };
  return { kind: 'none' };
});

function isThermalRowActive(entry: ThermalEntry): boolean {
  return (
    activeTarget.value.kind === 'thermal' &&
    activeTarget.value.connectionId === entry.connectionId &&
    activeTarget.value.role === entry.role
  );
}

// ---- Trigger label ----

const activeConnection = computed<Connection | null>(() => {
  if (activeTarget.value.kind !== 'thermal') return null;
  return printer.getConnection(activeTarget.value.connectionId) ?? null;
});

type DotClass = 'green' | 'yellow' | 'red' | 'gray';

const triggerDotClass = computed<DotClass>(() => {
  const conn = activeConnection.value;
  if (!conn) {
    return printer.lastPaired ? 'yellow' : 'gray';
  }
  const status = conn.status;
  if (!status) return 'green';
  if (!status.ready) return 'red';
  if (status.errors.length > 0) return 'yellow';
  return 'green';
});

const triggerLabel = computed(() => {
  if (activeTarget.value.kind === 'sheet') {
    if (media.source === 'custom') {
      const w = Math.round(media.widthMm * 10) / 10;
      const h = media.heightMm;
      const dims =
        h === null
          ? t('media.format.continuous', { width: w })
          : t('media.format.fixed', { width: w, height: Math.round(h * 10) / 10 });
      return t('output.custom.triggerLabel', { dims });
    }
    const code = printConfig.sheetTemplate?.code ?? media.sheetCode;
    if (code) {
      const sheet = findSheet(code);
      if (sheet) return `${sheet.brand} ${sheet.part}`;
    }
    return t('output.sheet.row.title');
  }
  if (activeTarget.value.kind === 'thermal') {
    const conn = activeConnection.value;
    if (!conn) return t('output.pickTarget');
    const base = conn.nickname ?? conn.model;
    const slotState = conn.slots.get(activeTarget.value.role);
    const m = slotState?.selectedMedia ?? slotState?.detectedMedia;
    const mediaName = m?.name ?? t('media.notSet');
    return `${base} · ${mediaName}`;
  }
  return t('output.pickTarget');
});

const triggerTooltip = computed(() => {
  const conn = activeConnection.value;
  const first = conn?.status?.errors[0];
  if (first) return localisedErrorMessage(first, t);
  return triggerLabel.value;
});

// ---- Sheet row ----

const resolvedSheet = computed<SheetTemplate | null>(() => {
  const code = printConfig.sheetTemplate?.code ?? media.sheetCode;
  return code ? (findSheet(code) ?? null) : null;
});

/**
 * Show the PDF row's expanded card when:
 *  - it's the active target (source ∈ {sheet, custom}), OR
 *  - the user has nothing remembered yet (no sheet ever picked AND
 *    no custom dims) — auto-expand so first-time users see the
 *    sheet/custom choice without a dialog detour.
 *
 * When a sheet has been picked previously but the user is on a
 * thermal target, the card stays collapsed: tapping the row
 * re-applies the remembered sheet (one-click switch back).
 */
const showSheetCard = computed(() => {
  if (activeTarget.value.kind === 'sheet') return true;
  return !resolvedSheet.value;
});

const sheetSubLabel = computed(() => {
  if (media.source === 'custom') {
    const w = Math.round(media.widthMm * 10) / 10;
    const h = media.heightMm;
    return h === null
      ? t('media.format.continuous', { width: w })
      : t('media.format.fixed', { width: w, height: Math.round(h * 10) / 10 });
  }
  const sheet = resolvedSheet.value;
  if (sheet) return `${sheet.brand} ${sheet.part}`;
  return t('output.sheet.row.empty');
});

// ---- "Last checked" ticker (only when active thermal row is expanded) ----

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
  const conn = activeConnection.value;
  if (!conn || !conn.statusAt) return null;
  const seconds = Math.max(0, Math.round((now.value - conn.statusAt) / 1000));
  return t('printer.lastCheckedSeconds', { seconds });
});

// ---- Toast on fresh error (parity with PrinterPopover) ----

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

// ---- Browser-not-supported copy ----

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

// ---- Open/close ----

function toggle(): void {
  open.value = !open.value;
  whyOpen.value = false;
  clearError();
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
  whyOpen.value = false;
  clearError();
  stopTicker();
}

function onDocClick(event: MouseEvent): void {
  if (!open.value) return;
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) close();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    close();
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onKeydown);
  stopTicker();
});

// ---- Row interactions ----

function onSelectThermal(entry: ThermalEntry): void {
  printer.setActiveSlot({ connectionId: entry.connectionId, role: entry.role });
  // Stay open: user is exploring. Picking a media inside the card is
  // the affirmative action that closes (plan §4.1, §4.2).
}

function onSelectSheet(): void {
  // Already on the PDF target (sheet OR custom) → close idempotently.
  // Switching between sheet and custom happens inside the card.
  if (media.source === 'sheet' || media.source === 'custom') {
    close();
    return;
  }
  // Coming from a thermal target with a previously-picked sheet:
  // re-apply it as a one-click switch back (plan §4.1).
  if (resolvedSheet.value) {
    media.pickSheet(resolvedSheet.value);
    printConfig.recordCanvasSheetPick(resolvedSheet.value);
    show(
      t('media.toast.appliedSheet', {
        name: `${resolvedSheet.value.brand} ${resolvedSheet.value.part}`,
      }),
      'info',
      { ttlMs: 3000 },
    );
    close();
    return;
  }
  // No sheet ever picked → the card is already visible below the row
  // (see `showSheetCard`); the user picks sheet or custom inline. No
  // automatic dialog detour.
}

/**
 * Picking custom dims is an explicit "design for a custom-sized PDF,
 * not a sheet." `printConfig.sheetTemplate` now synthesizes a 1-up
 * sheet at the canvas dims when `media.source === 'custom'`, so we
 * don't need to clear the persisted last-picked here — the synth
 * wins as long as the canvas stays custom, and the user keeps their
 * last sheet for an easy switch back later.
 */
function onPickedCustom(): void {
  close();
}

function onSheetPicked(sheet: SheetTemplate): void {
  media.pickSheet(sheet);
  printConfig.recordCanvasSheetPick(sheet);
  show(t('media.toast.appliedSheet', { name: `${sheet.brand} ${sheet.part}` }), 'info', {
    ttlMs: 3000,
  });
  sheetPickerOpen.value = false;
  close();
}

async function onDisconnect(id: string): Promise<void> {
  await removeConnectionAction(id);
  if (printer.connections.size === 0) close();
}

async function onConnectUsb(): Promise<void> {
  const additive = thermalEntries.value.length > 0;
  const { requestUsbPrinter } = await import('@/lib/printer/connect');
  await runConnect(requestUsbPrinter, additive);
  if (!additive) close();
}

async function onConnectSerial(): Promise<void> {
  const additive = thermalEntries.value.length > 0;
  const { openBrotherQLViaSerial } = await import('@/lib/printer/drivers');
  await runConnect(openBrotherQLViaSerial, additive);
  if (!additive) close();
}
</script>

<style scoped>
.output-menu {
  position: relative;
  display: inline-flex;
}

.output-menu__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing);
}

.output-menu__trigger:hover {
  background: var(--color-bg-panel);
  color: var(--color-text);
}

.output-menu__trigger[aria-expanded='true'] {
  background: var(--color-bg-panel);
  color: var(--color-text);
}

.output-menu__icon {
  font-size: 14px;
  line-height: 1;
}

.output-menu__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.output-menu__dot--green {
  background: var(--color-success);
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.15);
}

.output-menu__dot--yellow {
  background: var(--color-warning);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
}

.output-menu__dot--red {
  background: var(--color-error);
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.18);
}

.output-menu__dot--gray {
  background: var(--color-text-muted);
}

.output-menu__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.output-menu__chevron {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.output-menu__panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 340px;
  max-width: 440px;
  max-height: 70vh;
  overflow-y: auto;
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

.output-menu__heading {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.output-menu__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.output-menu__divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: var(--space-1) 0;
}

.output-menu__sheet-row {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.output-menu__sheet-row--active {
  background: var(--color-bg-canvas);
}

.output-menu__sheet-btn {
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  font-size: var(--text-sm);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.output-menu__stack {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.output-menu__sheet-label {
  font-weight: var(--weight-medium);
}

.output-menu__sheet-sub {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.output-menu__connect {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.output-menu__btn {
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
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing);
}

.output-menu__btn:hover {
  background: var(--color-bg);
}

.output-menu__btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: transparent;
}

.output-menu__btn--primary:hover {
  background: var(--color-primary-hover);
}

.output-menu__note {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.output-menu__why {
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-primary);
  cursor: pointer;
  text-align: left;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.output-menu__why:hover {
  color: var(--color-primary-hover);
}

.output-menu__why-body {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.output-menu__error {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-error);
}

.output-menu-fade-enter-active,
.output-menu-fade-leave-active {
  transition:
    opacity var(--duration-fast) var(--easing),
    transform var(--duration-fast) var(--easing);
}

.output-menu-fade-enter-from,
.output-menu-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -4px);
}

/*
 * Mobile: trigger keeps its label (truncates with ellipsis); panel
 * becomes a top drawer pinned under the topbar — full viewport width,
 * no centring offset, internal scroll. Slide-down animation replaces
 * the desktop fade-from-trigger.
 */
@media (max-width: 720px) {
  .output-menu__trigger {
    padding: var(--space-2) var(--space-3);
  }
  .output-menu__label {
    max-width: 50vw;
  }

  .output-menu__panel {
    position: fixed;
    top: var(--topbar-height);
    left: 0;
    right: 0;
    transform: none;
    width: 100vw;
    max-width: none;
    max-height: calc(100vh - var(--topbar-height));
    border-radius: 0 0 var(--radius-md) var(--radius-md);
    border-left: none;
    border-right: none;
  }

  .output-menu-fade-enter-from,
  .output-menu-fade-leave-to {
    transform: translateY(-8px);
  }
}
</style>

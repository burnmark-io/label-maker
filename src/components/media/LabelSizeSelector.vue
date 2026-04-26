<template>
  <div ref="rootRef" class="size-selector">
    <button
      class="size-selector__trigger"
      type="button"
      :aria-expanded="open"
      :aria-label="t('media.selector.label')"
      :title="t('media.selector.label')"
      @click="toggle"
    >
      <span class="size-selector__icon" aria-hidden="true">📐</span>
      <span class="size-selector__current">{{ currentLabel }}</span>
      <span class="size-selector__chevron" aria-hidden="true">▾</span>
    </button>

    <transition name="size-selector-fade">
      <div
        v-if="open"
        class="size-selector__panel"
        role="dialog"
        :aria-label="t('media.selector.label')"
      >
        <section
          v-if="printer.isConnected && printerMedia.length > 0"
          class="size-selector__section"
        >
          <h3 class="size-selector__heading">
            {{ t('media.fromPrinterModel', { model: printer.model ?? '' }) }}
          </h3>
          <button
            v-for="m in printerMedia"
            :key="String(m.id)"
            type="button"
            class="size-selector__option"
            :class="{ 'size-selector__option--active': isMediaActive(m) }"
            @click="onPrinterMedia(m)"
          >
            <span class="size-selector__option-name">{{ m.name }}</span>
            <span v-if="isMediaDetected(m)" class="size-selector__option-tag">
              {{ t('media.detected') }}
            </span>
          </button>
        </section>

        <section v-if="!printer.isConnected" class="size-selector__section">
          <h3 class="size-selector__heading">{{ t('media.commonSizes') }}</h3>
          <button
            v-for="size in COMMON_SIZES"
            :key="size.id"
            type="button"
            class="size-selector__option"
            :class="{ 'size-selector__option--active': isCommonActive(size) }"
            @click="onCommon(size)"
          >
            <span class="size-selector__option-name">{{ size.name }}</span>
          </button>
        </section>

        <section class="size-selector__section">
          <h3 class="size-selector__heading">{{ t('media.fromSheet') }}</h3>
          <button
            type="button"
            class="size-selector__option"
            :class="{ 'size-selector__option--active': media.source === 'sheet' }"
            @click="sheetPickerOpen = true"
          >
            <span class="size-selector__option-name">
              {{ media.source === 'sheet' ? sheetCurrentLabel : t('media.sheet.picker') }}
            </span>
            <span class="size-selector__chevron" aria-hidden="true">…</span>
          </button>
        </section>

        <section class="size-selector__section">
          <h3 class="size-selector__heading">{{ t('media.custom.label') }}</h3>
          <CustomSizeInput
            :initial-width-mm="media.widthMm"
            :initial-height-mm="media.heightMm"
            @apply="onCustom"
          />
        </section>
      </div>
    </transition>

    <SheetPickerDialog :open="sheetPickerOpen" @close="sheetPickerOpen = false" @select="onSheet" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import type { SheetTemplate } from '@burnmark-io/sheet-templates';
import { findSheet } from '@burnmark-io/sheet-templates';

import type { MediaDescriptor } from '@thermal-label/contracts';

import { useMediaStore } from '@/stores/media';
import { usePrinterStore } from '@/stores/printer';
import { COMMON_SIZES, type CommonSize } from '@/lib/media/common-sizes';
import { getMediaForFamily } from '@/lib/printer/registry';
import { useToast } from '@/composables/useToast';
import CustomSizeInput from './CustomSizeInput.vue';
import SheetPickerDialog from './SheetPickerDialog.vue';

const { t } = useI18n();
const media = useMediaStore();
const printer = usePrinterStore();
const { detectedMedia } = storeToRefs(printer);
const { show } = useToast();

const open = ref(false);
const sheetPickerOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);

function toggle(): void {
  open.value = !open.value;
}

function close(): void {
  open.value = false;
}

const currentLabel = computed(() => {
  if (media.source === 'sheet' && media.sheetCode) {
    const sheet = findSheet(media.sheetCode);
    if (sheet) return `${sheet.brand} ${sheet.part}`;
  }
  if (media.heightMm === null) {
    return t('media.format.continuous', { width: round1(media.widthMm) });
  }
  return t('media.format.fixed', {
    width: round1(media.widthMm),
    height: round1(media.heightMm),
  });
});

const sheetCurrentLabel = computed(() => {
  if (!media.sheetCode) return t('media.sheet.picker');
  const sheet = findSheet(media.sheetCode);
  if (!sheet) return t('media.sheet.picker');
  return `${sheet.brand} ${sheet.part}`;
});

/**
 * Driver-aware media list — populated from the connected printer's
 * family registry. Restricts the picker to media the connected printer
 * can actually load. When no printer is connected, falls back to the
 * curated `COMMON_SIZES` cross-driver list (rendered in a separate
 * section below).
 */
const printerMedia = computed<MediaDescriptor[]>(() => {
  if (!printer.family) return [];
  return getMediaForFamily(printer.family);
});

function isCommonActive(size: CommonSize): boolean {
  if (media.source !== 'manual') return false;
  if (Math.abs(size.widthMm - media.widthMm) > 0.5) return false;
  return (size.heightMm ?? null) === media.heightMm;
}

function isMediaActive(m: MediaDescriptor): boolean {
  if (Math.abs(m.widthMm - media.widthMm) > 0.5) return false;
  return (m.heightMm ?? null) === media.heightMm;
}

function isMediaDetected(m: MediaDescriptor): boolean {
  const det = detectedMedia.value;
  if (!det) return false;
  return String(m.id) === String(det.id);
}

function onPrinterMedia(m: MediaDescriptor): void {
  // Driver-list pick is a deliberate user choice → 'manual'. Sets the
  // canvas dimensions AND threads the descriptor through to the
  // printer's `selectedMedia` so the print pipeline uses the user's
  // assertion (e.g. DK-22251 two-colour) instead of the driver's
  // possibly-wrong auto-detect.
  media.pickPrinterMedia(m);
  // Brief confirmation when the user is overriding what was detected
  // — the more interesting case for the toast. Picking the
  // already-detected entry doesn't need acknowledgement.
  if (!isMediaDetected(m)) {
    show(t('media.toast.overrodeDetected', { name: m.name }), 'info', { ttlMs: 3000 });
  }
  close();
}

function onCommon(size: CommonSize): void {
  media.pickCommonSize(size.widthMm, size.heightMm);
  close();
}

function onSheet(sheet: SheetTemplate): void {
  media.pickSheet(sheet);
  show(t('media.toast.appliedSheet', { name: `${sheet.brand} ${sheet.part}` }), 'info', {
    ttlMs: 3000,
  });
  close();
}

function onCustom(widthMm: number, heightMm: number | null): void {
  media.pickCustom(widthMm, heightMm);
  close();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function onDocClick(event: MouseEvent): void {
  if (!open.value) return;
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) close();
}

onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));
</script>

<style scoped>
.size-selector {
  position: relative;
  display: inline-flex;
}

.size-selector__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing);
  max-width: 280px;
}

.size-selector__trigger:hover {
  background: var(--color-bg);
}

.size-selector__icon {
  font-size: 16px;
  line-height: 1;
}

.size-selector__current {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.size-selector__chevron {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.size-selector__panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 320px;
  max-width: 400px;
  max-height: 70vh;
  overflow-y: auto;
  padding: var(--space-3);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.size-selector__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.size-selector__heading {
  margin: 0 0 var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.size-selector__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  text-align: left;
  font-size: var(--text-sm);
  color: var(--color-text);
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing);
}

.size-selector__option:hover {
  background: var(--color-bg-canvas);
}

.size-selector__option--active {
  background: var(--color-bg-canvas);
  border-color: var(--color-border);
  font-weight: var(--weight-medium);
}

.size-selector__option-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.size-selector__option-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: rgba(22, 163, 74, 0.1);
  color: var(--color-success);
  border: 1px solid rgba(22, 163, 74, 0.4);
  font-weight: var(--weight-medium);
}

.size-selector-fade-enter-active,
.size-selector-fade-leave-active {
  transition:
    opacity var(--duration-fast) var(--easing),
    transform var(--duration-fast) var(--easing);
}

.size-selector-fade-enter-from,
.size-selector-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

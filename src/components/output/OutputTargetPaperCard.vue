<template>
  <div class="paper-card">
    <section class="paper-card__section">
      <h3 class="paper-card__heading">{{ t('media.orientation.label') }}</h3>
      <div
        class="paper-card__orientation"
        role="radiogroup"
        :aria-label="t('media.orientation.toggle')"
      >
        <button
          type="button"
          class="paper-card__orientation-btn"
          :class="{ 'paper-card__orientation-btn--active': media.orientation === 'vertical' }"
          role="radio"
          :aria-checked="media.orientation === 'vertical'"
          @click="onOrientation('vertical')"
        >
          <span aria-hidden="true">▯</span>
          {{ t('media.orientation.vertical') }}
        </button>
        <button
          type="button"
          class="paper-card__orientation-btn"
          :class="{ 'paper-card__orientation-btn--active': media.orientation === 'horizontal' }"
          role="radio"
          :aria-checked="media.orientation === 'horizontal'"
          @click="onOrientation('horizontal')"
        >
          <span aria-hidden="true">▭</span>
          {{ t('media.orientation.horizontal') }}
        </button>
      </div>
    </section>

    <!-- Thermal target: media list (collapsed to current + "more sizes…") -->
    <template v-if="kind === 'thermal'">
      <section v-if="printerMedia.length > 0" class="paper-card__section">
        <h3 class="paper-card__heading">
          {{
            t('media.fromPrinterModel', { model: connection?.nickname ?? connection?.model ?? '' })
          }}
        </h3>

        <!--
          Default state shows only the current pick (selected ?? detected).
          Most users design for what's loaded — surfacing the full media
          list every time is friction for the realistic distribution.
          The "More sizes…" toggle lets the override path stay one click
          away. When nothing is current (no detect, no pick), we expand
          by default so the user has something to act on.
        -->
        <button
          v-if="currentMedia"
          type="button"
          class="paper-card__option paper-card__option--active"
          @click="onPrinterMedia(currentMedia)"
        >
          <span class="paper-card__option-name">{{ currentMedia.name }}</span>
          <span v-if="isMediaDetected(currentMedia)" class="paper-card__option-tag">
            {{ t('media.detected') }}
          </span>
        </button>

        <button
          v-if="otherMedia.length > 0"
          type="button"
          class="paper-card__more"
          :aria-expanded="moreOpen"
          @click="moreOpen = !moreOpen"
        >
          {{ moreOpen ? t('media.more.hide') : t('media.more.show', { count: otherMedia.length }) }}
          <span aria-hidden="true">{{ moreOpen ? '▴' : '▾' }}</span>
        </button>

        <template v-if="moreOpen || !currentMedia">
          <button
            v-for="m in otherMedia"
            :key="String(m.id)"
            type="button"
            class="paper-card__option"
            :class="{ 'paper-card__option--active': isMediaActive(m) }"
            @click="onPrinterMedia(m)"
          >
            <span class="paper-card__option-name">{{ m.name }}</span>
            <span v-if="isMediaDetected(m)" class="paper-card__option-tag">
              {{ t('media.detected') }}
            </span>
          </button>
        </template>
      </section>

      <section v-if="lastCheckedLabel" class="paper-card__section paper-card__section--meta">
        <p class="paper-card__note paper-card__note--checked">{{ lastCheckedLabel }}</p>
      </section>

      <section class="paper-card__section paper-card__section--meta">
        <button class="paper-card__btn" type="button" @click="emit('disconnect', connectionId!)">
          {{ t('printer.disconnect') }}
        </button>
      </section>
    </template>

    <!--
      Sheet/PDF target: paper output. Two ways to set the size — pick a
      sticker-sheet template (1600+ entries → dialog) or type custom
      dimensions (free-form → inline). Custom is a single-label PDF; the
      sheet path is multi-up onto a known sheet.
    -->
    <template v-else-if="kind === 'sheet'">
      <section class="paper-card__section">
        <h3 class="paper-card__heading">{{ t('output.sheet.heading') }}</h3>
        <p v-if="isSheetActive && resolvedSheet" class="paper-card__sheet-line">
          {{ resolvedSheet.brand }} {{ resolvedSheet.part }}
          <span class="paper-card__sheet-detail">
            — {{ t('output.sheet.perPage', { count: labelsPerPage }) }}
          </span>
        </p>
        <p v-else class="paper-card__note">{{ t('output.sheet.row.empty') }}</p>
        <button class="paper-card__btn" type="button" @click="emit('change-sheet')">
          {{
            isSheetActive
              ? t('output.sheet.row.changeTemplate')
              : t('output.sheet.row.pickTemplate')
          }}
        </button>
      </section>

      <section class="paper-card__section">
        <h3 class="paper-card__heading">{{ t('output.custom.heading') }}</h3>
        <p v-if="isCustomActive" class="paper-card__sheet-line">
          {{ customLabel }}
        </p>
        <CustomSizeInput
          :initial-width-mm="media.widthMm"
          :initial-height-mm="media.heightMm"
          @apply="onCustom"
        />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { findSheet } from '@burnmark-io/sheet-templates';
import type { MediaDescriptor } from '@thermal-label/contracts';

import { useMediaStore } from '@/stores/media';
import { usePrinterStore } from '@/stores/printer';
import { usePrintConfigStore } from '@/stores/print-config';
import { getMediaForEngine } from '@/lib/printer/registry';
import { useToast } from '@/composables/useToast';
import CustomSizeInput from '@/components/media/CustomSizeInput.vue';

const props = defineProps<{
  kind: 'thermal' | 'sheet';
  /** Required when kind === 'thermal'. */
  connectionId?: string;
  /** Required when kind === 'thermal'. */
  role?: string;
  /** Live "seconds since last status" string for the active thermal slot. */
  lastCheckedLabel?: string | null;
}>();

const emit = defineEmits<{
  (e: 'pick-media'): void;
  (e: 'pick-custom'): void;
  (e: 'change-sheet'): void;
  (e: 'disconnect', id: string): void;
}>();

const { t } = useI18n();
const media = useMediaStore();
const printer = usePrinterStore();
const printConfig = usePrintConfigStore();
const { show } = useToast();

const connection = computed(() => {
  if (!props.connectionId) return null;
  return printer.getConnection(props.connectionId) ?? null;
});

const slot = computed(() => {
  const conn = connection.value;
  if (!conn || !props.role) return null;
  return conn.slots.get(props.role) ?? null;
});

const printerMedia = computed<MediaDescriptor[]>(() => {
  const conn = connection.value;
  const s = slot.value;
  if (!conn || !s) return [];
  return getMediaForEngine(conn.family, s.engine);
});

const moreOpen = ref(false);

/**
 * Currently-applied entry from the engine's compatible-media list.
 * Prefers an entry that matches the canvas dims AND the slot's
 * selected/detected id; falls back to dim-match for the case where the
 * canvas size came from a different code path (e.g. document load) but
 * still happens to line up with a known entry.
 */
const currentMedia = computed<MediaDescriptor | null>(() => {
  const list = printerMedia.value;
  if (list.length === 0) return null;
  const pick = slot.value?.selectedMedia ?? slot.value?.detectedMedia ?? null;
  if (pick) {
    const byId = list.find(m => String(m.id) === String(pick.id));
    if (byId) return byId;
  }
  return list.find(m => isMediaActive(m)) ?? null;
});

const otherMedia = computed<MediaDescriptor[]>(() => {
  const cur = currentMedia.value;
  if (!cur) return printerMedia.value;
  return printerMedia.value.filter(m => String(m.id) !== String(cur.id));
});

function isMediaActive(m: MediaDescriptor): boolean {
  if (Math.abs(m.widthMm - media.widthMm) > 0.5) return false;
  return (m.heightMm ?? null) === media.heightMm;
}

function isMediaDetected(m: MediaDescriptor): boolean {
  const det = slot.value?.detectedMedia ?? null;
  if (!det) return false;
  return String(m.id) === String(det.id);
}

function onPrinterMedia(m: MediaDescriptor): void {
  media.pickPrinterMedia(m);
  if (!isMediaDetected(m)) {
    show(t('media.toast.overrodeDetected', { name: m.name }), 'info', { ttlMs: 3000 });
  }
  emit('pick-media');
}

function onCustom(widthMm: number, heightMm: number | null): void {
  media.pickCustom(widthMm, heightMm);
  emit('pick-custom');
}

function onOrientation(o: 'vertical' | 'horizontal'): void {
  if (media.orientation === o) return;
  media.setOrientation(o);
}

const resolvedSheet = computed(() => {
  if (props.kind !== 'sheet') return null;
  const code = printConfig.sheetTemplate?.code ?? media.sheetCode;
  return code ? (findSheet(code) ?? null) : null;
});

const isSheetActive = computed(() => media.source === 'sheet');
const isCustomActive = computed(() => media.source === 'custom');

const customLabel = computed(() => {
  const w = round1(media.widthMm);
  const h = media.heightMm;
  if (h === null) return t('media.format.continuous', { width: w });
  return t('media.format.fixed', { width: w, height: round1(h) });
});

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const labelsPerPage = computed(() => printConfig.labelsPerPage);
</script>

<style scoped>
.paper-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
  margin-top: var(--space-1);
  border-left: 2px solid var(--color-primary);
  background: var(--color-bg-canvas);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.paper-card__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.paper-card__section--meta {
  margin-top: var(--space-1);
}

.paper-card__heading {
  margin: 0 0 var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.paper-card__orientation {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-1);
}

.paper-card__orientation-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: transparent;
  font-size: var(--text-sm);
  color: var(--color-text);
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing);
}

.paper-card__orientation-btn:hover {
  background: var(--color-bg-panel);
}

.paper-card__orientation-btn--active {
  background: var(--color-bg-panel);
  font-weight: var(--weight-medium);
}

.paper-card__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  text-align: left;
  font-size: var(--text-sm);
  color: var(--color-text);
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing);
}

.paper-card__option:hover {
  background: var(--color-bg-panel);
}

.paper-card__option--active {
  background: var(--color-bg-panel);
  border-color: var(--color-border);
  font-weight: var(--weight-medium);
}

.paper-card__option-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.paper-card__option-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: rgba(22, 163, 74, 0.1);
  color: var(--color-success);
  border: 1px solid rgba(22, 163, 74, 0.4);
  font-weight: var(--weight-medium);
}

.paper-card__more {
  appearance: none;
  background: none;
  border: none;
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-primary);
  cursor: pointer;
  text-align: left;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
}

.paper-card__more:hover {
  color: var(--color-primary-hover);
}

.paper-card__sheet-line {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.paper-card__sheet-detail {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.paper-card__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing);
}

.paper-card__btn:hover {
  background: var(--color-bg);
}

.paper-card__note {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.paper-card__note--checked {
  font-variant-numeric: tabular-nums;
}
</style>

import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import type { MediaDescriptor } from '@thermal-label/contracts';
import type { SheetTemplate } from '@burnmark-io/sheet-templates';

import { useDesignerStore } from '@/stores/designer';
import { usePrinterStore } from '@/stores/printer';

/**
 * Per `amendment-canvas-sizing.md` — canvas size and the "where it came
 * from" provenance, surfaced in mm for the user.
 *
 * The document keeps `widthDots`/`heightDots`/`dpi` as canonical (no
 * change to designer-core). mm is recovered for display via
 * `dots × 25.4 / dpi` using the document's stored DPI. Slightly lossy
 * for non-grid-aligned values; the printed output is dot-determined
 * either way.
 *
 * `source`/`sheetCode`/`continuousLengthMm` round-trip via
 * `document.metadata` (designer-core preserves it through
 * `toJSON`/`fromJSON`).
 */

const LAST_SIZE_KEY = 'burnmark.lastLabelSize';
const DEFAULT_DPI = 300;
const DEFAULT_WIDTH_MM = 62;
/** First-visit fallback before localStorage has anything to say. */
const DEFAULT_HEIGHT_MM: number | null = null; // continuous

export type CanvasSource = 'detected' | 'manual' | 'sheet' | 'custom';

interface PersistedSize {
  widthMm: number;
  heightMm: number | null;
  source: CanvasSource;
  sheetCode?: string;
}

function readLastSize(): PersistedSize | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_SIZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSize;
    if (typeof parsed.widthMm !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLastSize(value: PersistedSize): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_SIZE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function dotsFromMm(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / 25.4);
}

export function mmFromDots(dots: number, dpi: number): number {
  return (dots * 25.4) / dpi;
}

/**
 * 4:3 starting ratio per amendment §3.2 — applied when a continuous
 * media is freshly selected. Argument is the across-roll width (the
 * media's intrinsic widthMm), not the canvas's display width.
 */
export function defaultContinuousLength(mediaWidthMm: number): number {
  return Math.round((mediaWidthMm * 4) / 3);
}

export const useMediaStore = defineStore('media', () => {
  const designer = useDesignerStore();
  const printer = usePrinterStore();

  // ---- Derived from the document ----
  const dpi = computed(() => designer.document.canvas.dpi || DEFAULT_DPI);
  const widthDots = computed(() => designer.document.canvas.widthDots);
  const heightDots = computed(() => designer.document.canvas.heightDots);

  /** Across-feed dimension in mm. Always a number. */
  const widthMm = computed(() => mmFromDots(widthDots.value, dpi.value));
  /** Along-feed dimension in mm. `null` ↔ continuous (heightDots === 0). */
  const heightMm = computed<number | null>(() =>
    heightDots.value === 0 ? null : mmFromDots(heightDots.value, dpi.value),
  );
  const isContinuous = computed(() => heightMm.value === null);

  /** Provenance of the current size — see amendment §6.1 for semantics. */
  const source = computed<CanvasSource>(() => {
    const raw = designer.document.metadata?.canvasSource as CanvasSource | undefined;
    return raw ?? 'manual';
  });

  /** Sheet code when `source === 'sheet'`. */
  const sheetCode = computed<string | undefined>(
    () => designer.document.metadata?.canvasSheetCode as string | undefined,
  );

  /**
   * User-set length on continuous canvases (set by drag-to-resize).
   * Lives in metadata so it round-trips. Defaults to 4:3 starting
   * length when undefined; the editor resolves the default at view
   * time so we don't need to write it eagerly.
   */
  const continuousLengthMm = computed<number>(() => {
    const stored = designer.document.metadata?.canvasContinuousLengthMm as number | undefined;
    if (typeof stored === 'number' && Number.isFinite(stored) && stored > 0) return stored;
    return defaultContinuousLength(widthMm.value);
  });

  // ---- Mutators ----

  /**
   * Apply a size to the document — derives dots from mm at the
   * document's current DPI and threads the provenance metadata.
   */
  function applySize(opts: {
    widthMm: number;
    heightMm: number | null;
    source: CanvasSource;
    sheetCode?: string;
    /** Reset the continuous drag length to the default (used on fresh picks). */
    resetContinuousLength?: boolean;
  }): void {
    const widthDotsNext = dotsFromMm(opts.widthMm, dpi.value);
    const heightDotsNext = opts.heightMm === null ? 0 : dotsFromMm(opts.heightMm, dpi.value);

    designer.setCanvas({ widthDots: widthDotsNext, heightDots: heightDotsNext });
    const metaPatch: Record<string, unknown> = {
      canvasSource: opts.source,
      canvasSheetCode: opts.sheetCode,
    };
    if (opts.resetContinuousLength) {
      metaPatch.canvasContinuousLengthMm = undefined;
    }
    designer.setDocumentMetadata(metaPatch);

    writeLastSize({
      widthMm: opts.widthMm,
      heightMm: opts.heightMm,
      source: opts.source,
      sheetCode: opts.sheetCode,
    });
  }

  /** Pick from the hardcoded "Common sizes" list — `source: 'manual'`. */
  function pickCommonSize(widthMmIn: number, heightMmIn: number | null): void {
    applySize({
      widthMm: widthMmIn,
      heightMm: heightMmIn,
      source: 'manual',
      resetContinuousLength: true,
    });
  }

  /** Pick a sticker sheet — extract single-label dimensions. */
  function pickSheet(sheet: SheetTemplate): void {
    applySize({
      widthMm: sheet.labelWidthMm,
      heightMm: sheet.labelHeightMm,
      source: 'sheet',
      sheetCode: sheet.code,
      resetContinuousLength: true,
    });
  }

  /**
   * Free-form custom dimensions. Empty/zero/non-positive height → continuous.
   * No validation beyond positive width — these are the escape hatch.
   */
  function pickCustom(widthMmIn: number, heightMmIn: number | null): void {
    if (!Number.isFinite(widthMmIn) || widthMmIn <= 0) return;
    const h =
      heightMmIn !== null && Number.isFinite(heightMmIn) && heightMmIn > 0 ? heightMmIn : null;
    applySize({
      widthMm: widthMmIn,
      heightMm: h,
      source: 'custom',
      resetContinuousLength: true,
    });
  }

  /** Apply a `MediaDescriptor` from printer auto-detection. */
  function pickDetected(media: MediaDescriptor): void {
    applySize({
      widthMm: media.widthMm,
      heightMm: media.heightMm ?? null,
      source: 'detected',
      resetContinuousLength: true,
    });
  }

  /**
   * Deliberate user pick from the connected printer's media registry.
   *
   * Mirrors `pickCommonSize` for canvas state but **also** writes the
   * full `MediaDescriptor` into `printer.selectedMedia` so the print
   * pipeline (preview, colour-plane split, raster bytes) uses the
   * user's override — driver auto-detection can be wrong (e.g. a
   * DK-22251 two-colour roll reported as DK-22205). Detection becomes
   * a suggestion the user can correct (amendment §2.2 — "rails, not a
   * wall").
   *
   * Source becomes `'manual'`: a future re-detect won't overwrite it.
   */
  function pickPrinterMedia(media: MediaDescriptor): void {
    applySize({
      widthMm: media.widthMm,
      heightMm: media.heightMm ?? null,
      source: 'manual',
      resetContinuousLength: true,
    });
    printer.setSelectedMedia(media);
  }

  /**
   * Drag-to-resize commit on a continuous canvas. Updates the user's
   * manual length without leaving continuous mode (heightDots stays 0,
   * cut line stays visible).
   */
  function setContinuousLength(mm: number): void {
    if (!Number.isFinite(mm) || mm <= 0) return;
    designer.setDocumentMetadata({ canvasContinuousLengthMm: mm });
    writeLastSize({
      widthMm: widthMm.value,
      heightMm: null,
      source: source.value,
      sheetCode: sheetCode.value,
    });
  }

  /**
   * Apply the localStorage last-used size to the current document.
   * Called on app start before the first-visit sample loads. No-ops
   * if nothing is stored.
   */
  function applyLastUsedOrDefault(): void {
    const last = readLastSize();
    if (last) {
      applySize({
        widthMm: last.widthMm,
        heightMm: last.heightMm,
        source: 'detected', // not the user's deliberate pick — auto-resize-on-connect should fire
        sheetCode: last.sheetCode,
        resetContinuousLength: true,
      });
      return;
    }
    applySize({
      widthMm: DEFAULT_WIDTH_MM,
      heightMm: DEFAULT_HEIGHT_MM,
      source: 'detected',
      resetContinuousLength: true,
    });
  }

  // ---- Auto-resize-on-printer-connect ----

  // Watch `printer.detectedMedia`. When it transitions to a non-null
  // value AND `source === 'detected'`, apply it. If `source !== 'detected'`,
  // the user has made a deliberate pick — detection is a suggestion,
  // never a lock (amendment §2.2).
  watch(
    () => printer.detectedMedia,
    media => {
      if (!media) return;
      if (source.value !== 'detected') return;
      // Avoid no-op churn if the detected media already matches.
      if (
        Math.abs(media.widthMm - widthMm.value) < 0.5 &&
        ((media.heightMm ?? null) === heightMm.value ||
          (media.heightMm === undefined && heightMm.value === null))
      ) {
        return;
      }
      pickDetected(media);
    },
  );

  return {
    // State (computed from doc)
    widthMm,
    heightMm,
    widthDots,
    heightDots,
    dpi,
    isContinuous,
    source,
    sheetCode,
    continuousLengthMm,
    // Actions
    pickCommonSize,
    pickSheet,
    pickCustom,
    pickDetected,
    pickPrinterMedia,
    setContinuousLength,
    applyLastUsedOrDefault,
  };
});

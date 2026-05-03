import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import type { MediaDescriptor } from '@thermal-label/contracts';
import type { SheetTemplate } from '@burnmark-io/sheet-templates';

import { useDesignerStore } from '@/stores/designer';
import { usePrinterStore } from '@/stores/printer';
import { useResizeBannerStore } from '@/stores/resizeBanner';

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

export type Orientation = 'vertical' | 'horizontal';

interface PersistedSize {
  widthMm: number;
  heightMm: number | null;
  source: CanvasSource;
  sheetCode?: string;
  orientation?: Orientation;
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

/**
 * Smart default for a media's display orientation, two-tier:
 *
 * 1. Driver-provided `MediaDescriptor.defaultOrientation` (contracts ≥0.2.0)
 *    wins — drivers know what reads naturally for narrow tapes vs.
 *    rectangular die-cut labels.
 * 2. Fallback heuristic for hand-curated sizes (`pickCommonSize` /
 *    `pickCustom` / `pickSheet`) where there's no descriptor:
 *    - Continuous (no heightMm): treat <=19 mm as a tape and default to
 *      horizontal so text reads along the tape; wider rolls stay vertical.
 *    - Die-cut: default vertical when as-tall-or-taller than wide; the
 *      shorter side aligning with the feed feels natural for address-style
 *      labels. Otherwise horizontal.
 */
export function defaultOrientationFor(
  media: MediaDescriptor | { widthMm: number; heightMm?: number | null },
): Orientation {
  if (
    'defaultOrientation' in media &&
    (media.defaultOrientation === 'horizontal' || media.defaultOrientation === 'vertical')
  ) {
    return media.defaultOrientation;
  }
  const widthMm = media.widthMm;
  const heightMm = (media as { heightMm?: number | null }).heightMm ?? null;
  if (heightMm === null) {
    return widthMm <= 19 ? 'horizontal' : 'vertical';
  }
  return heightMm >= widthMm ? 'vertical' : 'horizontal';
}

export const useMediaStore = defineStore('media', () => {
  const designer = useDesignerStore();
  const printer = usePrinterStore();
  const resizeBanner = useResizeBannerStore();

  // ---- Derived from the document ----
  const dpi = computed(() => designer.document.canvas.dpi || DEFAULT_DPI);
  const widthDots = computed(() => designer.document.canvas.widthDots);
  const heightDots = computed(() => designer.document.canvas.heightDots);
  /**
   * Display orientation. Mirrors `document.canvas.orientation`; the
   * `?? 'vertical'` defends against legacy `.label` files written before
   * the field was introduced.
   */
  const orientation = computed<Orientation>(
    () => designer.document.canvas.orientation ?? 'vertical',
  );

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
    /**
     * Display orientation. When omitted, the smart-default helper
     * (`defaultOrientationFor`) picks based on widthMm/heightMm and any
     * driver descriptor passed by the caller.
     */
    orientation?: Orientation;
  }): void {
    const widthDotsNext = dotsFromMm(opts.widthMm, dpi.value);
    const heightDotsNext = opts.heightMm === null ? 0 : dotsFromMm(opts.heightMm, dpi.value);

    designer.setCanvas({ widthDots: widthDotsNext, heightDots: heightDotsNext });
    if (opts.orientation) {
      designer.setOrientation(opts.orientation);
    }
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
      orientation: opts.orientation ?? orientation.value,
    });
  }

  /**
   * Toggle the canvas orientation without changing media size. Mirrors
   * the new orientation into the persisted last-used record so it
   * survives a reload.
   */
  function setOrientation(o: Orientation): void {
    designer.setOrientation(o);
    writeLastSize({
      widthMm: widthMm.value,
      heightMm: heightMm.value,
      source: source.value,
      sheetCode: sheetCode.value,
      orientation: o,
    });
  }

  /** Pick from the hardcoded "Common sizes" list — `source: 'manual'`. */
  function pickCommonSize(widthMmIn: number, heightMmIn: number | null): void {
    applySize({
      widthMm: widthMmIn,
      heightMm: heightMmIn,
      source: 'manual',
      resetContinuousLength: true,
      orientation: defaultOrientationFor({ widthMm: widthMmIn, heightMm: heightMmIn }),
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
      orientation: defaultOrientationFor({
        widthMm: sheet.labelWidthMm,
        heightMm: sheet.labelHeightMm,
      }),
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
      orientation: defaultOrientationFor({ widthMm: widthMmIn, heightMm: h }),
    });
  }

  /** Apply a `MediaDescriptor` from printer auto-detection. */
  function pickDetected(media: MediaDescriptor): void {
    applySize({
      widthMm: media.widthMm,
      heightMm: media.heightMm ?? null,
      source: 'detected',
      resetContinuousLength: true,
      orientation: defaultOrientationFor(media),
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
      orientation: defaultOrientationFor(media),
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
      orientation: orientation.value,
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
        orientation:
          last.orientation ??
          defaultOrientationFor({ widthMm: last.widthMm, heightMm: last.heightMm }),
      });
      return;
    }
    // First-visit fallback (no localStorage). Source 'custom' so the
    // PDF-render synth in print-config kicks in immediately — a fresh
    // visitor can hit Print on the demo label and get a PDF without
    // having to set up a printer or pick a sheet first. Rails not
    // walls. The auto-adopt-on-printer-connect watch below is gated
    // on canUndo, not source, so this doesn't break the upgrade path
    // when the user later pairs a printer.
    applySize({
      widthMm: DEFAULT_WIDTH_MM,
      heightMm: DEFAULT_HEIGHT_MM,
      source: 'custom',
      resetContinuousLength: true,
      orientation: defaultOrientationFor({
        widthMm: DEFAULT_WIDTH_MM,
        heightMm: DEFAULT_HEIGHT_MM,
      }),
    });
  }

  // ---- Auto-resize-on-printer-connect / paper-roll-change ----
  //
  // Watch `printer.detectedMedia`. When it transitions to a non-null
  // value, route through the canUndo-based gate from
  // `amendment-printer-status-polling.md §4.5.1`:
  //   - canvas untouched (`!canUndo` OR `objects.length === 0`) →
  //     silent `pickDetected`. Demo content has `canUndo === false`
  //     after the first-visit `clearHistory` call, so it counts as
  //     untouched.
  //   - canvas touched → surface the adopt-confirmation banner instead
  //     of swapping the user's work; they click [Use this size] when
  //     they actually want the change.
  //
  // This rule supersedes the older `source === 'detected'` gate from
  // `amendment-canvas-sizing.md §2.2`. A user with stale
  // `source: 'manual'` from a previous session, who hasn't started
  // designing yet, now correctly auto-adopts the new printer's media.
  watch(
    () => printer.detectedMedia,
    detected => {
      if (!detected) return;
      // Avoid no-op churn when detection just confirms the current size.
      if (
        Math.abs(detected.widthMm - widthMm.value) < 0.5 &&
        ((detected.heightMm ?? null) === heightMm.value ||
          (detected.heightMm === undefined && heightMm.value === null))
      ) {
        return;
      }
      const touched = designer.canUndo && designer.document.objects.length > 0;
      if (touched) {
        // The connected printer's model is the friendliest user-facing
        // label we have for the banner.
        const printerName = printer.model ?? '';
        resizeBanner.showAdopt({ media: detected, printerName });
        return;
      }
      pickDetected(detected);
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
    orientation,
    // Actions
    pickCommonSize,
    pickSheet,
    pickCustom,
    pickDetected,
    pickPrinterMedia,
    setContinuousLength,
    setOrientation,
    applyLastUsedOrDefault,
  };
});

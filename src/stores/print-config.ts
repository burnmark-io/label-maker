import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { findSheet, type SheetTemplate } from '@burnmark-io/sheet-templates';
import { useDataStore } from './data';
import { useDesignerStore } from './designer';
import { useMediaStore } from './media';
import { usePrinterStore } from './printer';

export type PrintDensity = 'light' | 'normal' | 'dark';

/** Output destination — where the rendered labels go. */
export type PrintDestination = 'thermal' | 'sheet';

const SHEET_TEMPLATE_KEY = 'burnmark.sheetTemplate';

/**
 * Source selector for output operations. When a dataset is loaded, every
 * output surface (Print popup, Output tab Print + Save-as-file) honours
 * this same selection. `range` is 1-indexed and inclusive.
 */
export type OutputSelection =
  | { kind: 'active' }
  | { kind: 'all' }
  | { kind: 'range'; from: number; to: number };

const DEFAULT_NO_DATA: OutputSelection = { kind: 'active' };
const DEFAULT_WITH_DATA: OutputSelection = { kind: 'all' };

/**
 * Shared print configuration. Both the central toolbar Print popup and the
 * Output tab's Print section read/write here so the two surfaces stay in
 * lock-step. Separate from `printer.ts` (connection / status / model).
 *
 * `OutputSelection` lives per document, session-only — reopening the same
 * document within a session restores the user's choice; a fresh session
 * resets to default ("all" when a dataset is loaded, "active" otherwise).
 */
export const usePrintConfigStore = defineStore('print-config', () => {
  const data = useDataStore();
  const designer = useDesignerStore();
  const printer = usePrinterStore();
  const media = useMediaStore();

  const copies = ref<number>(1);
  const density = ref<PrintDensity>('normal');

  // PrintDestination — session-only. Default-on-load is derived from
  // connection state by the consumer (CanvasActions / PrintSection); we
  // just hold the user's explicit choice here.
  const destination = ref<PrintDestination>('thermal');

  // Sheet template resolution is a three-step chain:
  //   1. Per-document override — set when the user explicitly picks a
  //      sheet via the Print popup that diverges from the canvas sheet.
  //      Session-only, keyed by document id.
  //   2. The document's canvas sheet (`media.sheetCode`) — when the user
  //      designed the label *for* a specific sheet, that's the natural
  //      output target.
  //   3. Global last-picked, persisted to localStorage. Acts as the
  //      seed for fresh documents that have no canvas sheet (custom or
  //      detected canvas source).
  // The topbar's sheet picker writes #2 (and clears #1 + bumps #3); the
  // Print popup's "change" link writes #1 + #3, leaving the canvas
  // alone. Either way the user can pick once and both surfaces stay in
  // sync.
  const overrideByDoc = ref<Map<string, string>>(new Map());
  const globalSheetCode = ref<string | null>(loadSheetTemplateCode());

  const sheetTemplate = computed<SheetTemplate | null>(() => {
    // Custom canvas → synthesize a 1-up sheet at the canvas dims. The
    // user explicitly picked "custom" from the PDF row's expanded card:
    // PDF output, no template, single label per page. With a dataset
    // loaded, `renderSheet` produces N pages automatically — same
    // plumbing as a real sheet, just 1×1 layout. Wins over
    // override/canvas/global because explicit user intent.
    if (media.source === 'custom') {
      return synthesizeCustomSheet(media.widthMm, media.heightMm, media.continuousLengthMm);
    }
    // Explicit user picks: per-doc override, then canvas-baked sheet.
    const docId = designer.document?.id ?? null;
    if (docId) {
      const override = overrideByDoc.value.get(docId);
      if (override) {
        const resolved = findSheet(override);
        if (resolved) return resolved;
      }
    }
    const canvasCode = media.sheetCode;
    if (canvasCode) {
      const resolved = findSheet(canvasCode);
      if (resolved) return resolved;
    }
    if (globalSheetCode.value) {
      return findSheet(globalSheetCode.value) ?? null;
    }
    // Fallback synth: only when there's no printer connected. Lets a
    // setup-less user (first-visit demo, returning user with no
    // printer paired yet) hit Print and get a PDF without having to
    // pick a sheet first — rails not walls. We deliberately don't
    // synth when a printer IS connected: that user has thermal as a
    // viable target, and surfacing a "Sheet: Custom · 62×40mm" toggle
    // they didn't ask for would be noise.
    if (!printer.isConnected) {
      return synthesizeCustomSheet(media.widthMm, media.heightMm, media.continuousLengthMm);
    }
    return null;
  });

  /**
   * True when the resolved sheet template diverges from the canvas
   * sheet — i.e., the user has explicitly overridden output to a
   * different sheet than the one the canvas is sized for. Useful for
   * surfacing a "(override)" hint near the change link.
   */
  const sheetOverrideActive = computed<boolean>(() => {
    const docId = designer.document?.id ?? null;
    if (!docId) return false;
    const override = overrideByDoc.value.get(docId);
    if (!override) return false;
    return override !== media.sheetCode;
  });

  // §3.2 destination capability + visibility.
  const thermalPossible = computed<boolean>(() => printer.isConnected);
  const sheetPossible = computed<boolean>(() => sheetTemplate.value !== null);
  const showDestinationToggle = computed<boolean>(
    () => thermalPossible.value && sheetPossible.value,
  );

  /**
   * The destination output should actually go to. Honours the user's
   * stated preference when possible; otherwise falls back to whatever
   * is available. When neither is available the value falls back to
   * `thermal` — in that state the consumer should render a first-run
   * setup CTA, not a Print button (§3.4).
   */
  const effectiveDestination = computed<PrintDestination>(() => {
    const d = destination.value;
    if (d === 'thermal' && !thermalPossible.value) {
      return sheetPossible.value ? 'sheet' : 'thermal';
    }
    if (d === 'sheet' && !sheetPossible.value) {
      return thermalPossible.value ? 'thermal' : 'sheet';
    }
    return d;
  });

  /**
   * Print-popup picker. Writes the per-document override and bumps the
   * global last-picked. Does NOT touch the canvas — the user wants to
   * print onto a different sheet than the one they designed for.
   */
  function setSheetTemplate(template: SheetTemplate | string | null): void {
    const code = template == null ? null : typeof template === 'string' ? template : template.code;
    const docId = designer.document?.id ?? null;
    if (docId) {
      const next = new Map(overrideByDoc.value);
      if (code) next.set(docId, code);
      else next.delete(docId);
      overrideByDoc.value = next;
    }
    globalSheetCode.value = code;
    saveSheetTemplateCode(code);
  }

  /**
   * Topbar / canvas picker. The user picked a sheet to design for, so
   * the canvas already resized via `media.pickSheet`. Drop any per-
   * document output override (canvas now matches what the user wants
   * to print onto) and bump the global last-picked so fresh documents
   * inherit this choice.
   */
  function recordCanvasSheetPick(template: SheetTemplate | string): void {
    const code = typeof template === 'string' ? template : template.code;
    const docId = designer.document?.id ?? null;
    if (docId && overrideByDoc.value.has(docId)) {
      const next = new Map(overrideByDoc.value);
      next.delete(docId);
      overrideByDoc.value = next;
    }
    globalSheetCode.value = code;
    saveSheetTemplateCode(code);
  }

  const selectionByDoc = ref<Map<string, OutputSelection>>(new Map());

  const currentDocId = computed<string | null>(() => designer.document?.id ?? null);

  const outputSelection = computed<OutputSelection>(() => {
    const id = currentDocId.value;
    const fallback = data.rows.length > 0 ? DEFAULT_WITH_DATA : DEFAULT_NO_DATA;
    if (!id) return fallback;
    return selectionByDoc.value.get(id) ?? fallback;
  });

  function setOutputSelection(sel: OutputSelection): void {
    const id = currentDocId.value;
    if (!id) return;
    const next = new Map(selectionByDoc.value);
    next.set(id, sel);
    selectionByDoc.value = next;
  }

  function clearSelectionFor(docId: string): void {
    if (!selectionByDoc.value.has(docId)) return;
    const next = new Map(selectionByDoc.value);
    next.delete(docId);
    selectionByDoc.value = next;
  }

  /**
   * Resolve the selection against the current dataset, clamping range
   * bounds and falling back to `active` when the dataset becomes empty
   * or the range collapses. Called via the watch below whenever the
   * dataset row count changes; safe to call manually too.
   */
  function reconcileForRowCount(rowsLength: number): void {
    const id = currentDocId.value;
    if (!id) return;
    const existing = selectionByDoc.value.get(id);
    if (!existing) {
      // Default-on-dataset-load: empty → loaded transitions become "all".
      if (rowsLength > 0) setOutputSelection({ kind: 'all' });
      return;
    }
    if (rowsLength === 0) {
      setOutputSelection({ kind: 'active' });
      return;
    }
    if (existing.kind === 'range') {
      const clampedFrom = Math.min(Math.max(1, existing.from), rowsLength);
      const clampedTo = Math.min(Math.max(clampedFrom, existing.to), rowsLength);
      if (clampedFrom !== existing.from || clampedTo !== existing.to) {
        setOutputSelection({ kind: 'range', from: clampedFrom, to: clampedTo });
      }
    }
  }

  watch(
    () => data.rows.length,
    rowCount => reconcileForRowCount(rowCount),
  );

  // ---- Derived selectors ---------------------------------------------

  /**
   * Indices (0-based) of the rows that an output operation should iterate
   * for the current selection. Returns an empty array when no dataset is
   * loaded — output paths fall back to single-label behaviour in that case.
   */
  const rowsForSelection = computed<number[]>(() => {
    const rows = data.rows;
    if (rows.length === 0) return [];
    const sel = outputSelection.value;
    switch (sel.kind) {
      case 'all':
        return rows.map((_, i) => i);
      case 'range': {
        const from = Math.max(1, sel.from) - 1;
        const to = Math.min(rows.length, sel.to) - 1;
        if (from > to) return [];
        const out: number[] = [];
        for (let i = from; i <= to; i += 1) out.push(i);
        return out;
      }
      case 'active':
      default: {
        const idx = Math.min(Math.max(0, data.currentIndex), rows.length - 1);
        return [idx];
      }
    }
  });

  /** Number of label outputs for the current configuration. */
  const count = computed<number>(() => {
    const rowMultiplier = data.rows.length === 0 ? 1 : rowsForSelection.value.length;
    return rowMultiplier * Math.max(1, copies.value);
  });

  /**
   * Labels-per-page on the configured sheet template (sum across
   * multi-layout sheets). Returns 1 when no template is set so consumers
   * can safely divide.
   */
  const labelsPerPage = computed<number>(() => {
    const sheet = sheetTemplate.value;
    if (!sheet) return 1;
    return Math.max(
      1,
      sheet.layouts.reduce((sum, layout) => sum + layout.columns * layout.rows, 0),
    );
  });

  /** Page count for sheet destination — `ceil(count / labelsPerPage)`. */
  const pageCount = computed<number>(() =>
    Math.max(1, Math.ceil(count.value / labelsPerPage.value)),
  );

  return {
    copies,
    density,
    destination,
    effectiveDestination,
    thermalPossible,
    sheetPossible,
    showDestinationToggle,
    sheetTemplate,
    sheetOverrideActive,
    setSheetTemplate,
    recordCanvasSheetPick,
    outputSelection,
    setOutputSelection,
    clearSelectionFor,
    reconcileForRowCount,
    rowsForSelection,
    count,
    labelsPerPage,
    pageCount,
  };
});

/**
 * Build a one-label-per-page SheetTemplate at the given dims. Used as
 * the canvas's effective sheet when `media.source === 'custom'`.
 *
 * Continuous canvases (no fixed height) take the canvas's
 * `continuousLengthMm` as the page height — same length the user sees
 * on the canvas, so the printed PDF page matches.
 *
 * The synthesized template is computed on every read; do not persist
 * it. `code: '__custom__'` is a sentinel — `findSheet` will not
 * resolve it, so any code path that round-trips through localStorage
 * fails closed.
 */
function synthesizeCustomSheet(
  widthMm: number,
  heightMm: number | null,
  continuousLengthMm: number,
): SheetTemplate {
  const w = Math.max(1, widthMm);
  const h = heightMm !== null && heightMm > 0 ? heightMm : continuousLengthMm;
  const round1 = (n: number): number => Math.round(n * 10) / 10;
  return {
    code: '__custom__',
    name: 'Custom',
    brand: 'Custom',
    part: `${round1(w)}×${round1(h)}mm`,
    paperSize: 'Custom',
    paperWidthMm: w,
    paperHeightMm: h,
    labelWidthMm: w,
    labelHeightMm: h,
    labelShape: 'rectangle',
    layouts: [{ columns: 1, rows: 1, originXMm: 0, originYMm: 0, pitchXMm: 0, pitchYMm: 0 }],
    marginMm: 0,
  };
}

function loadSheetTemplateCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SHEET_TEMPLATE_KEY);
  } catch {
    return null;
  }
}

function saveSheetTemplateCode(code: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (code == null) {
      window.localStorage.removeItem(SHEET_TEMPLATE_KEY);
    } else {
      window.localStorage.setItem(SHEET_TEMPLATE_KEY, code);
    }
  } catch {
    /* localStorage unavailable / quota — degrade silently */
  }
}

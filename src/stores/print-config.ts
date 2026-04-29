import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { findSheet, type SheetTemplate } from '@burnmark-io/sheet-templates';
import { useDataStore } from './data';
import { useDesignerStore } from './designer';

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

  const copies = ref<number>(1);
  const density = ref<PrintDensity>('normal');

  // PrintDestination — session-only. Default-on-load is derived from
  // connection state by the consumer (CanvasActions / PrintSection); we
  // just hold the user's explicit choice here.
  const destination = ref<PrintDestination>('thermal');

  // Sheet template code — persisted globally to localStorage. Last-picked
  // wins, same model as the connected thermal printer ("the printer"
  // until explicitly changed). Stored as the `code`; the resolved
  // `SheetTemplate` is exposed via `sheetTemplate`.
  const sheetTemplateCode = ref<string | null>(loadSheetTemplateCode());

  const sheetTemplate = computed<SheetTemplate | null>(() => {
    const code = sheetTemplateCode.value;
    if (!code) return null;
    return findSheet(code) ?? null;
  });

  function setSheetTemplate(template: SheetTemplate | string | null): void {
    if (template == null) {
      sheetTemplateCode.value = null;
      saveSheetTemplateCode(null);
      return;
    }
    const code = typeof template === 'string' ? template : template.code;
    sheetTemplateCode.value = code;
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

  return {
    copies,
    density,
    destination,
    sheetTemplate,
    setSheetTemplate,
    outputSelection,
    setOutputSelection,
    clearSelectionFor,
    reconcileForRowCount,
    rowsForSelection,
    count,
  };
});

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

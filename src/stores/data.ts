import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import {
  applyMappingToRow,
  autoMapColumns,
  loadMapping,
  saveMapping,
  templateKeyFromPlaceholders,
} from '@/services/column-mapper';
import { useDesignerStore } from './designer';

/**
 * Maximum rows the app will keep from an import. Anything beyond this is
 * silently dropped — the UI surfaces a banner ("showing first 30 rows").
 * No mention of paid tiers; the limit is a friendly conversation hook.
 */
export const ROW_LIMIT = 30;

export type ImportSource = 'csv' | 'xlsx' | 'tsv';

export interface ImportSummary {
  source: ImportSource;
  fileName: string;
  totalRowsInFile: number;
}

/**
 * Data store — owns the imported rows, the column-to-placeholder mapping,
 * and the "currently previewed row" index that drives the substitution
 * preview in the canvas.
 */
export const useDataStore = defineStore('data', () => {
  const designer = useDesignerStore();

  const headers = ref<string[]>([]);
  const rows = ref<Record<string, string>[]>([]);
  const mapping = ref<Record<string, string>>({});
  const lastImport = ref<ImportSummary | null>(null);
  const currentIndex = ref(0);
  const previewEnabled = ref(true);

  /** Placeholders referenced by the live document (lower-cased). */
  const placeholders = computed<string[]>(() => designer.getPlaceholders());

  const limited = computed(() =>
    lastImport.value ? lastImport.value.totalRowsInFile > ROW_LIMIT : false,
  );

  /** Variables for the currently previewed row, ready for `applyVariables`. */
  const currentVariables = computed<Record<string, string>>(() => {
    if (!previewEnabled.value || rows.value.length === 0) return {};
    const idx = Math.min(currentIndex.value, rows.value.length - 1);
    const row = rows.value[idx];
    if (!row) return {};
    if (Object.keys(mapping.value).length === 0) {
      // No mapping yet — fall back to identity (case-insensitive).
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) out[k.toLowerCase()] = String(v ?? '');
      return out;
    }
    return applyMappingToRow(row, mapping.value);
  });

  const hasData = computed(() => rows.value.length > 0);

  function clear(): void {
    headers.value = [];
    rows.value = [];
    mapping.value = {};
    lastImport.value = null;
    currentIndex.value = 0;
  }

  function setData(
    nextHeaders: string[],
    nextRows: Record<string, string>[],
    summary: ImportSummary,
  ): void {
    headers.value = nextHeaders;
    rows.value = nextRows.slice(0, ROW_LIMIT);
    lastImport.value = summary;
    currentIndex.value = 0;

    const key = templateKeyFromPlaceholders(placeholders.value);
    const remembered = key ? loadMapping(key) : null;
    if (remembered && Object.keys(remembered).length > 0) {
      // Filter remembered columns to those present in this file.
      const filtered: Record<string, string> = {};
      for (const [ph, col] of Object.entries(remembered)) {
        if (nextHeaders.includes(col)) filtered[ph] = col;
      }
      // Fill unmapped placeholders from auto-map to be helpful.
      const auto = autoMapColumns(nextHeaders, placeholders.value);
      mapping.value = { ...auto.mapping, ...filtered };
    } else {
      const auto = autoMapColumns(nextHeaders, placeholders.value);
      mapping.value = auto.mapping;
    }
  }

  function setMapping(next: Record<string, string>): void {
    mapping.value = { ...next };
    persistMapping();
  }

  function setColumnFor(placeholder: string, column: string | null): void {
    const key = placeholder.toLowerCase();
    const next = { ...mapping.value };
    if (column === null || column === '') {
      delete next[key];
    } else {
      next[key] = column;
    }
    mapping.value = next;
    persistMapping();
  }

  function persistMapping(): void {
    const key = templateKeyFromPlaceholders(placeholders.value);
    if (!key) return;
    saveMapping(key, mapping.value);
  }

  function step(delta: number): void {
    if (rows.value.length === 0) return;
    const next = (currentIndex.value + delta + rows.value.length) % rows.value.length;
    currentIndex.value = next;
  }

  function setIndex(idx: number): void {
    if (rows.value.length === 0) return;
    currentIndex.value = Math.max(0, Math.min(idx, rows.value.length - 1));
  }

  function togglePreview(): void {
    previewEnabled.value = !previewEnabled.value;
  }

  // When placeholders change (user edits the design), re-run auto-map
  // for any new ones. Existing manual choices are preserved.
  watch(placeholders, next => {
    if (rows.value.length === 0) return;
    const auto = autoMapColumns(headers.value, next);
    const merged: Record<string, string> = { ...auto.mapping };
    for (const ph of next) {
      const key = ph.toLowerCase();
      if (mapping.value[key]) merged[key] = mapping.value[key];
    }
    mapping.value = merged;
  });

  return {
    headers,
    rows,
    mapping,
    lastImport,
    currentIndex,
    previewEnabled,
    placeholders,
    limited,
    hasData,
    currentVariables,
    ROW_LIMIT,
    clear,
    setData,
    setMapping,
    setColumnFor,
    step,
    setIndex,
    togglePreview,
  };
});

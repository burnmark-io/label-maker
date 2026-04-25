import { ref, type Ref } from 'vue';
import { parseCsv, type CsvData } from '@burnmark-io/designer-core';
import { useDataStore, type ImportSource } from '@/stores/data';
import { usePreferencesStore } from '@/stores/preferences';

/**
 * File import — CSV/TSV via designer-core's papaparse wrapper, XLSX/XLS
 * via SheetJS (lazy-imported so the bundle stays slim when the user
 * never opens the Data panel).
 *
 * Parsing is decoupled from routing: the composable parses the file,
 * then decides where the rows should land based on the active set and
 * the user's `csvImportBehavior` preference (D32). Callers can supply
 * an `onAsk` handler to defer the choice to a UI dialog (Phase D wires
 * the dialog; without it, `'ask'` falls back to creating a new set).
 */
export interface ImportError {
  message: string;
  fileName?: string;
}

export type ImportDecision = { kind: 'append' } | { kind: 'new' } | { kind: 'cancel' };

export interface ImportRouteContext {
  source: ImportSource;
  fileName: string;
  parsed: CsvData;
  activeName: string;
}

function detectSource(fileName: string): ImportSource | null {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'tsv') return 'tsv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return null;
}

async function parseExcel(file: File): Promise<CsvData> {
  const xlsx = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = xlsx.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [], rowCount: 0 };
  }
  const sheet = wb.Sheets[firstSheetName];
  // Force every cell to a string so the merged shape matches CsvData.
  const aoa = xlsx.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  if (aoa.length === 0) return { headers: [], rows: [], rowCount: 0 };
  const headers = (aoa[0] as unknown[]).map(cell => String(cell ?? '').trim());
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < aoa.length; r += 1) {
    const row = aoa[r] as unknown[];
    if (!row || row.every(cell => cell === '' || cell === null || cell === undefined)) continue;
    const record: Record<string, string> = {};
    let hasContent = false;
    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c];
      const value = row[c] === undefined || row[c] === null ? '' : String(row[c]);
      if (key) record[key] = value;
      if (value !== '') hasContent = true;
    }
    if (hasContent) rows.push(record);
  }
  return { headers, rows, rowCount: rows.length };
}

export interface UseCsvImportOptions {
  /**
   * Hook for the `'ask'` branch — invoked when the active set already
   * has rows and the user hasn't picked a "remember this choice" yet.
   * Returns the user's choice. If omitted, `'ask'` silently defaults to
   * creating a new dataset.
   */
  onAsk?: (ctx: ImportRouteContext) => Promise<ImportDecision> | ImportDecision;
  /**
   * Hook for confirming the eviction of a `source: 'manual'` dataset
   * when the pool is at the cap. Returning `false` aborts the import
   * with no rows touched. Without a hook, manual sets are evicted
   * silently — match the production wiring (DataPanel) to avoid that.
   */
  onEvictManual?: (name: string) => Promise<boolean> | boolean;
}

export function useCsvImport(options: UseCsvImportOptions = {}): {
  isImporting: Ref<boolean>;
  error: Ref<ImportError | null>;
  importFile: (file: File) => Promise<void>;
  importFiles: (files: FileList | File[] | null) => Promise<void>;
} {
  const data = useDataStore();
  const prefs = usePreferencesStore();
  const isImporting = ref(false);
  const error = ref<ImportError | null>(null);

  async function importFile(file: File): Promise<void> {
    isImporting.value = true;
    error.value = null;
    try {
      const source = detectSource(file.name);
      if (!source) {
        throw new Error('Unsupported file. Use a .csv, .tsv, .xlsx or .xls file.');
      }
      let parsed: CsvData;
      if (source === 'xlsx') {
        parsed = await parseExcel(file);
      } else {
        parsed = await parseCsv(file);
      }
      if (parsed.headers.length === 0) {
        throw new Error('No columns detected. Make sure the first row contains headers.');
      }

      const active = data.activeDataset;
      const activeIsEmpty = !active || active.rows.length === 0;

      // If creating a new dataset would evict a manual set, surface the
      // confirm before the parser-side mutation. Append doesn't trigger
      // eviction (we're modifying the active set in place).
      async function confirmManualEvictionIfNeeded(): Promise<boolean> {
        const victim = data.peekEvictionVictim();
        if (!victim || victim.source !== 'manual') return true;
        if (!options.onEvictManual) return true;
        return await options.onEvictManual(victim.name);
      }

      if (activeIsEmpty) {
        if (!(await confirmManualEvictionIfNeeded())) return;
        const created = data.createDataset({
          source,
          fileName: file.name,
          headers: parsed.headers,
          rows: parsed.rows,
          totalRowsInFile: parsed.rowCount,
          name: file.name,
        });
        if (created) data.setActiveDataset(created.id);
        return;
      }

      let decision: ImportDecision;
      if (prefs.csvImportBehavior === 'append') {
        decision = { kind: 'append' };
      } else if (prefs.csvImportBehavior === 'new') {
        decision = { kind: 'new' };
      } else if (options.onAsk) {
        decision = await options.onAsk({
          source,
          fileName: file.name,
          parsed,
          activeName: active!.name,
        });
      } else {
        // No dialog wired yet (Phase C without Phase D's dialog) —
        // safer to start a fresh set than to silently mash data into
        // the active one.
        decision = { kind: 'new' };
      }

      if (decision.kind === 'cancel') return;
      if (decision.kind === 'append') {
        data.appendRowsToActive(parsed.headers, parsed.rows, {
          source,
          fileName: file.name,
          totalRowsInFile: parsed.rowCount,
        });
        return;
      }
      if (!(await confirmManualEvictionIfNeeded())) return;
      const created = data.createDataset({
        source,
        fileName: file.name,
        headers: parsed.headers,
        rows: parsed.rows,
        totalRowsInFile: parsed.rowCount,
        name: file.name,
      });
      if (created) data.setActiveDataset(created.id);
    } catch (err) {
      error.value = {
        message: err instanceof Error ? err.message : String(err),
        fileName: file.name,
      };
    } finally {
      isImporting.value = false;
    }
  }

  async function importFiles(files: FileList | File[] | null): Promise<void> {
    if (!files) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    // Only import the first file — multi-file batch import is out of scope.
    await importFile(list[0]);
  }

  return { isImporting, error, importFile, importFiles };
}

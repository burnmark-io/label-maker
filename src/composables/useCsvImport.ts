import { ref, type Ref } from 'vue';
import { parseCsv, type CsvData } from '@burnmark-io/designer-core';
import { useDataStore, type ImportSource } from '@/stores/data';

/**
 * File import — CSV/TSV via designer-core's papaparse wrapper, XLSX/XLS
 * via SheetJS (lazy-imported so the bundle stays slim when the user
 * never opens the Data panel).
 */
export interface ImportError {
  message: string;
  fileName?: string;
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
  const headers = (aoa[0] as unknown[]).map((cell) => String(cell ?? '').trim());
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < aoa.length; r += 1) {
    const row = aoa[r] as unknown[];
    if (!row || row.every((cell) => cell === '' || cell === null || cell === undefined)) continue;
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

export function useCsvImport(): {
  isImporting: Ref<boolean>;
  error: Ref<ImportError | null>;
  importFile: (file: File) => Promise<void>;
  importFiles: (files: FileList | File[] | null) => Promise<void>;
} {
  const data = useDataStore();
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
      data.setData(parsed.headers, parsed.rows, {
        source,
        fileName: file.name,
        totalRowsInFile: parsed.rowCount,
      });
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

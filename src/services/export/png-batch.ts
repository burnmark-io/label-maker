import JSZip from 'jszip';
import { applyMappingToRow } from '@/services/column-mapper';

interface DesignerLike {
  exportPng(variables?: Record<string, string>): Promise<Blob>;
}

interface BatchPngResult {
  /** The resulting blob — a `.zip` when multiple PNGs, a single `.png` when one. */
  blob: Blob;
  /** True when the result is a zip; false when a single PNG. */
  zipped: boolean;
  /** Number of label PNGs produced. */
  count: number;
  /** Per-row errors, keyed by 0-based row index in the input `rows` array. */
  errors: Map<number, string>;
}

/**
 * Multi-row PNG export. Calls `exportPng` once per mapped row and
 * packages the results — single PNG when the input is one row, a zip
 * of `<base>-001.png` … `<base>-NNN.png` otherwise. Per-row render
 * errors are collected and reported back to the caller; rendering
 * continues for surviving rows so a single bad placeholder doesn't
 * tank the batch.
 */
export async function exportPngBatch(
  designer: DesignerLike,
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  baseName: string,
): Promise<BatchPngResult> {
  const errors = new Map<number, string>();

  if (rows.length === 0) {
    const blob = await designer.exportPng();
    return { blob, zipped: false, count: 1, errors };
  }

  if (rows.length === 1) {
    const variables = applyMappingToRow(rows[0]!, mapping);
    const blob = await designer.exportPng(variables);
    return { blob, zipped: false, count: 1, errors };
  }

  const zip = new JSZip();
  const padWidth = String(rows.length).length;
  let produced = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const variables = applyMappingToRow(rows[i]!, mapping);
    try {
      const blob = await designer.exportPng(variables);
      const fileName = `${baseName}-${String(i + 1).padStart(padWidth, '0')}.png`;
      zip.file(fileName, blob);
      produced += 1;
    } catch (err) {
      errors.set(i, err instanceof Error ? err.message : String(err));
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, zipped: true, count: produced, errors };
}

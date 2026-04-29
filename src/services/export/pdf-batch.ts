import { applyMappingToRow } from '@/services/column-mapper';

interface DesignerLike {
  exportPdf(rows?: Record<string, string>[]): Promise<Blob>;
}

/**
 * Multi-row PDF export. The designer-core PDF exporter already produces
 * an N-page document when given an array of row variables — this helper
 * just maps the dataset rows through the column mapping before handing
 * them off, so the placeholder substitution lines up with the user's
 * column choices.
 */
export async function exportPdfBatch(
  designer: DesignerLike,
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Promise<Blob> {
  if (rows.length === 0) {
    return designer.exportPdf();
  }
  const mapped = rows.map(row => applyMappingToRow(row, mapping));
  return designer.exportPdf(mapped);
}

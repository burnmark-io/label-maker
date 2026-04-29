import type { SheetTemplate } from '@burnmark-io/sheet-templates';
import { applyMappingToRow } from '@/services/column-mapper';

interface DesignerLike {
  exportSheet(sheet: SheetTemplate, rows?: Record<string, string>[]): Promise<Blob>;
}

interface SheetRenderInput {
  sheet: SheetTemplate;
  /** Selected source rows from the dataset (in row-major order). Empty when no dataset. */
  rows: Record<string, string>[];
  /** Column-mapping for placeholder substitution. */
  mapping: Record<string, string>;
  /** Number of copies of each row (or of the active label when no dataset). */
  copies: number;
}

interface SheetRenderResult {
  blob: Blob;
  /** Total label slots filled. */
  totalLabels: number;
  /** Number of pages produced. */
  pageCount: number;
  /** Slots per page on the chosen template. */
  labelsPerPage: number;
  /** Empty slots on the last page (0 when the math is even). */
  emptyOnLastPage: number;
}

/** labelsPerPage from a sheet template — sum across multi-layout sheets. */
function labelsPerPageFromSheet(sheet: SheetTemplate): number {
  return sheet.layouts.reduce((sum, layout) => sum + layout.columns * layout.rows, 0);
}

/**
 * Render the configured sheet template with the selected rows × copies.
 * Pack tight (row 1 copy 1, row 1 copy 2, …, row 2 copy 1, …) and let
 * the last page carry empty slots if the math doesn't divide evenly —
 * silently duplicating user data to fill them is a footgun.
 */
export async function renderSheet(
  designer: DesignerLike,
  input: SheetRenderInput,
): Promise<SheetRenderResult> {
  const copies = Math.max(1, input.copies);
  const labelsPerPage = labelsPerPageFromSheet(input.sheet);

  let expanded: Record<string, string>[];
  if (input.rows.length === 0) {
    // No dataset: render `copies` copies of the active label using empty
    // variables — designer-core falls back to the label's literal text.
    expanded = Array.from({ length: copies }, () => ({}));
  } else {
    // Row-major: row 1 × copies, row 2 × copies, …
    expanded = [];
    for (const row of input.rows) {
      const mapped = applyMappingToRow(row, input.mapping);
      for (let i = 0; i < copies; i += 1) {
        expanded.push(mapped);
      }
    }
  }

  const blob = await designer.exportSheet(input.sheet, expanded);
  const totalLabels = expanded.length;
  const pageCount = Math.max(1, Math.ceil(totalLabels / Math.max(1, labelsPerPage)));
  const emptyOnLastPage =
    pageCount * labelsPerPage > totalLabels ? pageCount * labelsPerPage - totalLabels : 0;

  return {
    blob,
    totalLabels,
    pageCount,
    labelsPerPage,
    emptyOnLastPage,
  };
}

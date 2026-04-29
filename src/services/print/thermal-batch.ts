import { renderBatch, type BatchResult } from '@burnmark-io/designer-core';
import type { RawImageData, PrintOptions } from '@thermal-label/contracts';
import type { PrintDensity } from '@/stores/print-config';

interface DesignerLike {
  designer: unknown;
}

interface PrinterLike {
  print(image: RawImageData, options?: PrintOptions): Promise<void>;
}

export interface BatchProgress {
  /** 0-based row index in the input rows array. */
  rowIndex: number;
  /** Total rows in the batch. */
  rowsTotal: number;
  /** 1-based copy within the current row. */
  copy: number;
  /** Copies per row. */
  copiesPerRow: number;
  /** Labels finished (rows × copies). */
  completed: number;
  /** Total label outputs (`rows × copies`). */
  total: number;
}

export interface BatchOptions {
  rows: Record<string, string>[];
  copies: number;
  density: PrintDensity;
  onProgress?(p: BatchProgress): void;
  /** Called when a row's render fails. Returning `false` halts the batch. */
  onRowError?(rowIndex: number, err: string): boolean | Promise<boolean>;
  /** Polled between labels. Return true to halt after the current label. */
  shouldCancel?(): boolean;
  /** Called once a label has been sent to the printer (per copy). */
  onLabelPrinted?(rowIndex: number, copy: number): void;
  /** Resume from this row index (0-based). Earlier rows are skipped. */
  resumeFrom?: number;
}

export interface BatchSummary {
  /** True when the batch ran to completion. */
  completed: boolean;
  /** Last row index attempted (0-based). Useful for "resume from row N+1". */
  lastRowIndex: number;
  /** Labels printed (rows × copies completed). */
  printed: number;
  /** Total labels in the batch. */
  total: number;
  /** Rows whose render or print step raised, keyed by 0-based index. */
  errors: Map<number, string>;
  /** True when the batch halted due to `shouldCancel()` returning true. */
  cancelled: boolean;
}

/**
 * Iterate `rows × copies` row-major and print each label via `printer.print`.
 *
 * Per §5.2 row-major fill order: row 1 copy 1, row 1 copy 2, …, row 1
 * copy N, row 2 copy 1, … . Each `printer.print` call carries
 * `copies: 1` so cutter-capable printers cut after every label.
 *
 * Returns a `BatchSummary` describing how the batch ended. The caller
 * is responsible for surfacing progress / errors via the supplied hooks.
 */
export async function runThermalBatch(
  designer: DesignerLike,
  printer: PrinterLike,
  options: BatchOptions,
): Promise<BatchSummary> {
  const { rows, copies, density } = options;
  const copiesPerRow = Math.max(1, copies);
  const rowsTotal = rows.length;
  const total = rowsTotal === 0 ? 0 : rowsTotal * copiesPerRow;
  const errors = new Map<number, string>();
  const startIndex = Math.max(0, options.resumeFrom ?? 0);

  let printed = 0;
  let lastRowIndex = startIndex - 1;
  let cancelled = false;

  if (total === 0) {
    return { completed: true, lastRowIndex: -1, printed: 0, total: 0, errors, cancelled: false };
  }

  // Fast path: zero rows is nonsensical for a batch; the caller should
  // have routed to single-print. Bail early if `rows` is empty.
  if (rowsTotal === 0) {
    return { completed: true, lastRowIndex: -1, printed: 0, total: 0, errors, cancelled: false };
  }

  // Skip rows below resumeFrom by slicing the input — designer-core's
  // renderBatch doesn't expose a start index, so we trim beforehand.
  const trimmed = rows.slice(startIndex);

  const generator: AsyncGenerator<BatchResult> = renderBatch(
    designer.designer as unknown as Parameters<typeof renderBatch>[0],
    trimmed,
  );

  outer: for await (const result of generator) {
    const rowIndex = startIndex + result.index;
    lastRowIndex = rowIndex;

    for (let copy = 1; copy <= copiesPerRow; copy += 1) {
      if (options.shouldCancel?.()) {
        cancelled = true;
        break outer;
      }

      try {
        const image: RawImageData = {
          width: result.image.width,
          height: result.image.height,
          data:
            result.image.data instanceof Uint8Array
              ? result.image.data
              : new Uint8Array(
                  result.image.data.buffer,
                  result.image.data.byteOffset,
                  result.image.data.byteLength,
                ),
        };
        await printer.print(image, { copies: 1, density });
        printed += 1;
        options.onLabelPrinted?.(rowIndex, copy);
        options.onProgress?.({
          rowIndex,
          rowsTotal,
          copy,
          copiesPerRow,
          completed: printed,
          total,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.set(rowIndex, message);
        const carryOn = options.onRowError ? await options.onRowError(rowIndex, message) : false;
        if (!carryOn) break outer;
        // If onRowError returned true, skip remaining copies of this row
        // and move on — re-printing a row that just errored on copy 2/N
        // gives the user duplicates.
        break;
      }
    }
  }

  const completed = !cancelled && errors.size === 0 && printed === total;
  return { completed, lastRowIndex, printed, total, errors, cancelled };
}

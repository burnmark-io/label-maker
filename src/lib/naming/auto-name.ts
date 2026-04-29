import type { LabelObject, LabelObjectInput } from '@burnmark-io/designer-core';

/**
 * Type-label key used both for grouping objects into "name pools" and
 * for looking up the human-readable prefix in i18n. Stable identifiers,
 * not localised strings — the prefix is resolved separately via `t()`.
 */
export type TypeLabelKey =
  | 'text'
  | 'image'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'qrcode'
  | 'barcode'
  | 'group';

const QR_BARCODE_FORMATS = new Set(['qrcode', 'microqr', 'gs1qrcode']);

/**
 * Map a label object to its naming pool key. Shapes split by sub-shape
 * (rectangle vs ellipse vs line); barcodes split QR formats from the
 * rest so QR codes share a "QR 1, QR 2" pool independent of "Barcode 1,
 * Barcode 2" for 1D / other 2D formats.
 */
export function typeLabelKeyFor(
  obj: Pick<LabelObject, 'type'> & Partial<LabelObject>,
): TypeLabelKey {
  switch (obj.type) {
    case 'text':
      return 'text';
    case 'image':
      return 'image';
    case 'group':
      return 'group';
    case 'shape': {
      const shape = (obj as { shape?: string }).shape;
      if (shape === 'ellipse') return 'ellipse';
      if (shape === 'line') return 'line';
      return 'rectangle';
    }
    case 'barcode': {
      const format = (obj as { format?: string }).format;
      if (format && QR_BARCODE_FORMATS.has(format)) return 'qrcode';
      return 'barcode';
    }
    default:
      return 'text';
  }
}

/**
 * Parse `<prefix> <N>` into N. Whole-string match: prefix, exactly one
 * space, decimal integer, end. Returns `null` if the name doesn't match.
 *
 * - Custom names ("Greeting") → null, don't influence the pool.
 * - Names with extra suffix ("Text 2 copy") → null.
 * - Names with non-trailing numbers ("v2 Text") → null.
 */
export function parseTrailingNumber(name: string, prefix: string): number | null {
  if (!name || !prefix) return null;
  if (!name.startsWith(prefix + ' ')) return null;
  const tail = name.slice(prefix.length + 1);
  if (!/^\d+$/.test(tail)) return null;
  const n = Number(tail);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Compute the next auto-name for a new object of `key`'s pool given the
 * current document's objects. Reads the current names — no stored
 * counter, no seeding step. Re-numbering after deletion of the highest-
 * numbered object is intentional (see amendment §9.3).
 */
export function nextNameForType(
  objects: readonly LabelObject[],
  key: TypeLabelKey,
  prefix: string,
): string {
  let max = 0;
  for (const obj of objects) {
    if (typeLabelKeyFor(obj) !== key) continue;
    const n = obj.name ? parseTrailingNumber(obj.name, prefix) : null;
    if (n !== null && n > max) max = n;
  }
  return `${prefix} ${max + 1}`;
}

/**
 * Decide the auto-name for a new object given the current document's
 * objects and a `prefixFor(key)` resolver. Returns `undefined` if the
 * caller already supplied a name (we don't override).
 */
export function autoNameFor(
  input: Pick<LabelObjectInput, 'type'> & { name?: string } & Record<string, unknown>,
  objects: readonly LabelObject[],
  prefixFor: (key: TypeLabelKey) => string,
): string | undefined {
  if (typeof input.name === 'string' && input.name.length > 0) return undefined;
  const key = typeLabelKeyFor(input as Parameters<typeof typeLabelKeyFor>[0]);
  return nextNameForType(objects, key, prefixFor(key));
}

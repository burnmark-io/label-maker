/**
 * Column mapper — auto-maps imported CSV/Excel columns to template
 * placeholders, with three strategies in order:
 *
 * 1. exact match (case-insensitive, whitespace tolerant)
 * 2. fuzzy/synonym match (Dutch/English common pairs, Levenshtein < 3)
 * 3. positional fallback for any still-unmapped placeholders
 *
 * The mapping is keyed `placeholder -> column`. Persisted per-template
 * via {@link saveMapping}/{@link loadMapping} so reusing the same data
 * file with the same template skips the manual UI.
 */

const STORAGE_KEY = 'burnmark.columnMapper';

export interface MappingResult {
  /** placeholder name (lower-cased) → column header (original casing) */
  mapping: Record<string, string>;
  /** Placeholders that auto-mapping could not match. */
  unmapped: string[];
  /** Columns that no placeholder claimed. */
  unusedColumns: string[];
  /**
   * `true` when all placeholders matched via exact/fuzzy. Positional
   * fallback marks the result as incomplete so the UI can prompt.
   */
  complete: boolean;
}

const SYNONYMS: Record<string, string[]> = {
  name: ['naam', 'fullname', 'full_name', 'fullName', 'klant', 'customer'],
  firstname: ['firstName', 'first_name', 'voornaam', 'given'],
  lastname: ['lastName', 'last_name', 'achternaam', 'surname', 'family'],
  email: ['e-mail', 'mail', 'emailaddress', 'emailadres'],
  phone: ['telefoon', 'tel', 'phonenumber', 'telnr'],
  address: ['adres', 'street', 'straat'],
  city: ['woonplaats', 'plaats', 'town'],
  country: ['land', 'nation'],
  postcode: ['zip', 'zipcode', 'postalcode', 'postal_code'],
  date: ['datum', 'day'],
  price: ['prijs', 'cost', 'amount'],
  quantity: ['qty', 'aantal', 'count'],
  description: ['desc', 'omschrijving', 'beschrijving', 'detail'],
  product: ['item', 'sku', 'product_name', 'productnaam'],
  code: ['sku', 'id', 'barcode', 'productcode'],
};

function normalise(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.]+/g, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Auto-map CSV/Excel headers to placeholder names. Returns the mapping
 * plus diagnostics for the UI.
 */
export function autoMapColumns(headers: string[], placeholders: string[]): MappingResult {
  const mapping: Record<string, string> = {};
  const usedColumns = new Set<string>();
  const remainingPlaceholders: string[] = [];

  const normalisedHeaders = headers.map(h => ({ raw: h, norm: normalise(h) }));

  // Pass 1 — exact (case-insensitive, punctuation-stripped) match.
  for (const ph of placeholders) {
    const target = normalise(ph);
    const hit = normalisedHeaders.find(h => !usedColumns.has(h.raw) && h.norm === target);
    if (hit) {
      mapping[ph.toLowerCase()] = hit.raw;
      usedColumns.add(hit.raw);
    } else {
      remainingPlaceholders.push(ph);
    }
  }

  // Pass 2 — synonyms / fuzzy match.
  const stillUnmapped: string[] = [];
  for (const ph of remainingPlaceholders) {
    const target = normalise(ph);
    const synonyms = (SYNONYMS[target] ?? []).map(normalise);

    let best: { raw: string; score: number } | null = null;
    for (const h of normalisedHeaders) {
      if (usedColumns.has(h.raw)) continue;
      if (synonyms.includes(h.norm)) {
        best = { raw: h.raw, score: 0 };
        break;
      }
      const dist = levenshtein(target, h.norm);
      // Allow up to 2 edits for short keys, scaled for longer.
      const tolerance = Math.max(1, Math.floor(target.length / 4));
      if (dist <= tolerance && (!best || dist < best.score)) {
        best = { raw: h.raw, score: dist };
      }
    }

    if (best) {
      mapping[ph.toLowerCase()] = best.raw;
      usedColumns.add(best.raw);
    } else {
      stillUnmapped.push(ph);
    }
  }

  const complete = stillUnmapped.length === 0;

  // Pass 3 — positional fallback for everything still unmapped.
  const remainingColumns = headers.filter(h => !usedColumns.has(h));
  for (let i = 0; i < stillUnmapped.length && i < remainingColumns.length; i += 1) {
    mapping[stillUnmapped[i].toLowerCase()] = remainingColumns[i];
    usedColumns.add(remainingColumns[i]);
  }

  const unmapped = placeholders.filter(ph => !(ph.toLowerCase() in mapping));
  const unusedColumns = headers.filter(h => !usedColumns.has(h));

  return { mapping, unmapped, unusedColumns, complete };
}

/**
 * Build a `templateKey` for persistence — a stable hash-ish id derived
 * from the placeholder list. Two designs with the same placeholders share
 * a remembered mapping; that's the desired behaviour (same template
 * shape = same mapping).
 */
export function templateKeyFromPlaceholders(placeholders: string[]): string {
  return [...placeholders]
    .map(p => p.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');
}

interface PersistedMappings {
  [templateKey: string]: Record<string, string>;
}

function readStorage(): PersistedMappings {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedMappings;
  } catch {
    return {};
  }
}

function writeStorage(value: PersistedMappings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function loadMapping(templateKey: string): Record<string, string> | null {
  const all = readStorage();
  return all[templateKey] ?? null;
}

export function saveMapping(templateKey: string, mapping: Record<string, string>): void {
  const all = readStorage();
  all[templateKey] = { ...mapping };
  writeStorage(all);
}

export function clearMapping(templateKey: string): void {
  const all = readStorage();
  if (templateKey in all) {
    delete all[templateKey];
    writeStorage(all);
  }
}

/**
 * Apply a mapping to a row of column data, producing variables for
 * `applyVariables` / `renderBatch`. Keys are lower-cased to match
 * designer-core's case-insensitive lookup.
 */
export function applyMappingToRow(
  row: Record<string, string>,
  mapping: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [placeholder, column] of Object.entries(mapping)) {
    if (column && column in row) {
      out[placeholder.toLowerCase()] = String(row[column] ?? '');
    }
  }
  return out;
}

/**
 * CSV template generator — builds a starter CSV from a design's
 * placeholders. Removes the "what columns does my CSV need?" friction
 * at the highest-friction moment.
 *
 * CSV only (D34): SheetJS would grow the eager bundle by ~430KB just
 * to write Excel; CSV opens in Excel, Numbers, Sheets, and Notepad.
 */
import { safeFileName } from './file-download';

const SAMPLE_BY_PLACEHOLDER: Record<string, string> = {
  name: 'Sample name',
  firstname: 'Sample first name',
  lastname: 'Sample last name',
  email: 'sample@example.com',
  phone: '+31 6 1234 5678',
  address: '123 Main St',
  city: 'Amsterdam',
  country: 'Netherlands',
  postcode: '1234 AB',
  date: '2024-01-01',
  price: '9.99',
  quantity: '1',
  description: 'Sample description',
  product: 'Sample product',
  code: 'ABC123',
};

function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export interface CsvTemplate {
  filename: string;
  csv: string;
}

/**
 * Build a CSV template from the placeholders detected in a design.
 *
 * - Headers: each placeholder, lower-cased, in document-order.
 * - One example row, populated with plausible defaults from
 *   {@link SAMPLE_BY_PLACEHOLDER} or `value 1`, `value 2`, … as a
 *   numbered fallback.
 * - Filename: `<document-name>-template.csv` (sanitised).
 */
export function buildCsvTemplate(placeholders: string[], documentName: string): CsvTemplate {
  const headers = placeholders.map(p => p.trim().toLowerCase()).filter(Boolean);
  const sample = headers.map((header, i) => {
    return SAMPLE_BY_PLACEHOLDER[header] ?? `value ${i + 1}`;
  });
  const lines = [headers.map(escapeCell).join(','), sample.map(escapeCell).join(',')];
  const csv = `${lines.join('\r\n')}\r\n`;
  const slug = safeFileName(documentName || 'untitled');
  return { filename: `${slug}-template.csv`, csv };
}

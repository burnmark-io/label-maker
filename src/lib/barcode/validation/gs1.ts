export interface AiSpec {
  ai: string;
  fixedLength?: number;
  maxLength?: number;
  alphabet: 'numeric' | 'alphanumeric';
  description: string;
}

export const AI_TABLE: Record<string, AiSpec> = {
  '00': { ai: '00', fixedLength: 18, alphabet: 'numeric', description: 'SSCC' },
  '01': { ai: '01', fixedLength: 14, alphabet: 'numeric', description: 'GTIN' },
  '02': { ai: '02', fixedLength: 14, alphabet: 'numeric', description: 'Content GTIN' },
  '10': { ai: '10', maxLength: 20, alphabet: 'alphanumeric', description: 'Batch / Lot' },
  '11': { ai: '11', fixedLength: 6, alphabet: 'numeric', description: 'Production date YYMMDD' },
  '13': { ai: '13', fixedLength: 6, alphabet: 'numeric', description: 'Packaging date YYMMDD' },
  '15': { ai: '15', fixedLength: 6, alphabet: 'numeric', description: 'Best-before YYMMDD' },
  '17': { ai: '17', fixedLength: 6, alphabet: 'numeric', description: 'Expiration YYMMDD' },
  '20': { ai: '20', fixedLength: 2, alphabet: 'numeric', description: 'Variant' },
  '21': { ai: '21', maxLength: 20, alphabet: 'alphanumeric', description: 'Serial number' },
  '30': { ai: '30', maxLength: 8, alphabet: 'numeric', description: 'Count of items' },
  '37': { ai: '37', maxLength: 8, alphabet: 'numeric', description: 'Count of trade items' },
  '90': { ai: '90', maxLength: 30, alphabet: 'alphanumeric', description: 'Internal' },
  '91': { ai: '91', maxLength: 90, alphabet: 'alphanumeric', description: 'Internal' },
  '240': {
    ai: '240',
    maxLength: 30,
    alphabet: 'alphanumeric',
    description: 'Additional product ID',
  },
  '241': {
    ai: '241',
    maxLength: 30,
    alphabet: 'alphanumeric',
    description: 'Customer part number',
  },
  '310': { ai: '310', fixedLength: 6, alphabet: 'numeric', description: 'Net weight (kg)' },
  '320': { ai: '320', fixedLength: 6, alphabet: 'numeric', description: 'Net weight (lb)' },
  '400': { ai: '400', maxLength: 30, alphabet: 'alphanumeric', description: 'Customer PO number' },
  '410': { ai: '410', fixedLength: 13, alphabet: 'numeric', description: 'Ship-to GLN' },
  '414': {
    ai: '414',
    fixedLength: 13,
    alphabet: 'numeric',
    description: 'Identification of physical location',
  },
  '420': { ai: '420', maxLength: 20, alphabet: 'alphanumeric', description: 'Ship-to postal code' },
  '8200': {
    ai: '8200',
    maxLength: 70,
    alphabet: 'alphanumeric',
    description: 'Extended packaging URL',
  },
};

export interface ParsedAi {
  ai: string;
  value: string;
  start: number;
  end: number;
}

export interface ParseError {
  at: number;
  code: 'malformed' | 'emptyAi' | 'unterminated';
}

export interface ParseResult {
  ais: ParsedAi[];
  errors: ParseError[];
}

/**
 * Look up an AI spec, applying the 310/320 family rule (`310x`/`320x`
 * with `x` = decimal position is treated as the family prefix entry).
 */
export function lookupAi(ai: string): AiSpec | undefined {
  if (AI_TABLE[ai]) return AI_TABLE[ai];
  if (ai.length === 4 && (ai.startsWith('310') || ai.startsWith('320'))) {
    return AI_TABLE[ai.slice(0, 3)];
  }
  return undefined;
}

/**
 * Parse a parenthesised GS1 string `(AI)data(AI)data` into its
 * AI/value pairs. Tolerates trailing whitespace.
 */
export function parseGs1(input: string): ParseResult {
  const ais: ParsedAi[] = [];
  const errors: ParseError[] = [];
  let i = 0;
  const s = input;
  if (!s.trim()) return { ais, errors };

  while (i < s.length) {
    if (s[i] !== '(') {
      errors.push({ at: i, code: 'malformed' });
      return { ais, errors };
    }
    const start = i;
    const close = s.indexOf(')', i + 1);
    if (close === -1) {
      errors.push({ at: i, code: 'unterminated' });
      return { ais, errors };
    }
    const ai = s.slice(i + 1, close);
    if (!ai) {
      errors.push({ at: i, code: 'emptyAi' });
      return { ais, errors };
    }
    if (!/^\d{2,4}$/.test(ai)) {
      errors.push({ at: i, code: 'malformed' });
      return { ais, errors };
    }
    let valueEnd = s.indexOf('(', close + 1);
    if (valueEnd === -1) valueEnd = s.length;
    const value = s.slice(close + 1, valueEnd);
    ais.push({ ai, value, start, end: valueEnd });
    i = valueEnd;
  }

  return { ais, errors };
}

export interface AiValidationIssue {
  ai: string;
  code: 'unknown' | 'wrongLength' | 'badAlphabet';
  expectedLength?: number;
  gotLength?: number;
}

export function validateParsedAis(parsed: ParsedAi[]): AiValidationIssue[] {
  const issues: AiValidationIssue[] = [];
  for (const entry of parsed) {
    const spec = lookupAi(entry.ai);
    if (!spec) {
      issues.push({ ai: entry.ai, code: 'unknown' });
      continue;
    }
    const alphabetOk =
      spec.alphabet === 'numeric' ? /^\d*$/.test(entry.value) : /^[\x20-\x7E]*$/.test(entry.value);
    if (!alphabetOk) {
      issues.push({ ai: entry.ai, code: 'badAlphabet' });
      continue;
    }
    if (spec.fixedLength !== undefined) {
      if (entry.value.length !== spec.fixedLength) {
        issues.push({
          ai: entry.ai,
          code: 'wrongLength',
          expectedLength: spec.fixedLength,
          gotLength: entry.value.length,
        });
      }
    } else if (spec.maxLength !== undefined) {
      if (entry.value.length === 0 || entry.value.length > spec.maxLength) {
        issues.push({
          ai: entry.ai,
          code: 'wrongLength',
          expectedLength: spec.maxLength,
          gotLength: entry.value.length,
        });
      }
    }
  }
  return issues;
}

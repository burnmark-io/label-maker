import type { BarcodeFormat } from '@burnmark-io/designer-core';
import type { FormatRegistry, FormatRule, ValidationResult } from './types.js';
import { isValidGtin } from './checksums.js';
import { parseGs1, validateParsedAis } from './gs1.js';

const OK: ValidationResult = { severity: 'ok' };
const EMPTY: ValidationResult = {
  severity: 'info',
  message: 'properties.barcode.validation.empty',
};

function emptyOr(data: string, fn: () => ValidationResult): ValidationResult {
  if (data.length === 0) return EMPTY;
  return fn();
}

function badAlphabet(): ValidationResult {
  return { severity: 'error', message: 'properties.barcode.validation.badAlphabet' };
}

function wrongLength(expected: number, got: number): ValidationResult {
  return {
    severity: 'error',
    message: 'properties.barcode.validation.wrongLength',
    messageParams: { expected, got },
  };
}

function wrongLengthChoice(choices: number[], got: number): ValidationResult {
  return {
    severity: 'error',
    message: 'properties.barcode.validation.wrongLengthChoice',
    messageParams: { choices: choices.join(' / '), got },
  };
}

function wrongLengthRange(min: number, max: number, got: number): ValidationResult {
  return {
    severity: 'error',
    message: 'properties.barcode.validation.wrongLengthRange',
    messageParams: { min, max, got },
  };
}

function evenDigitsRequired(got: number): ValidationResult {
  return {
    severity: 'error',
    message: 'properties.barcode.validation.evenDigitsRequired',
    messageParams: { got },
  };
}

function capacityWarning(): ValidationResult {
  return { severity: 'warning', message: 'properties.barcode.validation.capacityWarning' };
}

/**
 * GTIN-family validator that accepts both "data digits only" (checksum
 * will be appended by bwip-js) and "data digits + checksum" (validated
 * here). Other lengths are flagged.
 */
function gtinValidate(dataLen: number, fullLen: number, data: string): ValidationResult {
  if (data.length === 0) return EMPTY;
  if (!/^\d+$/.test(data)) return badAlphabet();
  if (data.length === dataLen) {
    return {
      severity: 'info',
      message: 'properties.barcode.validation.checksumAdded',
      messageParams: { count: data.length },
    };
  }
  if (data.length === fullLen) {
    if (isValidGtin(data)) {
      return { severity: 'ok' };
    }
    return {
      severity: 'error',
      message: 'properties.barcode.validation.checksumInvalid',
      messageParams: { count: data.length },
    };
  }
  return wrongLengthChoice([dataLen, fullLen], data.length);
}

function gs1Validate(data: string): ValidationResult {
  if (data.length === 0) return EMPTY;
  const result = parseGs1(data);
  if (result.errors.length > 0) {
    return {
      severity: 'error',
      message: 'properties.barcode.validation.gs1MalformedAi',
    };
  }
  if (result.ais.length === 0) {
    return {
      severity: 'error',
      message: 'properties.barcode.validation.gs1MalformedAi',
    };
  }
  const issues = validateParsedAis(result.ais);
  let warning: ValidationResult | null = null;
  for (const issue of issues) {
    if (issue.code === 'unknown') {
      warning = {
        severity: 'warning',
        message: 'properties.barcode.validation.gs1UnknownAi',
        messageParams: { ai: issue.ai },
      };
      continue;
    }
    if (issue.code === 'badAlphabet') {
      return {
        severity: 'error',
        message: 'properties.barcode.validation.badAlphabet',
      };
    }
    if (issue.code === 'wrongLength') {
      return {
        severity: 'error',
        message: 'properties.barcode.validation.gs1AiWrongLength',
        messageParams: {
          ai: issue.ai,
          expected: issue.expectedLength ?? 0,
          got: issue.gotLength ?? 0,
        },
      };
    }
  }
  return warning ?? OK;
}

const PRINTABLE_ASCII = /[\x20-\x7E]/;
const PRINTABLE_ASCII_WITH_DEL = /[\x20-\x7F]/;
const CONTROL_AND_UPPER = /[\x00-\x5F]/;
const CODE39 = /[A-Z0-9 \-.$/+%]/;
const CODE39_FULL = /[\x00-\x7F]/;
const CODE11 = /[0-9\-]/;
const CODABAR = /[0-9\-$:/.+]/;
const HIBC = /[A-Z0-9\-.$/+%]/;
const NUMERIC = /[0-9]/;
const ALNUM_UPPER = /[A-Z0-9]/;
const JAPANPOST = /[A-Z0-9\-]/;
const GS1_ALPHA = /[\x20-\x7E()]/;

function makeRule(partial: Partial<FormatRule> & Pick<FormatRule, 'validate'>): FormatRule {
  return {
    hintKey: '',
    placeholderKey: '',
    ...partial,
  } as FormatRule;
}

const RULES: Partial<FormatRegistry> = {
  // ---- 1D linear -----------------------------------------------------

  code128: makeRule({
    mask: PRINTABLE_ASCII,
    validate: data => emptyOr(data, () => (/^[\x20-\x7E]+$/.test(data) ? OK : badAlphabet())),
  }),
  code128a: makeRule({
    mask: CONTROL_AND_UPPER,
    validate: data => emptyOr(data, () => (/^[\x00-\x5F]+$/.test(data) ? OK : badAlphabet())),
  }),
  code128b: makeRule({
    mask: PRINTABLE_ASCII_WITH_DEL,
    validate: data => emptyOr(data, () => (/^[\x20-\x7F]+$/.test(data) ? OK : badAlphabet())),
  }),
  code128c: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        if (data.length % 2 !== 0) return evenDigitsRequired(data.length);
        return OK;
      }),
  }),
  code39: makeRule({
    mask: CODE39,
    transform: raw => raw.toUpperCase(),
    validate: data =>
      emptyOr(data, () =>
        CODE39.test(data[0] ?? '') && /^[A-Z0-9 \-.$/+%]+$/.test(data) ? OK : badAlphabet(),
      ),
  }),
  code39ext: makeRule({
    mask: CODE39_FULL,
    validate: data => emptyOr(data, () => (/^[\x00-\x7F]+$/.test(data) ? OK : badAlphabet())),
  }),
  code93: makeRule({
    mask: CODE39,
    transform: raw => raw.toUpperCase(),
    validate: data => emptyOr(data, () => (/^[A-Z0-9 \-.$/+%]+$/.test(data) ? OK : badAlphabet())),
  }),
  code11: makeRule({
    mask: CODE11,
    validate: data => emptyOr(data, () => (/^[0-9\-]+$/.test(data) ? OK : badAlphabet())),
  }),
  codabar: makeRule({
    mask: CODABAR,
    validate: data => emptyOr(data, () => (/^[0-9\-$:/.+]+$/.test(data) ? OK : badAlphabet())),
  }),
  ean13: makeRule({
    mask: NUMERIC,
    validate: data => gtinValidate(12, 13, data),
  }),
  ean8: makeRule({
    mask: NUMERIC,
    validate: data => gtinValidate(7, 8, data),
  }),
  upca: makeRule({
    mask: NUMERIC,
    validate: data => gtinValidate(11, 12, data),
  }),
  upce: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        if (![6, 7, 8].includes(data.length)) return wrongLengthChoice([6, 7, 8], data.length);
        return OK;
      }),
  }),
  itf14: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        if (data.length === 13) {
          return {
            severity: 'info',
            message: 'properties.barcode.validation.checksumAdded',
            messageParams: { count: 13 },
          };
        }
        if (data.length === 14) {
          return isValidGtin(data)
            ? OK
            : {
                severity: 'error',
                message: 'properties.barcode.validation.checksumInvalid',
                messageParams: { count: 14 },
              };
        }
        return wrongLengthChoice([13, 14], data.length);
      }),
  }),
  interleaved2of5: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        if (data.length % 2 !== 0) return evenDigitsRequired(data.length);
        return OK;
      }),
  }),
  msi: makeRule({
    mask: NUMERIC,
    validate: data => emptyOr(data, () => (/^\d+$/.test(data) ? OK : badAlphabet())),
  }),
  pharmacode: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        const n = Number(data);
        if (n < 3 || n > 131070) {
          return {
            severity: 'error',
            message: 'properties.barcode.validation.outOfRange',
            messageParams: { min: 3, max: 131070, got: n },
          };
        }
        return OK;
      }),
  }),
  pzn: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        if (![6, 7].includes(data.length)) return wrongLengthChoice([6, 7], data.length);
        return OK;
      }),
  }),
  hibccode128: makeRule({
    mask: HIBC,
    transform: raw => raw.toUpperCase(),
    validate: data => emptyOr(data, () => (/^[A-Z0-9\-.$/+%]+$/.test(data) ? OK : badAlphabet())),
  }),
  isbt128: makeRule({
    mask: PRINTABLE_ASCII,
    validate: data => emptyOr(data, () => (/^[\x20-\x7E]+$/.test(data) ? OK : badAlphabet())),
  }),
  leitcode: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        if (data.length !== 14) return wrongLength(14, data.length);
        return OK;
      }),
  }),
  identcode: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        if (data.length !== 12) return wrongLength(12, data.length);
        return OK;
      }),
  }),

  // ---- 2D matrix / stacked ------------------------------------------

  qrcode: makeRule({
    validate: data => {
      if (data.length === 0) return EMPTY;
      if (data.length > 2000) return capacityWarning();
      return OK;
    },
  }),
  microqr: makeRule({
    validate: data => {
      if (data.length === 0) return EMPTY;
      if (data.length > 35) return capacityWarning();
      return OK;
    },
  }),
  datamatrix: makeRule({
    validate: data => {
      if (data.length === 0) return EMPTY;
      if (data.length > 2335) return capacityWarning();
      return OK;
    },
  }),
  datamatrixrectangular: makeRule({
    validate: data => {
      if (data.length === 0) return EMPTY;
      if (data.length > 2335) return capacityWarning();
      return OK;
    },
  }),
  pdf417: makeRule({
    validate: data => {
      if (data.length === 0) return EMPTY;
      if (data.length > 1850) return capacityWarning();
      return OK;
    },
  }),
  micropdf417: makeRule({
    validate: data => {
      if (data.length === 0) return EMPTY;
      if (data.length > 250) return capacityWarning();
      return OK;
    },
  }),
  azteccode: makeRule({
    validate: data => {
      if (data.length === 0) return EMPTY;
      if (data.length > 3067) return capacityWarning();
      return OK;
    },
  }),
  aztecrune: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        const n = Number(data);
        if (n < 0 || n > 255) {
          return {
            severity: 'error',
            message: 'properties.barcode.validation.outOfRange',
            messageParams: { min: 0, max: 255, got: n },
          };
        }
        return OK;
      }),
  }),
  maxicode: makeRule({
    validate: data => {
      if (data.length === 0) return EMPTY;
      if (data.length > 93) return capacityWarning();
      return OK;
    },
  }),
  dotcode: makeRule({
    validate: data => emptyOr(data, () => OK),
  }),
  hanxin: makeRule({
    validate: data => emptyOr(data, () => OK),
  }),

  // ---- GS1 -----------------------------------------------------------

  gs1_128: makeRule({
    mask: GS1_ALPHA,
    validate: gs1Validate,
  }),
  gs1qrcode: makeRule({
    mask: GS1_ALPHA,
    validate: gs1Validate,
  }),
  gs1datamatrix: makeRule({
    mask: GS1_ALPHA,
    validate: gs1Validate,
  }),
  gs1_cc: makeRule({
    mask: GS1_ALPHA,
    validate: gs1Validate,
  }),
  databar: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        if (data.length !== 14) return wrongLength(14, data.length);
        return OK;
      }),
  }),
  databarexpanded: makeRule({
    mask: GS1_ALPHA,
    validate: gs1Validate,
  }),

  // ---- Postal --------------------------------------------------------

  postnet: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        if (![5, 9, 11].includes(data.length)) return wrongLengthChoice([5, 9, 11], data.length);
        return OK;
      }),
  }),
  onecode: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        if (![20, 25, 29, 31].includes(data.length))
          return wrongLengthChoice([20, 25, 29, 31], data.length);
        return OK;
      }),
  }),
  royalmail: makeRule({
    mask: ALNUM_UPPER,
    transform: raw => raw.toUpperCase(),
    validate: data =>
      emptyOr(data, () => {
        if (!/^[A-Z0-9]+$/.test(data)) return badAlphabet();
        if (data.length > 9) return wrongLengthRange(1, 9, data.length);
        return OK;
      }),
  }),
  kix: makeRule({
    mask: ALNUM_UPPER,
    transform: raw => raw.toUpperCase(),
    validate: data =>
      emptyOr(data, () => {
        if (!/^[A-Z0-9]+$/.test(data)) return badAlphabet();
        if (data.length > 11) return wrongLengthRange(1, 11, data.length);
        return OK;
      }),
  }),
  auspost: makeRule({
    mask: NUMERIC,
    validate: data =>
      emptyOr(data, () => {
        if (!/^\d+$/.test(data)) return badAlphabet();
        if (![8, 13, 16, 23].includes(data.length))
          return wrongLengthChoice([8, 13, 16, 23], data.length);
        return OK;
      }),
  }),
  japanpost: makeRule({
    mask: JAPANPOST,
    transform: raw => raw.toUpperCase(),
    validate: data =>
      emptyOr(data, () => {
        if (!/^[A-Z0-9\-]+$/.test(data)) return badAlphabet();
        if (data.length > 20) return wrongLengthRange(1, 20, data.length);
        return OK;
      }),
  }),
};

const ALL_FORMATS: BarcodeFormat[] = [
  'code128',
  'code128a',
  'code128b',
  'code128c',
  'code39',
  'code39ext',
  'code93',
  'code11',
  'codabar',
  'ean13',
  'ean8',
  'upca',
  'upce',
  'itf14',
  'interleaved2of5',
  'gs1_128',
  'databar',
  'databarexpanded',
  'pharmacode',
  'msi',
  'postnet',
  'royalmail',
  'kix',
  'onecode',
  'qrcode',
  'microqr',
  'datamatrix',
  'datamatrixrectangular',
  'pdf417',
  'micropdf417',
  'azteccode',
  'aztecrune',
  'maxicode',
  'dotcode',
  'hanxin',
  'gs1qrcode',
  'gs1datamatrix',
  'gs1_cc',
  'auspost',
  'japanpost',
  'leitcode',
  'identcode',
  'hibccode128',
  'isbt128',
  'pzn',
];

// Attach hint/placeholder keys derived from the format id so the registry
// stays declarative and i18n can be resolved by namespace lookup.
for (const fmt of ALL_FORMATS) {
  const rule = RULES[fmt];
  if (!rule) continue;
  rule.hintKey = `properties.barcode.hint.${fmt}`;
  rule.placeholderKey = `properties.barcode.placeholder.${fmt}`;
}

// Fallback rule for any BarcodeFormat the registry hasn't covered yet —
// keeps the type assertion below honest. No mask, anything-goes validate.
const FALLBACK: FormatRule = {
  validate: data => emptyOr(data, () => OK),
  hintKey: 'properties.barcode.hint.code128',
  placeholderKey: 'properties.barcode.placeholder.code128',
};

export function getFormatRule(format: BarcodeFormat): FormatRule {
  return RULES[format] ?? FALLBACK;
}

export const REGISTERED_FORMATS = ALL_FORMATS;

import type { BarcodeFormat } from '@burnmark-io/designer-core';
import { getFormatRule, REGISTERED_FORMATS } from './registry.js';
import type { FormatRule, ValidationResult } from './types.js';

const PLACEHOLDER_RE = /\{\{[^}]+\}\}/;

export function hasPlaceholders(data: string): boolean {
  return PLACEHOLDER_RE.test(data);
}

export function getRule(format: BarcodeFormat): FormatRule {
  return getFormatRule(format);
}

/**
 * Filter `raw` keystroke-by-keystroke against the format's mask. The
 * brace characters `{` and `}` always pass so the user can type a
 * `{{token}}` into a strict-mask field.
 *
 * If the format has no mask, returns `raw` unchanged.
 */
export function applyMask(format: BarcodeFormat, raw: string): string {
  const rule = getFormatRule(format);
  // Transform first (e.g. uppercase) so users typing in their natural case
  // don't see characters dropped before the case-fold has a chance to run.
  const pre = rule.transform ? rule.transform(raw) : raw;
  if (!rule.mask) return pre;
  let out = '';
  for (const ch of pre) {
    if (ch === '{' || ch === '}') {
      out += ch;
      continue;
    }
    if (rule.mask.test(ch)) out += ch;
  }
  return out;
}

/**
 * Validate the data string for a format. If the data contains a
 * `{{placeholder}}` token, validation is bypassed and a muted info
 * line is returned (per amendment §3.2).
 */
export function validate(format: BarcodeFormat, data: string): ValidationResult {
  if (hasPlaceholders(data)) {
    return {
      severity: 'info',
      message: 'properties.barcode.validation.placeholderBypass',
    };
  }
  return getFormatRule(format).validate(data);
}

export { REGISTERED_FORMATS };
export type { FormatRule, ValidationResult, Severity } from './types.js';

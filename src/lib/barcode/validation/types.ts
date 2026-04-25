import type { BarcodeFormat } from '@burnmark-io/designer-core';

export type Severity = 'ok' | 'info' | 'warning' | 'error';

export interface ValidationResult {
  severity: Severity;
  /** i18n key. Caller resolves with `t()`. */
  message?: string;
  messageParams?: Record<string, string | number>;
}

export interface FormatRule {
  /** Keystroke-level character class. Undefined means no filter. */
  mask?: RegExp;
  /** Optional pre-write transform (e.g. uppercase). */
  transform?: (raw: string) => string;
  /** Validate the (possibly placeholder-containing) data string. */
  validate(data: string): ValidationResult;
  /** i18n key for the format's "what does this expect" hint. */
  hintKey: string;
  /** i18n key for the input field placeholder text. */
  placeholderKey: string;
}

export type FormatRegistry = Record<BarcodeFormat, FormatRule>;

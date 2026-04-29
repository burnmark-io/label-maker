import type { PrinterError } from '@thermal-label/contracts';

/**
 * Surface a user-facing message for a printer error code.
 *
 * Looks up `printer.errors.${code}` in the active locale and falls
 * back to the driver's `PrinterError.message` when no translation
 * exists. The fallback rule lets us ship canonical, polished strings
 * for known codes without blanking the UI when an upstream driver
 * introduces a new code we haven't keyed yet.
 *
 * The plural namespace (`errors.`, not `error.`) avoids colliding
 * with the existing scalar `printer.error` connection-lost label.
 *
 * Pass `t` from `useI18n()` at the call site — the helper is a plain
 * function so it works in components and Pinia stores alike.
 */
export function localisedErrorMessage(error: PrinterError, t: (key: string) => string): string {
  const key = `printer.errors.${error.code}`;
  const translated = t(key);
  return translated === key ? error.message : translated;
}

/**
 * Compute the GTIN/EAN/UPC mod-10 checksum digit for a numeric string.
 *
 * The EAN-13/EAN-8/UPC-A family all share the same algorithm: starting
 * from the rightmost data digit, alternate weights 3 and 1, sum, and
 * the check digit is `(10 - (sum % 10)) % 10`.
 */
function gtinCheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    const d = digits.charCodeAt(digits.length - 1 - i) - 48;
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

export function ean13Checksum(twelveDigits: string): number {
  return gtinCheckDigit(twelveDigits);
}

export function ean8Checksum(sevenDigits: string): number {
  return gtinCheckDigit(sevenDigits);
}

export function upcaChecksum(elevenDigits: string): number {
  return gtinCheckDigit(elevenDigits);
}

/** Validate a GTIN-style code by recomputing its trailing check digit. */
export function isValidGtin(full: string): boolean {
  if (!/^\d+$/.test(full) || full.length < 2) return false;
  const data = full.slice(0, -1);
  const expected = gtinCheckDigit(data);
  return expected === Number(full.slice(-1));
}

import { BUNDLED_FONTS, type BundledFontFamily } from '@burnmark-io/designer-core';

/** A font the text panel offers: the stored family and the name shown in the UI. */
export interface FontOption {
  /** `fontFamily` stored in the document (designer-core's family name). */
  value: string;
  /** Name shown in the UI. */
  label: string;
}

/** Bundled families, in the order the picker shows them. */
const BUNDLED_ORDER: readonly BundledFontFamily[] = [
  'Burnmark Sans',
  'Burnmark Serif',
  'Burnmark Mono',
  'Burnmark Narrow',
];

/** Plain system fonts, offered after the bundled ones. Not embedded. */
const SYSTEM_FONTS: readonly string[] = ['Arial', 'Helvetica', 'Courier New'];

/** Font for new text objects. */
export const DEFAULT_FONT_FAMILY: BundledFontFamily = 'Burnmark Sans';

/** Bundled fonts (shown without "Burnmark"), then system fonts. */
export const FONT_OPTIONS: readonly FontOption[] = [
  ...BUNDLED_ORDER.map(family => ({
    value: BUNDLED_FONTS[family].family,
    label: family.replace(/^Burnmark /, ''),
  })),
  ...SYSTEM_FONTS.map(family => ({ value: family, label: family })),
];

/** The options, with an unlisted `current` family (e.g. an older label) added first. */
export function fontOptionsFor(current: string): readonly FontOption[] {
  return FONT_OPTIONS.some(o => o.value === current)
    ? FONT_OPTIONS
    : [{ value: current, label: current }, ...FONT_OPTIONS];
}

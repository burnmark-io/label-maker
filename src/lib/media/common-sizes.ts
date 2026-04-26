import type { PrinterFamily } from '@/lib/printer/registry';

/**
 * Hand-curated catalogue of common label sizes shown in the
 * `LabelSizeSelector` dropdown. Per `amendment-canvas-sizing.md` §2.1
 * these are surfaced regardless of printer connection — a user
 * without hardware can still design at any of them.
 *
 * The list is intentionally short. The full per-driver `MEDIA`
 * registries live in `@thermal-label/*-core`; we surface those only
 * once a printer is connected (the "From printer (detected)" section
 * in the selector).
 */
export interface CommonSize {
  /** Stable id used in the picker key + tests. */
  id: string;
  widthMm: number;
  /** `null` = continuous medium (cut line + drag handle in editor). */
  heightMm: number | null;
  /** Display name. Not i18n'd — these are mostly product/SKU references. */
  name: string;
  family: PrinterFamily;
}

export const COMMON_SIZES: readonly CommonSize[] = [
  {
    id: 'brother-62-cont',
    widthMm: 62,
    heightMm: null,
    name: '62mm continuous (Brother QL)',
    family: 'brother-ql',
  },
  {
    id: 'brother-29-cont',
    widthMm: 29,
    heightMm: null,
    name: '29mm continuous (Brother QL)',
    family: 'brother-ql',
  },
  {
    id: 'brother-12-cont',
    widthMm: 12,
    heightMm: null,
    name: '12mm continuous (Brother QL)',
    family: 'brother-ql',
  },
  {
    id: 'brother-29x90',
    widthMm: 29,
    heightMm: 90,
    name: '29×90mm die-cut (Brother QL)',
    family: 'brother-ql',
  },
  {
    id: 'brother-62x29',
    widthMm: 62,
    heightMm: 29,
    name: '62×29mm die-cut (Brother QL)',
    family: 'brother-ql',
  },
  {
    id: 'brother-38x90',
    widthMm: 38,
    heightMm: 90,
    name: '38×90mm die-cut (Brother QL)',
    family: 'brother-ql',
  },
  {
    id: 'lw-89x28',
    widthMm: 89,
    heightMm: 28,
    name: '89×28mm address (LabelWriter)',
    family: 'labelwriter',
  },
  {
    id: 'lw-89x36',
    widthMm: 89,
    heightMm: 36,
    name: '89×36mm large address (LabelWriter)',
    family: 'labelwriter',
  },
  {
    id: 'lw-56-cont',
    widthMm: 56,
    heightMm: null,
    name: '56mm continuous (LabelWriter)',
    family: 'labelwriter',
  },
  {
    id: 'lm-12-cont',
    widthMm: 12,
    heightMm: null,
    name: '12mm tape (LabelManager / P-touch)',
    family: 'labelmanager',
  },
  {
    id: 'lm-9-cont',
    widthMm: 9,
    heightMm: null,
    name: '9mm tape (LabelManager / P-touch)',
    family: 'labelmanager',
  },
  {
    id: 'lm-19-cont',
    widthMm: 19,
    heightMm: null,
    name: '19mm tape (LabelManager / P-touch)',
    family: 'labelmanager',
  },
];

export function findCommonSize(id: string): CommonSize | undefined {
  return COMMON_SIZES.find(s => s.id === id);
}

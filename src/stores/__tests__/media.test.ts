import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { MediaDescriptor } from '@thermal-label/contracts';
import type { SheetTemplate } from '@burnmark-io/sheet-templates';

import {
  useMediaStore,
  dotsFromMm,
  mmFromDots,
  defaultContinuousLength,
  defaultOrientationFor,
} from '../media';
import { useDesignerStore } from '../designer';
import { usePrinterStore } from '../printer';
import { useResizeBannerStore } from '../resizeBanner';

function makeMedia(overrides: Partial<MediaDescriptor> = {}): MediaDescriptor {
  return {
    id: 'm1',
    name: 'Test media',
    widthMm: 62,
    type: 'continuous',
    ...overrides,
  };
}

function makeSheet(overrides: Partial<SheetTemplate> = {}): SheetTemplate {
  return {
    code: 'test-l7160',
    name: 'Test L7160',
    brand: 'Avery',
    part: 'L7160',
    paperSize: 'A4',
    paperWidthMm: 210,
    paperHeightMm: 297,
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    labelShape: 'rectangle',
    cornerRadiusMm: 2,
    layouts: [{ columns: 3, rows: 7, originXMm: 7, originYMm: 15, pitchXMm: 66, pitchYMm: 38 }],
    ...overrides,
  };
}

describe('media store — mm/dots conversion', () => {
  it('round-trips grid-aligned values exactly at 300dpi', () => {
    expect(dotsFromMm(62, 300)).toBe(732);
    expect(mmFromDots(732, 300)).toBeCloseTo(61.976, 2); // 732*25.4/300
    // 90mm at 300dpi = 1063 dots → back to ~90.0042mm — close but not exact
    expect(dotsFromMm(90, 300)).toBe(1063);
  });

  it('default continuous length follows the 4:3 ratio', () => {
    expect(defaultContinuousLength(12)).toBe(16);
    expect(defaultContinuousLength(29)).toBe(39);
    expect(defaultContinuousLength(62)).toBe(83);
  });
});

describe('media store — picking sizes', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
  });

  it('picks a common continuous size and sets source: manual + heightDots: 0', () => {
    const media = useMediaStore();
    const designer = useDesignerStore();

    media.pickCommonSize(62, null);

    expect(designer.document.canvas.widthDots).toBe(dotsFromMm(62, 300));
    expect(designer.document.canvas.heightDots).toBe(0);
    expect(media.source).toBe('manual');
    expect(media.heightMm).toBe(null);
    expect(media.isContinuous).toBe(true);
  });

  it('picks a die-cut size and sets source: manual + heightDots > 0', () => {
    const media = useMediaStore();
    const designer = useDesignerStore();

    media.pickCommonSize(29, 90);

    expect(designer.document.canvas.widthDots).toBe(dotsFromMm(29, 300));
    expect(designer.document.canvas.heightDots).toBe(dotsFromMm(90, 300));
    expect(media.source).toBe('manual');
    expect(media.isContinuous).toBe(false);
  });

  it('pickSheet sets source: sheet + sheetCode + dimensions from the sheet', () => {
    const media = useMediaStore();
    const designer = useDesignerStore();
    const sheet = makeSheet();

    media.pickSheet(sheet);

    expect(media.source).toBe('sheet');
    expect(media.sheetCode).toBe('test-l7160');
    expect(designer.document.canvas.widthDots).toBe(dotsFromMm(63.5, 300));
    expect(designer.document.canvas.heightDots).toBe(dotsFromMm(38.1, 300));
  });

  it('pickCustom with empty/zero/null height treats as continuous', () => {
    const media = useMediaStore();
    const designer = useDesignerStore();

    media.pickCustom(40, null);
    expect(designer.document.canvas.heightDots).toBe(0);
    expect(media.source).toBe('custom');

    media.pickCustom(40, 0);
    expect(designer.document.canvas.heightDots).toBe(0);
  });

  it('pickCustom with explicit height stores fixed length', () => {
    const media = useMediaStore();
    const designer = useDesignerStore();

    media.pickCustom(40, 25);
    expect(designer.document.canvas.heightDots).toBe(dotsFromMm(25, 300));
    expect(media.heightMm).toBeCloseTo(25, 1);
  });

  it('pickDetected sets source: detected', () => {
    const media = useMediaStore();
    media.pickDetected(makeMedia({ widthMm: 62, heightMm: 29 }));
    expect(media.source).toBe('detected');
    expect(media.heightMm).toBeCloseTo(29, 1);
  });

  it('pickPrinterMedia overrides printer.selectedMedia and sets source: manual', () => {
    const media = useMediaStore();
    const printer = usePrinterStore();
    // Auto-detect picked DK-22205 (62mm continuous, single-colour).
    const detected = makeMedia({
      id: 'DK-22205',
      name: '62mm continuous (DK-22205)',
      // single-colour: omit `palette`
    });
    printer.setDetectedMedia(detected);
    // User asserts the actual roll: DK-22251 (62mm continuous, two-colour).
    const asserted = makeMedia({
      id: 'DK-22251',
      name: '62mm continuous two-color (DK-22251)',
      palette: [
        { name: 'black', rgb: [0, 0, 0] },
        { name: 'red', rgb: [255, 0, 0] },
      ],
    });
    media.pickPrinterMedia(asserted);

    expect(media.source).toBe('manual');
    // Print pipeline now uses the user's override.
    expect(printer.selectedMedia?.id).toBe('DK-22251');
    expect(printer.effectiveMedia?.id).toBe('DK-22251');
    expect(printer.effectiveMedia?.palette?.length).toBeGreaterThan(0);
    // Detected media is unchanged — UI can still flag the originally-detected entry.
    expect(printer.detectedMedia?.id).toBe('DK-22205');
  });
});

describe('media store — auto-resize-on-printer-connect', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
  });

  it('auto-applies detected media when source is detected', async () => {
    const media = useMediaStore();
    const printer = usePrinterStore();

    // Default starting state: source defaults to 'manual' on a fresh
    // doc whose metadata has no canvasSource. Reset to 'detected' via
    // applyLastUsedOrDefault, which also seeds the default size.
    media.applyLastUsedOrDefault();
    expect(media.source).toBe('detected');

    const detected = makeMedia({ widthMm: 89, heightMm: 28 });
    printer.setDetectedMedia(detected);

    // Pinia watch fires synchronously in tests under microtask boundary.
    await Promise.resolve();
    await Promise.resolve();

    expect(media.widthMm).toBeCloseTo(89, 0);
    expect(media.heightMm).toBeCloseTo(28, 0);
  });

  it('untouched canvas with stale source: manual still adopts (canUndo gate)', async () => {
    // Old behaviour: source !== 'detected' → suppress. Was wrong: a
    // user with a stale `manual` source from a previous session who
    // hasn't started designing yet should pick up the new printer's
    // media (amendment §4.5.1 supersedes canvas-sizing §2.2).
    const media = useMediaStore();
    const designer = useDesignerStore();
    const printer = usePrinterStore();

    media.pickCommonSize(62, null);
    designer.clearHistory();
    expect(media.source).toBe('manual');
    expect(designer.canUndo).toBe(false);

    printer.setDetectedMedia(makeMedia({ widthMm: 89, heightMm: 28 }));
    await Promise.resolve();
    await Promise.resolve();

    expect(media.widthMm).toBeCloseTo(89, 0);
  });

  it('touched canvas surfaces the adopt banner instead of swapping', async () => {
    const media = useMediaStore();
    const designer = useDesignerStore();
    const printer = usePrinterStore();
    const banner = useResizeBannerStore();

    media.pickCommonSize(62, null);
    designer.clearHistory();
    // Simulate the user actually designing — any history-producing
    // change does. setCanvas runs through the history wrapper.
    designer.setCanvas({ widthDots: media.widthDots, heightDots: 100 });
    designer.addObject({
      type: 'text',
      content: 'hi',
      x: 0,
      y: 0,
      width: 50,
      height: 20,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      color: '#000',
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      verticalAlign: 'top',
      letterSpacing: 0,
      lineHeight: 1.2,
      invert: false,
      wrap: true,
      autoHeight: false,
    } as never);
    expect(designer.canUndo).toBe(true);
    expect(designer.document.objects.length).toBeGreaterThan(0);

    const widthBefore = media.widthMm;
    const heightBefore = media.heightMm;

    printer.setDetectedMedia(makeMedia({ widthMm: 89, heightMm: 28 }));
    await Promise.resolve();
    await Promise.resolve();

    expect(media.widthMm).toBeCloseTo(widthBefore, 1);
    expect(media.heightMm).toBe(heightBefore);
    expect(banner.mode).toBe('adopt');
    expect(banner.payload?.media.widthMm).toBe(89);
  });

  it('empty canvas with canUndo=true (user nuked everything) still adopts silently', async () => {
    const media = useMediaStore();
    const designer = useDesignerStore();
    const printer = usePrinterStore();
    const banner = useResizeBannerStore();

    media.pickCommonSize(62, null);
    designer.clearHistory();
    // Add then delete everything, leaving canUndo=true but no objects.
    designer.addObject({
      type: 'text',
      content: 'tmp',
      x: 0,
      y: 0,
      width: 50,
      height: 20,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      color: '#000',
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      verticalAlign: 'top',
      letterSpacing: 0,
      lineHeight: 1.2,
      invert: false,
      wrap: true,
      autoHeight: false,
    } as never);
    const id = designer.document.objects[0]!.id;
    designer.removeObject(id);
    expect(designer.canUndo).toBe(true);
    expect(designer.document.objects.length).toBe(0);

    printer.setDetectedMedia(makeMedia({ widthMm: 89, heightMm: 28 }));
    await Promise.resolve();
    await Promise.resolve();

    expect(media.widthMm).toBeCloseTo(89, 0);
    expect(banner.mode).toBe('idle');
  });
});

describe('media store — continuous drag-to-resize', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
  });

  it('starting length follows 4:3 ratio when nothing has been set', () => {
    const media = useMediaStore();
    media.pickCommonSize(62, null); // continuous 62mm
    expect(media.continuousLengthMm).toBe(83); // round(62 * 4/3)
  });

  it('setContinuousLength updates the manual length without leaving continuous', () => {
    const media = useMediaStore();
    const designer = useDesignerStore();
    media.pickCommonSize(62, null);
    expect(designer.document.canvas.heightDots).toBe(0);

    media.setContinuousLength(50);

    // Stays continuous at the doc level (heightDots: 0); user length lives
    // separately and survives across re-reads.
    expect(designer.document.canvas.heightDots).toBe(0);
    expect(media.isContinuous).toBe(true);
    expect(media.continuousLengthMm).toBe(50);
  });
});

describe('media store — localStorage persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
  });

  it('persists last-used size on pick', () => {
    const media = useMediaStore();
    media.pickCommonSize(62, 29);
    const raw = window.localStorage.getItem('burnmark.lastLabelSize');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { widthMm: number; heightMm: number | null };
    expect(parsed.widthMm).toBe(62);
    expect(parsed.heightMm).toBe(29);
  });

  it('applyLastUsedOrDefault restores the last-used size', () => {
    window.localStorage.setItem(
      'burnmark.lastLabelSize',
      JSON.stringify({ widthMm: 89, heightMm: 28, source: 'manual' }),
    );
    const media = useMediaStore();
    media.applyLastUsedOrDefault();
    expect(media.widthMm).toBeCloseTo(89, 0);
    expect(media.heightMm).toBeCloseTo(28, 0);
    // applyLastUsedOrDefault forces source to 'detected' so a printer
    // connect can override.
    expect(media.source).toBe('detected');
  });

  it('falls back to 62mm continuous when localStorage is empty', () => {
    const media = useMediaStore();
    media.applyLastUsedOrDefault();
    expect(media.widthMm).toBeCloseTo(62, 0);
    expect(media.heightMm).toBe(null);
    expect(media.source).toBe('detected');
  });
});

describe('defaultOrientationFor', () => {
  it('Tier 1: trusts MediaDescriptor.defaultOrientation when present', () => {
    expect(
      defaultOrientationFor(makeMedia({ widthMm: 62, defaultOrientation: 'horizontal' })),
    ).toBe('horizontal');
    expect(defaultOrientationFor(makeMedia({ widthMm: 12, defaultOrientation: 'vertical' }))).toBe(
      'vertical',
    );
  });

  it('Tier 2 — continuous: ≤19mm reads as a tape (horizontal)', () => {
    expect(defaultOrientationFor({ widthMm: 12, heightMm: null })).toBe('horizontal');
    expect(defaultOrientationFor({ widthMm: 19, heightMm: null })).toBe('horizontal');
    expect(defaultOrientationFor({ widthMm: 20, heightMm: null })).toBe('vertical');
    expect(defaultOrientationFor({ widthMm: 62, heightMm: null })).toBe('vertical');
  });

  it('Tier 2 — die-cut: tall stays vertical, wide goes horizontal', () => {
    expect(defaultOrientationFor({ widthMm: 30, heightMm: 60 })).toBe('vertical');
    expect(defaultOrientationFor({ widthMm: 60, heightMm: 30 })).toBe('horizontal');
    // Square: tall-or-equal rule → vertical.
    expect(defaultOrientationFor({ widthMm: 50, heightMm: 50 })).toBe('vertical');
  });
});

describe('media store — orientation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
  });

  it('pickCommonSize on a narrow continuous tape defaults to horizontal', () => {
    const media = useMediaStore();
    media.pickCommonSize(12, null);
    expect(media.orientation).toBe('horizontal');
  });

  it('pickCommonSize on a wide continuous roll defaults to vertical', () => {
    const media = useMediaStore();
    media.pickCommonSize(62, null);
    expect(media.orientation).toBe('vertical');
  });

  it('pickPrinterMedia honours MediaDescriptor.defaultOrientation = "horizontal"', () => {
    const media = useMediaStore();
    media.pickPrinterMedia(makeMedia({ widthMm: 12, defaultOrientation: 'horizontal' }));
    expect(media.orientation).toBe('horizontal');
  });

  it('setOrientation updates the canvas and persists to localStorage', () => {
    const media = useMediaStore();
    const designer = useDesignerStore();
    media.pickCommonSize(62, 100); // taller-than-wide die-cut → defaults vertical
    expect(media.orientation).toBe('vertical');

    media.setOrientation('horizontal');
    expect(designer.document.canvas.orientation).toBe('horizontal');

    const raw = window.localStorage.getItem('burnmark.lastLabelSize');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { orientation?: string };
    expect(parsed.orientation).toBe('horizontal');
  });

  it('applyLastUsedOrDefault restores the persisted orientation', () => {
    window.localStorage.setItem(
      'burnmark.lastLabelSize',
      JSON.stringify({
        widthMm: 62,
        heightMm: 29,
        source: 'manual',
        orientation: 'horizontal',
      }),
    );
    const media = useMediaStore();
    media.applyLastUsedOrDefault();
    expect(media.orientation).toBe('horizontal');
  });

  it('applyLastUsedOrDefault falls back to the heuristic when orientation is absent (legacy record)', () => {
    // Legacy persisted record predating the orientation field.
    window.localStorage.setItem(
      'burnmark.lastLabelSize',
      JSON.stringify({ widthMm: 12, heightMm: null, source: 'manual' }),
    );
    const media = useMediaStore();
    media.applyLastUsedOrDefault();
    expect(media.orientation).toBe('horizontal');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { MediaDescriptor } from '@thermal-label/contracts';

import { useResizeBannerStore } from '../resizeBanner';

function makeMedia(overrides: Partial<MediaDescriptor> = {}): MediaDescriptor {
  return {
    id: 'm1',
    name: '62mm continuous',
    widthMm: 62,
    type: 'continuous',
    ...overrides,
  };
}

describe('resizeBanner store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts idle with no payload', () => {
    const banner = useResizeBannerStore();
    expect(banner.mode).toBe('idle');
    expect(banner.payload).toBeNull();
  });

  it('showAdopt sets mode and stores payload', () => {
    const banner = useResizeBannerStore();
    const media = makeMedia();
    banner.showAdopt({ media, printerName: 'QL-820NWB' });
    expect(banner.mode).toBe('adopt');
    expect(banner.payload?.media.id).toBe('m1');
    expect(banner.payload?.printerName).toBe('QL-820NWB');
  });

  it('hide resets mode and clears payload', () => {
    const banner = useResizeBannerStore();
    banner.showAdopt({ media: makeMedia(), printerName: 'QL-820NWB' });
    banner.hide();
    expect(banner.mode).toBe('idle');
    expect(banner.payload).toBeNull();
  });

  it('successive showAdopt calls overwrite payload', () => {
    const banner = useResizeBannerStore();
    banner.showAdopt({ media: makeMedia({ id: 'first' }), printerName: 'A' });
    banner.showAdopt({ media: makeMedia({ id: 'second' }), printerName: 'B' });
    expect(banner.payload?.media.id).toBe('second');
    expect(banner.payload?.printerName).toBe('B');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { nextTick } from 'vue';
import type { MediaDescriptor } from '@thermal-label/contracts';

import en from '@/i18n/locales/en.json';
import CanvasResizeBanner from '../CanvasResizeBanner.vue';
import { useResizeBannerStore } from '@/stores/resizeBanner';
import { useMediaStore } from '@/stores/media';

function makeMedia(overrides: Partial<MediaDescriptor> = {}): MediaDescriptor {
  return {
    id: 'm1',
    name: '29mm continuous',
    widthMm: 29,
    type: 'continuous',
    ...overrides,
  };
}

function mountBanner() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(CanvasResizeBanner, {
    global: { plugins: [i18n] },
  });
}

describe('CanvasResizeBanner', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders nothing while mode is idle', () => {
    const wrapper = mountBanner();
    expect(wrapper.find('.banner').exists()).toBe(false);
  });

  it('renders the adopt slot with media name and printer name', async () => {
    const wrapper = mountBanner();
    const banner = useResizeBannerStore();
    banner.showAdopt({ media: makeMedia(), printerName: 'QL-820NWB' });
    await nextTick();
    expect(wrapper.find('.banner--adopt').exists()).toBe(true);
    expect(wrapper.text()).toContain('29mm continuous');
    expect(wrapper.text()).toContain('QL-820NWB');
  });

  it('[Use this size] calls media.pickDetected and hides the banner', async () => {
    const wrapper = mountBanner();
    const banner = useResizeBannerStore();
    const media = useMediaStore();
    const detected = makeMedia({ widthMm: 29, name: '29mm continuous' });
    banner.showAdopt({ media: detected, printerName: 'QL-820NWB' });
    await nextTick();

    await wrapper.find('.banner__btn--primary').trigger('click');
    await nextTick();

    expect(media.widthMm).toBeCloseTo(29, 0);
    expect(banner.mode).toBe('idle');
  });

  it('dismiss hides the banner without applying media', async () => {
    const wrapper = mountBanner();
    const banner = useResizeBannerStore();
    const media = useMediaStore();
    media.pickCommonSize(62, null);
    const widthBefore = media.widthMm;

    banner.showAdopt({ media: makeMedia({ widthMm: 29 }), printerName: 'QL-820NWB' });
    await nextTick();

    await wrapper.find('.banner__btn--icon').trigger('click');
    await nextTick();

    expect(banner.mode).toBe('idle');
    expect(media.widthMm).toBeCloseTo(widthBefore, 1);
  });
});

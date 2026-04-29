import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import type { ImageObject } from '@burnmark-io/designer-core';

import en from '@/i18n/locales/en.json';
import ImageProperties from '../ImageProperties.vue';
import type * as DesignerStore from '@/stores/designer';

const updateObjectSpy = vi.fn();
const loadAsBlobSpy = vi.fn(async (_key: string): Promise<Blob> => new Blob(['x']));
const storeFromBlobSpy = vi.fn(async (_blob: Blob): Promise<string> => 'new-asset');

vi.mock('@/stores/designer', async () => {
  const actual = await vi.importActual<typeof DesignerStore>('@/stores/designer');
  return {
    ...actual,
    useDesignerStore: () => ({
      updateObject: updateObjectSpy,
      assetLoader: {
        loadAsBlob: loadAsBlobSpy,
        storeFromBlob: storeFromBlobSpy,
      },
    }),
  };
});

// jsdom needs a stub for URL.createObjectURL / revokeObjectURL.
beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:fake'),
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
  updateObjectSpy.mockClear();
  loadAsBlobSpy.mockClear();
  storeFromBlobSpy.mockClear();
  window.localStorage.clear();
});

function makeImage(): ImageObject {
  return {
    id: 'obj-1',
    type: 'image',
    name: 'Image 1',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    color: '#000',
    assetKey: 'asset-1',
    fit: 'contain',
    threshold: 128,
    dither: true,
    invert: false,
  } as unknown as ImageObject;
}

function mountImage() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(ImageProperties, {
    props: { object: makeImage() },
    global: { plugins: [i18n] },
  });
}

describe('ImageProperties', () => {
  it('renders the image preview region with the Replace control at the top', () => {
    const w = mountImage();
    const html = w.html();
    const previewIndex = html.indexOf('image-preview');
    const fitIndex = html.indexOf('Fit');
    expect(previewIndex).toBeGreaterThan(-1);
    expect(fitIndex).toBeGreaterThan(previewIndex);
    expect(w.find('.image-preview__replace').text()).toContain('Replace image');
  });

  it('Thermal sub-section is collapsed by default', () => {
    const w = mountImage();
    const trigger = w.findAll('.collapsible__trigger').find(t => t.text().includes('Thermal'));
    expect(trigger?.attributes('aria-expanded')).toBe('false');
  });
});

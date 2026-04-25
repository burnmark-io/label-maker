import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { shallowRef } from 'vue';
import type { BarcodeObject } from '@burnmark-io/designer-core';

import en from '@/i18n/locales/en.json';
import BarcodeProperties from '../BarcodeProperties.vue';

const updateObject = vi.fn();
let placeholders: string[] = [];
let liveBarcode: BarcodeObject | null = null;
const documentRef = shallowRef<unknown>({});

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => ({
    updateObject,
    get document() {
      return documentRef.value;
    },
    get: (id: string) => (liveBarcode && liveBarcode.id === id ? liveBarcode : undefined),
  }),
}));

vi.mock('@/stores/data', () => ({
  useDataStore: () => ({
    get placeholders() {
      return placeholders;
    },
  }),
}));

function makeObject(overrides: Partial<BarcodeObject> = {}): BarcodeObject {
  return {
    id: 'b1',
    type: 'barcode',
    name: 'b1',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    format: 'code128',
    data: '',
    options: {},
    ...overrides,
  } as BarcodeObject;
}

function mountWith(object: BarcodeObject) {
  liveBarcode = object;
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(BarcodeProperties, {
    props: { object },
    global: { plugins: [i18n] },
  });
}

describe('BarcodeProperties', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    updateObject.mockReset();
    placeholders = [];
    liveBarcode = null;
  });

  it('renders the format hint when the data field is empty', () => {
    const wrapper = mountWith(makeObject({ format: 'code128' }));
    const help = wrapper.find('.props__help');
    expect(help.exists()).toBe(true);
    expect(help.text()).toContain('printable text');
  });

  it('shows an error helper line when input fails validation', () => {
    const wrapper = mountWith(makeObject({ format: 'ean13', data: 'abc' }));
    const help = wrapper.find('.props__help');
    expect(help.exists()).toBe(true);
    expect(help.classes()).toContain('props__help--error');
  });

  it('marks the textarea aria-invalid on error', () => {
    const wrapper = mountWith(makeObject({ format: 'ean13', data: 'abc' }));
    const ta = wrapper.find('textarea');
    expect(ta.attributes('aria-invalid')).toBe('true');
  });

  it('shows the placeholder-bypass info line for {{token}} input', () => {
    const wrapper = mountWith(makeObject({ format: 'ean13', data: '{{barcode_id}}' }));
    const help = wrapper.find('.props__help');
    expect(help.classes()).toContain('props__help--info');
    expect(help.text()).toMatch(/actual data/);
  });

  it('mask filters bad characters during typing for ean13', async () => {
    const wrapper = mountWith(makeObject({ format: 'ean13', data: '' }));
    const ta = wrapper.find('textarea');
    (ta.element as HTMLTextAreaElement).value = '590-123-4';
    await ta.trigger('input');
    expect(updateObject).toHaveBeenCalledWith('b1', { data: '5901234' });
  });

  it('always lets `{` and `}` pass through a strict mask', async () => {
    const wrapper = mountWith(makeObject({ format: 'ean13', data: '' }));
    const ta = wrapper.find('textarea');
    (ta.element as HTMLTextAreaElement).value = '{';
    await ta.trigger('input');
    expect(updateObject).toHaveBeenCalledWith('b1', { data: '{' });
  });

  it('writes typed value through unfiltered when raw already has a placeholder', async () => {
    const wrapper = mountWith(makeObject({ format: 'ean13', data: '{{x}}' }));
    const ta = wrapper.find('textarea');
    (ta.element as HTMLTextAreaElement).value = '{{x}}-tail';
    await ta.trigger('input');
    expect(updateObject).toHaveBeenCalledWith('b1', { data: '{{x}}-tail' });
  });

  it('disables the insert-variable button when no placeholders exist', () => {
    placeholders = [];
    const wrapper = mountWith(makeObject({ format: 'code128' }));
    const trigger = wrapper.find('.insvar__trigger');
    expect(trigger.attributes('disabled')).toBeDefined();
  });

  it('inserts a placeholder token at cursor when a variable is picked', async () => {
    placeholders = ['barcode_id'];
    const wrapper = mountWith(makeObject({ format: 'ean13', data: '' }));
    await wrapper.find('.insvar__trigger').trigger('click');
    const item = wrapper.find('.insvar__item');
    expect(item.exists()).toBe(true);
    await item.trigger('click');
    expect(updateObject).toHaveBeenCalledWith('b1', { data: '{{barcode_id}}' });
  });
});

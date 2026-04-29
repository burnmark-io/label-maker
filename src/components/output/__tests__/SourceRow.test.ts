import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { reactive, nextTick } from 'vue';

import en from '@/i18n/locales/en.json';

const dataState = reactive<{ rows: Record<string, string>[]; currentIndex: number }>({
  rows: [],
  currentIndex: 0,
});
const designerState = reactive<{ document: { id: string } | null }>({
  document: { id: 'doc-1' },
});

vi.mock('@/stores/data', () => ({
  useDataStore: () => dataState,
}));

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => designerState,
}));

import SourceRow from '../SourceRow.vue';
import { usePrintConfigStore } from '@/stores/print-config';

function makeRows(n: number): Record<string, string>[] {
  return Array.from({ length: n }, (_, i) => ({ name: `row${i + 1}` }));
}

beforeEach(() => {
  setActivePinia(createPinia());
  dataState.rows = [];
  dataState.currentIndex = 0;
  designerState.document = { id: 'doc-1' };
});

function mountRow() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(SourceRow, { global: { plugins: [i18n] } });
}

describe('SourceRow', () => {
  it('renders nothing when no dataset is loaded', () => {
    const wrapper = mountRow();
    expect(wrapper.find('.source-row').exists()).toBe(false);
  });

  it('renders the segmented control when a dataset is loaded', async () => {
    dataState.rows = makeRows(10);
    const wrapper = mountRow();
    await nextTick();
    const segments = wrapper.findAll('.source-row__segment').map(s => s.text());
    expect(segments).toEqual(['Active', 'All', 'Range']);
  });

  it('marks the current selection kind active', async () => {
    dataState.rows = makeRows(10);
    const wrapper = mountRow();
    await nextTick();
    // default with dataset: 'all'
    const allBtn = wrapper.findAll('.source-row__segment')[1]!;
    expect(allBtn.classes()).toContain('source-row__segment--active');
  });

  it('clicking a segment updates the store selection', async () => {
    dataState.rows = makeRows(10);
    const wrapper = mountRow();
    const config = usePrintConfigStore();
    await nextTick();
    await wrapper.findAll('.source-row__segment')[0]!.trigger('click');
    expect(config.outputSelection).toEqual({ kind: 'active' });
  });

  it('switching to range seeds from=1 to=rowCount and shows the inputs', async () => {
    dataState.rows = makeRows(20);
    const wrapper = mountRow();
    const config = usePrintConfigStore();
    await nextTick();
    await wrapper.findAll('.source-row__segment')[2]!.trigger('click');
    await nextTick();
    expect(config.outputSelection).toEqual({ kind: 'range', from: 1, to: 20 });
    const inputs = wrapper.findAll('.source-row__range-input');
    expect(inputs).toHaveLength(2);
  });

  it('clamps out-of-bounds range on blur', async () => {
    dataState.rows = makeRows(10);
    const wrapper = mountRow();
    const config = usePrintConfigStore();
    await nextTick();
    await wrapper.findAll('.source-row__segment')[2]!.trigger('click');
    await nextTick();
    const inputs = wrapper.findAll('.source-row__range-input');
    await inputs[0]!.setValue('-3');
    await inputs[1]!.setValue('99');
    await inputs[1]!.trigger('blur');
    expect(config.outputSelection).toEqual({ kind: 'range', from: 1, to: 10 });
  });

  it('flips from > to into a valid clamped range', async () => {
    dataState.rows = makeRows(10);
    const wrapper = mountRow();
    const config = usePrintConfigStore();
    await nextTick();
    await wrapper.findAll('.source-row__segment')[2]!.trigger('click');
    await nextTick();
    const inputs = wrapper.findAll('.source-row__range-input');
    await inputs[0]!.setValue('7');
    await inputs[1]!.setValue('3');
    await inputs[1]!.trigger('blur');
    // to is clamped up to from when from > to
    expect(config.outputSelection).toEqual({ kind: 'range', from: 7, to: 7 });
  });
});

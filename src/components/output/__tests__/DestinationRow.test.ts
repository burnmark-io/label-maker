import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { reactive, nextTick } from 'vue';

import en from '@/i18n/locales/en.json';

const printerState = reactive<{ isConnected: boolean }>({ isConnected: false });
const dataState = reactive<{ rows: Record<string, string>[]; currentIndex: number }>({
  rows: [],
  currentIndex: 0,
});
const designerState = reactive<{
  document: {
    id: string;
    canvas: { widthDots: number; heightDots: number; dpi: number };
    metadata: Record<string, unknown>;
  } | null;
}>({
  document: {
    id: 'doc-1',
    canvas: { widthDots: 696, heightDots: 472, dpi: 300 },
    metadata: {},
  },
});

vi.mock('@/stores/printer', () => ({
  usePrinterStore: () => printerState,
}));
vi.mock('@/stores/data', () => ({
  useDataStore: () => dataState,
}));
vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => designerState,
}));

import DestinationRow from '../DestinationRow.vue';
import { usePrintConfigStore } from '@/stores/print-config';

beforeEach(() => {
  setActivePinia(createPinia());
  printerState.isConnected = false;
  dataState.rows = [];
  designerState.document = {
    id: 'doc-1',
    canvas: { widthDots: 696, heightDots: 472, dpi: 300 },
    metadata: {},
  };
  window.localStorage.clear();
});

function mountRow() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(DestinationRow, { global: { plugins: [i18n] } });
}

describe('DestinationRow', () => {
  it('renders nothing when only thermal is possible', async () => {
    printerState.isConnected = true;
    const wrapper = mountRow();
    await nextTick();
    expect(wrapper.find('.destination-row').exists()).toBe(false);
  });

  it('shows the toggle when both thermal and sheet are possible', async () => {
    printerState.isConnected = true;
    const wrapper = mountRow();
    const config = usePrintConfigStore();
    config.setSheetTemplate('avery-l7160');
    await nextTick();
    expect(wrapper.find('.destination-row__toggle').exists()).toBe(true);
    const segs = wrapper.findAll('.destination-row__seg').map(s => s.text());
    expect(segs).toEqual(['Thermal', 'Sheet']);
  });

  it('defaults to thermal when both are possible', async () => {
    printerState.isConnected = true;
    const wrapper = mountRow();
    const config = usePrintConfigStore();
    config.setSheetTemplate('avery-l7160');
    await nextTick();
    const thermal = wrapper.findAll('.destination-row__seg')[0]!;
    expect(thermal.classes()).toContain('destination-row__seg--active');
  });

  it('clicking Sheet flips the destination', async () => {
    printerState.isConnected = true;
    const wrapper = mountRow();
    const config = usePrintConfigStore();
    config.setSheetTemplate('avery-l7160');
    await nextTick();
    await wrapper.findAll('.destination-row__seg')[1]!.trigger('click');
    expect(config.destination).toBe('sheet');
  });

  it('shows the change link with the synth label when no printer + no sheet picked', async () => {
    // No printer, no real sheet → print-config falls back to the
    // 1-up custom synth so Print still works. DestinationRow surfaces
    // it as a normal "Sheet: ... — change" link.
    const wrapper = mountRow();
    await nextTick();
    expect(wrapper.find('.destination-row__cta').exists()).toBe(false);
    const change = wrapper.find('.destination-row__change');
    expect(change.exists()).toBe(true);
    expect(change.text()).toContain('Custom');
  });

  it('shows the change link when only sheet is possible', async () => {
    const wrapper = mountRow();
    const config = usePrintConfigStore();
    config.setSheetTemplate('avery-l7160');
    await nextTick();
    expect(wrapper.find('.destination-row__toggle').exists()).toBe(false);
    expect(wrapper.find('.destination-row__change').exists()).toBe(true);
  });

  it('change link emits open-sheet-picker', async () => {
    printerState.isConnected = true;
    const wrapper = mountRow();
    const config = usePrintConfigStore();
    config.setSheetTemplate('avery-l7160');
    await nextTick();
    await wrapper.find('.destination-row__change').trigger('click');
    expect(wrapper.emitted('open-sheet-picker')).toHaveLength(1);
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { reactive, nextTick } from 'vue';

import en from '@/i18n/locales/en.json';

const exportPng = vi.fn(async () => new Blob(['png']));
const exportPdf = vi.fn(async () => new Blob(['pdf']));
const toJSON = vi.fn(() => '{"id":"x"}');
const downloadBlobMock = vi.fn();
const showMock = vi.fn();

const dataState = reactive<{
  rows: Record<string, string>[];
  mapping: Record<string, string>;
  currentIndex: number;
}>({ rows: [], mapping: {}, currentIndex: 0 });

const designerState = reactive<{ document: { id: string } | null }>({
  document: { id: 'doc-1' },
});

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => ({
    get document() {
      return { id: designerState.document?.id ?? 'doc-1', name: 'My label' };
    },
    exportPng,
    exportPdf,
    toJSON,
  }),
}));

vi.mock('@/stores/data', () => ({
  useDataStore: () => dataState,
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ show: showMock }),
}));

vi.mock('@/services/file-download', () => ({
  downloadBlob: (blob: Blob, name: string) => downloadBlobMock(blob, name),
  safeFileName: (name: string) => name,
}));

vi.mock('@/services/column-mapper', () => ({
  applyMappingToRow: (row: unknown) => row,
}));

beforeEach(() => {
  setActivePinia(createPinia());
  exportPng.mockClear();
  exportPdf.mockClear();
  toJSON.mockClear();
  downloadBlobMock.mockClear();
  showMock.mockClear();
  dataState.rows = [];
  dataState.mapping = {};
  dataState.currentIndex = 0;
  designerState.document = { id: 'doc-1' };
});

import SaveAsFileSection from '../SaveAsFileSection.vue';
import { usePrintConfigStore } from '@/stores/print-config';

function makeRows(n: number): Record<string, string>[] {
  return Array.from({ length: n }, (_, i) => ({ name: `row${i + 1}` }));
}

function mountSection() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(SaveAsFileSection, { global: { plugins: [i18n] } });
}

describe('SaveAsFileSection', () => {
  it('renders three buttons: PNG, PDF, .label', () => {
    const wrapper = mountSection();
    const btns = wrapper.findAll('.output-save-as-file__btn').map(b => b.text());
    expect(btns).toEqual(['PNG', 'PDF', '.label']);
  });

  it('PNG button triggers exportPng download', async () => {
    const wrapper = mountSection();
    await wrapper.findAll('.output-save-as-file__btn')[0]!.trigger('click');
    await new Promise(r => setTimeout(r, 0));
    expect(exportPng).toHaveBeenCalledTimes(1);
    expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'My label.png');
  });

  it('PDF button triggers exportPdf download', async () => {
    const wrapper = mountSection();
    await wrapper.findAll('.output-save-as-file__btn')[1]!.trigger('click');
    await new Promise(r => setTimeout(r, 0));
    expect(exportPdf).toHaveBeenCalledTimes(1);
    expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'My label.pdf');
  });

  it('.label button serialises the document and downloads it', async () => {
    const wrapper = mountSection();
    await wrapper.findAll('.output-save-as-file__btn')[2]!.trigger('click');
    await new Promise(r => setTimeout(r, 0));
    expect(toJSON).toHaveBeenCalledTimes(1);
    expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'My label.label');
  });

  it('shows Source dropdown when a dataset is loaded', async () => {
    dataState.rows = makeRows(5);
    const wrapper = mountSection();
    await nextTick();
    expect(wrapper.find('.output-save-as-file__source').exists()).toBe(true);
  });

  it('hides .label button when Source ≠ Active', async () => {
    dataState.rows = makeRows(10);
    const wrapper = mountSection();
    await nextTick();
    // dataset loaded → default selection is "all" → .label hides;
    // PNG / PDF labels carry the file / page count.
    const btns = wrapper.findAll('.output-save-as-file__btn').map(b => b.text());
    expect(btns).toEqual(['PNG (10 files)', 'PDF (10 pages)']);
  });

  it('shows .label button again after switching Source = Active', async () => {
    dataState.rows = makeRows(5);
    const wrapper = mountSection();
    const config = usePrintConfigStore();
    await nextTick();
    config.setOutputSelection({ kind: 'active' });
    await nextTick();
    const btns = wrapper.findAll('.output-save-as-file__btn').map(b => b.text());
    expect(btns).toEqual(['PNG', 'PDF', '.label']);
  });

  it('PDF export with Source = All passes every row to exportPdf', async () => {
    dataState.rows = makeRows(3);
    const wrapper = mountSection();
    await nextTick();
    await wrapper.findAll('.output-save-as-file__btn')[1]!.trigger('click');
    await new Promise(r => setTimeout(r, 0));
    expect(exportPdf).toHaveBeenCalledTimes(1);
    expect(exportPdf).toHaveBeenCalledWith([{ name: 'row1' }, { name: 'row2' }, { name: 'row3' }]);
  });

  it('PNG export with Source = All produces a zip', async () => {
    dataState.rows = makeRows(3);
    const wrapper = mountSection();
    await nextTick();
    await wrapper.findAll('.output-save-as-file__btn')[0]!.trigger('click');
    // JSZip generateAsync schedules through setImmediate in node; flush
    // both microtasks and a real timer tick to let it resolve.
    for (let i = 0; i < 5; i += 1) {
      await flushPromises();
      await new Promise(r => setTimeout(r, 5));
    }
    expect(exportPng).toHaveBeenCalledTimes(3);
    expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'My label.zip');
  });

  it('PNG export with Source = Active produces a single PNG', async () => {
    dataState.rows = makeRows(5);
    const wrapper = mountSection();
    const config = usePrintConfigStore();
    await nextTick();
    config.setOutputSelection({ kind: 'active' });
    dataState.currentIndex = 2;
    await nextTick();
    await wrapper.findAll('.output-save-as-file__btn')[0]!.trigger('click');
    await new Promise(r => setTimeout(r, 0));
    expect(exportPng).toHaveBeenCalledTimes(1);
    expect(exportPng).toHaveBeenCalledWith({ name: 'row3' });
    expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'My label.png');
  });

  it('PDF export with Source = Range honours the configured slice', async () => {
    dataState.rows = makeRows(10);
    const wrapper = mountSection();
    const config = usePrintConfigStore();
    await nextTick();
    config.setOutputSelection({ kind: 'range', from: 3, to: 5 });
    await nextTick();
    await wrapper.findAll('.output-save-as-file__btn')[1]!.trigger('click');
    await new Promise(r => setTimeout(r, 0));
    expect(exportPdf).toHaveBeenCalledTimes(1);
    expect(exportPdf).toHaveBeenCalledWith([{ name: 'row3' }, { name: 'row4' }, { name: 'row5' }]);
  });
});

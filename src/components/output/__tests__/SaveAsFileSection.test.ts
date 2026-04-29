import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';

import en from '@/i18n/locales/en.json';
import SaveAsFileSection from '../SaveAsFileSection.vue';

const exportPng = vi.fn(async () => new Blob(['png']));
const exportPdf = vi.fn(async () => new Blob(['pdf']));
const toJSON = vi.fn(() => '{"id":"x"}');
const downloadBlobMock = vi.fn();
const showMock = vi.fn();

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => ({
    document: { id: 'doc-1', name: 'My label' },
    exportPng,
    exportPdf,
    toJSON,
  }),
}));

vi.mock('@/stores/data', () => ({
  useDataStore: () => ({ rows: [], mapping: {}, currentIndex: 0 }),
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
});

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
});

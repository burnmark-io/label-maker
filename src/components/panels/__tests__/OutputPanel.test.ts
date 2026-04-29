import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';

import en from '@/i18n/locales/en.json';
import OutputPanel from '../OutputPanel.vue';

vi.mock('@/components/output/PreviewSection.vue', () => ({
  default: { name: 'PreviewSection', template: '<div data-testid="preview-section" />' },
}));
vi.mock('@/components/output/PrintSection.vue', () => ({
  default: { name: 'PrintSection', template: '<div data-testid="print-section" />' },
}));
vi.mock('@/components/output/SaveAsFileSection.vue', () => ({
  default: { name: 'SaveAsFileSection', template: '<div data-testid="save-as-file-section" />' },
}));

beforeEach(() => {
  setActivePinia(createPinia());
});

function mountPanel() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(OutputPanel, { global: { plugins: [i18n] } });
}

describe('OutputPanel', () => {
  it('renders three sections in order: Preview, Print, Save-as-file', () => {
    const wrapper = mountPanel();
    const ids = wrapper.findAll('[data-testid]').map(el => el.attributes('data-testid'));
    expect(ids).toEqual(['preview-section', 'print-section', 'save-as-file-section']);
  });
});

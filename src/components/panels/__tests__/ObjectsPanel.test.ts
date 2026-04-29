import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { ref } from 'vue';
import type { LabelDocument, LabelObject } from '@burnmark-io/designer-core';

import en from '@/i18n/locales/en.json';
import ObjectsPanel from '../ObjectsPanel.vue';
import { DOCUMENT_SELECTION_ID } from '@/stores/designer';
import type * as DesignerStore from '@/stores/designer';

const selectionRef = ref<string[]>([]);
const documentRef = ref<LabelDocument>(makeDoc());
const selectSpy = vi.fn((ids: string[]) => {
  selectionRef.value = ids;
});

function makeDoc(objects: LabelObject[] = []): LabelDocument {
  return {
    id: 'doc-1',
    version: 1,
    name: 'My label',
    description: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    canvas: {
      widthDots: 696,
      heightDots: 1181,
      dpi: 300,
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      background: '#ffffff',
      grid: { enabled: false, spacingDots: 10 },
      orientation: 'vertical',
    },
    objects,
    metadata: {},
  };
}

vi.mock('@/stores/designer', async () => {
  const actual = await vi.importActual<typeof DesignerStore>('@/stores/designer');
  return {
    ...actual,
    useDesignerStore: () => ({
      get selection() {
        return selectionRef.value;
      },
      get document() {
        return documentRef.value;
      },
      select: selectSpy,
      updateObject: vi.fn(),
      reorder: vi.fn(),
    }),
  };
});

vi.mock('@/composables/useOutOfBounds', () => ({
  useOutOfBounds: () => ({ isOut: () => false }),
}));

function mountPanel() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(ObjectsPanel, {
    global: { plugins: [i18n] },
  });
}

describe('ObjectsPanel — document root row', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    selectionRef.value = [];
    documentRef.value = makeDoc();
    selectSpy.mockClear();
  });

  it('renders the document row at the top of the list', () => {
    const wrapper = mountPanel();
    const docRow = wrapper.find('.objects-list__item--document');
    expect(docRow.exists()).toBe(true);
    expect(docRow.text()).toContain('My label');
  });

  it('falls back to localised "Untitled label" when document.name is empty', () => {
    documentRef.value = makeDoc();
    documentRef.value.name = '';
    const wrapper = mountPanel();
    expect(wrapper.find('.objects-list__item--document').text()).toContain('Untitled label');
  });

  it('renders the canvas size as a subtitle (mm-derived)', () => {
    const wrapper = mountPanel();
    // 696/300 * 25.4 ≈ 59mm; 1181/300 * 25.4 ≈ 100mm
    expect(wrapper.find('.objects-list__item--document').text()).toContain('59 × 100 mm');
  });

  it('shows continuous label for heightDots === 0', () => {
    documentRef.value = makeDoc();
    documentRef.value.canvas.heightDots = 0;
    const wrapper = mountPanel();
    expect(wrapper.find('.objects-list__item--document').text()).toContain('continuous');
  });

  it('clicking the document row selects $document (no shift handling)', async () => {
    const wrapper = mountPanel();
    await wrapper.find('.objects-list__row--document').trigger('click');
    expect(selectSpy).toHaveBeenCalledWith([DOCUMENT_SELECTION_ID]);
  });

  it('document row has no lock/visible/reorder controls', () => {
    const wrapper = mountPanel();
    const docRow = wrapper.find('.objects-list__item--document');
    expect(docRow.findAll('.objects-list__action').length).toBe(0);
  });

  it('document row reflects selected state via aria-pressed', async () => {
    selectionRef.value = [DOCUMENT_SELECTION_ID];
    const wrapper = mountPanel();
    expect(wrapper.find('.objects-list__row--document').attributes('aria-pressed')).toBe('true');
  });
});

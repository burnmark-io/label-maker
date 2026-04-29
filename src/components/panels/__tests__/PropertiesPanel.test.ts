import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { ref, computed } from 'vue';
import type { LabelDocument, LabelObject } from '@burnmark-io/designer-core';

import en from '@/i18n/locales/en.json';
import PropertiesPanel from '../PropertiesPanel.vue';
import { DOCUMENT_SELECTION_ID } from '@/stores/designer';
import type * as DesignerStore from '@/stores/designer';

const selectionRef = ref<string[]>([]);
const documentRef = ref<LabelDocument>(makeDoc());
const deselectSpy = vi.fn();

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
      heightDots: 0,
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

function makeText(id: string, name?: string): LabelObject {
  return {
    id,
    type: 'text',
    name,
    x: 0,
    y: 0,
    width: 100,
    height: 30,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    content: 'Hello',
    fontFamily: 'Arial',
    fontSize: 16,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    color: '#000',
    letterSpacing: 0,
    lineHeight: 1.2,
    invert: false,
    wrap: false,
    autoHeight: false,
  } as unknown as LabelObject;
}

vi.mock('@/stores/designer', async () => {
  const actual = await vi.importActual<typeof DesignerStore>('@/stores/designer');
  return {
    ...actual,
    useDesignerStore: () => ({
      get selection() {
        return selectionRef.value;
      },
      get selectedObjectIds() {
        return computed(() => selectionRef.value.filter(id => id !== DOCUMENT_SELECTION_ID)).value;
      },
      get document() {
        return documentRef.value;
      },
      deselect: deselectSpy,
      setDocumentInfo: vi.fn(),
      setCanvas: vi.fn(),
    }),
  };
});

function mountPanel() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(PropertiesPanel, {
    global: { plugins: [i18n] },
  });
}

describe('PropertiesPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    selectionRef.value = [];
    documentRef.value = makeDoc();
    deselectSpy.mockClear();
  });

  it('renders the empty state when no selection', () => {
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain('Pick an object to edit it.');
    expect(wrapper.find('.properties-panel__header').exists()).toBe(false);
  });

  it('renders the document branch when $document is selected', () => {
    selectionRef.value = [DOCUMENT_SELECTION_ID];
    const wrapper = mountPanel();
    expect(wrapper.find('.properties-panel__header').exists()).toBe(true);
    expect(wrapper.text()).toContain('Document');
    // Document branch shows the document fields, not the empty state.
    expect(wrapper.text()).not.toContain('Pick an object');
  });

  it('renders the object branch with the object name in the header', () => {
    documentRef.value = makeDoc([makeText('obj-1', 'Hello world')]);
    selectionRef.value = ['obj-1'];
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain('Hello world');
  });

  it('falls back to type when object has no name', () => {
    documentRef.value = makeDoc([makeText('obj-1')]);
    selectionRef.value = ['obj-1'];
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain('text');
  });

  it('renders multi-select header for >1 objects', () => {
    documentRef.value = makeDoc([makeText('obj-1', 'A'), makeText('obj-2', 'B')]);
    selectionRef.value = ['obj-1', 'obj-2'];
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain('2 items selected');
  });

  it('Deselect button calls designer.deselect()', async () => {
    documentRef.value = makeDoc([makeText('obj-1', 'A')]);
    selectionRef.value = ['obj-1'];
    const wrapper = mountPanel();
    await wrapper.find('.properties-panel__deselect').trigger('click');
    expect(deselectSpy).toHaveBeenCalledTimes(1);
  });

  it('hides type-specific component when multi-selecting (only common props)', () => {
    documentRef.value = makeDoc([makeText('obj-1', 'A'), makeText('obj-2', 'B')]);
    selectionRef.value = ['obj-1', 'obj-2'];
    const wrapper = mountPanel();
    // CommonProperties renders a Name field; TextProperties renders a Content textarea.
    // For multi-select we should see Name but not Content.
    expect(wrapper.text()).toContain('Name');
    expect(wrapper.text()).not.toContain('Content');
  });
});

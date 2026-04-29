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
const updateObjectSpy = vi.fn();

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
      updateObject: updateObjectSpy,
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
    updateObjectSpy.mockClear();
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

  it('multi-select: shows Appearance, hides type-specific and Position & size', () => {
    documentRef.value = makeDoc([makeText('obj-1', 'A'), makeText('obj-2', 'B')]);
    selectionRef.value = ['obj-1', 'obj-2'];
    const wrapper = mountPanel();
    // Appearance applies to all selected (opacity/visible/locked); Position
    // & Size is hidden because forcing two objects to the same X/Y/W/H
    // rarely matches intent.
    expect(wrapper.text()).toContain('Appearance');
    expect(wrapper.text()).not.toContain('Position & size');
    expect(wrapper.text()).not.toContain('Content');
  });

  it('does not render the name input in Properties (selection header owns the name)', () => {
    documentRef.value = makeDoc([makeText('obj-1', 'Hello world')]);
    selectionRef.value = ['obj-1'];
    const wrapper = mountPanel();
    // The header still shows the name. CommonProperties no longer has a Name input.
    const inputs = wrapper.findAll('input[type="text"]');
    expect(inputs.length).toBe(0);
  });

  it('renders type-specific section before Appearance and Position', () => {
    documentRef.value = makeDoc([makeText('obj-1', 'Hello')]);
    selectionRef.value = ['obj-1'];
    const wrapper = mountPanel();
    const text = wrapper.text();
    const contentIndex = text.indexOf('Content');
    const appearanceIndex = text.indexOf('Appearance');
    const positionIndex = text.indexOf('Position & size');
    expect(contentIndex).toBeGreaterThan(-1);
    expect(appearanceIndex).toBeGreaterThan(contentIndex);
    expect(positionIndex).toBeGreaterThan(appearanceIndex);
  });

  it('Position & size renders collapsed by default', () => {
    documentRef.value = makeDoc([makeText('obj-1', 'Hello')]);
    selectionRef.value = ['obj-1'];
    const wrapper = mountPanel();
    const positionTrigger = wrapper
      .findAll('.collapsible__trigger')
      .find(t => t.text().includes('Position & size'));
    expect(positionTrigger?.attributes('aria-expanded')).toBe('false');
  });

  it('selection header is renameable for single-object selection', async () => {
    documentRef.value = makeDoc([makeText('obj-1', 'Hello')]);
    selectionRef.value = ['obj-1'];
    const wrapper = mountPanel();
    const headerEditable = wrapper.find('.properties-panel__header .editable__display');
    expect(headerEditable.exists()).toBe(true);
    await headerEditable.trigger('click');
    const input = wrapper.find('.properties-panel__header .editable__input');
    (input.element as HTMLInputElement).value = 'Renamed';
    await input.trigger('input');
    await input.trigger('keydown.enter');
    expect(updateObjectSpy).toHaveBeenCalledWith('obj-1', { name: 'Renamed' });
  });

  it('selection header is NOT renameable for multi-select', () => {
    documentRef.value = makeDoc([makeText('obj-1', 'A'), makeText('obj-2', 'B')]);
    selectionRef.value = ['obj-1', 'obj-2'];
    const wrapper = mountPanel();
    expect(wrapper.find('.properties-panel__header .editable__display').exists()).toBe(false);
    expect(wrapper.find('.properties-panel__header').text()).toContain('2 items selected');
  });

  it('selection header is NOT renameable for the document branch', () => {
    selectionRef.value = [DOCUMENT_SELECTION_ID];
    const wrapper = mountPanel();
    expect(wrapper.find('.properties-panel__header .editable__display').exists()).toBe(false);
  });
});

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
const removeObjectSpy = vi.fn();

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
      removeObject: removeObjectSpy,
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
    removeObjectSpy.mockClear();
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

  describe('Selection header rename', () => {
    it('shows a persistent [✎] button for single-object selection', () => {
      documentRef.value = makeDoc([makeText('obj-1', 'Hello')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      const renameBtn = wrapper.find('.properties-panel__rename-btn');
      expect(renameBtn.exists()).toBe(true);
      expect(renameBtn.attributes('aria-label')).toBe('Rename');
      // No EditableText in the header anymore.
      expect(wrapper.find('.properties-panel__header .editable__display').exists()).toBe(false);
    });

    it('clicking the name itself does not enter rename mode', async () => {
      documentRef.value = makeDoc([makeText('obj-1', 'Hello')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      const nameSpan = wrapper.find('.properties-panel__header-context');
      await nameSpan.trigger('click');
      expect(wrapper.find('.properties-panel__rename-input').exists()).toBe(false);
    });

    it('clicking [✎] reveals the input pre-filled with the current name', async () => {
      documentRef.value = makeDoc([makeText('obj-1', 'Hello')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      await wrapper.find('.properties-panel__rename-btn').trigger('click');
      const input = wrapper.find<HTMLInputElement>('.properties-panel__rename-input');
      expect(input.exists()).toBe(true);
      expect(input.element.value).toBe('Hello');
    });

    it('Enter commits the edited name and returns to display state', async () => {
      documentRef.value = makeDoc([makeText('obj-1', 'Hello')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      await wrapper.find('.properties-panel__rename-btn').trigger('click');
      const input = wrapper.find('.properties-panel__rename-input');
      (input.element as HTMLInputElement).value = 'Renamed';
      await input.trigger('input');
      await input.trigger('keydown.enter');
      expect(updateObjectSpy).toHaveBeenCalledWith('obj-1', { name: 'Renamed' });
      expect(wrapper.find('.properties-panel__rename-input').exists()).toBe(false);
    });

    it('clicking [✓] commits the edited name', async () => {
      documentRef.value = makeDoc([makeText('obj-1', 'Hello')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      await wrapper.find('.properties-panel__rename-btn').trigger('click');
      const input = wrapper.find('.properties-panel__rename-input');
      (input.element as HTMLInputElement).value = 'From check';
      await input.trigger('input');
      await wrapper.find('.properties-panel__rename-confirm').trigger('click');
      expect(updateObjectSpy).toHaveBeenCalledWith('obj-1', { name: 'From check' });
    });

    it('Escape cancels — name unchanged, returns to display state', async () => {
      documentRef.value = makeDoc([makeText('obj-1', 'Hello')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      await wrapper.find('.properties-panel__rename-btn').trigger('click');
      const input = wrapper.find('.properties-panel__rename-input');
      (input.element as HTMLInputElement).value = 'Discarded';
      await input.trigger('input');
      await input.trigger('keydown.escape');
      // Subsequent blur fires after Escape (real DOM does this); commit
      // must early-return because renaming is already false.
      await input.trigger('blur');
      expect(updateObjectSpy).not.toHaveBeenCalled();
      expect(wrapper.find('.properties-panel__rename-input').exists()).toBe(false);
    });

    it('blur commits (same as Enter)', async () => {
      documentRef.value = makeDoc([makeText('obj-1', 'Hello')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      await wrapper.find('.properties-panel__rename-btn').trigger('click');
      const input = wrapper.find('.properties-panel__rename-input');
      (input.element as HTMLInputElement).value = 'Via blur';
      await input.trigger('input');
      await input.trigger('blur');
      expect(updateObjectSpy).toHaveBeenCalledWith('obj-1', { name: 'Via blur' });
    });

    it('empty submit reverts (no update)', async () => {
      documentRef.value = makeDoc([makeText('obj-1', 'Hello')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      await wrapper.find('.properties-panel__rename-btn').trigger('click');
      const input = wrapper.find('.properties-panel__rename-input');
      (input.element as HTMLInputElement).value = '   ';
      await input.trigger('input');
      await input.trigger('keydown.enter');
      expect(updateObjectSpy).not.toHaveBeenCalled();
    });

    it('Deselect button is hidden during rename and visible in display state', async () => {
      documentRef.value = makeDoc([makeText('obj-1', 'Hello')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      expect(wrapper.find('.properties-panel__deselect').exists()).toBe(true);
      await wrapper.find('.properties-panel__rename-btn').trigger('click');
      expect(wrapper.find('.properties-panel__deselect').exists()).toBe(false);
      await wrapper.find('.properties-panel__rename-input').trigger('keydown.escape');
      expect(wrapper.find('.properties-panel__deselect').exists()).toBe(true);
    });

    it('multi-select header has no [✎] button', () => {
      documentRef.value = makeDoc([makeText('obj-1', 'A'), makeText('obj-2', 'B')]);
      selectionRef.value = ['obj-1', 'obj-2'];
      const wrapper = mountPanel();
      expect(wrapper.find('.properties-panel__rename-btn').exists()).toBe(false);
      expect(wrapper.find('.properties-panel__header').text()).toContain('2 items selected');
    });

    it('document selection header has no [✎] button', () => {
      selectionRef.value = [DOCUMENT_SELECTION_ID];
      const wrapper = mountPanel();
      expect(wrapper.find('.properties-panel__rename-btn').exists()).toBe(false);
    });

    it('selecting a different object while in rename mode resets to display state', async () => {
      documentRef.value = makeDoc([makeText('obj-1', 'A'), makeText('obj-2', 'B')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      await wrapper.find('.properties-panel__rename-btn').trigger('click');
      expect(wrapper.find('.properties-panel__rename-input').exists()).toBe(true);
      selectionRef.value = ['obj-2'];
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.properties-panel__rename-input').exists()).toBe(false);
      expect(wrapper.find('.properties-panel__rename-btn').exists()).toBe(true);
    });

    it('renders auto-name placeholder in muted style when object has no custom name', () => {
      documentRef.value = makeDoc([makeText('obj-1')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      const ctx = wrapper.find('.properties-panel__header-context');
      expect(ctx.classes()).toContain('properties-panel__header-context--auto');
      expect(ctx.text()).toBe('text');
    });
  });

  describe('Delete affordance', () => {
    it('does not render Delete button when selection is empty', () => {
      const wrapper = mountPanel();
      expect(wrapper.find('.properties-panel__delete').exists()).toBe(false);
    });

    it('does not render Delete button for the document selection', () => {
      selectionRef.value = [DOCUMENT_SELECTION_ID];
      const wrapper = mountPanel();
      expect(wrapper.find('.properties-panel__delete').exists()).toBe(false);
    });

    it('renders "Delete {name}" for a single named object', () => {
      documentRef.value = makeDoc([makeText('obj-1', 'Greeting')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      const btn = wrapper.find('.properties-panel__delete');
      expect(btn.exists()).toBe(true);
      expect(btn.text()).toBe('Delete Greeting');
    });

    it('falls back to type when single object has no name', () => {
      documentRef.value = makeDoc([makeText('obj-1')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      expect(wrapper.find('.properties-panel__delete').text()).toBe('Delete text');
    });

    it('renders "Delete {n} items" for multi-select', () => {
      documentRef.value = makeDoc([makeText('obj-1', 'A'), makeText('obj-2', 'B')]);
      selectionRef.value = ['obj-1', 'obj-2'];
      const wrapper = mountPanel();
      expect(wrapper.find('.properties-panel__delete').text()).toBe('Delete 2 items');
    });

    it('truncates long single-object names and surfaces the full name in the tooltip', () => {
      const longName = 'Greeting on the front of the box for shipping orders';
      documentRef.value = makeDoc([makeText('obj-1', longName)]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      const btn = wrapper.find('.properties-panel__delete');
      // Truncated to ~30 chars + ellipsis.
      expect(btn.text().endsWith('…')).toBe(true);
      expect(btn.text().length).toBeLessThan(`Delete ${longName}`.length);
      expect(btn.attributes('title')).toBe(`Delete ${longName}`);
    });

    it('does not set a tooltip when the name fits under the truncation limit', () => {
      documentRef.value = makeDoc([makeText('obj-1', 'A')]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      const btn = wrapper.find('.properties-panel__delete');
      expect(btn.attributes('title')).toBeUndefined();
    });

    it('clicking Delete invokes removeObject for every selected id and clears selection', async () => {
      documentRef.value = makeDoc([makeText('obj-1', 'A'), makeText('obj-2', 'B')]);
      selectionRef.value = ['obj-1', 'obj-2'];
      const wrapper = mountPanel();
      await wrapper.find('.properties-panel__delete').trigger('click');
      expect(removeObjectSpy).toHaveBeenCalledWith('obj-1');
      expect(removeObjectSpy).toHaveBeenCalledWith('obj-2');
      expect(removeObjectSpy).toHaveBeenCalledTimes(2);
      expect(deselectSpy).toHaveBeenCalledTimes(1);
    });

    it('locked objects are deletable through the button (matches keyboard behaviour)', async () => {
      const locked = { ...makeText('obj-1', 'Locked'), locked: true } as LabelObject;
      documentRef.value = makeDoc([locked]);
      selectionRef.value = ['obj-1'];
      const wrapper = mountPanel();
      await wrapper.find('.properties-panel__delete').trigger('click');
      expect(removeObjectSpy).toHaveBeenCalledWith('obj-1');
    });
  });

  it('multi-select: toggling Visible in Appearance applies to every selected object', async () => {
    documentRef.value = makeDoc([makeText('obj-1', 'A'), makeText('obj-2', 'B')]);
    selectionRef.value = ['obj-1', 'obj-2'];
    const wrapper = mountPanel();
    const toggles = wrapper.findAll('.toggle__input');
    // First toggle is Visible, second is Locked.
    const visible = toggles[0]!.element as HTMLInputElement;
    visible.checked = false;
    await toggles[0]!.trigger('change');
    expect(updateObjectSpy).toHaveBeenCalledWith('obj-1', { visible: false });
    expect(updateObjectSpy).toHaveBeenCalledWith('obj-2', { visible: false });
  });
});

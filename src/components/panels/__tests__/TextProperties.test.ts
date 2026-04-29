import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import type { TextObject } from '@burnmark-io/designer-core';

import en from '@/i18n/locales/en.json';
import TextProperties from '../TextProperties.vue';
import type * as DesignerStore from '@/stores/designer';

const updateObjectSpy = vi.fn();

vi.mock('@/stores/designer', async () => {
  const actual = await vi.importActual<typeof DesignerStore>('@/stores/designer');
  return {
    ...actual,
    useDesignerStore: () => ({ updateObject: updateObjectSpy }),
  };
});

function makeText(): TextObject {
  return {
    id: 'obj-1',
    type: 'text',
    name: 'Text 1',
    x: 0,
    y: 0,
    width: 100,
    height: 30,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    content: 'Hello',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    color: '#000000',
    letterSpacing: 0,
    lineHeight: 1.2,
    invert: false,
    wrap: false,
    autoHeight: false,
  } as unknown as TextObject;
}

function mountText() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(TextProperties, {
    props: { object: makeText() },
    global: { plugins: [i18n] },
  });
}

describe('TextProperties', () => {
  beforeEach(() => {
    window.localStorage.clear();
    updateObjectSpy.mockClear();
  });

  it('renders the formatting toolbar above the content textarea', () => {
    const w = mountText();
    const html = w.html();
    const toolbarIndex = html.indexOf('aria-label="Bold"');
    const textareaIndex = html.indexOf('<textarea');
    expect(toolbarIndex).toBeGreaterThan(-1);
    expect(textareaIndex).toBeGreaterThan(-1);
    expect(toolbarIndex).toBeLessThan(textareaIndex);
  });

  it('Style sub-section is collapsed by default', () => {
    const w = mountText();
    const styleTrigger = w.findAll('.collapsible__trigger').find(t => t.text().includes('Style'));
    expect(styleTrigger?.attributes('aria-expanded')).toBe('false');
  });

  it('clicking Bold toggles fontWeight via update', async () => {
    const w = mountText();
    const boldButton = w.find('button[aria-label="Bold"]');
    await boldButton.trigger('click');
    expect(updateObjectSpy).toHaveBeenCalledWith('obj-1', { fontWeight: 'bold' });
  });

  it('typing in the content textarea updates content', async () => {
    const w = mountText();
    const ta = w.find('textarea');
    (ta.element as HTMLTextAreaElement).value = 'Updated';
    await ta.trigger('input');
    expect(updateObjectSpy).toHaveBeenCalledWith('obj-1', { content: 'Updated' });
  });
});

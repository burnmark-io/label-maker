import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import CollapsibleSection from '../CollapsibleSection.vue';

describe('CollapsibleSection', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders collapsed by default', () => {
    const w = mount(CollapsibleSection, {
      props: { title: 'Style' },
      slots: { default: '<p class="hidden-content">hidden</p>' },
    });
    expect(w.find('.collapsible__trigger').attributes('aria-expanded') === 'true').toBe(false);
    expect(w.find('.collapsible__trigger').attributes('aria-expanded')).toBe('false');
  });

  it('renders open when defaultOpen=true', () => {
    const w = mount(CollapsibleSection, {
      props: { title: 'Position', defaultOpen: true },
      slots: { default: '<p class="visible">shown</p>' },
    });
    expect(w.find('.collapsible__trigger').attributes('aria-expanded') === 'true').toBe(true);
    expect(w.find('.collapsible__trigger').attributes('aria-expanded')).toBe('true');
  });

  it('toggles on trigger click', async () => {
    const w = mount(CollapsibleSection, {
      props: { title: 'Style' },
    });
    await w.find('.collapsible__trigger').trigger('click');
    expect(w.find('.collapsible__trigger').attributes('aria-expanded') === 'true').toBe(true);
    await w.find('.collapsible__trigger').trigger('click');
    expect(w.find('.collapsible__trigger').attributes('aria-expanded') === 'true').toBe(false);
  });

  it('persists open state to localStorage when storageKey is given', async () => {
    const w = mount(CollapsibleSection, {
      props: { title: 'Style', storageKey: 'props.style.text' },
    });
    await w.find('.collapsible__trigger').trigger('click');
    expect(window.localStorage.getItem('props.style.text')).toBe('1');
    await w.find('.collapsible__trigger').trigger('click');
    expect(window.localStorage.getItem('props.style.text')).toBe('0');
  });

  it('reads persisted open state on mount and overrides defaultOpen', async () => {
    window.localStorage.setItem('props.style.text', '1');
    const w = mount(CollapsibleSection, {
      props: { title: 'Style', storageKey: 'props.style.text', defaultOpen: false },
    });
    await nextTick();
    expect(w.find('.collapsible__trigger').attributes('aria-expanded') === 'true').toBe(true);
  });

  it('respects defaultOpen when no persisted value exists', () => {
    const w = mount(CollapsibleSection, {
      props: { title: 'Position & Size', storageKey: 'props.position', defaultOpen: false },
    });
    expect(w.find('.collapsible__trigger').attributes('aria-expanded') === 'true').toBe(false);
  });

  it('re-reads persisted state when storageKey changes (swapping object types)', async () => {
    window.localStorage.setItem('props.style.text', '1');
    window.localStorage.setItem('props.style.image', '0');

    const w = mount(CollapsibleSection, {
      props: { title: 'Style', storageKey: 'props.style.text' },
    });
    await nextTick();
    expect(w.find('.collapsible__trigger').attributes('aria-expanded') === 'true').toBe(true);

    await w.setProps({ storageKey: 'props.style.image' });
    await nextTick();
    expect(w.find('.collapsible__trigger').attributes('aria-expanded') === 'true').toBe(false);
  });
});

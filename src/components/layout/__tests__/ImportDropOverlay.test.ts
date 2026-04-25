import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';

import en from '@/i18n/locales/en.json';
import ImportDropOverlay from '../ImportDropOverlay.vue';

const runImport = vi.fn(async () => {});

vi.mock('@/composables/useLabelImport', () => ({
  useLabelImport: () => ({ runImport }),
}));

function mountOverlay() {
  setActivePinia(createPinia());
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(ImportDropOverlay, { global: { plugins: [i18n] }, attachTo: document.body });
}

function dispatchDrag(name: string, types: string[], file?: File): DragEvent {
  const dt = {
    types,
    files: file ? ([file] as unknown as FileList) : ([] as unknown as FileList),
  } as unknown as DataTransfer;
  const event = new Event(name, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: dt });
  window.dispatchEvent(event);
  return event;
}

afterEach(() => {
  runImport.mockReset();
});

describe('ImportDropOverlay', () => {
  it('shows the overlay when a file drag enters the window', async () => {
    const wrapper = mountOverlay();
    dispatchDrag('dragenter', ['Files']);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.drop-overlay').exists()).toBe(true);
    wrapper.unmount();
  });

  it('hides the overlay when the matching dragleave fires', async () => {
    const wrapper = mountOverlay();
    dispatchDrag('dragenter', ['Files']);
    await wrapper.vm.$nextTick();
    dispatchDrag('dragleave', ['Files']);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.drop-overlay').exists()).toBe(false);
    wrapper.unmount();
  });

  it('does not show for non-file drags (text/html etc.)', async () => {
    const wrapper = mountOverlay();
    dispatchDrag('dragenter', ['text/html']);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.drop-overlay').exists()).toBe(false);
    wrapper.unmount();
  });

  it('runs the import when a file is dropped on the overlay', async () => {
    const wrapper = mountOverlay();
    dispatchDrag('dragenter', ['Files']);
    await wrapper.vm.$nextTick();
    const overlay = wrapper.find('.drop-overlay').element as HTMLElement;
    const file = new File(['{}'], 'x.label', { type: 'application/json' });
    const dt = {
      types: ['Files'],
      files: [file] as unknown as FileList,
    } as unknown as DataTransfer;
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dt });
    overlay.dispatchEvent(dropEvent);
    await wrapper.vm.$nextTick();
    expect(runImport).toHaveBeenCalledTimes(1);
    expect(runImport).toHaveBeenCalledWith(file);
    expect(wrapper.find('.drop-overlay').exists()).toBe(false);
    wrapper.unmount();
  });
});

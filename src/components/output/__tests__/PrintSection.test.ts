import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { ref } from 'vue';

import en from '@/i18n/locales/en.json';
import PrintSection from '../PrintSection.vue';
import { usePrintConfigStore } from '@/stores/print-config';

const isConnected = ref(true);
const effectiveMedia = ref<unknown>({ name: 'Test Media' });
const isPrinting = ref(false);
const model = ref<string | null>('Test Printer');
const printMock = vi.fn(async () => undefined);

vi.mock('@/stores/printer', () => ({
  usePrinterStore: () => ({
    get isConnected() {
      return isConnected.value;
    },
    get effectiveMedia() {
      return effectiveMedia.value;
    },
    get isPrinting() {
      return isPrinting.value;
    },
    get model() {
      return model.value;
    },
    print: printMock,
  }),
}));

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => ({
    document: {
      id: 'doc-1',
      canvas: { widthDots: 696, heightDots: 472, dpi: 300 },
      metadata: {},
    },
    renderToRGBA: vi.fn(async () => ({
      width: 100,
      height: 50,
      data: new Uint8ClampedArray(100 * 50 * 4),
    })),
  }),
}));

vi.mock('@/stores/data', () => ({
  useDataStore: () => ({ currentVariables: {}, rows: [], currentIndex: 0 }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    show: vi.fn(() => 'toast-id'),
    update: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

function mountSection() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(PrintSection, { global: { plugins: [i18n] } });
}

beforeEach(() => {
  setActivePinia(createPinia());
  isConnected.value = true;
  effectiveMedia.value = { name: 'Test Media' };
  isPrinting.value = false;
  printMock.mockClear();
});

describe('PrintSection', () => {
  it('still renders without a printer (PDF synth fallback keeps Print usable)', () => {
    // Rails not walls: a setup-less user can still hit Print and get
    // a PDF via the print-config 1-up sheet synth. PrintSection is
    // visible because sheetPossible is true even without a printer.
    isConnected.value = false;
    const wrapper = mountSection();
    expect(wrapper.find('.output-print').exists()).toBe(true);
  });

  it('renders when a printer is connected', () => {
    const wrapper = mountSection();
    expect(wrapper.find('.output-print').exists()).toBe(true);
  });

  it('binds copies + density to the print-config store', async () => {
    const wrapper = mountSection();
    const config = usePrintConfigStore();

    config.copies = 5;
    config.density = 'dark';
    await wrapper.vm.$nextTick();

    const copiesInput = wrapper.find('input[type="number"]').element as HTMLInputElement;
    const densitySelect = wrapper.find('select').element as HTMLSelectElement;
    expect(copiesInput.value).toBe('5');
    expect(densitySelect.value).toBe('dark');
  });

  it('disables Print button when there is no effective media', () => {
    effectiveMedia.value = null;
    const wrapper = mountSection();
    const button = wrapper.find('.output-print__action');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('clicking Print with copies = 1 invokes printer.print once', async () => {
    const wrapper = mountSection();
    const config = usePrintConfigStore();
    config.copies = 1;
    config.density = 'light';

    await wrapper.find('.output-print__action').trigger('click');
    await new Promise(r => setTimeout(r, 0));

    expect(printMock).toHaveBeenCalledTimes(1);
    expect(printMock).toHaveBeenCalledWith(expect.anything(), {
      copies: 1,
      density: 'light',
    });
  });

  it('button label and summary line reflect count when count > 1', async () => {
    const wrapper = mountSection();
    const config = usePrintConfigStore();
    config.copies = 5;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.output-print__action').text()).toBe('Print 5 labels');
    expect(wrapper.find('.output-print__summary').exists()).toBe(true);
    expect(wrapper.find('.output-print__summary').text()).toContain('5 labels');
  });

  it('button reads "Print" with no summary when count = 1', async () => {
    const wrapper = mountSection();
    const config = usePrintConfigStore();
    config.copies = 1;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.output-print__action').text()).toBe('Print');
    expect(wrapper.find('.output-print__summary').exists()).toBe(false);
  });
});

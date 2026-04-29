import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { ref } from 'vue';

import en from '@/i18n/locales/en.json';
import CanvasActions from '../CanvasActions.vue';

// Heavy-store stubs — CanvasActions reaches into many stores; for the
// dropdown-trim test we only care about which menu items render.
vi.mock('@/stores/printer', () => ({
  usePrinterStore: () => ({
    isConnected: false,
    isPrinting: false,
    model: null,
    connection: { kind: 'disconnected' },
    lastStatus: null,
    effectiveMedia: null,
    print: vi.fn(),
  }),
}));

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => ({
    document: {
      id: 'doc-1',
      name: 'Test',
      canvas: { widthDots: 100, heightDots: 100, dpi: 300 },
      objects: [],
    },
  }),
}));

vi.mock('@/stores/data', () => ({
  useDataStore: () => ({
    currentVariables: {},
    rows: [],
    mapping: {},
    hasData: false,
    currentIndex: 0,
  }),
}));

vi.mock('@/stores/library', () => ({
  useLibraryStore: () => ({ isFull: false }),
  LibraryFullError: class extends Error {},
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ show: vi.fn(), update: vi.fn(), dismiss: vi.fn() }),
}));

vi.mock('@/composables/useDocumentLifecycle', () => ({
  useDocumentLifecycle: () => ({
    confirmSwapWithSave: vi.fn(),
    newBlankDocument: vi.fn(),
    assignNewId: vi.fn(),
  }),
}));

vi.mock('@/composables/useLabelImport', () => ({
  useLabelImport: () => ({
    runImport: vi.fn(),
    saveCurrentToLibrary: vi.fn(),
  }),
}));

vi.mock('@/services/thumbnail', () => ({
  captureCanvasThumbnail: vi.fn(),
}));

import { CANVAS_VIEWPORT_KEY } from '@/composables/useCanvasViewport';

beforeEach(() => {
  setActivePinia(createPinia());
});

function mountActions() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(CanvasActions, {
    global: {
      plugins: [i18n],
      provide: {
        [CANVAS_VIEWPORT_KEY as symbol]: {
          zoom: ref(1),
          zoomIn: vi.fn(),
          zoomOut: vi.fn(),
          resetZoom: vi.fn(),
        },
      },
    },
  });
}

describe('CanvasActions — Save dropdown trim', () => {
  it('opens the Save dropdown with exactly four file-lifecycle items', async () => {
    const wrapper = mountActions();
    // The Save split-button: first the visible "Save" button, then the caret.
    // Click the caret to open the dropdown.
    await wrapper.find('.actions__btn--caret').trigger('click');

    const items = wrapper.findAll('.actions__dropdown [role="menuitem"]');
    const labels = items.map(b => b.text());
    expect(labels).toEqual(['Save', 'Save as new', 'New label', 'Library']);
  });

  it('omits Import / Export / Print Sheet / Share items', async () => {
    const wrapper = mountActions();
    await wrapper.find('.actions__btn--caret').trigger('click');

    const text = wrapper.find('.actions__dropdown').text();
    expect(text).not.toMatch(/Import/);
    expect(text).not.toMatch(/Export/);
    expect(text).not.toMatch(/Print to sticker sheet/);
    expect(text).not.toMatch(/Share/);
  });
});

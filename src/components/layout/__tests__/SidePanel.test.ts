import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { ref } from 'vue';
import type { LabelDocument } from '@burnmark-io/designer-core';

import en from '@/i18n/locales/en.json';
import SidePanel from '../SidePanel.vue';
import type * as DesignerStore from '@/stores/designer';

// Each child panel pulls in heavier modules (Konva-dependent canvas /
// vue-konva, designer-core renderer) that we don't need for these IA
// tests. Stub them.
vi.mock('@/components/panels/ObjectsPanel.vue', () => ({
  default: { name: 'ObjectsPanel', template: '<div data-testid="objects-panel" />' },
}));
vi.mock('@/components/panels/PropertiesPanel.vue', () => ({
  default: { name: 'PropertiesPanel', template: '<div data-testid="properties-panel" />' },
}));
vi.mock('@/components/panels/DataPanel.vue', () => ({
  default: { name: 'DataPanel', template: '<div data-testid="data-panel" />' },
}));
vi.mock('@/components/printer/PrintPreview.vue', () => ({
  default: { name: 'PrintPreview', template: '<div data-testid="preview-panel" />' },
}));

// Stub the auto-switch composable — it touches the designer store with
// real watchers; tested separately. Here we focus on tab structure.
vi.mock('@/composables/useTabAutoSwitch', () => ({
  useTabAutoSwitch: () => undefined,
}));

const selectionRef = ref<string[]>([]);
const documentRef = ref<LabelDocument>(makeDoc());

function makeDoc(): LabelDocument {
  return {
    id: 'doc-1',
    version: 1,
    name: 'My label',
    createdAt: '',
    updatedAt: '',
    canvas: {
      widthDots: 696,
      heightDots: 1181,
      dpi: 300,
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      background: '#ffffff',
      grid: { enabled: false, spacingDots: 10 },
      orientation: 'vertical',
    },
    objects: [],
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
      get selectedObjectIds() {
        return selectionRef.value.filter(id => id !== actual.DOCUMENT_SELECTION_ID);
      },
      get document() {
        return documentRef.value;
      },
    }),
  };
});

let matchMediaResult = false;

beforeEach(() => {
  setActivePinia(createPinia());
  window.localStorage.clear();
  selectionRef.value = [];
  matchMediaResult = false;

  // useMediaQuery polls matchMedia. Stub it so tests can flip mobile/desktop.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: matchMediaResult,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mountPanel() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(SidePanel, {
    global: { plugins: [i18n] },
  });
}

describe('SidePanel — tab structure', () => {
  it('renders four tabs in order: Objects, Properties, Data, Preview', () => {
    const wrapper = mountPanel();
    const labels = wrapper.findAll('.side-panel__tab').map(t => t.text());
    expect(labels.map(l => l.split(/\s/)[0])).toEqual(['Objects', 'Properties', 'Data', 'Preview']);
  });

  it('hides the Properties badge when nothing is selected', () => {
    const wrapper = mountPanel();
    expect(wrapper.find('.side-panel__tab-badge').exists()).toBe(false);
  });

  it('shows the count badge on Properties tab when ≥1 regular object selected', () => {
    selectionRef.value = ['obj-a', 'obj-b'];
    const wrapper = mountPanel();
    const badge = wrapper.find('.side-panel__tab-badge');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('2');
  });

  it('hides the badge for document selection (single state, not a count)', async () => {
    const { DOCUMENT_SELECTION_ID } = await import('@/stores/designer');
    selectionRef.value = [DOCUMENT_SELECTION_ID];
    const wrapper = mountPanel();
    expect(wrapper.find('.side-panel__tab-badge').exists()).toBe(false);
  });

  it('renders the panel matching the active tab', async () => {
    const wrapper = mountPanel();
    expect(wrapper.find('[data-testid="objects-panel"]').exists()).toBe(true);

    await wrapper.findAll('.side-panel__tab')[1]?.trigger('click');
    expect(wrapper.find('[data-testid="properties-panel"]').exists()).toBe(true);
  });
});

describe('SidePanel — mobile drawer gestures', () => {
  it('on mobile + collapsed: tap inactive tab expands AND switches', async () => {
    matchMediaResult = true; // simulate (max-width: 900px)
    const { usePreferencesStore } = await import('@/stores/preferences');
    const prefs = usePreferencesStore();
    prefs.sidePanelOpen = false;
    prefs.sidePanelTab = 'objects';

    const wrapper = mountPanel();
    await wrapper.findAll('.side-panel__tab')[2]?.trigger('click'); // Data
    expect(prefs.sidePanelOpen).toBe(true);
    expect(prefs.sidePanelTab).toBe('data');
  });

  it('on mobile + expanded: tap active tab collapses (no tab change)', async () => {
    matchMediaResult = true;
    const { usePreferencesStore } = await import('@/stores/preferences');
    const prefs = usePreferencesStore();
    prefs.sidePanelOpen = true;
    prefs.sidePanelTab = 'data';

    const wrapper = mountPanel();
    await wrapper.findAll('.side-panel__tab')[2]?.trigger('click'); // Data (active)
    expect(prefs.sidePanelOpen).toBe(false);
    expect(prefs.sidePanelTab).toBe('data');
  });

  it('on desktop: tap active tab is a no-op (stays expanded)', async () => {
    matchMediaResult = false; // desktop
    const { usePreferencesStore } = await import('@/stores/preferences');
    const prefs = usePreferencesStore();
    prefs.sidePanelOpen = true;
    prefs.sidePanelTab = 'data';

    const wrapper = mountPanel();
    await wrapper.findAll('.side-panel__tab')[2]?.trigger('click');
    expect(prefs.sidePanelOpen).toBe(true);
    expect(prefs.sidePanelTab).toBe('data');
  });
});

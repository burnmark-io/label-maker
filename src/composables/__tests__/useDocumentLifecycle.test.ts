import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';

import en from '@/i18n/locales/en.json';
import { __resetForTests } from '@/services/storage';
import { useLibraryStore } from '@/stores/library';
import { useDocumentLifecycle, type DocumentLifecycle } from '../useDocumentLifecycle';

interface DesignerStub {
  canUndo: boolean;
  document: { id: string; name: string; createdAt?: string; updatedAt?: string };
  loadDocument: ReturnType<typeof vi.fn>;
  newDocument: ReturnType<typeof vi.fn>;
  clearHistory: ReturnType<typeof vi.fn>;
}

const designerState: DesignerStub = {
  canUndo: false,
  document: { id: 'orig', name: 'X', createdAt: 'old', updatedAt: 'old' },
  loadDocument: vi.fn(),
  newDocument: vi.fn(),
  clearHistory: vi.fn(),
};

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => designerState,
}));

function withSetup(): DocumentLifecycle {
  let lifecycle!: DocumentLifecycle;
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  const Comp = defineComponent({
    setup() {
      lifecycle = useDocumentLifecycle();
      return () => h('div');
    },
  });
  mount(Comp, { global: { plugins: [i18n] } });
  return lifecycle;
}

async function resetIdb(): Promise<void> {
  await __resetForTests();
  await new Promise<void>(resolve => {
    const req = indexedDB.deleteDatabase('burnmark');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  setActivePinia(createPinia());
  designerState.canUndo = false;
  designerState.document = { id: 'orig', name: 'X', createdAt: 'old', updatedAt: 'old' };
  designerState.loadDocument.mockReset();
  designerState.newDocument.mockReset();
  designerState.clearHistory.mockReset();
  await resetIdb();
});

describe('useDocumentLifecycle.confirmDestructiveSwap', () => {
  it('resolves true without prompting when there is no undo history', async () => {
    const lifecycle = withSetup();
    designerState.canUndo = false;
    const result = await lifecycle.confirmDestructiveSwap();
    expect(result).toBe(true);
    expect(lifecycle.confirmer.open.value).toBe(false);
  });

  it('opens the confirmer when there is unsaved work', async () => {
    const lifecycle = withSetup();
    designerState.canUndo = true;
    const promise = lifecycle.confirmDestructiveSwap();
    expect(lifecycle.confirmer.open.value).toBe(true);
    lifecycle.confirmer.resolve();
    expect(await promise).toBe(true);
  });

  it('returns false when the user cancels', async () => {
    const lifecycle = withSetup();
    designerState.canUndo = true;
    const promise = lifecycle.confirmDestructiveSwap();
    lifecycle.confirmer.cancel();
    expect(await promise).toBe(false);
  });

  it('uses the generic replaceConfirm copy when called without an incoming name', async () => {
    const lifecycle = withSetup();
    designerState.canUndo = true;
    const promise = lifecycle.confirmDestructiveSwap();
    expect(lifecycle.confirmer.options.value?.message).toContain('unsaved changes will be lost');
    lifecycle.confirmer.resolve();
    await promise;
  });

  it('uses the name-aware replaceConfirmWithIncoming copy when called with an incoming name', async () => {
    const lifecycle = withSetup();
    designerState.canUndo = true;
    designerState.document.name = 'My great label';
    const promise = lifecycle.confirmDestructiveSwap({ incomingName: 'colleague.label' });
    const message = lifecycle.confirmer.options.value?.message ?? '';
    expect(message).toContain('My great label');
    expect(message).toContain('colleague.label');
    lifecycle.confirmer.resolve();
    await promise;
  });
});

describe('useDocumentLifecycle.assignNewId', () => {
  it('reloads the document with a fresh id and matching timestamps', () => {
    const lifecycle = withSetup();
    const before = new Date().toISOString();
    const next = lifecycle.assignNewId();
    expect(next).not.toBe('orig');
    expect(designerState.loadDocument).toHaveBeenCalledTimes(1);
    const passed = designerState.loadDocument.mock.calls[0][0] as {
      id: string;
      name: string;
      createdAt: string;
      updatedAt: string;
    };
    expect(passed.id).toBe(next);
    expect(passed.name).toBe('X');
    expect(passed.createdAt).toBe(passed.updatedAt);
    expect(passed.createdAt >= before).toBe(true);
  });

  it('clears history so undo cannot revert the id swap', () => {
    const lifecycle = withSetup();
    lifecycle.assignNewId();
    expect(designerState.clearHistory).toHaveBeenCalled();
  });
});

describe('useDocumentLifecycle.newBlankDocument', () => {
  it('resets the canvas and clears history', () => {
    const lifecycle = withSetup();
    lifecycle.newBlankDocument();
    expect(designerState.newDocument).toHaveBeenCalledTimes(1);
    expect(designerState.clearHistory).toHaveBeenCalledTimes(1);
  });
});

describe('useDocumentLifecycle integration with library.save', () => {
  it('save after assignNewId creates a new entry without touching the original', async () => {
    // loadDocument really needs to update designerState.document so the
    // next library.save sees the new id.
    designerState.loadDocument.mockImplementation((doc: DesignerStub['document']) => {
      designerState.document = { ...doc };
    });

    const library = useLibraryStore();
    await library.load();

    await library.save({
      ...designerState.document,
      canvas: { widthDots: 100, heightDots: 60, dpi: 300 },
      objects: [],
    } as never);
    expect(library.entries).toHaveLength(1);
    const originalId = designerState.document.id;

    const lifecycle = withSetup();
    const newId = lifecycle.assignNewId();

    await library.save({
      ...designerState.document,
      canvas: { widthDots: 100, heightDots: 60, dpi: 300 },
      objects: [],
    } as never);

    expect(library.entries).toHaveLength(2);
    expect(library.entries.find(e => e.id === originalId)).toBeDefined();
    expect(library.entries.find(e => e.id === newId)).toBeDefined();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { shallowRef, nextTick } from 'vue';

// A fake `LabelDesigner` mirroring the production reality: designer-core
// mutates `this.doc` in place and fires a 'change' event; designer-vue's
// ShallowRef reassignment is a no-op for identical references. The data
// store subscribes to the underlying designer's `change` event directly
// — this fake exposes the same surface so the same code path is exercised.
const changeListeners = new Set<() => void>();
let internalDoc: { objects: { content?: string }[] } = { objects: [] };
const documentRef = shallowRef(internalDoc);

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => ({
    get document() {
      return documentRef.value;
    },
    designer: {
      on(event: string, fn: () => void) {
        if (event === 'change') changeListeners.add(fn);
        return () => changeListeners.delete(fn);
      },
    },
    getPlaceholders: (): string[] => {
      const out = new Set<string>();
      for (const obj of internalDoc.objects) {
        if (typeof obj.content === 'string') {
          const matches = obj.content.matchAll(/\{\{\s*([\w-]+)\s*\}\}/g);
          for (const m of matches) out.add(m[1]);
        }
      }
      return [...out];
    },
  }),
}));

import { useDataStore } from '../data';

function setDocument(next: { objects: { content?: string }[] }): void {
  // In-place mutation followed by a `change` event — what designer-core
  // actually does for `update` / `add` / `remove`. Identity is preserved.
  internalDoc.objects = next.objects;
  for (const fn of changeListeners) fn();
}

describe('data store — placeholders reactivity', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    changeListeners.clear();
    internalDoc = { objects: [] };
    documentRef.value = internalDoc;
  });

  it('recomputes placeholders when the designer document changes', async () => {
    const data = useDataStore();
    expect(data.placeholders).toEqual([]);

    setDocument({ objects: [{ content: 'Hello {{name}}' }] });
    await nextTick();
    expect(data.placeholders).toEqual(['name']);

    setDocument({
      objects: [{ content: 'Hi {{name}}, you live in {{city}}' }],
    });
    await nextTick();
    expect(data.placeholders).toEqual(['name', 'city']);

    setDocument({ objects: [{ content: 'Plain text only' }] });
    await nextTick();
    expect(data.placeholders).toEqual([]);
  });
});

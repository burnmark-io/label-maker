import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { shallowRef, nextTick } from 'vue';

// A fake `LabelDesigner` whose document is a ShallowRef and whose
// `getPlaceholders()` reads its internal mirror — same pattern the real
// designer uses (it reads `this.doc` directly, not the ref).
const documentRef = shallowRef<{ objects: { content?: string }[] }>({ objects: [] });
let internalDoc = documentRef.value;

vi.mock('@/stores/designer', () => ({
  useDesignerStore: () => ({
    // Pinia stores expose refs unwrapped via the reactive proxy, which is
    // what the production code reads. A plain getter mirrors that
    // unwrap-on-access behaviour while keeping the underlying ref tracked.
    get document() {
      return documentRef.value;
    },
    getPlaceholders: (): string[] => {
      // Lifted from the real LabelDesigner: scan text content for {{name}}.
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
  internalDoc = next;
  documentRef.value = next; // identity swap — what designer-vue does on 'change'
}

describe('data store — placeholders reactivity', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setDocument({ objects: [] });
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

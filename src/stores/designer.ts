import { defineStore } from 'pinia';
import { computed, triggerRef } from 'vue';
import { useLabelDesigner } from '@burnmark-io/designer-vue';
import type {
  CanvasConfig,
  LabelObject,
  LabelObjectInput,
  LabelDocument,
  RawImageData,
} from '@burnmark-io/designer-core';
import { BurnmarkAssetLoader } from '@/services/asset-loader';

/**
 * Designer store — wraps `useLabelDesigner` from `@burnmark-io/designer-vue`
 * and exposes its reactive state and methods to the rest of the app.
 *
 * The composable owns the LabelDesigner. Konva, the properties panel, the
 * objects panel — they're all views over this state.
 */
export const useDesignerStore = defineStore('designer', () => {
  const assetLoader = new BurnmarkAssetLoader();

  const composable = useLabelDesigner({
    canvas: {
      widthDots: 696,
      heightDots: 0,
      dpi: 300,
    },
    name: 'Untitled label',
    renderOnMount: false,
    assetLoader,
  });

  // designer-core mutates `this.doc` in place for every `update`/`add`/
  // `remove`, so the composable's `document.value = designer.document`
  // assignment is the same reference and the ShallowRef short-circuits.
  // Force-trigger after every change so consumers that read through
  // `document` see the new field values.
  composable.designer.on('change', () => {
    triggerRef(composable.document);
  });

  // The raw doc and its objects keep the same identity after in-place
  // mutation. That's invisible to Vue's prop diff: ObjectsPanel rows
  // bind `obj.visible` / `obj.locked`, property panels pass `:object="obj"`
  // to children. Without fresh references, the visibility chevron, lock
  // toggle, colour picker, etc. show stale state until something else
  // forces a re-render. Wrap the document in a computed that returns a
  // shallow-cloned doc + per-object shallow clones each time the
  // underlying ShallowRef triggers. Cheap (object spreads on a doc with
  // ~tens of objects), no history corruption (originals untouched), and
  // every consumer becomes reactive to in-place edits without local
  // workarounds. Keep `composable.document` as the dep so we recompute
  // exactly when designer-core fires `change`.
  const reactiveDocument = computed<LabelDocument>(() => {
    const raw = composable.document.value;
    return {
      ...raw,
      objects: raw.objects.map(o => ({ ...o })),
    };
  });

  /**
   * Add a typed object input. The underlying API accepts the discriminated
   * union `LabelObjectInput`, but the union version of `Omit<U, 'id'>` is
   * the intersection of common keys — which loses subtype-specific fields.
   * Using a generic constraint keeps the call site fully typed.
   */
  function addObject<T extends LabelObject>(input: Omit<T, 'id'>): string {
    return composable.add(input as LabelObjectInput);
  }

  function updateObject(id: string, patch: Partial<LabelObject>): void {
    composable.update(id, patch);
  }

  function removeObject(id: string): void {
    composable.remove(id);
  }

  function loadDocument(doc: LabelDocument): void {
    composable.loadDocument(doc);
  }

  function setCanvas(patch: Partial<CanvasConfig>): void {
    composable.setCanvas(patch);
  }

  /**
   * Render the document to full-colour RGBA. The composable's `render()`
   * is fire-and-forget (updates `bitmap.value` and returns void); this
   * goes straight to the underlying `LabelDesigner.render()` for the
   * raw image, which is what the printer's `print()` and
   * `createPreview()` expect.
   */
  function renderToRGBA(variables?: Record<string, string>): Promise<RawImageData> {
    return composable.designer.render(variables);
  }

  return {
    document: reactiveDocument,
    selection: composable.selection,
    canUndo: composable.canUndo,
    canRedo: composable.canRedo,
    isRendering: composable.isRendering,
    bitmap: composable.bitmap,
    renderWarning: composable.renderWarning,
    renderError: composable.renderError,

    // Methods
    addObject,
    updateObject,
    removeObject,
    reorder: composable.reorder,
    select: composable.select,
    deselect: composable.deselect,
    loadDocument,
    newDocument: composable.newDocument,
    setCanvas,
    undo: composable.undo,
    redo: composable.redo,
    clearHistory: composable.clearHistory,
    getPlaceholders: composable.getPlaceholders,
    applyVariables: composable.applyVariables,
    render: composable.render,
    renderToRGBA,
    toJSON: composable.toJSON,
    fromJSON: composable.fromJSON,
    get: composable.get,
    getAll: composable.getAll,
    designer: composable.designer,
    assetLoader,

    // Export helpers from the composable.
    exportPng: composable.exportPng,
    exportPdf: composable.exportPdf,
    exportSheet: composable.exportSheet,
    exportBundled: composable.exportBundled,
  };
});

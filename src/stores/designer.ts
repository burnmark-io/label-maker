import { defineStore } from 'pinia';
import { useLabelDesigner } from '@burnmark-io/designer-vue';
import type {
  CanvasConfig,
  LabelObject,
  LabelObjectInput,
  LabelDocument,
} from '@burnmark-io/designer-core';

/**
 * Designer store — wraps `useLabelDesigner` from `@burnmark-io/designer-vue`
 * and exposes its reactive state and methods to the rest of the app.
 *
 * The composable owns the LabelDesigner. Konva, the properties panel, the
 * objects panel — they're all views over this state.
 */
export const useDesignerStore = defineStore('designer', () => {
  const composable = useLabelDesigner({
    canvas: {
      widthDots: 696,
      heightDots: 0,
      dpi: 300,
    },
    name: 'Untitled label',
    renderOnMount: false,
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

  return {
    document: composable.document,
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
    toJSON: composable.toJSON,
    fromJSON: composable.fromJSON,
    get: composable.get,
    getAll: composable.getAll,
    designer: composable.designer,
  };
});

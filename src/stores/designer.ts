import { defineStore } from 'pinia';
import { computed, triggerRef } from 'vue';
import { useLabelDesigner } from '@burnmark-io/designer-vue';

/**
 * Sentinel id used to represent "the document itself is selected" inside
 * the existing `selection: string[]` shape — keeps the selection model a
 * flat string array and avoids a discriminated-union migration. Mutually
 * exclusive with regular object ids: `select()` strips this if combined.
 */
export const DOCUMENT_SELECTION_ID = '$document';

export function isDocumentSelected(selection: readonly string[]): boolean {
  return selection.length === 1 && selection[0] === DOCUMENT_SELECTION_ID;
}
import {
  exportBundled as exportBundledCore,
  exportPdf as exportPdfCore,
  exportPng as exportPngCore,
  exportSheet as exportSheetCore,
  renderFull,
  type CanvasConfig,
  type LabelObject,
  type LabelObjectInput,
  type LabelDocument,
  type RawImageData,
  type RenderOptions,
  type SheetTemplate,
} from '@burnmark-io/designer-core';
import { BurnmarkAssetLoader } from '@/services/asset-loader';
import { autoNameFor, type TypeLabelKey } from '@/lib/naming/auto-name';
import { i18n } from '@/i18n';

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
   *
   * Auto-names new objects when the caller doesn't supply a `name`.
   * `<TypeLabel> <N>` where N is `max(parsed N for that pool) + 1` from
   * the document's current objects. Callers that pass a name (e.g. paste
   * preserving the source's name) keep theirs.
   */
  function addObject<T extends LabelObject>(input: Omit<T, 'id'>): string {
    const withName = ensureAutoName(input);
    return composable.add(withName as LabelObjectInput);
  }

  function autoNamePrefix(key: TypeLabelKey): string {
    return i18n.global.t(`objectTypes.${key}`);
  }

  function ensureAutoName<T extends LabelObject>(input: Omit<T, 'id'>): Omit<T, 'id'> {
    const objects = composable.designer.document.objects;
    const name = autoNameFor(input as Parameters<typeof autoNameFor>[0], objects, autoNamePrefix);
    if (name === undefined) return input;
    return { ...input, name } as Omit<T, 'id'>;
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
   * Persist the orientation flag on the canvas. The viewport composable
   * reads this to swap the on-screen frame; `getRenderDoc` reads it to
   * decide whether to swap canvas dims for the actual render.
   */
  function setOrientation(orientation: 'vertical' | 'horizontal'): void {
    composable.designer.setOrientation(orientation);
  }

  /**
   * Patch `document.metadata`. Designer-core's `metadata: Record<string, unknown>`
   * survives `toJSON`/`fromJSON`, so anything written here round-trips
   * through the share-encoder, IndexedDB and `.label` exports.
   *
   * Mutates in place + triggers the document ref so reactive consumers see
   * the new values. Not recorded in undo history — metadata isn't
   * undo-relevant (canvas source flag, sheet code, continuous length, etc.).
   */
  function setDocumentMetadata(patch: Record<string, unknown>): void {
    const raw = composable.designer.document;
    raw.metadata = { ...raw.metadata, ...patch };
    triggerRef(composable.document);
  }

  /**
   * Edit document name / description. designer-core has no public mutator
   * for these and the private `mutate` helper that pushes history isn't
   * exposed, so we mirror `setDocumentMetadata`'s pattern: mutate in place
   * + trigger the ref. Trade-off: name/description edits don't appear in
   * undo history. Acceptable for now — these fields previously had no
   * editable surface at all; adding undo is a designer-core enhancement.
   */
  function setDocumentInfo(patch: { name?: string; description?: string }): void {
    const raw = composable.designer.document;
    if (patch.name !== undefined) raw.name = patch.name;
    if (patch.description !== undefined) raw.description = patch.description;
    raw.updatedAt = new Date().toISOString();
    triggerRef(composable.document);
  }

  /**
   * Selection guard: document and regular object ids are mutually
   * exclusive selection scopes. If both are present (e.g. a Shift-click
   * adding a regular object while the document was selected), the regular
   * objects win and the sentinel is dropped — last user action takes
   * priority.
   */
  function select(ids: readonly string[]): void {
    const hasDoc = ids.includes(DOCUMENT_SELECTION_ID);
    const hasObj = ids.some(id => id !== DOCUMENT_SELECTION_ID);
    const next = hasDoc && hasObj ? ids.filter(id => id !== DOCUMENT_SELECTION_ID) : [...ids];
    composable.select(next);
  }

  /**
   * Selection filtered to regular object ids only — strips the
   * `$document` sentinel. Use this for any consumer that iterates
   * selection looking up actual `LabelObject`s; passing the sentinel to
   * `document.objects.find(...)` returns `undefined` and corrupts
   * downstream logic.
   */
  const selectedObjectIds = computed<string[]>(() =>
    composable.selection.value.filter(id => id !== DOCUMENT_SELECTION_ID),
  );

  /**
   * Doc snapshot used for rendering, exports, and the print pipeline.
   *
   * For a horizontal die-cut canvas we swap `widthDots`/`heightDots`
   * so the rendered bitmap matches the on-screen design view. Konva's
   * stage is also laid out at the swapped (display) dims via
   * `useCanvasViewport`, and object positions are stored in that same
   * stage coord space — rendering at the canonical dims would put the
   * bitmap and the user's drawing in different coordinate systems and
   * is what shipped the "label rotated 90°" bug.
   *
   * `orientation` on the clone is reset to `'vertical'` so any
   * orientation-aware downstream code (e.g. the exporter's
   * `respectOrientation` default) doesn't add a second rotation on top.
   *
   * Continuous tape (`heightDots === 0`) is intentionally left alone:
   * the renderer's growth-axis logic keys off `heightDots` and a clean
   * swap to "growth along x" needs more work. Horizontal continuous
   * is parked.
   */
  function getRenderDoc(): LabelDocument {
    const raw = composable.designer.document;
    const { canvas } = raw;
    if (canvas.orientation !== 'horizontal' || canvas.heightDots === 0) return raw;
    return {
      ...raw,
      canvas: {
        ...canvas,
        widthDots: canvas.heightDots,
        heightDots: canvas.widthDots,
        orientation: 'vertical',
      },
    };
  }

  /**
   * Render the document to full-colour RGBA at display dimensions
   * (orientation-corrected for horizontal die-cut). The bitmap is the
   * same shape the user sees on the canvas — the printer pipeline,
   * preview, and image exporters all consume this so what they get
   * matches what they designed.
   */
  function renderToRGBA(variables?: Record<string, string>): Promise<RawImageData> {
    const opts: RenderOptions = { assetLoader };
    if (variables) opts.variables = variables;
    return renderFull(getRenderDoc(), opts);
  }

  function exportPng(variables?: Record<string, string>, scale?: number): Promise<Blob> {
    return exportPngCore(getRenderDoc(), {
      assetLoader,
      ...(variables && { variables }),
      ...(scale !== undefined && { scale }),
    });
  }

  function exportPdf(
    rows?: Record<string, string>[],
    variables?: Record<string, string>,
  ): Promise<Blob> {
    return exportPdfCore(getRenderDoc(), rows, {
      assetLoader,
      ...(variables && { variables }),
    });
  }

  function exportSheet(
    sheet: SheetTemplate,
    rows?: Record<string, string>[],
    variables?: Record<string, string>,
  ): Promise<Blob> {
    return exportSheetCore(getRenderDoc(), sheet, rows, {
      assetLoader,
      ...(variables && { variables }),
    });
  }

  /**
   * Bundle the document JSON + referenced assets into a zip. Uses the
   * live document, not the render clone — the saved `.label` should
   * preserve the user's orientation choice and canonical dims so a
   * reload is a faithful round-trip.
   */
  function exportBundled(): Promise<{ blob: Blob; missing: string[] }> {
    return exportBundledCore(composable.designer.document, assetLoader);
  }

  return {
    document: reactiveDocument,
    selection: composable.selection,
    selectedObjectIds,
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
    select,
    deselect: composable.deselect,
    loadDocument,
    newDocument: composable.newDocument,
    setCanvas,
    setOrientation,
    setDocumentMetadata,
    setDocumentInfo,
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

    // Export helpers — orientation-aware via getRenderDoc so the produced
    // PNG/PDF/sheet output matches the on-screen design view.
    exportPng,
    exportPdf,
    exportSheet,
    exportBundled,
  };
});

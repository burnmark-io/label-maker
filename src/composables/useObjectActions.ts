import { useDesignerStore, isDocumentSelected } from '@/stores/designer';

/**
 * Shared object-level actions used by both keyboard shortcuts and panel UI
 * (e.g. the Properties tab's Delete button). Anything that mutates a
 * selection in the same way the keyboard shortcut would lives here so the
 * two surfaces stay in lock-step.
 */
export function useObjectActions() {
  const designer = useDesignerStore();

  function deleteSelection(): void {
    if (designer.selection.length === 0) return;
    if (isDocumentSelected(designer.selection)) return;
    for (const id of [...designer.selection]) designer.removeObject(id);
    designer.deselect();
  }

  return { deleteSelection };
}

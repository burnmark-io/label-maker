import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { useLibraryStore, LibraryFullError } from '@/stores/library';
import { useToast } from '@/composables/useToast';
import { useDocumentLifecycle } from '@/composables/useDocumentLifecycle';
import { captureCanvasThumbnail } from '@/services/thumbnail';
import { ImportError, importLabelFile, type ImportResult } from '@/services/label-import';

export interface LabelImport {
  runImport(file: File): Promise<void>;
  saveCurrentToLibrary(): Promise<boolean>;
}

/**
 * Shared import flow for `.label` and `.zip` files. Two surfaces use it:
 * the Save dropdown's `Import…` menu item and the global drag-and-drop
 * overlay. Three-way prompt before discarding unsaved work — Save & open,
 * Discard & open, or Cancel — so the user with in-flight edits can
 * preserve them in the library before the swap.
 */
export function useLabelImport(): LabelImport {
  const designer = useDesignerStore();
  const library = useLibraryStore();
  const lifecycle = useDocumentLifecycle();
  const { t } = useI18n();
  const { show, update, dismiss } = useToast();

  /**
   * Persist the current canvas to the library and return whether it
   * succeeded. On failure shows an error toast and returns false; the
   * caller should abort whatever swap they were about to do so the
   * user's in-flight work isn't lost. LibraryFullError gets a distinct
   * toast pointing the user at the library so they can free a slot.
   */
  async function saveCurrentToLibrary(): Promise<boolean> {
    const thumbnail = await captureCanvasThumbnail(designer);
    try {
      await library.save(designer.document, { thumbnail });
      return true;
    } catch (err) {
      if (err instanceof LibraryFullError) {
        show(t('library.fullOnSaveAndOpen', { count: library.MAX_SLOTS }), 'error');
      } else {
        show(t('library.saveError'), 'error');
      }
      return false;
    }
  }

  async function runImport(file: File): Promise<void> {
    const choice = await lifecycle.confirmSwapWithSave({ incomingName: file.name });
    if (choice === 'cancel') return;
    if (choice === 'save') {
      const savedName = designer.document.name;
      const ok = await saveCurrentToLibrary();
      if (!ok) return;
      show(t('lifecycle.savedThenOpening', { saved: savedName, incoming: file.name }), 'info', {
        ttlMs: 4000,
      });
    }

    const toastId = show(t('import.loading'), 'info', { sticky: true });

    let result: ImportResult;
    try {
      result = await importLabelFile(file, designer.assetLoader);
    } catch (err) {
      const code = err instanceof ImportError ? err.code : 'unknown-format';
      update(toastId, {
        message: t(`import.errors.${code}`),
        kind: 'error',
        sticky: false,
      });
      window.setTimeout(() => dismiss(toastId), 5000);
      return;
    }

    designer.loadDocument(result.doc);
    designer.clearHistory();

    const summary =
      result.kind === 'bundle' && result.missingAssetKeys.length > 0
        ? t('import.successWithMissing', { count: result.missingAssetKeys.length })
        : t('import.success');

    update(toastId, { message: summary, kind: 'success', sticky: false });
    window.setTimeout(() => dismiss(toastId), 4000);
  }

  return { runImport, saveCurrentToLibrary };
}

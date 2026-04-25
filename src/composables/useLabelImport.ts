import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { useToast } from '@/composables/useToast';
import { useDocumentLifecycle } from '@/composables/useDocumentLifecycle';
import { ImportError, importLabelFile, type ImportResult } from '@/services/label-import';

export interface LabelImport {
  runImport(file: File): Promise<void>;
}

/**
 * Shared import flow for `.label` and `.zip` files. Two surfaces use it:
 * the Save dropdown's `Import…` menu item and the global drag-and-drop
 * overlay. Confirms before discarding unsaved work, parses the file,
 * restores referenced asset bytes (bundle case), then loads the doc on
 * the canvas with cleared history.
 */
export function useLabelImport(): LabelImport {
  const designer = useDesignerStore();
  const lifecycle = useDocumentLifecycle();
  const { t } = useI18n();
  const { show, update, dismiss } = useToast();

  async function runImport(file: File): Promise<void> {
    if (!(await lifecycle.confirmDestructiveSwap({ incomingName: file.name }))) return;

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

  return { runImport };
}

import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { useConfirm, type ConfirmController } from './useConfirm';

export interface DocumentLifecycle {
  confirmer: ConfirmController;
  confirmDestructiveSwap(opts?: { incomingName?: string }): Promise<boolean>;
  newBlankDocument(): void;
  assignNewId(): string;
}

/**
 * Document lifecycle helpers shared by the toolbar's Save dropdown
 * and the library modal. Two responsibilities:
 *
 * 1. A single confirm-before-discard prompt so both surfaces agree on
 *    when to ask before throwing away the current document.
 * 2. The "mint a new id" path used by Save as new and the empty-slot
 *    "+" button. Implemented app-side via `loadDocument` so designer-
 *    core stays out of the id business.
 */
export function useDocumentLifecycle(): DocumentLifecycle {
  const designer = useDesignerStore();
  const { t } = useI18n();
  const confirmer = useConfirm();

  /**
   * Returns true to proceed, false to abort. The single "is there real
   * work to lose" signal is `designer.canUndo`: the first-visit sample,
   * freshly opened library docs, and freshly imported share docs all
   * call `clearHistory()` on load, so canUndo === false reliably means
   * "nothing the user could be surprised to lose."
   */
  async function confirmDestructiveSwap(opts: { incomingName?: string } = {}): Promise<boolean> {
    if (!designer.canUndo) return true;
    const messageKey = opts.incomingName
      ? 'library.replaceConfirmWithIncoming'
      : 'library.replaceConfirm';
    return confirmer.confirm({
      title: t('library.replaceConfirmTitle'),
      message: t(messageKey, {
        current: designer.document.name,
        incoming: opts.incomingName ?? '',
      }),
      confirmLabel: t('library.replaceConfirmAction'),
      cancelLabel: t('common.cancel'),
      tone: 'danger',
    });
  }

  function newBlankDocument(): void {
    designer.newDocument();
    designer.clearHistory();
  }

  /**
   * Mutate the current document so the next `library.save` creates a
   * new entry instead of updating the existing one. Done by reloading
   * the same content under a fresh id + timestamps. Clears history so
   * undo cannot revert the id and reattach the editor to the original
   * library slot.
   */
  function assignNewId(): string {
    const next = crypto.randomUUID();
    const now = new Date().toISOString();
    designer.loadDocument({
      ...designer.document,
      id: next,
      createdAt: now,
      updatedAt: now,
    });
    designer.clearHistory();
    return next;
  }

  return { confirmer, confirmDestructiveSwap, newBlankDocument, assignNewId };
}

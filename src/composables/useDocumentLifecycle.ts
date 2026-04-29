import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { useConfirm, type ConfirmController } from './useConfirm';

export type SwapChoice = 'proceed' | 'save' | 'discard' | 'cancel';

export interface DocumentLifecycle {
  confirmer: ConfirmController;
  confirmSwapWithSave(opts?: { incomingName?: string }): Promise<SwapChoice>;
  newBlankDocument(): void;
  assignNewId(): string;
}

// Module-scoped race guard. The confirmer is now a singleton (see
// useConfirm), which means two overlapping `confirm` calls cancel each
// other out — first call resolves to `false`. The boot-time hash read
// and the hashchange listener can plausibly collide; this guard makes
// the late entrant a silent no-op so the first one through wins instead
// of yanking the prompt out from under it.
const isSwapping = ref(false);

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
   * Three-way swap prompt. Returns one of:
   * - `'proceed'` — there is no work to lose; no prompt was shown. Caller
   *   should load without saving. Distinct from `'discard'` so callers
   *   can tell the prompt was skipped vs. the user actively chose discard.
   * - `'save'`  — save current to the library before loading the incoming.
   * - `'discard'` — load the incoming, throw away current canvas work.
   * - `'cancel'` — abort; canvas state preserved.
   */
  async function confirmSwapWithSave(
    opts: { incomingName?: string } = {},
  ): Promise<SwapChoice> {
    if (isSwapping.value) return 'cancel';
    isSwapping.value = true;
    try {
      if (!designer.canUndo) return 'proceed';
      const messageKey = opts.incomingName
        ? 'lifecycle.swapMessage'
        : 'lifecycle.swapMessageNoIncoming';
      const result = await confirmer.choose({
        title: t('lifecycle.swapTitle'),
        message: t(messageKey, {
          current: designer.document.name,
          incoming: opts.incomingName ?? '',
        }),
        primaryLabel: t('lifecycle.swapSaveAndOpen'),
        secondaryLabel: t('lifecycle.swapDiscardAndOpen'),
        cancelLabel: t('common.cancel'),
        primaryTone: 'primary',
        secondaryTone: 'danger',
      });
      if (result === 'primary') return 'save';
      if (result === 'secondary') return 'discard';
      return 'cancel';
    } finally {
      isSwapping.value = false;
    }
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

  return {
    confirmer,
    confirmSwapWithSave,
    newBlankDocument,
    assignNewId,
  };
}

/** Test-only helper: clear the swap guard between unit tests. */
export function __resetLifecycleForTests(): void {
  isSwapping.value = false;
}

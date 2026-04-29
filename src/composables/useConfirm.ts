import { ref, type Ref } from 'vue';

export type DialogTone = 'primary' | 'danger';

export interface ConfirmOptionsBase {
  title: string;
  message?: string;
  cancelLabel: string;
}

export interface ConfirmOptions extends ConfirmOptionsBase {
  confirmLabel: string;
  tone?: DialogTone;
}

export interface ChoiceOptions extends ConfirmOptionsBase {
  primaryLabel: string;
  secondaryLabel: string;
  primaryTone?: DialogTone;
  secondaryTone?: DialogTone;
}

export type DialogOptions = ConfirmOptions | ChoiceOptions;
export type ChoiceResult = 'primary' | 'secondary' | 'cancel';

export interface ConfirmController {
  open: Ref<boolean>;
  options: Ref<DialogOptions | null>;
  confirm(opts: ConfirmOptions): Promise<boolean>;
  choose(opts: ChoiceOptions): Promise<ChoiceResult>;
  resolve(): void;
  resolveSecondary(): void;
  cancel(): void;
}

export function isChoiceOptions(opts: DialogOptions): opts is ChoiceOptions {
  return 'secondaryLabel' in opts;
}

// Singleton state — every `useConfirm()` caller sees the same refs and
// closures. One `<ConfirmDialog>` mounted at the app shell is bound to
// these and renders for every prompt across the app, regardless of which
// component or composable initiated the confirm.
const open = ref(false);
const options = ref<DialogOptions | null>(null);
let confirmResolver: ((ok: boolean) => void) | null = null;
let chooseResolver: ((result: ChoiceResult) => void) | null = null;

function clearResolvers(): void {
  confirmResolver = null;
  chooseResolver = null;
}

function preempt(): void {
  // A new prompt overwrites any in-flight one. Resolve the previous
  // resolver to a benign cancel-equivalent so awaiters don't hang.
  confirmResolver?.(false);
  chooseResolver?.('cancel');
  clearResolvers();
}

function confirm(opts: ConfirmOptions): Promise<boolean> {
  preempt();
  options.value = opts;
  open.value = true;
  return new Promise<boolean>(resolve => {
    confirmResolver = resolve;
  });
}

function choose(opts: ChoiceOptions): Promise<ChoiceResult> {
  preempt();
  options.value = opts;
  open.value = true;
  return new Promise<ChoiceResult>(resolve => {
    chooseResolver = resolve;
  });
}

function resolve(): void {
  open.value = false;
  confirmResolver?.(true);
  chooseResolver?.('primary');
  clearResolvers();
}

function resolveSecondary(): void {
  open.value = false;
  // Secondary only exists in choose-mode. If a binary confirm somehow
  // received this call, fall through to cancel — safer than confirming.
  chooseResolver?.('secondary');
  confirmResolver?.(false);
  clearResolvers();
}

function cancel(): void {
  open.value = false;
  confirmResolver?.(false);
  chooseResolver?.('cancel');
  clearResolvers();
}

/**
 * Single-flight confirm dialog driver, shared app-wide. Pair with one
 * `<ConfirmDialog>` mounted at the app shell:
 *
 * ```vue
 * <ConfirmDialog
 *   :open="confirmer.open.value"
 *   v-bind="confirmer.options.value ?? {}"
 *   @confirm="confirmer.resolve"
 *   @secondary="confirmer.resolveSecondary"
 *   @cancel="confirmer.cancel"
 * />
 * ```
 *
 * Two shapes:
 * - `confirm({...})` returns `Promise<boolean>` — binary OK/Cancel.
 * - `choose({...})` returns `Promise<'primary' | 'secondary' | 'cancel'>`
 *   — three-button modal for save / discard / cancel style decisions.
 *
 * Concurrent calls are queued by overwriting — the previous resolver
 * resolves to its cancel-equivalent so a stuck handler doesn't hang.
 */
export function useConfirm(): ConfirmController {
  return { open, options, confirm, choose, resolve, resolveSecondary, cancel };
}

/** Test-only helper: clear shared state between unit tests. */
export function __resetConfirmForTests(): void {
  open.value = false;
  options.value = null;
  clearResolvers();
}

import { ref, type Ref } from 'vue';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'primary' | 'danger';
}

export interface ConfirmController {
  open: Ref<boolean>;
  options: Ref<ConfirmOptions | null>;
  confirm(opts: ConfirmOptions): Promise<boolean>;
  resolve(): void;
  cancel(): void;
}

// Singleton state — every `useConfirm()` caller sees the same refs and
// closures. One `<ConfirmDialog>` mounted at the app shell is bound to
// these and renders for every prompt across the app, regardless of which
// component or composable initiated the confirm.
const open = ref(false);
const options = ref<ConfirmOptions | null>(null);
let resolver: ((ok: boolean) => void) | null = null;

function confirm(opts: ConfirmOptions): Promise<boolean> {
  if (resolver) resolver(false);
  options.value = opts;
  open.value = true;
  return new Promise<boolean>(resolve => {
    resolver = resolve;
  });
}

function resolve(): void {
  open.value = false;
  resolver?.(true);
  resolver = null;
}

function cancel(): void {
  open.value = false;
  resolver?.(false);
  resolver = null;
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
 *   @cancel="confirmer.cancel"
 * />
 * ```
 *
 * Then await `confirmer.confirm({ ... })` from any handler. Returns
 * `true` if the user confirms, `false` for cancel / Escape / backdrop.
 *
 * Concurrent calls are queued by overwriting — the previous resolver
 * resolves to `false` so a stuck handler doesn't hang.
 */
export function useConfirm(): ConfirmController {
  return { open, options, confirm, resolve, cancel };
}

/** Test-only helper: clear shared state between unit tests. */
export function __resetConfirmForTests(): void {
  open.value = false;
  options.value = null;
  resolver = null;
}

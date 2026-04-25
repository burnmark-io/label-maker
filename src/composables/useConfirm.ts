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

/**
 * Single-flight confirm dialog driver. Pair with a `<ConfirmDialog>` in
 * the template:
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
 * resolves to `false` so a stuck handler doesn't hang. In practice the
 * UI prevents two confirms at once anyway.
 */
export function useConfirm(): ConfirmController {
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

  return { open, options, confirm, resolve, cancel };
}

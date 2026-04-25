import { ref } from 'vue';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Sticky toasts stay until explicitly dismissed (e.g. in-progress). */
  sticky: boolean;
}

const toasts = ref<Toast[]>([]);
let counter = 0;

/**
 * Tiny app-wide toast queue. Phase 8 will replace with a proper
 * accessible toast region; this is enough for Phase 4's print feedback.
 */
export function useToast(): {
  toasts: typeof toasts;
  show: (message: string, kind?: ToastKind, opts?: { sticky?: boolean; ttlMs?: number }) => number;
  dismiss: (id: number) => void;
  update: (id: number, patch: { message?: string; kind?: ToastKind; sticky?: boolean }) => void;
} {
  function show(
    message: string,
    kind: ToastKind = 'info',
    opts?: { sticky?: boolean; ttlMs?: number },
  ): number {
    counter += 1;
    const id = counter;
    const sticky = opts?.sticky ?? false;
    toasts.value = [...toasts.value, { id, kind, message, sticky }];
    if (!sticky) {
      const ttl = opts?.ttlMs ?? 4000;
      window.setTimeout(() => dismiss(id), ttl);
    }
    return id;
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter(toast => toast.id !== id);
  }

  function update(
    id: number,
    patch: { message?: string; kind?: ToastKind; sticky?: boolean },
  ): void {
    toasts.value = toasts.value.map(toast => (toast.id === id ? { ...toast, ...patch } : toast));
  }

  return { toasts, show, dismiss, update };
}

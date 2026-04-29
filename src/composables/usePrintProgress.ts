import { computed, ref } from 'vue';

export type PrintProgressKind =
  | 'idle'
  | 'generating-sheet'
  | 'printing'
  | 'error'
  | 'cancelled'
  | 'success';

export interface PrintProgressState {
  kind: PrintProgressKind;
  /** 0-based index of the row currently in flight (printing) or last attempted (error). */
  rowIndex: number;
  rowsTotal: number;
  copy: number;
  copiesPerRow: number;
  completed: number;
  total: number;
  errorMessage: string | null;
  errorRowIndex: number | null;
  /** Lets the user resume the batch from `errorRowIndex` after fixing the printer. */
  canResume: boolean;
}

const initial: PrintProgressState = {
  kind: 'idle',
  rowIndex: -1,
  rowsTotal: 0,
  copy: 0,
  copiesPerRow: 0,
  completed: 0,
  total: 0,
  errorMessage: null,
  errorRowIndex: null,
  canResume: false,
};

const state = ref<PrintProgressState>({ ...initial });
const cancelRequested = ref(false);
let resumeHandler: (() => void) | null = null;

export function usePrintProgress() {
  const isActive = computed(
    () =>
      state.value.kind === 'printing' ||
      state.value.kind === 'generating-sheet' ||
      state.value.kind === 'error',
  );

  const isVisible = computed(() => state.value.kind !== 'idle');

  function start(total: number, rowsTotal: number, copiesPerRow: number): void {
    cancelRequested.value = false;
    resumeHandler = null;
    state.value = {
      kind: 'printing',
      rowIndex: -1,
      rowsTotal,
      copy: 0,
      copiesPerRow,
      completed: 0,
      total,
      errorMessage: null,
      errorRowIndex: null,
      canResume: false,
    };
  }

  function startSheetGeneration(): void {
    cancelRequested.value = false;
    resumeHandler = null;
    state.value = { ...initial, kind: 'generating-sheet' };
  }

  function update(partial: Partial<PrintProgressState>): void {
    state.value = { ...state.value, ...partial };
  }

  function fail(rowIndex: number, message: string, onResume?: () => void): void {
    resumeHandler = onResume ?? null;
    state.value = {
      ...state.value,
      kind: 'error',
      errorRowIndex: rowIndex,
      errorMessage: message,
      canResume: !!onResume,
    };
  }

  function succeed(printed: number): void {
    state.value = { ...state.value, kind: 'success', completed: printed };
    // Auto-dismiss handled by the toast component.
  }

  function cancel(): void {
    cancelRequested.value = true;
  }

  function markCancelled(printed: number): void {
    state.value = { ...state.value, kind: 'cancelled', completed: printed };
  }

  function dismiss(): void {
    state.value = { ...initial };
    cancelRequested.value = false;
    resumeHandler = null;
  }

  function isCancelRequested(): boolean {
    return cancelRequested.value;
  }

  function resume(): void {
    if (!resumeHandler) return;
    const fn = resumeHandler;
    resumeHandler = null;
    fn();
  }

  return {
    state,
    isActive,
    isVisible,
    start,
    startSheetGeneration,
    update,
    fail,
    succeed,
    cancel,
    markCancelled,
    dismiss,
    isCancelRequested,
    resume,
  };
}

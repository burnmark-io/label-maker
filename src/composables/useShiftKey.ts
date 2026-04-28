import { ref, type Ref } from 'vue';

const shiftHeld = ref(false);
let listenersAttached = false;

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Shift') shiftHeld.value = true;
}

function onKeyUp(event: KeyboardEvent): void {
  if (event.key === 'Shift') shiftHeld.value = false;
}

function onBlur(): void {
  shiftHeld.value = false;
}

function ensureListeners(): void {
  if (listenersAttached || typeof window === 'undefined') return;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  listenersAttached = true;
}

/**
 * Single shared reactive flag that mirrors the Shift key state. Listeners
 * are attached once for the lifetime of the page; the ref is shared across
 * all callers so re-mounting components doesn't double-register.
 */
export function useShiftKey(): Ref<boolean> {
  ensureListeners();
  return shiftHeld;
}

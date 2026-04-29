import { computed, ref, type ComputedRef } from 'vue';
import { useShiftKey } from './useShiftKey';

const metaHeld = ref(false);
let listenersAttached = false;

function isBuildingMetaKey(event: KeyboardEvent): boolean {
  // Cmd on macOS, Ctrl elsewhere — both behave as the multi-select modifier
  // in design tools that already use Shift for range-select.
  return event.key === 'Meta' || event.key === 'Control';
}

function onKeyDown(event: KeyboardEvent): void {
  if (isBuildingMetaKey(event)) metaHeld.value = true;
}

function onKeyUp(event: KeyboardEvent): void {
  if (isBuildingMetaKey(event)) metaHeld.value = false;
}

function onBlur(): void {
  metaHeld.value = false;
}

function ensureListeners(): void {
  if (listenersAttached || typeof window === 'undefined') return;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  listenersAttached = true;
}

/**
 * True while a "selection-building" modifier (Shift, Cmd on macOS, Ctrl
 * elsewhere) is held. Used by the tab-auto-switch logic to defer
 * switching the user away from the Object tab while they're mid-gesture
 * building up a multi-selection.
 */
export function useBuildingModifier(): ComputedRef<boolean> {
  ensureListeners();
  const shiftHeld = useShiftKey();
  return computed(() => shiftHeld.value || metaHeld.value);
}

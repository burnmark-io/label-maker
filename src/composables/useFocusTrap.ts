import { nextTick, watch, type Ref } from 'vue';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',');

function focusableWithin(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    node => !node.hasAttribute('disabled') && node.offsetParent !== null,
  );
}

/**
 * Trap focus inside `containerRef` while `active` is true. Tab cycles within;
 * Shift+Tab cycles backwards. Restores focus to whatever was focused before
 * activation when the trap deactivates.
 */
export function useFocusTrap(containerRef: Ref<HTMLElement | null>, active: Ref<boolean>): void {
  let previouslyFocused: HTMLElement | null = null;

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const container = containerRef.value;
    if (!container) return;
    const items = focusableWithin(container);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (current === first || !container.contains(current)) {
        event.preventDefault();
        last.focus();
      }
    } else if (current === last) {
      event.preventDefault();
      first.focus();
    }
  }

  watch(
    active,
    async isActive => {
      if (typeof document === 'undefined') return;
      if (isActive) {
        previouslyFocused = document.activeElement as HTMLElement | null;
        document.addEventListener('keydown', onKeyDown, true);
        await nextTick();
        const container = containerRef.value;
        if (!container) return;
        const items = focusableWithin(container);
        const target = items[0] ?? container;
        target.focus({ preventScroll: true });
      } else {
        document.removeEventListener('keydown', onKeyDown, true);
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
          previouslyFocused.focus({ preventScroll: true });
        }
        previouslyFocused = null;
      }
    },
    { immediate: true },
  );
}

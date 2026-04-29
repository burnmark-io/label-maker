import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type { MediaDescriptor } from '@thermal-label/contracts';

/**
 * Cross-cutting banner for canvas-related notices that can't be a
 * silent change because the canvas has user content. Introduced for
 * the adopt-confirmation flow ("Detected X. [Use this size]") in
 * `amendment-printer-status-polling.md §4.5.2`. Sibling
 * `amendment-canvas-resize-and-first-print.md §5` extends the same
 * store with an `overflow` mode for the post-resize "{n} objects fall
 * outside the label" case — modes are mutually exclusive.
 */
export type ResizeBannerMode = 'idle' | 'adopt';

export interface AdoptPayload {
  media: MediaDescriptor;
  /** Human-readable printer label, composed at the call site. */
  printerName: string;
}

export const useResizeBannerStore = defineStore('resizeBanner', () => {
  const mode = ref<ResizeBannerMode>('idle');
  const payload = shallowRef<AdoptPayload | null>(null);

  function showAdopt(p: AdoptPayload): void {
    mode.value = 'adopt';
    payload.value = p;
  }

  function hide(): void {
    mode.value = 'idle';
    payload.value = null;
  }

  return { mode, payload, showAdopt, hide };
});

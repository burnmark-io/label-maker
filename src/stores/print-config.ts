import { defineStore } from 'pinia';
import { ref } from 'vue';

export type PrintDensity = 'light' | 'normal' | 'dark';

/**
 * Shared print configuration. Both the central toolbar Print popup and the
 * Output tab's Print section read/write here so the two surfaces stay in
 * lock-step. Separate from `printer.ts` (connection / status / model).
 *
 * Bulk-output amendment will extend this store with `OutputSelection`
 * (active/all/range) and `PrintDestination` (thermal/sheet).
 */
export const usePrintConfigStore = defineStore('print-config', () => {
  const copies = ref<number>(1);
  const density = ref<PrintDensity>('normal');

  return {
    copies,
    density,
  };
});

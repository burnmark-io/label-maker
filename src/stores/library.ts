import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface LibraryEntry {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  updatedAt: string;
}

/**
 * Library store. Phase 6 will back this with IndexedDB. Phase 1 just
 * scaffolds the store so the UI surface can be built.
 */
export const useLibraryStore = defineStore('library', () => {
  const entries = ref<LibraryEntry[]>([]);
  const MAX_SLOTS = 10;

  return {
    entries,
    MAX_SLOTS,
  };
});

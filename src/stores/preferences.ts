import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import type { SupportedLocale } from '@/i18n';

export type SidePanelTab = 'objects' | 'properties' | 'data' | 'preview';

/**
 * What happens when a CSV is dropped while the active dataset already has
 * rows. `'ask'` opens the import dialog; the other values skip the dialog
 * and apply the choice silently. Set via the dialog's "Remember this
 * choice" checkbox.
 */
export type CsvImportBehavior = 'ask' | 'append' | 'new';

/**
 * UI preferences. Persisted to localStorage. These are user-level
 * preferences (panel state, grid visibility, locale) — NOT document data.
 */
export const usePreferencesStore = defineStore('preferences', () => {
  const showGrid = useStorage<boolean>('burnmark.showGrid', true);
  const snapToGrid = useStorage<boolean>('burnmark.snapToGrid', true);
  const snapToObjects = useStorage<boolean>('burnmark.snapToObjects', true);
  const sidePanelOpen = useStorage<boolean>('burnmark.sidePanelOpen', true);
  const sidePanelTab = useStorage<SidePanelTab>('burnmark.sidePanelTab', 'objects');
  const locale = useStorage<SupportedLocale>('burnmark.locale', 'en');
  const tourCompleted = useStorage<boolean>('burnmark.tourCompleted', false);
  const sessionCount = useStorage<number>('burnmark.sessionCount', 0);
  const installPromptDismissedAt = useStorage<number>('burnmark.installPromptDismissedAt', 0);
  const csvImportBehavior = useStorage<CsvImportBehavior>('burnmark.csvImportBehavior', 'ask');
  const activeDatasetId = useStorage<string | null>('burnmark.activeDatasetId', null);

  return {
    showGrid,
    snapToGrid,
    snapToObjects,
    sidePanelOpen,
    sidePanelTab,
    locale,
    tourCompleted,
    sessionCount,
    installPromptDismissedAt,
    csvImportBehavior,
    activeDatasetId,
  };
});

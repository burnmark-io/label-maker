import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import type { SupportedLocale } from '@/i18n';

export type SidePanelTab = 'objects' | 'data' | 'preview';

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
  // One-shot migration: the merged Objects+Properties tab supersedes the
  // standalone Properties tab. Anyone whose persisted value is the old
  // 'properties' literal lands on the merged 'objects' tab on next boot.
  if ((sidePanelTab.value as string) === 'properties') {
    sidePanelTab.value = 'objects';
  }
  const locale = useStorage<SupportedLocale>('burnmark.locale', 'en');
  const tourCompleted = useStorage<boolean>('burnmark.tourCompleted', false);
  const sessionCount = useStorage<number>('burnmark.sessionCount', 0);
  const installPromptDismissedAt = useStorage<number>('burnmark.installPromptDismissedAt', 0);

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
  };
});

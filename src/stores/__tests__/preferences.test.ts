import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { usePreferencesStore } from '../preferences';

describe('preferences store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
  });

  it('starts with sane defaults', () => {
    const prefs = usePreferencesStore();
    expect(prefs.showGrid).toBe(true);
    expect(prefs.snapToGrid).toBe(true);
    expect(prefs.sidePanelOpen).toBe(true);
    expect(prefs.sidePanelTab).toBe('objects');
  });

  it('persists changes to localStorage', async () => {
    const prefs = usePreferencesStore();
    prefs.sessionCount += 2;
    await nextTick();
    expect(window.localStorage.getItem('burnmark.sessionCount')).toBe('2');
  });

  it('reads existing localStorage values', () => {
    window.localStorage.setItem('burnmark.sidePanelTab', 'data');
    const prefs = usePreferencesStore();
    expect(prefs.sidePanelTab).toBe('data');
  });

  it('migrates legacy "properties" tab value to "objects"', async () => {
    window.localStorage.setItem('burnmark.sidePanelTab', 'properties');
    const prefs = usePreferencesStore();
    expect(prefs.sidePanelTab).toBe('objects');
    await nextTick();
    expect(window.localStorage.getItem('burnmark.sidePanelTab')).toBe('objects');
  });
});

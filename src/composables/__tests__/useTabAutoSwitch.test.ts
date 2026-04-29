import { beforeEach, describe, expect, it } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useTabAutoSwitch } from '../useTabAutoSwitch';
import { useDesignerStore, DOCUMENT_SELECTION_ID } from '@/stores/designer';
import { usePreferencesStore } from '@/stores/preferences';

function pressKey(key: 'Shift' | 'Meta' | 'Control'): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function releaseKey(key: 'Shift' | 'Meta' | 'Control'): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

describe('useTabAutoSwitch', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    // Make sure no modifier state leaks from a previous test.
    releaseKey('Shift');
    releaseKey('Meta');
    releaseKey('Control');
  });

  it('switches Object → Properties on 0 → 1 selection', async () => {
    const scope = effectScope();
    scope.run(() => useTabAutoSwitch());
    const designer = useDesignerStore();
    const prefs = usePreferencesStore();
    expect(prefs.sidePanelTab).toBe('objects');

    designer.select(['obj-a']);
    await nextTick();
    expect(prefs.sidePanelTab).toBe('properties');
    scope.stop();
  });

  it('switches Properties → Object on 1 → 0 selection', async () => {
    const scope = effectScope();
    scope.run(() => useTabAutoSwitch());
    const designer = useDesignerStore();
    const prefs = usePreferencesStore();

    designer.select(['obj-a']);
    await nextTick();
    expect(prefs.sidePanelTab).toBe('properties');

    designer.deselect();
    await nextTick();
    expect(prefs.sidePanelTab).toBe('objects');
    scope.stop();
  });

  it('does not switch when user is manually on Data', async () => {
    const scope = effectScope();
    scope.run(() => useTabAutoSwitch());
    const designer = useDesignerStore();
    const prefs = usePreferencesStore();

    prefs.sidePanelTab = 'data';
    designer.select(['obj-a']);
    await nextTick();
    expect(prefs.sidePanelTab).toBe('data');

    designer.deselect();
    await nextTick();
    expect(prefs.sidePanelTab).toBe('data');
    scope.stop();
  });

  it('does not switch when user is manually on Output', async () => {
    const scope = effectScope();
    scope.run(() => useTabAutoSwitch());
    const designer = useDesignerStore();
    const prefs = usePreferencesStore();

    prefs.sidePanelTab = 'output';
    designer.select(['obj-a']);
    await nextTick();
    expect(prefs.sidePanelTab).toBe('output');
    scope.stop();
  });

  it('defers auto-switch while Shift is held; fires on release', async () => {
    const scope = effectScope();
    scope.run(() => useTabAutoSwitch());
    const designer = useDesignerStore();
    const prefs = usePreferencesStore();

    pressKey('Shift');
    await nextTick();

    designer.select(['obj-a']);
    await nextTick();
    expect(prefs.sidePanelTab).toBe('objects'); // still on Object — defer

    designer.select(['obj-a', 'obj-b']);
    await nextTick();
    expect(prefs.sidePanelTab).toBe('objects'); // still deferring during Shift chain

    releaseKey('Shift');
    await nextTick();
    expect(prefs.sidePanelTab).toBe('properties');
    scope.stop();
  });

  it('respects current tab on modifier release (no hijack if user manually moved to Data mid-gesture)', async () => {
    const scope = effectScope();
    scope.run(() => useTabAutoSwitch());
    const designer = useDesignerStore();
    const prefs = usePreferencesStore();

    pressKey('Shift');
    await nextTick();
    designer.select(['obj-a', 'obj-b']);
    await nextTick();

    // User taps Data mid-gesture.
    prefs.sidePanelTab = 'data';
    await nextTick();

    releaseKey('Shift');
    await nextTick();
    expect(prefs.sidePanelTab).toBe('data');
    scope.stop();
  });

  it('treats document selection as a non-empty selection for the switch rule', async () => {
    const scope = effectScope();
    scope.run(() => useTabAutoSwitch());
    const designer = useDesignerStore();
    const prefs = usePreferencesStore();

    designer.select([DOCUMENT_SELECTION_ID]);
    await nextTick();
    expect(prefs.sidePanelTab).toBe('properties');
    scope.stop();
  });

  it('Cmd / Meta also defers like Shift', async () => {
    const scope = effectScope();
    scope.run(() => useTabAutoSwitch());
    const designer = useDesignerStore();
    const prefs = usePreferencesStore();

    pressKey('Meta');
    await nextTick();
    designer.select(['obj-a']);
    await nextTick();
    expect(prefs.sidePanelTab).toBe('objects');

    releaseKey('Meta');
    await nextTick();
    expect(prefs.sidePanelTab).toBe('properties');
    scope.stop();
  });
});

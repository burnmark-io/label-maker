import { beforeEach, describe, expect, it } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { usePageTitle } from '../usePageTitle';
import { useDesignerStore } from '@/stores/designer';

describe('usePageTitle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.title = 'something-else';
  });

  it('falls back to "burnmark" for the store default name ("Untitled label")', () => {
    const scope = effectScope();
    scope.run(() => usePageTitle());
    expect(document.title).toBe('burnmark');
    scope.stop();
  });

  it('reflects a real name as "{name} — burnmark"', async () => {
    const scope = effectScope();
    scope.run(() => usePageTitle());
    const designer = useDesignerStore();

    designer.setDocumentInfo({ name: 'Address' });
    await nextTick();
    expect(document.title).toBe('Address — burnmark');
    scope.stop();
  });

  it('collapses back to "burnmark" when renamed to the default', async () => {
    const scope = effectScope();
    scope.run(() => usePageTitle());
    const designer = useDesignerStore();

    designer.setDocumentInfo({ name: 'Address' });
    await nextTick();
    expect(document.title).toBe('Address — burnmark');

    designer.setDocumentInfo({ name: 'Untitled label' });
    await nextTick();
    expect(document.title).toBe('burnmark');
    scope.stop();
  });

  it('treats empty name as the fallback', async () => {
    const scope = effectScope();
    scope.run(() => usePageTitle());
    const designer = useDesignerStore();

    designer.setDocumentInfo({ name: '' });
    await nextTick();
    expect(document.title).toBe('burnmark');
    scope.stop();
  });

  it('treats whitespace-only name as the fallback', async () => {
    const scope = effectScope();
    scope.run(() => usePageTitle());
    const designer = useDesignerStore();

    designer.setDocumentInfo({ name: '   ' });
    await nextTick();
    expect(document.title).toBe('burnmark');
    scope.stop();
  });

  it('trims surrounding whitespace from the displayed name', async () => {
    const scope = effectScope();
    scope.run(() => usePageTitle());
    const designer = useDesignerStore();

    designer.setDocumentInfo({ name: '  Shipping  ' });
    await nextTick();
    expect(document.title).toBe('Shipping — burnmark');
    scope.stop();
  });

  it('updates reactively across multiple renames', async () => {
    const scope = effectScope();
    scope.run(() => usePageTitle());
    const designer = useDesignerStore();

    designer.setDocumentInfo({ name: 'One' });
    await nextTick();
    expect(document.title).toBe('One — burnmark');

    designer.setDocumentInfo({ name: 'Two' });
    await nextTick();
    expect(document.title).toBe('Two — burnmark');

    designer.setDocumentInfo({ name: 'Three' });
    await nextTick();
    expect(document.title).toBe('Three — burnmark');
    scope.stop();
  });
});

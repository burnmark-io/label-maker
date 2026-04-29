import { describe, expect, it, vi } from 'vitest';
import { handleLaunchTargetURL } from '../pwa-launch';

function makeCtx(overrides: Partial<Parameters<typeof handleLaunchTargetURL>[1]> = {}) {
  return {
    currentOrigin: 'https://burnmark.app',
    currentPathname: '/',
    currentSearch: '',
    currentHash: '',
    replaceState: vi.fn(),
    onHashChange: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('handleLaunchTargetURL', () => {
  it('rewrites history and triggers onHashChange for a same-origin hash URL', async () => {
    const ctx = makeCtx();
    await handleLaunchTargetURL('https://burnmark.app/#XYZ', ctx);
    expect(ctx.replaceState).toHaveBeenCalledWith('/#XYZ');
    expect(ctx.onHashChange).toHaveBeenCalledTimes(1);
  });

  it('skips the off-origin URL without touching history or hash flow', async () => {
    const ctx = makeCtx();
    await handleLaunchTargetURL('https://evil.example/#XYZ', ctx);
    expect(ctx.replaceState).not.toHaveBeenCalled();
    expect(ctx.onHashChange).not.toHaveBeenCalled();
  });

  it('rewrites history but does not call onHashChange when there is no hash', async () => {
    const ctx = makeCtx();
    await handleLaunchTargetURL('https://burnmark.app/library', ctx);
    expect(ctx.replaceState).toHaveBeenCalledWith('/library');
    expect(ctx.onHashChange).not.toHaveBeenCalled();
  });

  it('does not rewrite history when the target equals the current location', async () => {
    const ctx = makeCtx({
      currentPathname: '/',
      currentSearch: '',
      currentHash: '#XYZ',
    });
    await handleLaunchTargetURL('https://burnmark.app/#XYZ', ctx);
    expect(ctx.replaceState).not.toHaveBeenCalled();
    // Hash present — hashchange flow still runs so the user can re-load.
    expect(ctx.onHashChange).toHaveBeenCalledTimes(1);
  });

  it('treats a bare "#" (length <= 1) as no hash and skips onHashChange', async () => {
    const ctx = makeCtx();
    await handleLaunchTargetURL('https://burnmark.app/#', ctx);
    expect(ctx.onHashChange).not.toHaveBeenCalled();
  });

  it('ignores a malformed targetURL string', async () => {
    const ctx = makeCtx();
    await handleLaunchTargetURL('not-a-url', ctx);
    expect(ctx.replaceState).not.toHaveBeenCalled();
    expect(ctx.onHashChange).not.toHaveBeenCalled();
  });

  it('preserves search params when syncing history', async () => {
    const ctx = makeCtx();
    await handleLaunchTargetURL('https://burnmark.app/library?q=foo#XYZ', ctx);
    expect(ctx.replaceState).toHaveBeenCalledWith('/library?q=foo#XYZ');
    expect(ctx.onHashChange).toHaveBeenCalledTimes(1);
  });

  it('compares origins (port mismatch is off-origin)', async () => {
    const ctx = makeCtx({ currentOrigin: 'http://localhost:5173' });
    await handleLaunchTargetURL('http://localhost:9999/#XYZ', ctx);
    expect(ctx.replaceState).not.toHaveBeenCalled();
    expect(ctx.onHashChange).not.toHaveBeenCalled();
  });
});

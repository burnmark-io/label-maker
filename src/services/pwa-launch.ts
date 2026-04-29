/**
 * PWA link-capture helper. Chromium's launchQueue routes captured
 * navigations into an already-open PWA window via `targetURL`. This
 * helper writes the URL into history (so the existing hashchange
 * listener and post-unlock hash-read see it) and triggers the
 * share-link flow when the URL carries a non-empty hash.
 *
 * The browser surface is injected as a `LaunchURLContext` so the
 * routing decisions are unit-testable without mounting AppShell.
 */
export interface LaunchURLContext {
  currentOrigin: string;
  currentPathname: string;
  currentSearch: string;
  currentHash: string;
  replaceState: (path: string) => void;
  onHashChange: () => Promise<void>;
}

export async function handleLaunchTargetURL(
  targetURL: string,
  ctx: LaunchURLContext,
): Promise<void> {
  let url: URL;
  try {
    url = new URL(targetURL);
  } catch {
    return;
  }
  if (url.origin !== ctx.currentOrigin) return;

  const newPath = url.pathname + url.search + url.hash;
  const oldPath = ctx.currentPathname + ctx.currentSearch + ctx.currentHash;
  if (newPath !== oldPath) {
    ctx.replaceState(newPath);
  }
  if (url.hash.length > 1) {
    await ctx.onHashChange();
  }
}

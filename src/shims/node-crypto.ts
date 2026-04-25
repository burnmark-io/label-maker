/**
 * Browser shim for `node:crypto`. designer-core's `id.js` imports
 * `randomUUID` for its Node fallback, but the runtime check prefers
 * `globalThis.crypto.randomUUID` which exists in all modern browsers.
 * The shim is never actually invoked in the browser path.
 */
export function randomUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  throw new Error('randomUUID is not available in this environment');
}

export default { randomUUID };

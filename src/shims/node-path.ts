/**
 * Browser shim for `node:path`. designer-core only enters the Node code
 * path when `globalThis.FontFace` is undefined, which never happens in
 * a browser; these stubs satisfy the bundler.
 */
export function dirname(p: string): string {
  const idx = p.lastIndexOf('/');
  return idx < 0 ? '.' : p.slice(0, idx);
}

export function resolve(...parts: string[]): string {
  return parts.filter(Boolean).join('/');
}

export default { dirname, resolve };

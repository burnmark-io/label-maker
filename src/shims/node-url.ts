/**
 * Browser shim for `node:url`. designer-core's `fonts.js` uses these
 * functions only on the Node code path; the browser path uses URL +
 * import.meta.url and never calls into these.
 */
export function fileURLToPath(url: string | URL): string {
  return typeof url === 'string' ? url : url.toString();
}

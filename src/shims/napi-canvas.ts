/**
 * Browser shim for `@napi-rs/canvas`. designer-core dynamically imports
 * this for Node-side font registration and rendering. In the browser
 * the dynamic import is never reached because the FontFace branch wins.
 * Importing this module from browser code throws so the failure is loud
 * if the path is ever taken accidentally.
 */
function unavailable(): never {
  throw new Error('@napi-rs/canvas is not available in browser builds');
}

export const GlobalFonts: Record<string, unknown> = new Proxy(
  {},
  {
    get: () => unavailable,
  },
);

export default { GlobalFonts };

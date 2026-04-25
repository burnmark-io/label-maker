# label-maker — Blockers

Genuinely blocking issues that need human input. Each entry: what was tried,
what's needed, what was worked around in the meantime.

> **Reverting workarounds**: every `(soft)` entry below that lists a
> "Revert when fixed" checklist describes a hack that exists only to
> compensate for an unreleased dependency fix. When the dependency
> ships, work through the checklist top-to-bottom — each item is the
> exact path to delete or revert.

## (soft) designer-core ships a Node-aware bundle

**Affected version:** `@burnmark-io/designer-core@0.1.0`
**See also:** D1 in DECISIONS.md.

The bundle imports `node:crypto`, `node:url`, `node:path`, and
dynamically imports `@napi-rs/canvas`. The runtime guards
(`globalThis.FontFace`, `globalThis.crypto.randomUUID`) ensure the Node
paths are unreachable in a browser, but bundlers still need to resolve
the imports.

**Upstream fix (designer-core):** add a `./browser` export condition in
`package.json` that points at a build with the Node paths stripped.
The browser path can either inline a tiny `randomUUID()` polyfill or
require the WebCrypto-backed one. `@napi-rs/canvas` should be lazy-
imported only on the Node code path.

**Revert when fixed (this repo):**
- [ ] Delete `src/shims/node-crypto.ts`
- [ ] Delete `src/shims/node-url.ts`
- [ ] Delete `src/shims/node-path.ts`
- [ ] Delete `src/shims/napi-canvas.ts`
- [ ] Remove the four matching aliases from `vite.config.ts`

## (soft) No git remote configured

The repo has no `origin` remote. Each phase commits locally; pushes
are no-ops. The operator should `git remote add origin
git@github.com:burnmark-io/label-maker.git` (once the repo exists)
and push the local branch.

## (soft) Android OTG scenario not verified

Phase 9 (step 65) calls for testing the Android + USB-C OTG path
(Chrome Android claims a connected printer through an OTG adapter).
No Android device was attached during this session, so the path is
unexercised. Code-wise the WebUSB flow is identical to desktop Chrome
— the operator should physically validate before announcing Android
support. Operator action: pair a QL-820NWB or a LabelWriter via OTG,
load the deployed PWA in Chrome Android, and confirm
connect → preview → print works.

## (soft) designer-core barcode path can't render in Chromium

**Affected version:** `@burnmark-io/designer-core@0.1.0`
**Affected code:** `dist/render/barcode.js` →
`BarcodeEngine.renderToImage()` (browser branch)
**See also:** D17 in DECISIONS.md.

The browser branch renders barcodes via:

```js
const svg = bwip.toSVG(opts);                          // viewBox-only SVG
const blob = new Blob([svg], { type: 'image/svg+xml' });
const bitmap = await createImageBitmap(blob);          // (1)
return { image: bitmap, width: bitmap.width, height: bitmap.height };
```

This trips two Chromium gaps in succession:

1. **`createImageBitmap(svgBlob)` is unsupported in Chromium** —
   throws `InvalidStateError: The source image could not be decoded`.
   Firefox decodes SVG blobs natively; Chromium has never shipped it
   (open issue since at least 2018).
2. **Even with an `HTMLImageElement` indirection, bwip-js's `toSVG()`
   output has only `viewBox`, no `width`/`height` attributes** — so
   the decoded image has zero `naturalWidth`/`naturalHeight`. Calling
   `createImageBitmap(img)` then fails ("no resize options are
   specified"); supplying `resizeWidth`/`resizeHeight` instead scales
   a 0×0 source to the target size, yielding a fully transparent
   bitmap (no error, but the barcode renders blank).

**Upstream fix options (designer-core), pick one:**

a) **Use bwip-js's `toCanvas(canvas, opts)`** in the browser branch.
   It rasterises directly to a Canvas2D, no SVG involved — bypasses
   both bugs in one stroke. Wrap with `createImageBitmap(canvas)` for
   the existing return shape.

b) **Keep the SVG approach but inject `width`/`height` from the
   viewBox before blobbing**, then go through an `HTMLImageElement`:
   ```js
   const svg = bwip.toSVG(opts);
   const sized = injectWidthHeightFromViewBox(svg);
   const blob = new Blob([sized], { type: 'image/svg+xml' });
   const url = URL.createObjectURL(blob);
   try {
     const img = new Image();
     img.src = url;
     await img.decode();
     return { image: await createImageBitmap(img), width: img.naturalWidth, height: img.naturalHeight };
   } finally {
     URL.revokeObjectURL(url);
   }
   ```

(a) is simpler. (b) matches what we're doing here in the shim.

**Worked around with:** `src/shims/createImageBitmap-svg.ts` —
patches `globalThis.createImageBitmap` at app startup so SVG blobs
get the inject-then-image-element treatment transparently. Every
other input flows to native unchanged.

**Revert when fixed (this repo):**
- [ ] Delete `src/shims/createImageBitmap-svg.ts`
- [ ] Delete `src/shims/__tests__/createImageBitmap-svg.test.ts`
- [ ] Remove the `patchCreateImageBitmap()` import + call from
      `src/main.ts`
- [ ] Delete decision **D17** from `DECISIONS.md` (or move it to a
      "historical" section)
- [ ] Verify QR code in the first-visit sample label still renders in
      Chrome and Firefox

## (soft) `LabelObjectInput` distributes Omit over the union

**Affected version:** `@burnmark-io/designer-core@0.1.0`
**Affected code:** `add()` parameter type in `dist/designer.d.ts`
**See also:** D2 in DECISIONS.md.

`LabelDesigner.add(object: LabelObjectInput)` accepts the union
`Omit<LabelObject, 'id'>`. TypeScript's `Omit` over a union returns
the intersection of common keys, dropping subtype-specific fields like
`shape: 'rectangle'` or `content: string`.

**Upstream fix (designer-core):** distribute `Omit` across the union:
```ts
type LabelObjectInput = LabelObject extends infer T
  ? T extends LabelObject
    ? Omit<T, 'id'>
    : never
  : never;
```
or define the input type per subtype.

**Revert when fixed (this repo):**
- [ ] Replace the generic `addObject<T>` wrapper in
      `src/stores/designer.ts` with a direct `add: composable.add`
      forward
- [ ] Update every `addObject<TextObject>(…)` / `<ShapeObject>` /
      `<ImageObject>` / `<BarcodeObject>` call site (sample-label,
      shape registry, panel handlers) — drop the type argument

## (env) Linux: usblp + ipp-usb hold interface 0 from WebUSB

On a typical Linux desktop with CUPS installed, two things compete with
Chrome for the USB printer interface and cause:

```
Failed to execute 'claimInterface' on 'USBDevice': Unable to claim
interface.
```

after the user picks the printer in the WebUSB dialog.

1. The `usblp` kernel module auto-binds to USB Printer Class devices
   on plug, exposing them as `/dev/usb/lpN`. Confirm with:
   ```sh
   lsmod | grep usblp
   ls /sys/bus/usb/drivers/usblp/   # interface IDs listed here are claimed
   ls /dev/usb/                     # lpN entries = bound printers
   ```
2. `ipp-usb` (shipped with CUPS on most distros) runs as a udev-triggered
   service and opens the device via libusb to provide IPP-over-USB:
   ```sh
   pgrep -af ipp-usb
   systemctl is-active ipp-usb
   ```

Either alone is enough to block `claimInterface`.

### One-shot unblock (lasts until replug)

```sh
echo 3-1:1.0 | sudo tee /sys/bus/usb/drivers/usblp/unbind   # adjust path per `ls /sys/bus/usb/drivers/usblp/`
sudo systemctl stop ipp-usb
```

### Permanent fix (per-printer)

**a) Mask the device for ipp-usb** — edit `/etc/ipp-usb/ipp-usb.conf`:
```
[devices]
0x04F9:0x209D = disable    # Brother QL-820NWBc — adjust VID:PID
```
Then `sudo systemctl restart ipp-usb`.

**b) Auto-detach usblp on plug** — drop a udev rule at
`/etc/udev/rules.d/85-thermal-label.rules` with one entry per supported
VID:PID:
```
SUBSYSTEM=="usb", ATTR{idVendor}=="04f9", ATTR{idProduct}=="209d", MODE="0664", TAG+="uaccess"
ACTION=="add", SUBSYSTEM=="usb", ATTRS{idVendor}=="04f9", ATTRS{idProduct}=="209d", \
    RUN+="/bin/sh -c 'echo -n %k > /sys/bus/usb/drivers/usblp/unbind 2>/dev/null || true'"
```
Then `sudo udevadm control --reload && sudo udevadm trigger`.

`TAG+="uaccess"` grants the active seat user access to the raw device
without group membership — what Chrome wants.

### Where this should land for users

This is an environment issue, not a code bug — but every Linux user with
CUPS will hit it. Phase 7 docs / Help menu should include a "Linux:
release the printer from CUPS" section pointing at this file's recipes.
macOS and Windows don't have an equivalent — Windows lets WebUSB share
with the spooler, and macOS is fine because classic Bluetooth SPP isn't
the path there and CUPS uses `usbmuxd`-style sharing.


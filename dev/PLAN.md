# burnmark label-maker — Implementation Plan

> The burnmark web application. A browser-native label designer that's easy,
> quick, friendly, and rich. No install, no account, no server. Connect your
> printer, make a beautiful label, print it. Your nan can do it.
>
> **Repository:** `github.com/burnmark-io/label-maker`
> **Deploys to:** `burnmark-io.github.io` (GitHub Pages) + `ghcr.io/burnmark-io/app` (Docker)
> **Stack:** Vue 3, Konva (canvas), `@burnmark-io/designer-core`, `@burnmark-io/designer-vue`
>
> **Design brief:** positive, warm, approachable. The name "burnmark" references
> thermal printing but the UI should feel like a craft tool, not a developer
> tool. Clean light UI with warm amber accents. Friendly, not industrial.
> Rounded corners, soft shadows, gentle animations. "Design beautiful labels"
> not "Thermal label driver ecosystem."

---

## 1. Repository Structure

```
label-maker/
├── .github/
│   ├── FUNDING.yml
│   └── workflows/
│       ├── ci.yml
│       ├── deploy.yml          # GitHub Pages
│       └── docker.yml          # ghcr.io image
├── public/
│   ├── favicon.svg
│   ├── manifest.json           # PWA manifest
│   ├── icons/                  # PWA icons (192, 512, maskable)
│   └── sw.js                   # service worker (Vite PWA plugin generates)
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router.ts               # vue-router (minimal — editor is the app)
│   ├── stores/                 # pinia stores
│   │   ├── designer.ts         # wraps useLabelDesigner composable
│   │   ├── printer.ts          # connection, status, auto-reconnect
│   │   ├── library.ts          # saved designs, IndexedDB
│   │   └── preferences.ts      # UI preferences, localStorage
│   ├── composables/
│   │   ├── usePrinterConnection.ts
│   │   ├── useAutoReconnect.ts
│   │   ├── useMediaDetection.ts
│   │   ├── usePrintPreview.ts
│   │   ├── useCsvImport.ts
│   │   └── useShareUrl.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.vue        # top bar + sidebar + canvas area
│   │   │   ├── TopBar.vue          # logo, printer status, main actions
│   │   │   └── SidePanel.vue       # tabbed panel (objects, properties, data)
│   │   ├── canvas/
│   │   │   ├── DesignCanvas.vue    # Konva stage + layers
│   │   │   ├── CanvasObject.vue    # renders a single LabelObject on Konva
│   │   │   ├── SelectionHandles.vue
│   │   │   ├── AlignmentGuides.vue
│   │   │   ├── GridOverlay.vue
│   │   │   ├── PaperDirection.vue  # feed direction arrow for continuous labels
│   │   │   └── CutLine.vue        # dashed bottom edge for continuous labels
│   │   ├── panels/
│   │   │   ├── ObjectsPanel.vue    # z-order list, visibility toggles
│   │   │   ├── PropertiesPanel.vue # selected object properties
│   │   │   ├── TextProperties.vue
│   │   │   ├── ImageProperties.vue
│   │   │   ├── BarcodeProperties.vue
│   │   │   ├── ShapeProperties.vue
│   │   │   ├── DataPanel.vue       # CSV/Excel import, placeholder mapping
│   │   │   └── ColumnMapper.vue    # manual column-to-placeholder mapping
│   │   ├── toolbar/
│   │   │   ├── MainToolbar.vue     # add text, image, barcode, shape
│   │   │   ├── TextTool.vue
│   │   │   ├── ImageTool.vue
│   │   │   ├── BarcodeTool.vue
│   │   │   ├── ShapeTool.vue       # rectangle, circle, line, heart, star, borders
│   │   │   └── ShapeLibrary.vue    # decorative shapes and border presets
│   │   ├── printer/
│   │   │   ├── PrinterStatus.vue   # connection dot + model + media
│   │   │   ├── ConnectButton.vue   # WebUSB/WebSerial picker trigger
│   │   │   ├── MediaSelector.vue   # manual media picker (when auto-detect unavailable)
│   │   │   └── PrintDialog.vue     # print confirmation, copies, density
│   │   ├── preview/
│   │   │   ├── BitmapPreview.vue   # 1bpp preview panel
│   │   │   ├── PlaneOverlay.vue    # two-colour plane visualisation
│   │   │   └── AssumedBanner.vue   # "preview may differ" warning
│   │   ├── batch/
│   │   │   ├── BatchPanel.vue      # CSV/Excel import + preview grid
│   │   │   ├── PreviewGrid.vue     # thumbnail grid of all generated labels
│   │   │   ├── BatchProgress.vue   # printing progress bar
│   │   │   └── LimitBanner.vue     # "showing first 30 rows" + feedback link
│   │   ├── sheets/
│   │   │   ├── SheetDialog.vue     # sheet picker + visual preview
│   │   │   ├── SheetPreview.vue    # visual layout of labels on paper
│   │   │   └── SheetPicker.vue     # searchable, grouped by brand
│   │   ├── library/
│   │   │   ├── DesignLibrary.vue   # saved designs as thumbnail cards
│   │   │   ├── DesignCard.vue      # thumbnail + name + date
│   │   │   └── LimitBanner.vue     # "7/10 designs" + feedback link
│   │   ├── share/
│   │   │   ├── ShareDialog.vue     # share URL generation
│   │   │   └── ImportDialog.vue    # load from URL hash
│   │   └── common/
│   │       ├── IconButton.vue
│   │       ├── Toast.vue
│   │       ├── Modal.vue
│   │       ├── Tooltip.vue
│   │       ├── SearchInput.vue
│   │       └── FeedbackLink.vue    # "Want more? Let us know" link
│   ├── services/
│   │   ├── storage.ts              # IndexedDB via idb — LabelStore, AssetStore impl
│   │   ├── asset-loader.ts         # ResizingAssetLoader (max 2400px, PNG re-encode)
│   │   ├── printer-manager.ts      # multi-transport printer management
│   │   ├── share-encoder.ts        # design → compressed base64 URL fragment
│   │   └── column-mapper.ts        # auto-map CSV/Excel columns to placeholders
│   ├── shapes/
│   │   ├── index.ts                # shape registry
│   │   ├── basic.ts                # rectangle, circle, ellipse, line, triangle
│   │   ├── decorative.ts           # heart, star, diamond, arrow, badge, ribbon
│   │   └── borders.ts             # classical border patterns, ornamental frames
│   ├── styles/
│   │   ├── variables.css           # design tokens — amber accent, warm palette
│   │   ├── base.css
│   │   └── transitions.css
│   └── utils/
│       ├── keyboard.ts             # shortcut handler
│       └── units.ts                # mm/dots/px conversion helpers
├── index.html
├── vite.config.ts
├── Dockerfile                      # nginx, ~15MB
├── docker-compose.yml              # app + print proxy sidecar
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── eslint.config.js
```

---

## 2. Dependencies

```json
{
  "dependencies": {
    "@burnmark-io/designer-core": "latest",
    "@burnmark-io/designer-vue": "latest",
    "@burnmark-io/sheet-templates": "latest",
    "@thermal-label/contracts": "latest",
    "@thermal-label/transport": "latest",
    "@thermal-label/brother-ql-node": "latest",
    "@thermal-label/labelwriter-node": "latest",
    "@thermal-label/labelmanager-node": "latest",
    "vue": "^3.4.0",
    "vue-router": "^4.0.0",
    "pinia": "^2.0.0",
    "vue-konva": "^3.0.0",
    "konva": "^9.0.0",
    "idb": "^8.0.0",
    "xlsx": "latest",
    "pako": "^2.0.0",
    "@vueuse/core": "^11.0.0"
  }
}
```

Wait — the `*-node` packages don't belong here. The app runs in the browser.
It needs the `*-web` packages:

```json
{
  "dependencies": {
    "@burnmark-io/designer-core": "latest",
    "@burnmark-io/designer-vue": "latest",
    "@burnmark-io/sheet-templates": "latest",
    "@thermal-label/contracts": "latest",
    "@thermal-label/transport": "latest",
    "@thermal-label/brother-ql-web": "latest",
    "@thermal-label/labelwriter-web": "latest",
    "@thermal-label/labelmanager-web": "latest",
    "vue": "^3.4.0",
    "vue-router": "^4.0.0",
    "pinia": "^2.0.0",
    "vue-konva": "^3.0.0",
    "konva": "^9.0.0",
    "idb": "^8.0.0",
    "xlsx": "latest",
    "pako": "^2.0.0",
    "@vueuse/core": "^11.0.0"
  },
  "devDependencies": {
    "@mbtech-nl/eslint-config": "^1.0.1",
    "@mbtech-nl/prettier-config": "^1.0.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0",
    "vite-plugin-pwa": "^0.20.0",
    "typescript": "~5.5.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0"
  }
}
```

`pako` for zlib compression of the share URL hash. `xlsx` (SheetJS) for
Excel file parsing. `@vueuse/core` for utility composables (useLocalStorage,
useEventListener, useDebounceFn, useMediaQuery).

---

## 3. Printer Connection

### 3.1 Connection States

```typescript
type PrinterConnectionState =
  | { status: 'disconnected' }
  | { status: 'paired'; device: DeviceDescriptor; lastSeen: string }
  | { status: 'connecting'; device: DeviceDescriptor }
  | { status: 'connected'; printer: PrinterAdapter; media?: MediaDescriptor; assumed: boolean }
  | { status: 'error'; device: DeviceDescriptor; message: string };
```

UI indicators:

```
🟢 QL-820NWB — 62mm continuous loaded         (connected, media detected)
🟢 LabelWriter 450 — select your labels       (connected, no detection)
🟡 QL-820NWB — plug in to reconnect           (paired, not present)
🔴 No printer — click to connect               (disconnected)
⚠️  QL-820NWB — connection lost                (error)
```

### 3.2 Auto-Reconnect

On app mount, check for previously paired devices:

```typescript
// WebUSB
const usbDevices = await navigator.usb.getDevices();
// Web Serial (BT SPP)
const serialPorts = await navigator.serial.getPorts();

// Try each — first success wins
for (const device of usbDevices) {
  try {
    const transport = await WebUsbTransport.fromDevice(device);
    const printer = await identifyAndConnect(transport);
    return; // connected!
  } catch {
    // Device paired but not physically present — show yellow state
    setPairedButDisconnected(device);
  }
}
```

### 3.3 Media Detection

After connecting, immediately call `getStatus()`:

```typescript
const status = await printer.getStatus();
if (status.detectedMedia) {
  // Auto-set canvas dimensions to match
  designer.setCanvas({
    widthDots: mediaToWidthDots(status.detectedMedia),
    heightDots: status.detectedMedia.heightMm ? mediaToHeightDots(status.detectedMedia) : 0,
  });
} else {
  // Show media picker — "What labels are loaded?"
  showMediaSelector();
}
```

### 3.4 Print Flow

```
User clicks "Print"
  → PrintDialog opens
  → Shows preview (printer.createPreview if connected, renderToBitmap otherwise)
  → Copies selector, density selector
  → "Print" button
  → printer.print(rgba, media, { copies, density })
  → Success toast or error with retry
  → printer.close() NOT called — keep connection alive for next print
```

Connection stays open until the user disconnects, closes the tab, or
the printer is physically unplugged (disconnect event).

---

## 4. Design Canvas

### 4.1 Konva Setup

```vue
<template>
  <v-stage :config="stageConfig" @mousedown="onStageClick">
    <v-layer ref="backgroundLayer">
      <PaperBackground />
      <GridOverlay v-if="preferences.showGrid" />
      <PaperDirection v-if="isContinuous" />
    </v-layer>
    <v-layer ref="objectsLayer">
      <CanvasObject
        v-for="obj in document.objects"
        :key="obj.id"
        :object="obj"
        :selected="selection.includes(obj.id)"
        @select="select([obj.id])"
      />
    </v-layer>
    <v-layer ref="guideLayer">
      <AlignmentGuides :objects="document.objects" :dragging="dragTarget" />
      <SelectionHandles :selection="selection" />
      <CutLine v-if="isContinuous" />
    </v-layer>
  </v-stage>
</template>
```

### 4.2 Paper Direction Indicator

For continuous labels (heightDots === 0 / heightMm undefined), show:

- Fixed width dimension label on the left or right edge: "← 62mm →"
- Feed direction arrow on the right side: "↓ feed"
- Dashed bottom edge with scissors icon — "cut here"
- The canvas grows vertically as content is added

For die-cut labels, the canvas has solid borders and fixed dimensions.

### 4.3 Alignment and Snapping

- Snap to grid (configurable grid spacing)
- Snap to other object edges and centres
- Alignment guides appear as thin coloured lines when snapping
- Smart spacing guides when objects are evenly distributed
- Hold Shift to constrain to horizontal/vertical movement
- Hold Shift while resizing to maintain aspect ratio

### 4.4 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Delete / Backspace | Delete selected |
| Ctrl+C | Copy |
| Ctrl+V | Paste |
| Ctrl+D | Duplicate (paste in place with offset) |
| Ctrl+A | Select all |
| Arrow keys | Nudge 1 dot |
| Shift+Arrow | Nudge 10 dots |
| Ctrl+G | Group selected |
| Ctrl+Shift+G | Ungroup |
| Ctrl+] | Bring forward |
| Ctrl+[ | Send backward |
| Ctrl+S | Save design |
| Ctrl+P | Print |
| Escape | Deselect all |

---

## 5. Shapes and Borders

### 5.1 Basic Shapes

Rectangle, circle/ellipse, line, triangle. These map to `ShapeObject`
in designer-core with `shape: 'rectangle' | 'ellipse' | 'line'`.
Triangle is rendered via Canvas path — the `ShapeObject` may need a
`'triangle'` type or it can be a path-based shape.

### 5.2 Decorative Shapes

Heart, star (5-point, 6-point), diamond, arrow (various), badge/ribbon,
speech bubble, banner/scroll. These are SVG paths rendered to the Canvas.

Implementation: each decorative shape is a function that returns a
Canvas path for a given bounding box:

```typescript
interface ShapeDefinition {
  name: string;
  icon: string;           // SVG for the toolbar
  renderPath(ctx: CanvasRenderingContext2D, x: number, y: number,
    width: number, height: number): void;
}
```

The shape library is a flat array of `ShapeDefinition` objects. The
toolbar shows them in a grid picker. designer-core treats them as
`ShapeObject` with a `shapePath` field containing the path data.

### 5.3 Border Presets

Classical and decorative border patterns for framing labels. These are
not simple rectangles with stroke — they're ornamental frames rendered
as repeating path patterns along the edges.

Categories:
- **Simple:** rounded rect, double line, dotted, dashed
- **Classical:** art deco corners, victorian scroll, celtic knot corners
- **Playful:** scalloped edge, stamp perforations, zigzag

Implementation: a border is a special `ShapeObject` that fills the
entire label canvas with a decorative frame. The `ShapeDefinition`
for borders receives the full canvas dimensions and renders the
pattern along all four edges.

The shape library picker groups shapes by category: Basic / Decorative /
Borders. Borders are full-label and auto-resize with the canvas.

---

## 6. Side Panels

### 6.1 Objects Panel

Z-ordered list of all objects. Each row shows:
- Drag handle for reordering
- Object type icon (T for text, image icon, barcode icon, shape icon)
- Object name (user-editable, or auto-generated: "Text 1", "Barcode 2")
- Visibility toggle (eye icon)
- Lock toggle (lock icon)

Click to select. Multi-select with Ctrl+click.

### 6.2 Properties Panel

Shows properties of the selected object. Changes are live — every edit
immediately updates the canvas and triggers the debounced preview.

**Text properties:**
- Content (textarea with `{{placeholder}}` syntax highlighting)
- Font family (dropdown — bundled fonts + system fonts)
- Font size (number input with common presets)
- Bold / Italic toggles
- Alignment (left / centre / right)
- Colour picker (small palette optimised for thermal: black, red, dark grey,
  light grey — with "prints as" indicator showing the 1bpp result)
- Letter spacing, line height
- Invert toggle (white on black)
- Auto-height toggle

**Image properties:**
- Thumbnail preview
- Fit mode (contain / cover / fill / none)
- Threshold slider (0-255) with live 1bpp preview
- Dither toggle with live preview
- Invert toggle
- Replace image button

**Barcode properties:**
- Format picker (grouped: 1D / 2D / Postal / GS1)
- Data input (with placeholder support)
- QR Content helpers as buttons: WiFi, vCard, URL, Phone, Email, Geo
- Scale slider
- Include text toggle (1D barcodes)
- Error correction level (QR)
- Live barcode preview

**Shape properties:**
- Shape type (for basic shapes)
- Fill toggle
- Stroke width
- Colour picker
- Corner radius (rectangles)

### 6.3 Data Panel

Template variables and CSV/Excel import:

- **Placeholders detected:** auto-extracted list of `{{variables}}` in the design
- **Import data:** drag-and-drop zone for CSV or Excel files
- **Column mapper:** when auto-mapping fails, two-column UI:
  left = CSV/Excel columns, right = template placeholders, dropdown to connect
- **Preview:** cycle through rows with prev/next buttons
- **Row count:** "30 rows loaded (showing first 30)" with feedback link if limited
- **Print batch:** button that opens BatchPanel

---

## 7. CSV / Excel Import

### 7.1 Supported Formats

- `.csv` — parsed with papaparse (already in designer-core)
- `.tsv` — same parser, tab delimiter
- `.xlsx` / `.xls` — parsed with SheetJS, first sheet extracted, row 1 as headers

### 7.2 Auto-Mapping

```typescript
function autoMapColumns(
  csvHeaders: string[],
  placeholders: string[],
): Map<string, string> {
  // Exact match (case-insensitive)
  // Then fuzzy: 'naam' → 'name', 'adres' → 'address'
  // Then positional: first unmatched column → first unmatched placeholder
  // Returns map: csvColumn → placeholder
}
```

When auto-mapping is incomplete, the ColumnMapper UI opens automatically.

### 7.3 Column Mapper UI

Two columns side by side:

```
CSV Columns              Template Placeholders
┌─────────────┐          ┌─────────────┐
│ naam        │ ───────▶ │ {{name}}    │
│ adres       │ ───────▶ │ {{address}} │
│ woonplaats  │    ?     │ {{city}}    │  ← dropdown to connect
│ postcode    │ ───────▶ │ {{postcode}}│
│ extra_col   │          │ (unmapped)  │
└─────────────┘          └─────────────┘
```

The mapper remembers associations per template (stored in localStorage).
Next time the same CSV structure is imported for the same template, it
maps automatically.

### 7.4 Batch Limits

- **30 rows maximum.** Rows beyond 30 are silently dropped with a banner:
  "Showing first 30 rows. Want more? [Let us know →]"
- The feedback link goes to a GitHub issue template or a simple form.
- No mention of "free tier" or "upgrade" — just the limit and a feedback path.
- Sheet export follows the same 30-row limit — fills however many pages 30 rows needs.

---

## 8. Print Preview

### 8.1 Preview Modes

**Design view** (always available):
Full-colour RGBA from `designer.render()`. The canvas IS the design view.

**Print preview** (when printer connected or media selected):
1bpp bitmap from `printer.createPreview(rgba)`. Shows in a separate
preview panel alongside the canvas. Updates on debounce (200ms).

For two-colour Brother QL:
- Black plane rendered as black dots
- Red plane rendered as red dots
- Overlaid on white background
- Clear visual distinction: "this is what your printer will produce"

### 8.2 Assumed Media Banner

When `PreviewResult.assumed === true`:

```
ℹ️ Preview based on default media — connect your printer or select
   media for an accurate preview.
```

Subtle, informative, not alarming. Dismissable.

---

## 9. URL Sharing

### 9.1 Encode Design to URL

Small designs (text + shapes only, no images) encoded to URL fragment:

```typescript
function encodeDesignToUrl(doc: LabelDocument): string | null {
  const json = JSON.stringify(doc);
  const compressed = pako.deflate(json);
  const encoded = btoa(String.fromCharCode(...compressed));

  // Limit: 8KB compressed — beyond that, share as .label file
  if (encoded.length > 8192) return null;

  return `${window.location.origin}/#${encoded}`;
}
```

### 9.2 Load Design from URL

On app mount, check for hash fragment:

```typescript
if (window.location.hash.length > 1) {
  try {
    const encoded = window.location.hash.slice(1);
    const compressed = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const json = pako.inflate(compressed, { to: 'string' });
    const doc = JSON.parse(json);
    designer.loadDocument(doc);
    showToast('Label loaded from shared link');
  } catch {
    // Invalid hash — ignore silently
  }
}
```

### 9.3 Share Dialog

- "Share this design" button in the toolbar
- Shows the generated URL (if small enough) with a copy button
- If the design has images or is too large: "This design is too large
  for a share link. Export as a .label file instead." with download button
- Optional: QR code of the share URL (meta — a label app generating
  a QR code of itself)

---

## 10. Storage

### 10.1 IndexedDB via `idb`

```typescript
// Two object stores
const db = await openDB('burnmark', 1, {
  upgrade(db) {
    db.createObjectStore('designs', { keyPath: 'id' });
    db.createObjectStore('assets');  // content-addressed blobs
  },
});
```

### 10.2 ResizingAssetLoader

Images resized on import — max 2400px largest dimension, re-encoded as PNG:

```typescript
class BurnmarkAssetLoader implements AssetLoader {
  private maxDimension = 2400;

  async store(data: Blob): Promise<string> {
    const resized = await this.resizeIfNeeded(data);
    const hash = await this.contentHash(resized);
    await db.put('assets', resized, hash);
    return hash;
  }
}
```

### 10.3 Design Library Limits

- Maximum 10 saved designs
- When at 10: "You've saved 10 designs. Delete one to save a new one."
- Small counter in the library panel: "7/10"
- No mention of paid upgrade — just the limit and the feedback link

---

## 11. PWA

### 11.1 Vite PWA Plugin

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'burnmark',
        short_name: 'burnmark',
        description: 'Design beautiful labels',
        theme_color: '#f59e0b',   // amber
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
```

### 11.2 Install Prompt

Don't prompt on first visit. After the user's second or third session
(tracked in localStorage), show a subtle toast:

```
Install burnmark for quick access from your desktop
[Install] [Maybe later]
```

"Maybe later" dismisses for 7 days. "Install" triggers the browser's
native install flow.

### 11.3 Offline Capability

The PWA works offline for designing. Printing requires the printer
(obviously). The service worker caches all static assets. IndexedDB
designs are available offline.

---

## 12. Docker

### 12.1 Dockerfile

```dockerfile
FROM node:24-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 12.2 Docker Compose (with print proxy sidecar)

```yaml
services:
  app:
    image: ghcr.io/burnmark-io/app
    ports:
      - "8080:80"

  proxy:
    image: ghcr.io/thermal-label/print-proxy
    ports:
      - "3000:3000"
    devices:
      - /dev/bus/usb:/dev/bus/usb
    volumes:
      - ./proxy.config.json:/app/proxy.config.json
    restart: unless-stopped
```

### 12.3 Convenience Download

Publish `compose.yaml` at `burnmark-io.github.io/compose.yaml`:

```bash
curl -o compose.yaml https://burnmark-io.github.io/compose.yaml
docker compose up -d
```

---

## 13. Design Tokens and Visual Style

### 13.1 Colour Palette

```css
:root {
  /* Primary — amber warmth */
  --color-primary: #f59e0b;
  --color-primary-hover: #d97706;
  --color-primary-light: #fef3c7;
  --color-primary-subtle: #fffbeb;

  /* Neutrals — warm grey, not cold */
  --color-bg: #fafaf9;
  --color-bg-panel: #ffffff;
  --color-bg-canvas: #f5f5f4;
  --color-border: #e7e5e4;
  --color-text: #1c1917;
  --color-text-secondary: #78716c;
  --color-text-muted: #a8a29e;

  /* Status */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Printer plane colours (for preview) */
  --color-plane-black: #1c1917;
  --color-plane-red: #dc2626;

  /* Shadows — soft, warm */
  --shadow-sm: 0 1px 2px rgba(28, 25, 23, 0.05);
  --shadow-md: 0 4px 6px rgba(28, 25, 23, 0.07);
  --shadow-lg: 0 10px 15px rgba(28, 25, 23, 0.1);

  /* Radii — rounded, friendly */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
}
```

### 13.2 Typography

```css
:root {
  --font-ui: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
}
```

Monospace for coordinates, measurements, barcode data. UI font for
everything else. Warm, readable, not clinical.

### 13.3 Tone

- Buttons: rounded, solid primary fill, clear labels
- Icons: Lucide icon set (consistent, friendly, MIT)
- Toasts: slide in from bottom, auto-dismiss after 3s
- Modals: soft backdrop blur, centred, rounded
- Empty states: friendly illustration + "Add your first text" prompt
- Error messages: human language, not technical. "Can't reach your
  printer — is it plugged in?" not "TransportClosedError"

---

## 14. User Experience Walkthrough

What the user sees, step by step. This section is the reference for
every UI decision — if a component doesn't serve this flow, question
whether it belongs.

### 14.1 First Visit

The app opens directly to the editor — there is no separate landing page.
The application IS the landing page. On first visit, a sample label is
loaded — a well-designed example that shows what's possible (text, a small
barcode, a shape). The user sees a finished label immediately, not a
blank canvas. This communicates "this is a label tool" within one second.

On subsequent visits, the app opens the last label the user was working on.
Restored from IndexedDB exactly as they left it. No "welcome back" modal —
just their work, ready to continue.

The sample label is a curated design that looks good on a 62mm continuous
label — the most common format. It demonstrates text with a placeholder
(`{{name}}`), a QR code, and a decorative border. The user can modify it
immediately or start fresh.

### 14.2 Onboarding Tour

A lightweight guided tour on first visit (tracked in localStorage).
Not a modal wizard — floating tooltips that highlight UI elements in
sequence. The user can dismiss at any step with "Skip tour" or ×.

```
Step 1: "This is your label"
  → highlights the label in the centre
  "This is a sample — click any element to edit, or start fresh."

Step 2: "Add things from the toolbar"
  → highlights the toolbar buttons near the label
  "Text, images, barcodes, shapes — pick one and click the label."

Step 3: "Adjust in the properties panel"
  → highlights the side panel
  "Select any object and tweak its font, size, colour, and more."

Step 4: "Connect and print"
  → highlights the printer status / connect button
  "Connect your printer and hit print. That's it!"
```

Four steps, maybe 15 seconds total. Dismissable. Restartable from the
help menu. After completion, a subtle toast: "You're ready! Need help
later? Check the help menu."

### 14.3 Layout — The Label Gets Centre Stage

The label is the hero. It sits in the centre of the screen at a comfortable
zoom — approximately 2× actual size, but never so large that it feels
disconnected from reality. The proportions are accurate: a 62mm × 100mm
label looks like a 62mm × 100mm label, just bigger. The user always has
a sense of "this is the real thing, zoomed in."

Important action buttons cluster near the label — within arm's reach of
what the user is working on. Less important controls live at the edges.

```
┌─────────────────────────────────────────────────────────┐
│ 🏷️ burnmark            🟢 QL-820NWB 62mm       [Help] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              ┌─ toolbar buttons ──┐                     │
│              │[T] [🖼] [▣] [⬡]   │              ┌─────┐│
│              └────────────────────┘              │props││
│                                                  │     ││
│              ┌────────────────────┐              │ or  ││
│              │                    │              │     ││
│              │   the label        │              │objs ││
│              │   (centre stage)   │              │     ││
│              │   ~2× zoom        │              │ or  ││
│              │                    │              │     ││
│              └────────────────────┘              │data ││
│                                                  │     ││
│              [⎙ Print] [↓ Export] [💾 Save]      └─────┘│
│                                                         │
├─────────────────────────────────────────────────────────┤
│ 🏷️ Labels aren't gonna print themselves · [About] [Help]│
└─────────────────────────────────────────────────────────┘
```

**Key layout principles:**
- The label is centred and gets all the visual weight
- Toolbar floats above the label — the tools are close to where they're used
- Action buttons (Print, Export, Save) float below the label — close to the work
- Properties/Objects/Data panel on the right — slides in when needed, doesn't
  compete with the label for attention
- Top bar is minimal — logo, printer status, help. Not crowded.
- Footer is one line — sponsor text, about, help links
- The background is a subtle warm grey — the label sits on it like paper on a desk

**Zoom behaviour:**
- Default zoom: label fills ~60% of available centre space, approximately 2×
- Scroll wheel zooms in/out (Ctrl+scroll, or pinch on trackpad)
- Double-click empty area to reset zoom to default
- Zoom level shown subtly near the label edge: "200%"
- Never zoom so far that individual pixels are visible in the design view —
  that's what the print preview is for

### 14.4 Design Library — 10 Slots

The design library is a panel (accessible from a button in the top bar
or sidebar) showing 10 design slots as cards. This communicates the limit
visually — no surprise "you've hit the limit" moment. The user sees all
10 slots from the start.

```
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│thumb │ │thumb │ │thumb │ │  +   │ │  +   │
│      │ │      │ │      │ │ New  │ │ New  │
│Name  │ │Name  │ │Name  │ │      │ │      │
│date  │ │date  │ │date  │ │      │ │      │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘
  ...5 more slots...
```

- Filled slots show a thumbnail, name, description, last edited date
- Empty slots show a "+" with "New label" — inviting, not restrictive
- Click a filled slot to open that design
- Right-click or ⋮ menu: Rename, Duplicate (if slots available), Delete, Export
- When all 10 slots are filled and user tries to save a new design:
  "All 10 slots are in use. Delete or export one to make room.
   Need more? [Let us know →]"
- Name and description are editable inline on the card

### 14.5 The Designing Flow

1. User clicks [T] in toolbar → cursor becomes crosshair
2. User clicks/drags on label → text object created at that position
3. Object is selected → properties panel slides in from the right
4. User types in the content field → label updates live
5. User adjusts font, size → label updates live
6. User drags the object → alignment guides appear when near other objects
7. User clicks empty area → deselects, properties panel shows label settings
8. Repeat for images, barcodes, shapes

Every change triggers the debounced 1bpp preview update (200ms).
A small preview toggle near the label shows the 1bpp bitmap output —
"what the printer will actually produce."

### 14.6 The Printing Flow

1. User clicks [⎙ Print] below the label → print dialog opens
2. If no printer connected → "Connect your printer first" with connect button
3. If printer connected → shows print preview (createPreview result)
4. Copies selector (1-10), density selector (light/normal/dark)
5. User clicks "Print" → progress indicator → success toast
6. Dialog closes. Printer stays connected for next print.

### 14.7 Tablet / Narrow Screens

- Toolbar moves to bottom (horizontal strip)
- Side panel becomes a bottom sheet (swipe up to open)
- Label gets full width, centred vertically
- Action buttons stack below the label
- Functional but not the primary design target

---

## 15. Internationalisation (i18n)

### 15.1 Setup

`vue-i18n` with JSON locale files. Lazy-loaded per locale.

```
src/
  locales/
    en.json       # English — primary, always complete
    nl.json       # Dutch — ship with v1
```

### 15.2 Scope

The UI has ~200 translatable strings: button labels, tooltips, panel
headers, dialog text, error messages, onboarding tour steps, empty
states. Label content is user data — not translated.

All UI text goes through `$t('key')`. No hardcoded strings in templates.

### 15.3 Locale Detection

1. Check localStorage preference (user manually selected)
2. Fall back to `navigator.language`
3. Fall back to English

### 15.4 Missing Language Prompt

If the detected locale doesn't have a translation file, show a subtle
one-time toast:

```
burnmark isn't available in [Deutsch] yet.
Showing English. Want to help translate? [Let us know →]
```

The "Let us know" link goes to a GitHub issue template for translation
contributions. Same engagement pattern as the CSV limit — turn a
limitation into a conversation.

### 15.5 Contributing Translations

Translations are contributed via PR — add a new JSON locale file,
translate all keys. The README documents the process. No external
translation platform needed at this scale.

### 15.6 What Gets Translated

- All UI chrome (buttons, labels, tooltips, panel headers)
- Error messages and toasts
- Onboarding tour text
- About page content
- Empty state prompts
- Footer sponsor text rotations

### 15.7 What Does NOT Get Translated

- Label content (user data)
- Barcode format names (technical, universal)
- Font family names
- CSS/HTML class names
- Placeholder syntax (`{{name}}` stays `{{name}}` in every locale)
- Sheet template names (Avery L7160 is Avery L7160 everywhere)

---

## 16. Accessibility (a11y)

### 16.1 Approach

Pragmatic a11y — the design canvas (Konva `<canvas>`) is inherently
inaccessible to screen readers. All UI chrome around it is fully
accessible. Keyboard shortcuts cover canvas interactions for
keyboard-only users.

### 16.2 Requirements

**All interactive UI elements:**
- ARIA labels on icon-only buttons (toolbar, panel actions)
- Focus visible outlines (not hidden, styled to match the warm theme)
- Keyboard navigable — Tab through toolbar, panels, dialogs
- Focus trapped in modals — Tab cycles within, Escape closes

**Dialogs and modals:**
- `role="dialog"` with `aria-labelledby`
- Focus moves to dialog on open, returns to trigger on close
- Escape key closes

**Toasts and notifications:**
- `role="status"` or `aria-live="polite"`
- Auto-dismiss toasts also available in a notification history

**Side panel:**
- Tab headers are keyboard-navigable
- Arrow keys switch tabs
- Panel content is focusable

**Colour contrast:**
- All UI text meets WCAG AA (4.5:1 for normal text, 3:1 for large)
- The amber accent (`#f59e0b`) on white fails AA — use `#b45309`
  (darker amber) for text-on-white. Amber stays for backgrounds
  and non-text elements.

### 16.3 Canvas Accessibility

The Konva canvas itself is a `<canvas>` element — screen readers see it
as a single image. Provide:

- `aria-label="Label design canvas"` on the stage
- An off-screen text summary of the canvas contents (updated on change):
  "Label contains 3 objects: Text 'Hello World', Barcode Code128, Rectangle"
- All canvas interactions available via keyboard shortcuts (documented
  in the help section)

### 16.4 Reduced Motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 17. Footer

### 17.1 Layout

Single line, subtle, always visible at the bottom of the app:

```
🏷️ [rotating sponsor text]     [About] · [Help] · [GitHub]
```

### 17.2 Rotating Sponsor Texts

A small pool of cheeky label-related messages that rotate randomly on
each page load. Linked to the Ko-fi / GitHub Sponsors page.

```typescript
const SPONSOR_TEXTS = [
  'Print labels, not money · Buy me some labels ☕',
  'This label printer won\'t feed itself 🏷️',
  'Fuelled by mass caffeine, erm, label runs ☕',
  'Help keep the print head warm 🔥',
  'Labels are free, label rolls aren\'t 🏷️',
  'Powered by mass caffeine and mass labels ☕',
  'Every label printed is a label earned 🏷️',
  'Supporting open source, one label at a time 🏷️',
];
```

Click goes to the funding page. Subtle, not aggressive. A smile, not a guilt trip.

### 17.3 Translated

The sponsor texts are in the locale files — each language gets its own
set of cheeky messages. Dutch humour is different from English humour.
The translators should have fun with these.

---

## 18. About Page

A simple in-app page (or modal) accessible from the footer. Not a
separate route — a modal keeps the app context.

### 18.1 Content

```
# About burnmark

burnmark is a free, open-source label designer that runs entirely
in your browser. No account, no server, no install.

### The name

Thermal printers work by burning tiny marks onto heat-sensitive paper.
Each dot on your label is literally a burn mark — a precise point of
heat from the print head. We thought that was a pretty cool name for
a label app.

### How it started

It started with a messy workshop and a Dymo LabelManager that refused
to cooperate on Linux. Instead of organising the workshop, we ended up
reverse-engineering USB printer protocols and accidentally building an
entire label printing ecosystem. The workshop is still not fully
organised.

[Read the full story →]  (links to the origin story blog post)

### The project

burnmark is part of the thermal-label ecosystem — open-source drivers
for Dymo and Brother label printers, a headless design engine, and
this web app. Everything is MIT-licensed.

[GitHub →]  [thermal-label drivers →]  [designer-core →]

### Support the project

burnmark is built and maintained by [Mannes Brak] in the Netherlands.
If you find it useful, consider supporting the project:

[☕ Buy me some labels]  [♥ GitHub Sponsors]

Version: {{version}}
```

### 18.2 The Scopecreep Hint

The "how it started" section is deliberately brief and self-deprecating.
It hints at the absurdity ("accidentally building an entire label printing
ecosystem") without telling the full story. The "Read the full story"
link goes to the blog post (when published). This gives the about page
personality without being a wall of text.

---

## 19. Help

### 19.1 Help Menu

Accessible from the footer "Help" link and via `?` keyboard shortcut.
Opens a panel or modal with:

```
Help

[🎓 Restart tour]          — re-runs the onboarding tour
[⌨️ Keyboard shortcuts]    — shows the full shortcut reference
[🖨️ Printer compatibility] — which printers work, browser requirements
[📖 Documentation]         — links to thermal-label.github.io docs site
[🐛 Report a problem]      — links to GitHub issues
[💬 Want a feature?]        — links to GitHub discussions
```

### 19.2 Keyboard Shortcuts Reference

A modal showing all shortcuts in a clean two-column layout, grouped by
category (General, Canvas, Objects, Printing). Same data as section 4.4
of this plan but presented in-app.

### 19.3 Printer Compatibility Note

```
burnmark works best in Chrome or Edge.

✅ Chrome (desktop + Android): full support — WebUSB, Web Serial, PWA
✅ Edge (desktop): full support
⚠️ Firefox: design and export only — no printing (WebUSB not supported)
⚠️ Safari: design and export only — no printing

Supported printers:
• Brother QL series (QL-800, QL-810W, QL-820NWB, QL-1100, QL-1110NWB)
• Dymo LabelWriter (400, 450, 450 Turbo, 450 Twin Turbo, 550, 5XL)
• Dymo LabelManager PnP

Connect via USB cable or Bluetooth (QL-820NWB via Web Serial).
Android users: use a USB-C OTG adapter (€5) to connect directly.
```

### 19.4 Restart Tour

The "Restart tour" button resets the localStorage flag and re-runs the
onboarding tour from step 1. Useful when someone dismissed it too quickly
or wants to show a colleague how the app works.

---

## 20. CI/CD

### 20.1 `ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v5
        with: { version: 9 }
      - uses: actions/setup-node@v6
        with: { node-version: '24', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm prettier --check "src/**/*.{ts,vue}"
      - run: pnpm test
      - run: pnpm build
```

### 20.2 `deploy.yml`

```yaml
name: Deploy
on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v5
        with: { version: 9 }
      - uses: actions/setup-node@v6
        with: { node-version: '24', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
      - uses: actions/deploy-pages@v5
        id: deployment
```

### 20.3 `docker.yml`

```yaml
name: Docker
on:
  push:
    tags:
      - 'v*'

permissions:
  packages: write

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: |
            ghcr.io/burnmark-io/app:latest
            ghcr.io/burnmark-io/app:${{ github.ref_name }}
```

---

## 21. Testing

### 21.1 What to Test

- **Stores:** pinia stores with mocked dependencies — designer, printer,
  library, preferences
- **Composables:** auto-reconnect, media detection, CSV import, share encoding
- **Services:** storage (mocked IndexedDB), asset loader (resize logic),
  column mapper (auto-mapping + manual)
- **Share encoding:** round-trip encode/decode, size limit handling
- **Column mapper:** exact match, fuzzy match, positional fallback
- **Keyboard shortcuts:** correct action dispatched per shortcut

### 21.2 What NOT to Test (here)

- designer-core rendering — tested in designer-core
- Printer protocol — tested in driver packages
- Konva canvas rendering — visual, test manually
- WebUSB/WebSerial API — browser API, mock in composable tests

### 21.3 E2E (future)

Playwright for critical paths:
- Load app → add text → renders on canvas
- Connect printer (mocked) → print dialog → prints
- Import CSV → preview grid → batch print
- Save design → load design → identical

Not in v1 scope. Add when the app is stable.

---

## 22. Implementation Sequence

```
Phase 1: Scaffold + Core Shell
  1. Scaffold — vite, vue, router, pinia, eslint, prettier, tsconfig
  2. Design tokens — CSS variables, base styles, typography
  3. AppShell — layout with top bar, sidebar, canvas area
  4. Pinia stores — designer (wraps composable), preferences
  5. Gate: app runs in dev mode, shows empty shell

Phase 2: Design Canvas
  6. Konva canvas — stage, background layer, grid overlay
  7. Text objects — add, select, move, resize, edit inline
  8. Image objects — import (with resize), fit modes, drag
  9. Shape objects — basic shapes (rect, circle, line)
  10. Barcode objects — format picker, data input, live preview
  11. Selection — multi-select, handles, alignment guides, snapping
  12. Properties panel — text, image, barcode, shape properties
  13. Objects panel — z-order list, visibility, lock
  14. Paper direction indicator — feed arrow, cut line for continuous
  15. Keyboard shortcuts
  16. Gate: can design a label with all object types, undo/redo works

Phase 3: Shapes and Borders
  17. Decorative shapes — heart, star, diamond, arrow, badge
  18. Border presets — simple, classical, playful
  19. Shape library picker in toolbar
  20. Gate: all shapes render correctly on canvas and in bitmap preview

Phase 4: Printer Integration
  21. Printer connection — WebUSB picker, transport setup
  22. Auto-reconnect — getDevices(), fromDevice(), paired state
  23. Media detection — getStatus(), auto-resize canvas
  24. Media selector — manual picker when auto-detect unavailable
  25. Print preview — 1bpp bitmap panel, two-colour overlay, assumed banner
  26. Print dialog — copies, density, print button
  27. Web Serial support — BT SPP connection alongside WebUSB
  28. Gate: can connect to real printer, see preview, print a label

Phase 5: Data and Batch
  29. Template variables — placeholder detection, substitution preview
  30. CSV import — drag-and-drop, papaparse
  31. Excel import — SheetJS, first sheet extraction
  32. Column mapper — auto-map + manual UI
  33. Batch preview grid — thumbnail grid of generated labels
  34. Batch print — progress bar, per-label status
  35. Limit banner — "showing first 30 rows" + feedback link
  36. Gate: can import CSV/Excel, map columns, preview batch, print batch

Phase 6: Export and Sharing
  37. Save/load — IndexedDB, design library panel, 10-design limit
  38. Export PNG/PDF — single label export
  39. Sheet export — sheet picker (lazy-loaded), visual preview, PDF download
  40. Export .label file — JSON download
  41. Export bundled .zip — design + assets
  42. URL sharing — encode/decode, share dialog, import from hash
  43. Gate: all export paths work, share URLs round-trip correctly

Phase 7: PWA and Docker
  44. PWA — manifest, service worker, install prompt (after 2nd visit)
  45. Offline mode — verify designing works offline
  46. Dockerfile — build + nginx
  47. docker-compose.yml — app + print proxy sidecar
  48. compose.yaml published to GitHub Pages for convenience download
  49. Gate: PWA installs, works offline, Docker builds and runs

Phase 8: Polish + i18n + a11y
  50. i18n setup — vue-i18n, en.json + nl.json, locale detection,
      missing language toast with feedback link
  51. Extract all hardcoded strings to locale keys
  52. a11y — ARIA labels on all toolbar/panel buttons, focus management
      in dialogs, keyboard navigation, reduced motion, canvas summary
  53. Footer — sponsor text rotation, about/help links
  54. About page/modal — name explanation, scopecreep hint, project links
  55. Help menu — restart tour, shortcuts reference, printer compatibility,
      docs link, issue link
  56. Onboarding tour — 4-step tooltip tour, first visit only, restartable
  57. Empty states — friendly illustrations and prompts
  58. Error messages — human language audit across all toasts/dialogs
  59. Transitions and animations — smooth, respects prefers-reduced-motion
  60. Responsive layout — desktop-first, functional on tablet landscape
  61. Performance — lazy-load sheet-templates, debounce renders, virtual
      scroll in batch preview grid
  62. Gate: feels good to use, no rough edges, all strings translated (en+nl)

Phase 9: Final
  63. Verify all gates pass
  64. Test on Chrome, Edge (Firefox/Safari: WebUSB not supported, show banner)
  65. Test Android OTG with USB-C adapter
  66. Test Docker compose with print proxy
  67. Verify en + nl translations are complete
  68. Verify a11y: keyboard-only navigation through full flow
  69. Deploy to GitHub Pages
  70. Push Docker image to ghcr.io
```

---

## 23. Key Constraints

**UX:**
- "Your nan can do it" — three clicks to first print: connect → type → print
- No jargon in the UI. "Connect your printer" not "Select WebUSB device"
- Sensible defaults everywhere — no configuration required for basic use
- Warm, positive tone — not dark/industrial despite the brand name
- Limits are friendly: counter + feedback link, no mention of paid tiers
- Onboarding tour on first visit — 4 steps, dismissable, restartable
- Footer sponsor text: cheeky, rotating, linked to funding page
- Missing language: toast with translation contribution link

**i18n:**
- vue-i18n with JSON locale files
- Ship with English + Dutch
- All UI strings via $t() — zero hardcoded text in templates
- Locale detection: localStorage → navigator.language → English
- Missing locale triggers a one-time "help us translate" toast
- Label content is NOT translated — it's user data

**a11y:**
- WCAG AA colour contrast on all UI chrome
- ARIA labels on all icon-only buttons
- Focus management in all modals and dialogs
- Keyboard shortcuts cover all canvas interactions
- Canvas has aria-label + off-screen content summary
- Respect prefers-reduced-motion
- The canvas itself is inherently inaccessible — accept this, provide
  keyboard alternatives

**Technical:**
- Browser-only — no Node.js, no `@napi-rs/canvas`, no `*-node` packages
- All `*-web` driver packages as dependencies
- `@burnmark-io/sheet-templates` lazy-loaded via dynamic import
- IndexedDB for storage, localStorage for preferences
- Images resized on import (max 2400px, PNG re-encode)
- Share URLs limited to ~8KB compressed — larger designs use .label export
- PWA install prompt after 2nd or 3rd visit, not first

**Deployment:**
- GitHub Pages at `burnmark-io.github.io`
- Docker at `ghcr.io/burnmark-io/app`
- No server, no API, no auth for v1
- `compose.yaml` published for easy self-hosting with print proxy

**Browser support:**
- Chrome and Edge: full support (WebUSB, Web Serial, PWA)
- Firefox: design + export only, no printing (WebUSB not supported)
- Safari: design + export only, no printing
- Show a friendly banner on unsupported browsers: "Printing requires
  Chrome or Edge. You can still design and export labels."
  
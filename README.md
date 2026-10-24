<p align="center"><img src="./logo.svg" alt="burnmark" width="120"></p>

# label-maker

[![CI](https://github.com/burnmark-io/label-maker/actions/workflows/ci.yml/badge.svg)](https://github.com/burnmark-io/label-maker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**Design beautiful labels, print without drivers.** The web app behind
[burnmark.app](https://burnmark.app): a Vue 3 label designer that talks to
thermal label printers straight from the browser over WebUSB.

- Design with text, images, barcodes/QR codes and shapes
- Print directly to Brother QL, DYMO LabelWriter and DYMO LabelManager
  printers, no driver install. See the
  [compatibility matrix](https://thermal-label.github.io/hardware/) for
  which models are verified
- Export to PNG or PDF, or tile onto standard A4 / US-Letter sticker sheets
- Batch-produce labels from CSV or Excel using `{{placeholders}}`
- Keep a local label library in the browser, optionally encrypted and
  unlockable with a passkey
- Installable PWA that works offline; nothing leaves your machine

Direct printing needs WebUSB, so a Chromium-based browser (Chrome, Edge,
…). Designing and exporting work in any modern browser.

## Development

Requires Node.js 22+ and pnpm 9.

```bash
pnpm install
pnpm dev          # dev server on http://localhost:5173
pnpm test         # vitest
pnpm typecheck
pnpm lint
pnpm build        # production build into dist/
```

### Configuration

| Variable                   | Purpose                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_REPORT_URL_<FAMILY>` | Override the device-report link for a printer family, e.g. `VITE_REPORT_URL_BROTHER_QL`. See [`src/lib/support`](./src/lib/support/index.ts). |

## Self-hosting

The app is a static site. The included `Dockerfile` builds it and serves it
with nginx:

```bash
docker build -t label-maker .
docker run -p 8080:80 label-maker
```

## Related packages

| Package                                                                          | Role                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [`@burnmark-io/designer-core`](https://github.com/burnmark-io/designer-core)     | Document model, rendering, template engine and exports |
| [`@burnmark-io/sheet-templates`](https://github.com/burnmark-io/sheet-templates) | Sticker sheet specifications                           |
| [`@thermal-label/*`](https://thermal-label.github.io)                            | Printer drivers and the WebUSB transport               |

## Repository layout

```
src/        the app (components, stores, composables, services, lib)
public/     static assets copied as-is into the build
dev/        planning and development notes, not needed to build or run
  PLAN.md, PROGRESS.md, DECISIONS.md, …   original build plan and logs
  plans/       implementation plans (implemented/, backlog/, superseded/)
  amendments/  feature amendments (implemented/, backlog/)
  adr/         architecture decision records
  formats/     Brother LBX and DYMO .label file format specs
```

## License

[MIT](./LICENSE) © MBTech

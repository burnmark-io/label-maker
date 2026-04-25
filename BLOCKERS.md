# label-maker — Blockers

Genuinely blocking issues that need human input. Each entry: what was tried,
what's needed, what was worked around in the meantime.

## (soft) designer-core ships a Node-aware bundle

`@burnmark-io/designer-core@0.1.0` imports `node:crypto`, `node:url`,
`node:path`, and dynamically `@napi-rs/canvas`. Browser builds need
shims to satisfy the bundler. **Not blocking** — see D1 in DECISIONS.md
for the alias-to-shim workaround. A future designer-core release should
expose a `./browser` export that doesn't touch the Node modules; once
available, drop the shims and the vite aliases.

## (soft) No git remote configured

The repo has no `origin` remote. Each phase commits locally; pushes
are no-ops. The operator should `git remote add origin
git@github.com:burnmark-io/label-maker.git` (once the repo exists)
and push the local branch.

## (soft) `LabelObjectInput` distributes Omit over the union

The exposed `add()` method's parameter type loses subtype-specific
fields. We wrapped it (D2) so consumers can pass typed discriminated
inputs. **Not blocking.**

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


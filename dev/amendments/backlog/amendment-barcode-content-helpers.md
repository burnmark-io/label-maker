# Amendment — 2D barcode content helpers, mobile QoL, & QR styling UI

> **Amends:** `PLAN.md` §6.2 (Barcode properties — "QR Content helpers
> as buttons: WiFi, vCard, URL, Phone, Email, Geo").
> **Sibling:** `amendment-barcode-validation.md` (per-format mask +
> validation; ships first; this amendment depends on its
> `is2dFormat()` helper, the placeholder-bypass policy, and the
> `InsertVariableButton` pattern).
> **Designer-core sibling:** `../designer-core/designer-core-amendment-qr-styling.md`
> (renderer-side changes for fancy QR — logo, dot styles, colours).
> Bumps `@burnmark-io/designer-core` to `^0.2.0`. Ships first; this
> amendment consumes its `qrStyle` options.
> **Companion to:** `PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md`.
>
> One sentence: when the user picks a 2D barcode (QR, Data Matrix,
> Aztec, …) the data field gains **content templates** — small
> structured editors that generate the right encoded string for
> common payloads (URL, WiFi, vCard, geo, email, phone, calendar
> event) — plus, for QR formats specifically, a **styling panel**
> with logo upload, dot-shape presets, and colour pickers. Mobile
> users get progressive enhancements (Contact Picker, Geolocation)
> where the platform offers them.

---

## 1. Vision

Two threads woven together because they ship in the same surface:

**Content helpers.** The validation amendment got the user a
syntactically-valid QR code on screen. It said nothing about *what*
to type. Most users who want a "WiFi QR code" don't know that the
encoded string looks like `WIFI:T:WPA;S:HomeNetwork;P:hunter2;H:false;;`
— they want **two text fields and a security dropdown**. Same story
for vCards, calendar events, geo points. Helpers turn "encode the
right string" from a research task into a fill-in-the-blanks task.

**QR styling.** Plain bwip-js QR codes are functional and ugly.
People don't print plain QRs on a wedding invitation, a craft beer
label, a startup business card. With the designer-core amendment,
QR codes can carry a logo, use rounded dots, sit on a coloured
background. We expose those options in the side panel as opt-in
controls — defaults stay byte-identical to today, but a user one
click away can have a QR that looks intentional.

**Mobile QoL.** Half of label-printing happens on phones (PROGRESS.md
phase 7 wired the PWA install flow). On Android Chrome the Contact
Picker, Geolocation, and `.ics` file picker all work. Where the
browser supports it, we use it; where it doesn't, we fall back to
manual fields. **No `userAgent` sniffing — feature detection only.**

The label is still the hero. Helpers and styling live in the side
panel; everything they generate flows through to `object.data` /
`object.options` exactly as if the user had typed it. The canvas
shows the result live, the validation amendment's helper line still
runs, the renderer doesn't know any of this UI exists.

---

## 2. Gap Analysis

### 2.1 What exists today

| Aspect | Today |
|---|---|
| 2D content entry | Plain textarea on `BarcodeProperties.vue`. User must already know the encoded string. |
| QR styling | None. bwip-js produces plain square modules. |
| Logo in QR | Not possible. |
| Mobile integration | None. |
| Round-trip | n/a — user types, that's it. |
| QR Error correction | Already exposed via `eclevel` dropdown ([BarcodeProperties.vue:40-57](src/components/panels/BarcodeProperties.vue#L40-L57)). |

### 2.2 What changes vs. PLAN.md

| Topic | PLAN.md | Amendment |
|---|---|---|
| QR content helpers | "QR Content helpers as buttons: WiFi, vCard, URL, Phone, Email, Geo" | Full **structured editors** for URL / Email / Phone / SMS / WiFi / vCard / Geo / Event / Plain text. Round-trip detection. Mobile QoL via feature detection. |
| QR styling | Not mentioned | Logo upload, dot-shape presets, corner styling, colour pickers — all opt-in, all only shown for QR formats. Defaults byte-identical to today. |
| Helpers for non-QR 2D | n/a | Same content-type picker shows for **all** 2D formats (Data Matrix, Aztec, PDF417, …) where the encoded string semantics overlap. Styling stays QR-only. |

### 2.3 What does **not** change

- The format picker. Same grouped `<select>` from the validation
  amendment.
- The validation registry. Helpers generate strings that flow through
  the same validate / mask pipeline. Strings out of helpers are not
  pre-flagged as valid — the validator runs anyway.
- The renderer. designer-core's amendment ships the new render path;
  this amendment only sets the new options.
- 1D / postal / GS1 formats. They get no helpers and no styling. The
  validation amendment's hint line is the only guidance.

---

## 3. Design Decisions

### 3.1 Content type picker is a dropdown, not tabs

Tabs would burn the toolbar's vertical real estate. A `<select>`
labelled "Content type" sits above the data editor area. Choosing a
value swaps the editor:

```
Format:        [QR Code ▾]
Content type:  [URL ▾]
               URL · Email · Phone · SMS · WiFi · vCard · Geo · Event · Plain text
[ — URL editor here — ]
[helper line from validation amendment]
```

"Plain text" is the default and reproduces today's textarea. Picking
any other type swaps to the structured editor; switching back to
"Plain text" preserves the encoded string in the textarea so users
can hand-edit.

### 3.2 Round-trip detection is best-effort, never destructive

When the helper picker opens (or when a different 2D barcode is
selected on the canvas), inspect `object.data`:

- Starts with `https?://` → URL.
- Starts with `mailto:` → Email.
- Starts with `tel:` → Phone.
- Starts with `sms:` → SMS.
- Starts with `WIFI:` → WiFi.
- Starts with `BEGIN:VCARD` → vCard.
- Starts with `geo:` → Geo.
- Starts with `BEGIN:VEVENT` → Event.
- Otherwise → Plain text.

If detection finds a match, **set the picker but don't pre-fill the
fields until the user opens that helper**. Reason: parsing a hand-
edited vCard or vEvent is fragile, and silently dropping fields the
parser couldn't read would erase user data. Instead, the picker
shows the detected type with a small "Open helper to edit
structured" link — clicking it runs the parser and fills what it
can, with a one-shot info note: "Some fields may not have parsed —
review before saving."

The "Plain text" path is a permanent escape hatch. From any helper,
"Edit raw" toggles to a textarea showing the generated string.
Edits in raw mode flow through verbatim and don't re-parse unless
the user explicitly re-opens the helper.

### 3.3 Helper fields support placeholders

A vCard `TEL` field can contain `{{phone}}`. A URL editor accepts
`https://shop.burnmark.io/{{slug}}`. The `InsertVariableButton`
component from the validation amendment is reusable: every text-y
field in every helper gets one (or a single shared one at the top
of the helper, the implementor's call).

When any helper field contains `{{...}}`, the encoder passes it
through verbatim — the substitution happens at render time inside
`BarcodeNode.vue`'s `applyTemplate` call ([BarcodeNode.vue:63](src/components/canvas/BarcodeNode.vue#L63)).
The validator's placeholder bypass (§3.2 in the validation
amendment) handles it from there.

### 3.4 Mobile features are progressive enhancements

For each platform integration, the rule is:

1. Feature-detect (`'contacts' in navigator`, `'geolocation' in
   navigator`, `BarcodeDetector` exists, etc.). **Never** branch on
   `userAgent`.
2. If supported, render the native button alongside the manual
   inputs.
3. If unsupported, the manual inputs work on their own.
4. If supported but permission is denied, swallow the error, keep
   manual inputs, optionally show a one-shot toast.

This means a helper looks identical on every platform until the user
sees a "Pick from contacts" button on Android Chrome or a "Use my
location" button anywhere. No surprise on mobile, no missing feature
on desktop.

### 3.5 QR styling is opt-in and QR-only

The styling panel is a collapsed accordion below the helper editor,
shown **only** when format ∈ {`qrcode`, `microqr`, `gs1qrcode`}.
Opening the accordion is the user's signal "I want fancy QR".
Defaults stay neutral — `qrStyle: undefined` until the user picks a
preset or uploads a logo. This guarantees that:

- Users who don't want fancy QR see today's UI (plus content type
  picker).
- Users who do want fancy QR see one extra panel, fully
  self-contained.
- Documents stay byte-identical on disk until styling is engaged.

The accordion is **not** a popover or a modal. Stays in the side
panel with the rest of the properties. Scrolls within the panel if
needed.

### 3.6 Logos are stored as assets, not data URLs in `qrStyle`

Same pattern as `ImageObject.assetKey`. The user uploads a logo →
the existing `BurnmarkAssetLoader` resizes (max 2400px), hashes,
stores in IndexedDB → returns a content-addressed key → we set
`qrStyle.logoAssetKey = key` on the barcode. Designer-core resolves
the key to bytes at render time and hands a data URL to
qr-code-styling.

Rationale: keeps documents small (no inline base64), reuses the
existing asset pipeline (export `.zip` already bundles asset blobs),
deduplicates if the same logo is used on multiple barcodes.

### 3.7 No QR styling for non-QR formats

Data Matrix, Aztec, PDF417 also accept arbitrary content but the
designer-core amendment renders them through bwip-js and exposes no
styling. We don't show the styling accordion for those formats.
Logos in Data Matrix etc. are technically possible (high EC + manual
overlay) but we don't pretend to support them in v1. Document this
in the help menu's "Printer compatibility" section.

### 3.8 Content type picker never blocks Save / Print

Same policy as the validation amendment (§3.6): no validation gate
ever blocks the print flow. A half-filled vCard generates whatever
encoded string we can produce, the renderer either succeeds or shows
the blank-block fallback, the user adjusts.

---

## 4. Content type reference table

Each row → one helper component + one encoder + one parser. The
**Encoded format** column is what the helper writes to `object.data`.
The **Mobile assist** column lists the optional progressive-
enhancement APIs.

| Content type | Encoded format | Helper fields | Mobile assist | Round-trip |
|---|---|---|---|---|
| Plain text | (verbatim) | textarea | — | trivial |
| URL | `https://example.com/path` | one URL field | Clipboard paste (`navigator.clipboard.readText`) | check `URL` constructor |
| Email | `mailto:user@example.com?subject=Hi&body=Hello` | to, cc, bcc, subject, body | Contact Picker (`navigator.contacts.select`, props `['email']`) | parse `mailto:` URI |
| Phone | `tel:+31201234567` | one tel field | Contact Picker (props `['tel']`) | parse `tel:` URI |
| SMS | `sms:+31612345678?body=Hello` | tel, body | Contact Picker (props `['tel']`) | parse `sms:` URI |
| WiFi | `WIFI:T:WPA;S:<ssid>;P:<password>;H:<true\|false>;;` | SSID, password, security (`WPA`/`WEP`/`nopass`), hidden checkbox | None confirmed (see §6.3) | regex parse (best-effort) |
| vCard | `BEGIN:VCARD\nVERSION:3.0\n…\nEND:VCARD` | FN (full name), N (last/first), ORG, TITLE, TEL, EMAIL, URL, ADR | Contact Picker (props `['name','tel','email','address']`) | line-by-line parse |
| Geo | `geo:<lat>,<lng>?q=<label>` | lat, lng, label | Geolocation (`navigator.geolocation.getCurrentPosition`) | regex parse |
| Calendar event | `BEGIN:VEVENT\nSUMMARY:<title>\n…\nEND:VEVENT` | title, location, start, end, description | `.ics` file picker (drag-and-drop) | line-by-line parse |

### 4.1 Detail: WiFi encoding

**Format**: `WIFI:T:<security>;S:<ssid>;P:<password>;H:<bool>;;`

- `T:WPA` for WPA / WPA2 / WPA3 (most networks)
- `T:WEP` for legacy
- `T:nopass` for open networks — the `P:` field is omitted
- `H:true` for hidden networks; default omit (treated as not hidden)
- The double semicolon `;;` at the end is a literal terminator
- **Escape these characters in S and P**: `\` `;` `,` `:` `"` —
  prepend a backslash. e.g. an SSID `Cafe; Bar` becomes `Cafe\; Bar`
  in the encoded string.

Helper component fields:

```
SSID:      [_______________]
Password:  [_______________] (hidden when security = nopass)
Security:  [WPA ▾]   ← WPA · WEP · None
Hidden:    [ ] Hidden network
```

### 4.2 Detail: vCard 3.0 encoding

Use vCard 3.0 (broadest scanner support). Each property on its own
line, line endings `\r\n`, `END:VCARD` terminates.

```
BEGIN:VCARD
VERSION:3.0
FN:Jane Doe
N:Doe;Jane;;;
ORG:Acme Inc.
TITLE:CEO
TEL;TYPE=CELL:+31612345678
EMAIL:jane@example.com
URL:https://example.com
ADR;TYPE=WORK:;;Main Street 1;Amsterdam;;1011AB;Netherlands
END:VCARD
```

Notes:

- `FN` is the full display name (required).
- `N` is structured `Last;First;Middle;Prefix;Suffix` (semicolons
  separate even if blank).
- **Escape these characters in any value**: `\` `,` `;` `\n` —
  prepend a backslash (or `\n` for newlines, `\r` for CRs).
- `TYPE=CELL` / `TYPE=WORK` / `TYPE=HOME` are common labels.
- `ADR` is `PO box;Extended;Street;City;Region;Postcode;Country`.
- **No photo / `PHOTO` field.** vCard photos inflate past most
  scanners' practical capacity (open question in §11).

### 4.3 Detail: Calendar event (vEvent) encoding

```
BEGIN:VEVENT
SUMMARY:Quarterly review
LOCATION:Acme HQ\, Amsterdam
DTSTART:20260501T100000Z
DTEND:20260501T110000Z
DESCRIPTION:Q4 numbers and roadmap
END:VEVENT
```

- `DTSTART` / `DTEND` in iCalendar UTC format `YYYYMMDDTHHMMSSZ`.
  Local-time variant `YYYYMMDDTHHMMSS` (no Z) also valid; prefer
  UTC.
- Same character escaping as vCard.
- Optional all-day form: `DTSTART;VALUE=DATE:20260501` and same for
  `DTEND`.

### 4.4 Detail: Geo encoding

```
geo:52.3676,4.9041
geo:52.3676,4.9041?q=Amsterdam
```

- Coordinates are decimal degrees, dot separator. Latitude first.
- Optional `?q=<label>` is supported by most map apps (Apple Maps,
  Google Maps, OpenStreetMap).
- No URL-encode of `q` value beyond standard URL rules — spaces
  become `%20`.

### 4.5 Detail: Phone / SMS / Email

`tel:` URIs are simple — strip whitespace except the leading `+`.
`sms:` allows `?body=` query parameter, body URL-encoded. `mailto:`
allows `?subject=`, `&body=`, `&cc=`, `&bcc=` — all URL-encoded.
For everyday use this is just `encodeURIComponent` on each field.

---

## 5. QR styling reference

The styling accordion's controls map directly to the
`@burnmark-io/designer-core` `qrStyle` option fields specified in
the designer-core amendment. Repeated here for consumer convenience.

### 5.1 Control mapping

| UI control | Maps to | Notes |
|---|---|---|
| Style preset (radio cards) | `qrStyle.preset` (then auto-applied to other fields) | Five built-in: Classic / Rounded / Dots / Classy / Brand |
| Logo (drop zone + thumbnail) | `qrStyle.logoAssetKey` | Existing `BurnmarkAssetLoader` — same upload UX as `ImageProperties.vue` |
| Logo size (slider) | `qrStyle.logoSize` (0.05–0.45) | Default 0.25. UI label: "Logo size" |
| Logo margin (slider) | `qrStyle.logoMargin` (0–8) | Default 2. UI label: "Logo padding" |
| Clear behind logo (toggle) | `qrStyle.logoClearArea` | Default true |
| Dot shape (radio cards with mini-icons) | `qrStyle.dotType` | square / dots / rounded / classy / classy-rounded / extra-rounded |
| Corner square (radio cards) | `qrStyle.cornerSquareType` | square / dot / extra-rounded |
| Corner dot (radio cards) | `qrStyle.cornerDotType` | square / dot |
| Foreground colour (color picker) | `qrStyle.dotColor` | Reuse `ColorPicker.vue` |
| Background colour (color picker) | `qrStyle.backgroundColor` | Reuse `ColorPicker.vue` |

The error-correction dropdown that already exists ([BarcodeProperties.vue:40-57](src/components/panels/BarcodeProperties.vue#L40-L57))
stays where it is. Designer-core auto-bumps EC to `H` when a logo is
set and the user hasn't overridden — but the dropdown still shows
the user's chosen value. If the renderer auto-bumps, surface a small
inline note: "Error correction set to High to make room for the logo."

### 5.2 Thermal-print warning banner

Inside the styling accordion, a small info banner near the dot-shape
control:

> Some shapes print less reliably on thermal labels.
> **Square** and **Rounded** are safest; **Dots** may have gaps.

Always shown when the accordion is open, dismissable. No popup, no
toast.

### 5.3 Preset previews

Each preset shows a tiny preview image (24×24px PNG bundled in
`/public/qr-presets/*.png`, generated once during build from canonical
fixtures). Clicking applies the preset and overwrites the individual
controls below — but the user can then tweak any field. This is the
"start here" affordance.

### 5.4 Logo upload UX

1. Drop zone: `<input type="file" accept="image/png,image/jpeg,image/svg+xml">`.
2. On file: call existing asset loader — resize, hash, store.
3. Set `qrStyle.logoAssetKey` to the returned hash.
4. Show 64×64 thumbnail with a "Remove" button.
5. On remove: clear `qrStyle.logoAssetKey`, EC dropdown resets if it
   was auto-bumped.

Drag-and-drop into the drop zone works identically to click-to-pick.

### 5.5 Round-trip with documents

Saving a document with `qrStyle` writes the field into the document
JSON. Loading replays it. Shared via URL (Phase 6) — `qrStyle` is
~100 bytes of JSON, fits inside the 8KB hash limit; **logos do
not** unless the user has a tiny image. The share dialog's existing
"too large for URL — export as .label" path covers this.

---

## 6. Mobile QoL detail

### 6.1 Contact Picker API (vCard / Phone / SMS / Email)

Spec: <https://wicg.github.io/contact-api/>. Available in Chrome
Android (and Edge Android). Not in iOS Safari or any desktop
browser.

```ts
type ContactProperty = 'name' | 'email' | 'tel' | 'address' | 'icon';
const supported =
  'contacts' in navigator &&
  typeof (navigator as { contacts?: { select: unknown } }).contacts?.select === 'function';

if (supported) {
  const contacts = await navigator.contacts.select(
    ['name', 'tel', 'email', 'address'],
    { multiple: false },
  );
  // contacts is an array of objects keyed by the requested properties
}
```

Each helper requests only the properties it needs:
- vCard: `['name', 'tel', 'email', 'address']`
- Phone: `['tel']`
- SMS: `['tel']`
- Email: `['email']`

The button label is consistent: **"Pick from contacts"** with a
small contact-card icon. Permission denial silently falls back to
manual fields (no toast). User cancellation is a no-op.

### 6.2 Geolocation (Geo helper)

Available everywhere with permission. The "Use my location" button
calls `navigator.geolocation.getCurrentPosition`:

```ts
navigator.geolocation.getCurrentPosition(
  (pos) => {
    helper.lat = pos.coords.latitude.toFixed(6);
    helper.lng = pos.coords.longitude.toFixed(6);
  },
  (err) => {
    // Silent fall back to manual inputs. err.code === 1 (denied),
    // 2 (unavailable), 3 (timeout).
  },
  { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
);
```

Six-decimal precision (~10cm) is enough for any label use case.

### 6.3 WiFi — currently-connected network

**Conclusion**: not exposed by any browser API. The Network
Information API (`navigator.connection`) reports connection type
(`'wifi'` / `'cellular'` / etc.) but never SSID or password —
that's a hard privacy boundary in every browser. WiFi helper stays
manual-only.

The implementor should still add a one-shot helper note at the
bottom of the WiFi editor's empty state:

> Tip: on Android, you can also share a WiFi QR from your phone —
> Settings → WiFi → ⚙ → Share. We can't read it from the browser.

This converts the absence of a feature into a useful pointer.

### 6.4 `.ics` file picker (Calendar event)

Drag-and-drop or `<input type="file" accept=".ics,text/calendar">`
on the Event helper's empty state. Parse the dropped file (re-use
the same vEvent parser used for round-trip detection). Pre-fill
the helper fields. Same one-shot info as round-trip parsing: "Some
fields may not have parsed — review before saving."

Stretch goal — phase F. Skip for the first release of the helpers.

### 6.5 Web Share Target (URL helper)

If the PWA was launched as a Web Share Target with a URL payload,
pre-fill the URL helper. Requires `share_target` config in the PWA
manifest:

```json
{
  "share_target": {
    "action": "/share",
    "method": "GET",
    "params": { "url": "url", "title": "title", "text": "text" }
  }
}
```

`/share` becomes a route in the SPA that creates a new label with
a QR + URL helper pre-filled, then redirects to `/`. Add to
`vite.config.ts` PWA plugin manifest.

Stretch goal — phase F. Skip for the first release.

### 6.6 Clipboard paste (URL helper)

A small "Paste URL" button next to the URL field calls
`navigator.clipboard.readText()` and validates with `new URL()`.
Permission may prompt on first use. If denied or empty, no-op.

---

## 7. Architecture

### 7.1 New files

```
src/
├── lib/barcode/helpers/
│   ├── index.ts              # registerHelpers, detectContentType, ContentType
│   ├── types.ts              # ContentType, HelperEncoder<T>, HelperParser<T>
│   ├── url.ts                # encodeUrl, parseUrl
│   ├── email.ts              # encodeMailto, parseMailto
│   ├── phone.ts              # encodeTel, parseTel
│   ├── sms.ts                # encodeSms, parseSms
│   ├── wifi.ts               # encodeWifi, parseWifi, escapeWifiValue
│   ├── vcard.ts              # encodeVCard, parseVCard, escapeVCardValue
│   ├── geo.ts                # encodeGeo, parseGeo
│   ├── vevent.ts             # encodeVEvent, parseVEvent
│   ├── mobile.ts             # feature-detection helpers (hasContactPicker, …)
│   └── __tests__/
│       └── *.test.ts         # round-trip tests for each helper
├── components/panels/barcode-helpers/
│   ├── ContentTypePicker.vue
│   ├── PlainTextHelper.vue
│   ├── UrlHelper.vue
│   ├── EmailHelper.vue
│   ├── PhoneHelper.vue
│   ├── SmsHelper.vue
│   ├── WifiHelper.vue
│   ├── VCardHelper.vue
│   ├── GeoHelper.vue
│   ├── EventHelper.vue
│   └── ContactPickerButton.vue   # shared progressive-enhancement button
└── components/panels/qr-styling/
    ├── QrStylingPanel.vue
    ├── QrPresetCard.vue          # one preset card with preview thumbnail
    ├── QrStyleField.vue          # styled radio-card group used by dot/corner pickers
    └── QrLogoUpload.vue          # drop zone + thumbnail + remove button
public/
└── qr-presets/
    ├── classic.png
    ├── rounded.png
    ├── dots.png
    ├── classy.png
    └── brand.png
```

### 7.2 `BarcodeProperties.vue` integration

```vue
<template>
  <div class="props">
    <!-- format picker (existing) -->
    <FormatPicker v-model="object.format" />

    <!-- (new) content type picker, only for 2D formats -->
    <ContentTypePicker
      v-if="is2dFormat(object.format)"
      v-model="contentType"
    />

    <!-- (new) per-content-type helper, swapped on contentType -->
    <component
      v-if="is2dFormat(object.format)"
      :is="helperComponent"
      v-model:data="object.data"
    />

    <!-- (existing) data textarea, only for 1D / postal / GS1 / "Plain text" 2D -->
    <DataField
      v-if="!is2dFormat(object.format) || contentType === 'plain'"
      :object="object"
    />

    <!-- (new) QR styling accordion, only for QR family -->
    <QrStylingPanel
      v-if="isQrFamily(object.format)"
      :object="object"
      @update="updateQrStyle"
    />

    <!-- (existing) scale slider, error correction dropdown, include text toggle -->
    <ScaleSlider … />
    <EcDropdown v-if="isQrFormat" … />
    <ToggleField v-if="!isQrFormat" … />
  </div>
</template>
```

The helper components all `v-model:data` against `object.data` —
their internal state is local; on every change they regenerate the
encoded string and emit. Round-trip detection runs once on mount
(or on `object.id` change).

### 7.3 `ContentType` discriminated union

```ts
// src/lib/barcode/helpers/types.ts
export type ContentType =
  | 'plain'
  | 'url'
  | 'email'
  | 'phone'
  | 'sms'
  | 'wifi'
  | 'vcard'
  | 'geo'
  | 'event';

export interface HelperEncoder<TFields> {
  encode(fields: TFields): string;
  parse(data: string): TFields | null;
  empty(): TFields;
}
```

Each helper module exports a `HelperEncoder<T>` instance and the
component consumes it.

### 7.4 Persistence of the picked content type

`contentType` is local UI state, not part of the document. Reason:
two users opening the same shared label may want different starting
helpers; the encoded string is canonical, the picker is a view.
Round-trip detection makes the picker pick the right value
automatically on mount. If the user manually switches to "Plain
text" while the data is `mailto:...`, the picker stays on Plain
text until they leave / re-enter the panel.

### 7.5 i18n

New keys under `properties.barcode.helpers.*` and
`properties.barcode.styling.*`. Mirror to `nl.json`. Mark uncertain
translations in `PLACEHOLDERS.md` (existing pattern).

Sketch:

```json
{
  "properties": {
    "barcode": {
      "contentType": {
        "label": "Content type",
        "plain": "Plain text",
        "url": "URL",
        "email": "Email",
        "phone": "Phone",
        "sms": "SMS",
        "wifi": "WiFi",
        "vcard": "Contact card",
        "geo": "Location",
        "event": "Calendar event"
      },
      "helpers": {
        "url": { "label": "URL", "paste": "Paste from clipboard" },
        "email": { "to": "To", "subject": "Subject", "body": "Message" },
        "wifi": {
          "ssid": "Network name",
          "password": "Password",
          "security": "Security",
          "hidden": "Hidden network",
          "androidTip": "Tip: on Android you can also share a WiFi QR from Settings → WiFi → ⚙ → Share."
        },
        "vcard": { "name": "Full name", "phone": "Phone", "email": "Email", "address": "Address" },
        "geo": { "lat": "Latitude", "lng": "Longitude", "label": "Place name", "useMyLocation": "Use my location" },
        "event": { "title": "Title", "location": "Location", "start": "Start", "end": "End" },
        "pickFromContacts": "Pick from contacts",
        "editRaw": "Edit raw",
        "fromHelper": "Back to {type}"
      },
      "styling": {
        "title": "QR style",
        "preset": "Style",
        "logo": "Logo",
        "logoSize": "Logo size",
        "logoMargin": "Logo padding",
        "logoClear": "Clear dots behind logo",
        "dotType": "Dot shape",
        "cornerSquare": "Corner squares",
        "cornerDot": "Corner dots",
        "foreground": "Foreground",
        "background": "Background",
        "ecAutoBumped": "Error correction set to High to make room for the logo.",
        "thermalWarning": "Some shapes print less reliably on thermal labels. Square and Rounded are safest; Dots may have gaps."
      }
    }
  }
}
```

---

## 8. UX Walkthrough

### 8.1 Picking "URL" content type

User adds a barcode object, format defaults to `code128`. Switches
format to `qrcode`. Content type picker appears, defaulting to
"Plain text". User changes to "URL":

```
Format:        [QR Code ▾]
Content type:  [URL ▾]
URL:           [_______________________________] { } [Paste]
               Any text or URL.
```

Typing into the URL field updates `object.data` directly with the
typed string. Validator runs (validation amendment §3.1) — for QR,
no mask, just length warnings.

### 8.2 Picking "WiFi" content type

```
Format:        [QR Code ▾]
Content type:  [WiFi ▾]
SSID:          [HomeNetwork__________] { }
Password:      [••••••••_____________] { }
Security:      [WPA / WPA2 ▾]
[ ] Hidden network
[Edit raw]
               16 characters of encoded data (validated).
```

Each keystroke regenerates `WIFI:T:WPA;S:HomeNetwork;P:hunter2;H:false;;`
and writes to `object.data`. Canvas updates live.

### 8.3 vCard with Contact Picker (Android Chrome)

```
Format:        [QR Code ▾]
Content type:  [Contact card ▾]
[👤 Pick from contacts]
Full name:     [Jane Doe_____________] { }
Phone:         [+31612345678_________] { }
Email:         [jane@example.com_____] { }
Address:       [Main Street 1 …______] { }
[Edit raw]
```

Tapping "Pick from contacts" calls `navigator.contacts.select`;
the picker opens; on return, fields populate. On a desktop browser,
the button is absent — fields are manual only.

### 8.4 Round-trip detection

User has imported a `.label` file with `data = "WIFI:T:WPA;S:Office;P:secret;;"`
and `format = qrcode`. Opens the barcode properties:

- Picker auto-detects `wifi` content type.
- Helper area shows: "Open helper to edit structured fields"
  with a button.
- Clicking the button parses the string and fills SSID/Password/
  Security/Hidden. One-shot info note: "Some fields may not have
  parsed — review before saving."

If the user just wants to keep what's there and tweak the QR
style (next section), they don't need to open the helper.

### 8.5 QR styling accordion

User has format `qrcode` and data `https://burnmark.io`. Below the
helper area:

```
▸ QR style
```

Clicking expands:

```
▾ QR style
  Style: [○ Classic] [● Rounded] [○ Dots] [○ Classy] [○ Brand]
  Logo:  [drop area / 64×64 thumbnail]
         Logo size:    ──◯── 25%
         Logo padding: ──◯── 2 modules
         [✓] Clear dots behind logo
  Dot shape:        [● rounded] [○ square] [○ dots] [○ classy-rounded] [○ extra-rounded]
  Corner squares:   [● extra-rounded] [○ square] [○ dot]
  Corner dots:      [● dot] [○ square]
  Foreground: [#000000 ▾]
  Background: [#ffffff ▾]

  ⓘ Some shapes print less reliably on thermal labels.
    Square and Rounded are safest; Dots may have gaps.
```

Picking a preset overwrites every field below. Tweaking individual
fields does not change the preset (preset becomes "Custom" — a
non-selectable visual state).

If a logo is uploaded and `eclevel` was at default, the EC dropdown
shows `H` and a small inline note: "Error correction set to High
to make room for the logo."

### 8.6 Switching format clears styling

If the user switches from `qrcode` to `code128`, the styling panel
disappears and `qrStyle` is **kept** on the object. Switching back
to `qrcode` brings it back. Switching to a 2D non-QR format
(`datamatrix`, `azteccode`) hides the styling panel but keeps
`qrStyle` on the object — same logic, no destructive change.

### 8.7 Switching format with content type

Content types apply to all 2D formats (QR, Data Matrix, Aztec,
PDF417). Switching from `qrcode` to `datamatrix` keeps the picked
content type and re-encodes — for content types that produce raw
strings (URL, email, etc.), this is transparent. Switching from a
2D format to a 1D format hides the content type picker and shows
the data textarea.

---

## 9. Implementation phases

Add as **Phase 12** in `PROGRESS.md`. Six sub-phases, each
shippable independently.

### Phase 12: 2D content helpers + QR styling

**12.A: Plumbing + URL + Plain text**
- [ ] **12.A.1** `src/lib/barcode/helpers/types.ts`,
      `src/lib/barcode/helpers/index.ts` — `ContentType`,
      `HelperEncoder<T>`, `detectContentType`, `is2dFormat` (move
      from validation amendment if not already there).
- [ ] **12.A.2** `helpers/url.ts` + `helpers/__tests__/url.test.ts`.
- [ ] **12.A.3** `ContentTypePicker.vue`, `PlainTextHelper.vue`,
      `UrlHelper.vue`. Reuse `InsertVariableButton` from validation
      amendment.
- [ ] **12.A.4** Wire into `BarcodeProperties.vue` — picker shows
      for 2D formats, swaps editor on type. Round-trip detection
      runs on mount.
- [ ] **12.A.5** i18n keys (`contentType`, `helpers.url`).
- [ ] **12.A.6** Component test for picker + URL helper.

**12.B: Email / Phone / SMS**
- [ ] **12.B.1** Encoder + parser + tests for each
      (`helpers/email.ts`, `helpers/phone.ts`, `helpers/sms.ts`).
- [ ] **12.B.2** Helper components.
- [ ] **12.B.3** `ContactPickerButton.vue` shared component;
      progressive enhancement using `'contacts' in navigator`
      detection.
- [ ] **12.B.4** i18n keys.
- [ ] **12.B.5** Tests.

**12.C: WiFi**
- [ ] **12.C.1** Encoder + parser + tests, character escaping per
      §4.1.
- [ ] **12.C.2** `WifiHelper.vue` with security dropdown, hidden
      checkbox, password masking. Android tip in empty state.
- [ ] **12.C.3** i18n.
- [ ] **12.C.4** Tests.

**12.D: Geo**
- [ ] **12.D.1** Encoder + parser + tests.
- [ ] **12.D.2** `GeoHelper.vue` with "Use my location" button
      using `navigator.geolocation`.
- [ ] **12.D.3** i18n.
- [ ] **12.D.4** Tests (mock `navigator.geolocation`).

**12.E: vCard**
- [ ] **12.E.1** Encoder + parser + tests, character escaping per §4.2.
- [ ] **12.E.2** `VCardHelper.vue` with `ContactPickerButton`. No
      photo field. ADR field flat or split — pick one and document.
- [ ] **12.E.3** i18n.
- [ ] **12.E.4** Tests.

**12.F: Event + stretch (.ics import, Web Share Target)**
- [ ] **12.F.1** vEvent encoder + parser + tests.
- [ ] **12.F.2** `EventHelper.vue` with date/time pickers.
- [ ] **12.F.3** Stretch — `.ics` drop zone parses + fills helper.
- [ ] **12.F.4** Stretch — `share_target` in PWA manifest +
      `/share` route handler.
- [ ] **12.F.5** Tests.

**12.G: QR styling UI** (depends on designer-core 0.2.0)
- [ ] **12.G.1** Bump `@burnmark-io/designer-core` to `^0.2.0` in
      `package.json`. Verify the bumped designer-core's `qrStyle`
      types are visible in the editor.
- [ ] **12.G.2** `QrStylingPanel.vue` accordion, hidden unless
      `isQrFamily(object.format)`.
- [ ] **12.G.3** `QrPresetCard.vue` — generate preview PNGs once
      via a build script (`scripts/gen-qr-presets.mjs`) → write to
      `public/qr-presets/*.png`. Five presets.
- [ ] **12.G.4** `QrLogoUpload.vue` — drop zone + asset loader
      integration + thumbnail + remove. Reuse upload UX from
      `ImageProperties.vue`.
- [ ] **12.G.5** Style fields (dot type, corner square, corner dot,
      colours) — use `QrStyleField.vue` for the radio-card pickers.
- [ ] **12.G.6** Surface `RenderWarning` events with codes
      `styled-qr-unavailable` and `qr-logo-load-failed` in the
      toast queue with friendly copy.
- [ ] **12.G.7** Auto-EC-bump note when a logo is uploaded and
      eclevel is default.
- [ ] **12.G.8** Thermal-print warning banner.
- [ ] **12.G.9** i18n keys (`styling.*`).
- [ ] **12.G.10** Tests — preset application overwrites fields,
      logo upload sets `qrStyle.logoAssetKey`, removing logo clears
      it, eclevel auto-bump trigger.

**12.H: Polish + DECISIONS update**
- [ ] **12.H.1** New D-numbered decisions in `DECISIONS.md`:
      content type is not persisted in the document; vCard 3.0;
      no PHOTO field; round-trip is best-effort; thermal warning
      copy; auto-EC-bump policy; logo storage via existing asset
      loader.
- [ ] **12.H.2** **Gate:** typecheck + lint + format + test +
      build. Manual run through every helper end-to-end.

---

## 10. Tests

### 10.1 Encoder / parser unit tests

Each helper ships with a round-trip test suite. Pattern:

```ts
// helpers/__tests__/wifi.test.ts
import { describe, expect, it } from 'vitest';
import { encodeWifi, parseWifi } from '../wifi.js';

describe('wifi helper', () => {
  it('encodes and parses a basic WPA network', () => {
    const fields = { ssid: 'HomeNetwork', password: 'hunter2', security: 'WPA' as const, hidden: false };
    const encoded = encodeWifi(fields);
    expect(encoded).toBe('WIFI:T:WPA;S:HomeNetwork;P:hunter2;H:false;;');
    expect(parseWifi(encoded)).toEqual(fields);
  });

  it('escapes special characters in SSID and password', () => {
    const fields = { ssid: 'Cafe; Bar', password: 'a:b\\c', security: 'WPA' as const, hidden: false };
    const encoded = encodeWifi(fields);
    expect(encoded).toContain('S:Cafe\\; Bar');
    expect(encoded).toContain('P:a\\:b\\\\c');
    expect(parseWifi(encoded)).toEqual(fields);
  });

  it('omits password for nopass', () => {
    const fields = { ssid: 'Open', password: '', security: 'nopass' as const, hidden: false };
    const encoded = encodeWifi(fields);
    expect(encoded).toBe('WIFI:T:nopass;S:Open;H:false;;');
  });

  it('returns null for non-WIFI strings', () => {
    expect(parseWifi('https://example.com')).toBeNull();
    expect(parseWifi('')).toBeNull();
  });
});
```

Same shape for URL, email, phone, sms, vCard, geo, vEvent. Each
exercises:
- A canonical happy-path round-trip.
- Edge cases per §4 (escapes, empty fields, optional fields).
- Negative cases (parser returns `null` on garbage).

### 10.2 `detectContentType` test matrix

```ts
it.each([
  ['https://burnmark.io', 'url'],
  ['http://example.com', 'url'],
  ['mailto:jane@example.com', 'email'],
  ['tel:+31612345678', 'phone'],
  ['sms:+31612345678?body=Hi', 'sms'],
  ['WIFI:T:WPA;S:Home;P:pwd;;', 'wifi'],
  ['BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Jane\r\nEND:VCARD', 'vcard'],
  ['geo:52.3676,4.9041', 'geo'],
  ['BEGIN:VEVENT\r\nSUMMARY:Test\r\nEND:VEVENT', 'event'],
  ['Hello', 'plain'],
  ['', 'plain'],
])('%s → %s', (data, expected) => {
  expect(detectContentType(data)).toBe(expected);
});
```

### 10.3 Component tests

- `ContentTypePicker.vue` — emits, re-detects on `object.id`
  change.
- Each helper — typing fields updates the encoded string;
  Insert-Variable inserts at cursor; "Edit raw" toggle preserves
  state.
- `ContactPickerButton.vue` — disabled when feature missing;
  emits selected fields on success; silently no-op on cancellation.
- `QrStylingPanel.vue` — preset application overwrites fields;
  individual edits do not change the preset radio; logo upload
  flows; remove logo clears the asset key.

### 10.4 E2E (manual)

- Import `.label` document with WIFI / mailto / vcard data — picker
  detects, helper opens, fields populate.
- On Android Chrome (manual): vCard "Pick from contacts" returns
  values into the helper.
- On any browser with location permission: Geo "Use my location"
  fills lat/lng.
- Upload a 100×100 PNG logo → QR renders with logo. Remove logo →
  QR renders plain.

---

## 11. Open questions

These are intentionally left for the implementor to settle and
record as new D-numbered decisions in `DECISIONS.md`.

1. **Content type persistence** — the decision (§7.4) is "not
   persisted; round-trip detection re-derives". Reconfirm during
   implementation; some users may want to lock the picker to a
   type so a manual hand-edit doesn't snap back. If so, add a
   `barcode.contentTypeOverride` field on the object (optional).
2. **vCard photo field** — confirmed out of scope. Document.
3. **Round-trip strictness** — best-effort with a one-shot info
   note. The implementor should pick the line between "parse what
   you can" and "if any field can't be parsed, refuse to fill" —
   default to "parse what you can".
4. **Helper UI density** — vCard has 6+ fields. Stack vertically in
   the side panel; if the panel becomes unscrollable, push the
   styling accordion below into its own scroll region. No modals.
5. **Mobile detection** — never `userAgent`. Always feature-detect.
   Implementor should resist the urge to "if android, show
   contacts button" — `'contacts' in navigator` is the right
   check.
6. **Locale handling in vCard / vEvent** — date / time / address
   conventions vary by locale. Default to ISO 8601 / en-US for the
   first release; punt locale-aware formatting to a future i18n
   pass.
7. **QR preset thumbnails** — generate at build time vs. ship
   pre-rendered in `public/`? Pre-rendered is simpler; build-time
   guarantees they match the actual library output. Default
   pre-rendered; document the regeneration script.
8. **Auto-EC-bump policy** — designer-core auto-bumps when logo is
   set and `eclevel` is unset. Should the UI show the bumped value
   in the dropdown or the user's "default" (M)? Default: show the
   bumped value (truth wins) with the small inline note.
9. **Renderer cache invalidation** — the designer-core amendment
   suggests memoising styled-QR renders. Confirm the cache key
   includes logo bytes hash, not just `qrStyle` JSON, so logo
   replacement triggers re-render.
10. **`gs1qrcode` styling** — designer-core may fall back to bwip-js
    for GS1 QR. The UI should still show the styling accordion (no
    UI restriction by sub-format), let the user pick options,
    surface the `styled-qr-unavailable` warning in the toast queue
    when render time hits the fallback.
11. **PWA `share_target`** — adding `share_target` to the PWA
    manifest forces a service-worker behaviour change. Verify it
    doesn't break the existing autoUpdate / install-prompt flow
    (D27, D28). Skip for v1 if it adds risk.

---

## 12. Pointers for the implementor

- Read `amendment-barcode-validation.md` before starting — this
  amendment depends on its `is2dFormat()`, `InsertVariableButton`,
  placeholder bypass, and the helper-line UI pattern.
- Read `../designer-core/designer-core-amendment-qr-styling.md`
  before phase 12.G — that defines the `qrStyle` types this UI
  drives.
- The data field already exists at
  [BarcodeProperties.vue:18-26](src/components/panels/BarcodeProperties.vue#L18-L26).
- Asset upload UX is already polished in
  [ImageProperties.vue](src/components/panels/ImageProperties.vue) —
  copy the pattern.
- Color picker exists at
  [ColorPicker.vue](src/components/panels/ColorPicker.vue) — reuse
  for `dotColor` and `backgroundColor`.
- PWA manifest is generated by `vite-plugin-pwa` config in
  `vite.config.ts` — relevant for §6.5 Web Share Target.
- Privacy stance (D11 in `DECISIONS.md`): no analytics, no
  tracking. Helpers and the styling panel must be silent and local.
  No "we improved your QR code 🎉" telemetry.

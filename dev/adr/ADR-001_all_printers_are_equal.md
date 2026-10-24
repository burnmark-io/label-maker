# label-maker — Amendment: Print + Save Buttons, Privacy

> Three changes:
> 1. Simple two-button interface — Print and Save, no complex dialogs
> 2. All save formats available to everyone, always
> 3. Privacy story — fully offline, no tracking, your data stays local

---

## Part 1: Two Buttons

### The Buttons

Two buttons near the label. That's the entire output interface.

```
[⎙ Print]    [💾 ▾]
```

### Print Button — Smart, One Click

No dropdown. No dialog with tabs. One click, does the right thing.

**Printer connected:**
Prints directly. Quick confirmation toast: "Printing to QL-820NWB..."
with success/error follow-up. Done.

For copies or density: long-press or right-click opens a small popover
with copies (1-10) and density (light/normal/dark). Most of the time
you just click and it prints one copy at normal density.

If CSV data is loaded, prints the batch (up to 30 rows) with a progress
toast.

**No printer connected:**
Opens the sheet picker. User picks their sticker sheet (Avery L7160 etc.).
PDF generated → inline viewer → browser's Ctrl+P. Still "printing" — just
through a PDF pipe.

If no sheet is selected yet, defaults to "single label per page" PDF at
the label's actual dimensions. The user can still Ctrl+P that.

### Save Button — Default Action + Dropdown

Click the button: saves to the current design slot (IndexedDB). Quick,
no dialog.

Click the dropdown arrow: reveals format options.

```
[💾 ▾]
  ├── Save                     save to current slot (same as clicking the button)
  ├── PDF                      single label or multi-page if CSV loaded
  ├── PNG                      single label, full colour
  ├── .label file              JSON design file for sharing/backup
  ├── .zip bundle              design + all image assets
  └── Print to sticker sheet   sheet picker → PDF → inline print
```

"Print to sticker sheet" is in the save dropdown as an alternative entry
point — some users will look for it here rather than clicking Print without
a printer connected. Same flow either way: sheet picker → PDF → browser print.

### Why This Is Better

The old plan had a print dialog with three sections (thermal / sheet /
download). That's a dialog wall between the user and their label. The
new design:

- Print = one click for the common case
- Save = one click for the common case
- Everything else = one extra click via the dropdown
- No modal dialog blocking the canvas

---

## Part 2: All Formats, Always

Every save/download format is available to every user, regardless of
whether they have a thermal printer. The save dropdown is always the same.
Having a Brother QL connected doesn't hide PDF export. Not having a printer
doesn't hide anything.

Want a 100-page PDF of Dymo-sized labels (one per page) from your CSV?
Save → PDF. Done. We don't know why you need that, and we don't judge.

### Batch Behaviour

When CSV/Excel data is loaded, all output paths respect it:

| Output | Batch behaviour | Limit |
|---|---|---|
| Print (thermal) | prints sequentially | 30 rows |
| Print (no printer → sheet) | fills sheet positions | 30 rows |
| Save → PDF | one label per page | 30 rows |
| Save → PNG | current row preview only | — |
| Save → .label | template with placeholders | — |
| Save → .zip | template + assets | — |

The 30-row limit applies to rendered output only. The .label file saves
the template regardless of how many CSV rows exist.

---

## Part 3: Privacy Story

### The Core Message

burnmark runs entirely in your browser. No server, no account, no tracking.
Your data never leaves your device.

### Where It Appears

**1. First visit banner (dismissable, one line):**

```
🔒 Your designs stay on your device. No account, no server, no tracking.
   Install for offline access → [Install]                        [×]
```

Does double duty: privacy + PWA install CTA on first visit. Subtle,
not alarming. The install CTA is soft here. The dedicated install prompt
(after 2nd/3rd visit) is more direct.

**2. About page — dedicated section:**

```
## Your data stays with you

burnmark runs entirely in your browser. There is no server — no database
storing your designs, no analytics tracking your clicks, no cloud sync
phoning home.

That means no one can see who's getting your Christmas cards this year.
Not even us. We literally can't — there's nowhere to look.

The only things that leave your browser:
• Print data sent to your printer (obviously)
• The PWA caches the app locally — no network needed after first load

That's it. No cookies, no fingerprinting, no "anonymous usage data."
Just a label app that minds its own business.
```

**3. Data panel — when CSV is loaded:**

When the user imports a CSV with names/addresses, one subtle line below
the data panel:

```
🔒 Your data stays in your browser — nothing is sent to any server.
```

People worry about pasting address lists into web apps. This addresses
it directly, right where the concern arises.

**4. PWA install prompt (2nd/3rd visit):**

```
Install burnmark for offline access — your labels stay on your device,
even without internet.
[Install]  [Maybe later]
```

Privacy angle reinforces the PWA benefit.

### Analytics — None

No Google Analytics. No Plausible. No Fathom. No "privacy-friendly"
alternatives. Zero tracking scripts. Zero network requests to third
parties. Zero.

Client-side localStorage counters for UX only:
- Visit count (for install prompt timing)
- Tour completion flag
- Locale preference
- Dismissed banner flags

These never leave the browser. They exist to make the UX better.

If usage insights are needed later: GitHub stars, npm downloads, GitHub
issue volume, Ko-fi support count. All public, all aggregate, all without
tracking individual users.

### Why This Matters

Dymo's official software requires an account. Brother's iPrint&Label sends
data through their servers. burnmark does neither. That's worth saying
out loud — it's a competitive advantage with the privacy-conscious maker
audience.

---

## Implementation Checklist

```
□ Print button: smart single-click (thermal if connected, sheet→PDF if not)
□ Print button: long-press/right-click popover for copies + density
□ Print button: batch progress toast when CSV loaded
□ Save button: default click saves to current slot
□ Save dropdown: PDF, PNG, .label, .zip, Print to sticker sheet
□ Sticker sheet flow: picker → PDF → inline viewer → browser Ctrl+P
□ All formats always available regardless of printer connection
□ Privacy banner on first visit with PWA install CTA
□ About page privacy section (Christmas cards line)
□ CSV data panel privacy line
□ PWA install prompt with offline/privacy angle
□ Zero analytics — verify no tracking scripts in build output
□ All privacy/button copy in vue-i18n locale files (en + nl)
```

---

## Affected Plan Sections

- Section 14.6 (printing flow) — replace with smart Print button
- Section 6 (side panels) — save dropdown replaces separate export section
- Section 14.3 (layout) — [⎙ Print] [💾 ▾] near the label, nothing else
- Section 18 (about page) — add privacy section
- Section 11 (PWA) — install prompt gets privacy angle
- Phase 4 — print button implementation, no complex dialog
- Phase 6 — save dropdown, inline PDF viewer for sheets
- Phase 8 — privacy copy in i18n

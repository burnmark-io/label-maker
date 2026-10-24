# Amendment — Barcode input validation & masking

> **Amends:** `PLAN.md` §6.2 (Barcode properties), §22 phase 5 (data + batch).
> **Companion to:** `PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md`.
> **Sibling stub:** `amendment-barcode-content-helpers.md` (2D content helpers
> — URL, WiFi, vCard, etc. — separate amendment, expanded by another agent).
>
> One sentence: turn the barcode `data` textarea into a guided input that
> tells the user what the selected format expects, filters obviously
> wrong characters at keystroke level, and surfaces a helper line when
> the input is structurally invalid — without ever blocking save or
> print.

---

## 1. Vision

The barcode field today is a free-text `<textarea>`. Pick **EAN-13**, type
`hello`, the canvas barcode renders as a blank white block (designer-core
swallows the bwip-js error and the canvas falls back to the dashed
placeholder rect). The user has no idea what went wrong, no idea what
format **EAN-13** even expects, and no path forward except guess-and-check.

We are not aiming for 100% validity. We are aiming for **rails — guides
that help the 90% of users who pick a format and want a working code
land it on the first try**. The other 10% (GS1 AI experts, MaxiCode
modes, exotic postal variants) get a basic implementation that doesn't
block them — they can still type whatever they need and see the result
on the canvas. Designer-core's existing behaviour (silent blank where
the barcode should be) is a fine "you got it wrong" signal; we just
also tell them, in the side panel, **why**.

The label is still the hero. Validation is a quiet helper line below
the input, not a wizard.

---

## 2. Gap Analysis

### 2.1 What exists today

| Aspect | Today |
|---|---|
| Format picker | `<select>` with optgroups (1D / 2D / GS1 / Postal). Works. |
| Data field | Plain `<textarea>` with no hints, no filter, no validation. |
| Format hint | None — user must already know what EAN-13 expects. |
| Invalid input | Renders silently as a blank `<VRect>` placeholder ([BarcodeNode.vue:13-18](src/components/canvas/BarcodeNode.vue#L13-L18)). |
| Placeholder support | `applyTemplate` substitutes `{{name}}` at render ([BarcodeNode.vue:63](src/components/canvas/BarcodeNode.vue#L63)). |
| Tests | None for input shape. |

### 2.2 What changes vs. PLAN.md

PLAN §6.2 lists "Format picker (grouped: 1D / 2D / Postal / GS1)", "Data
input (with placeholder support)", "QR Content helpers as buttons",
etc. The QR helpers are deferred to the sibling stub. This amendment
adds two pieces PLAN.md doesn't spell out:

| Topic | PLAN.md | Amendment |
|---|---|---|
| Format-aware data field | Implied via "live barcode preview" but unspecified | **Per-format mask + validation registry** drives keystroke filter, helper text, max-length hint. |
| Invalid input UX | Not specified | **Soft red border + helper line** under the data field. **Never blocks Save/Print/batch** — designer-core's blank-block fallback is the final signal. |

### 2.3 What does **not** change

- The `BarcodeFormat` union (still owned by designer-core).
- The render path. Designer-core still renders, still falls back to
  blank. We don't pre-render to detect failure.
- The format picker. Still a grouped `<select>`.
- Placeholder syntax. `{{name}}` still substituted at render time.
- Save / Print / Batch flow. None of these gate on validity.

---

## 3. Design Decisions

These are defaults the implementor should follow unless the table or a
later section overrides them. Each is a settled judgment call, not an
open question.

### 3.1 Mask **and** validation, paired

Two layers, used together where they pair naturally:

- **Keystroke filter** — when the format has a tight character set
  (EAN-13 → digits only, Code 39 → `[A-Z0-9 \-.$/+%]`, etc.) the input
  rejects disallowed characters as the user types. Implemented via a
  controlled-input pattern: filter the candidate string, write the
  filtered value back to the document, set the caret to a sensible
  position. Paste of a partly-invalid string drops the bad characters
  silently.
- **Soft validation** — when the input passes the keystroke filter but
  is still wrong shape (too short, bad checksum, malformed AI), a
  helper line appears below the field with **why** + **what to do**.
  Red border on the field. **No modal. No blocking.**

Formats with no useful keystroke filter (QR, Data Matrix, Aztec,
PDF417 — all accept arbitrary bytes) get **no filter, validation
only** (length / capacity warnings).

### 3.2 Placeholders bypass strict validation

If the data string contains `{{...}}`, validation is **skipped** and
replaced with a muted info line:

> Will be validated against the actual data when printed.

Rationale: a digits-only filter on top of full validation would call
`{{id}}` invalid for an EAN-13 field. The renderer substitutes at
print time; if the substituted value is wrong, the label prints blank,
which is the same "wrong code, blank block" signal we already accept.
We do **not** try to validate against the current preview row's
substituted value — that introduces a moving target and doesn't help
users understand what the template should produce.

### 3.3 Two ways to put a placeholder into a masked field

Strict masks (digits-only for EAN/UPC/ITF/POSTNET; uppercase + digits
for Code 39 / Royal Mail / KIX) would silently swallow the `{`
keystroke, so the user couldn't type `{{name}}` into the field at all.
We solve this two ways, both available simultaneously — **not a mode
toggle**. The field stays unified; mixed content like `LOT-{{batch}}`
just works.

**(a) Mask exception for `{` and `}`.** Every keystroke filter
implicitly allows the two brace characters. The mask's job is "block
typos", and `{` is never a typo — it's a deliberate template token
keystroke. Once `{{` shows up in the field, the placeholder bypass in
§3.2 takes over and the rest of the input is left alone.

**(b) Insert-variable button next to the data field.** A small `{ }`
icon button, opens a popover listing `useDataStore.placeholders`
(detected from the whole document). Clicking a placeholder inserts
`{{name}}` at the current cursor position. Disabled when no
placeholders exist (with tooltip: "Add a `{{token}}` to any field
first, or import a CSV.").

The button gives parity with the text content field — same component
should be reused there in a follow-up. For this amendment, only the
barcode data field gets the button. Text content already accepts
manual typing, so users aren't blocked there; the button just makes
the workflow more obvious. Adding it to text is a one-line change but
out of scope here.

### 3.4 EAN / UPC / ITF — accept either form

bwip-js accepts both "data digits only" (it appends the checksum) and
"data digits + checksum" (it validates the checksum). We mirror this:
both lengths are valid; the helper line reports which interpretation
applies.

```
EAN-13: 12 digits — checksum will be added.        (12 entered)
EAN-13: 13 digits — checksum is correct.           (13 entered, valid)
EAN-13: 13 digits — checksum doesn't match.        (13 entered, wrong)
EAN-13: needs 12 or 13 digits — got 8.             (too short)
```

### 3.5 GS1 — built-in AI table, plain string input

GS1-128, GS1 QR Code, GS1 DataMatrix all share the parenthesised
syntax: `(AI)data(AI)data`. We ship a small built-in table of common
AIs (see §6) and validate:

- AI exists in our table.
- Data length matches the AI's spec (fixed length AIs strict;
  variable-length AIs respect their max).

Unknown AIs get a **warning** (orange, not red): "Unknown AI 99 — this
might not scan reliably." We don't block — niche AIs we haven't shipped
should still work.

A structured AI builder (dropdowns, "Add AI" button) is **out of
scope** for this amendment. Mention it as a future option in §10.

### 3.6 No blocking. Ever.

Save, Print, Batch print, Sheet export — none of them check barcode
validity. The renderer's blank-block fallback is the production-side
signal; the helper line is the design-side signal. The user can always
hit Print on a malformed barcode if they want to (some industrial
workflows might depend on weird inputs we don't understand).

### 3.7 Exotic / niche formats — lenient with info hint

MaxiCode modes 2/3 have specific structured payloads (US ZIP + country
code + service class for mode 2). USPS POSTNET requires 5/9/11 digits
exactly. AusPost has three lengths (8/13/16/23). Rather than ship full
mode-aware validators for these:

- Validate the **alphabet** (digits-only, A-Z + digits, etc.).
- Validate the **plausible length range** (warn if obviously wrong).
- Show an **info hint** for the format's expected shape ("Standard
  Customer Barcode is 8 digits; FCC2 is 13; FCC3 is 16/23.").
- Don't try to detect mode from input. Don't try to enforce the
  structured payload.

If users hit a wall here, the canvas blank block tells them, and we
can grow the registry per-format later.

---

## 4. Format Reference Table

The implementor uses this table to populate the validation registry.
Each row is one entry in `src/lib/barcode/validation/registry.ts`. The
**Mask** column is the keystroke-level character class (regex
character class only — no anchors). The **Valid example** /
**Invalid example** columns are also test fixtures (§9).

> "Mask: —" means **no keystroke filter** for that format (validation
> only). Length numbers are rendered character counts, not bytes.

### 4.1 1D Linear

| Format | Mask | Length / Shape | Valid example | Invalid example | Notes |
|---|---|---|---|---|---|
| `code128` | `[\x20-\x7E]` (printable ASCII) | 1+ chars | `BURNMARK-001` | `héllo` (non-ASCII) | Auto-switches subsets in bwip-js. |
| `code128a` | `[\x00-\x5F]` (control + uppercase) | 1+ chars | `HELLO 001` | `hello` (lowercase) | Subset A — uppercase + control only. |
| `code128b` | `[\x20-\x7F]` (printable + DEL) | 1+ chars | `Hello 001` | `` (control) | Subset B — printable. |
| `code128c` | `[0-9]` | even count, 2+ | `12345678` | `1234567` (odd) | Subset C — digit pairs. |
| `code39` | `[A-Z0-9 \-.$/+%]` (auto-uppercase) | 1+ chars | `BURNMARK 01` | `Burnmark!` | Auto-uppercase on input. `*` is start/stop, not content. |
| `code39ext` | `[\x00-\x7F]` | 1+ chars | `Burnmark!01` | `héllo` (non-ASCII) | Extended via shift pairs — accepts mixed case. |
| `code93` | `[A-Z0-9 \-.$/+%]` | 1+ chars | `BURNMARK 01` | `burnmark!` | Same alphabet as code39 in practice. |
| `code11` | `[0-9\-]` | 1+ chars | `555-1212` | `ABC` | Telecom — digits + hyphen. |
| `codabar` | `[0-9\-$:/.+]` | 1+ chars | `12-34-56` | `ABCD` | Start/stop chars (A-D) added by renderer. |
| `ean13` | `[0-9]` | **12 or 13 digits** | `590123412345` | `5901234` (too short) | 12 → checksum added; 13 → checksum validated. |
| `ean8` | `[0-9]` | **7 or 8 digits** | `9638507` | `12345` (too short) | 7 → checksum added; 8 → checksum validated. |
| `upca` | `[0-9]` | **11 or 12 digits** | `01234567890` | `0123` (too short) | 11 → checksum added; 12 → checksum validated. |
| `upce` | `[0-9]` | 6, 7, or 8 digits | `01234565` | `0123` (too short) | Compressed UPC. Lenient validation. |
| `itf14` | `[0-9]` | **13 or 14 digits** | `1234567890123` | `12345678901` (11) | ITF-14 / SCC-14. |
| `interleaved2of5` | `[0-9]` | even count, 2+ | `1234567890` | `123` (odd) | i2of5 needs digit pairs. |
| `msi` | `[0-9]` | 1+ digits | `1234567` | `ABC` | MSI Plessey, digits only. |
| `pharmacode` | `[0-9]` | 1 to 6 digits, 3-131070 | `12345` | `0` (out of range) | German Pharmacode. |
| `pzn` | `[0-9]` | 6 or 7 digits | `1234567` | `ABCDEFG` | Pharmazentralnummer. |
| `hibccode128` | `[A-Z0-9\-.$/+%]` | 1+ chars | `+A123BJC5D6E71` | (lowercase) | HIBC LIC over Code 128. |
| `isbt128` | `[\x20-\x7E]` | 1+ chars | `=A1234500001` | (non-ASCII) | ISBT 128 blood products. |
| `leitcode` | `[0-9]` | 14 digits | `12345678901234` | `1234` | Deutsche Post Leitcode. |
| `identcode` | `[0-9]` | 12 digits | `123456789012` | `1234` | Deutsche Post Identcode. |

### 4.2 2D Matrix / Stacked

These accept arbitrary bytes — **no keystroke filter**. Validation is
length / capacity only.

| Format | Mask | Length / Shape | Valid example | Invalid example | Notes |
|---|---|---|---|---|---|
| `qrcode` | — | 1 to ~2953 bytes (varies by EC) | `https://burnmark.io` | `""` (empty) | Capacity depends on EC level — warn if > 2000 chars. |
| `microqr` | — | 1 to ~35 numeric / ~21 alpha / ~15 bytes | `12345` | (35-char string) | M1–M4. Tiny capacity — warn aggressively. |
| `datamatrix` | — | 1 to ~2335 chars | `BURNMARK-2026-001` | `""` (empty) | Square or rectangular variant. |
| `datamatrixrectangular` | — | 1 to ~2335 chars | `BURNMARK-001` | `""` (empty) | Same data, rectangular module shape. |
| `pdf417` | — | 1 to ~1850 chars | `BURNMARK shipping data` | `""` (empty) | Stacked. Industrial use. |
| `micropdf417` | — | 1 to ~250 chars | `LOT-12345` | (1000-char string) | Compact PDF417 — warn aggressively. |
| `azteccode` | — | 1 to ~3067 chars | `BURNMARK-001` | `""` (empty) | High capacity, no quiet zone needed. |
| `aztecrune` | `[0-9]` | 1-3 digits, 0-255 | `42` | `300` (out of range) | Single-byte Aztec Rune. |
| `maxicode` | — | up to ~93 chars | `BURNMARK-001` | (200-char string) | Modes 2/3 have postal payload — info hint only. |
| `dotcode` | — | 1+ chars | `(01)12345678901234` | `""` (empty) | Industrial high-speed. Often GS1 AI syntax. |
| `hanxin` | — | 1+ chars | `条码` (Chinese) | `""` (empty) | Han Xin Code — Chinese GB18030. |

### 4.3 GS1

All GS1 variants share the parenthesised AI syntax. The mask permits
the AI / data alphabet; the validator parses AIs against the built-in
table (§6).

| Format | Mask | Length / Shape | Valid example | Invalid example | Notes |
|---|---|---|---|---|---|
| `gs1_128` | `[\x20-\x7E()]` | `(AI)data` repeated | `(01)12345678901234(17)260101` | `01 12345 17 260101` (no parens) | Linear. AI table validation. |
| `gs1qrcode` | `[\x20-\x7E()]` | same syntax | `(01)12345678901234` | `(99)abc` (unknown AI → warn) | 2D QR variant. |
| `gs1datamatrix` | `[\x20-\x7E()]` | same syntax | `(01)12345678901234(10)LOT001` | `()12345` (empty AI) | 2D Data Matrix variant. |
| `gs1_cc` | `[\x20-\x7E()]` | same syntax | `(01)12345678901234` | (no AIs) | Composite Component. |
| `databar` | `[0-9]` | 14 digits (GTIN-14) | `12345678901234` | `1234` (too short) | DataBar Omnidirectional. |
| `databarexpanded` | `[\x20-\x7E()]` | AI syntax, up to ~74 numeric | `(01)12345678901234(3103)001234` | `()` (empty) | Variable-length expanded. |

### 4.4 Postal

| Format | Mask | Length / Shape | Valid example | Invalid example | Notes |
|---|---|---|---|---|---|
| `postnet` | `[0-9]` | 5, 9, or 11 digits | `941030000` | `94103` ✓ also valid; `9410` ✗ | USPS POSTNET (deprecated but still rendered). |
| `onecode` | `[0-9]` | 20, 25, 29, or 31 digits | `01234567094987654321` | `1234` | USPS Intelligent Mail (IMb). |
| `royalmail` | `[A-Z0-9]` | 1-9 chars typical | `SN34RD1A` | `sn34rd1a` (lowercase) → auto-upper | RM4SCC. Auto-uppercase. |
| `kix` | `[A-Z0-9]` | 1-11 chars typical | `2500GG75` | `2500gg75` → auto-upper | Dutch KIX. Auto-uppercase. |
| `auspost` | `[0-9]` | 8, 13, 16, or 23 digits | `12345678` | `1234` | Standard / FCC2 / FCC3 — info hint, no mode detection. |
| `japanpost` | `[A-Z0-9\-]` | 1-20 chars | `1310034-3-2-1` | (other punctuation) | Japan Post Customer Barcode. |

### 4.5 Severity table

| Severity | UI | Used for |
|---|---|---|
| `error` | Red border, red helper text | Wrong alphabet, wrong length, bad checksum, malformed AI structure. |
| `warning` | Amber border, amber helper text | Unknown AI, capacity warning, lowercase auto-upcased (one-shot toast on first paste). |
| `info` | No border change, muted helper text | Format hint when input is empty or valid; placeholder bypass note. |
| `ok` | No border change, no helper | Valid input. (Optional: tiny ✓ at the end of the field.) |

---

## 5. Architecture

### 5.1 New module: `src/lib/barcode/validation/`

```
src/lib/barcode/validation/
├── index.ts              # public API: validate(format, data), getMask(format), getHint(format)
├── registry.ts           # the per-format table from §4 as code
├── types.ts              # ValidationResult, FormatRule, Severity
├── checksums.ts          # ean13Checksum, ean8Checksum, upcaChecksum
├── gs1.ts                # parseGs1, AI_TABLE, validateAiString
└── __tests__/
    ├── registry.test.ts        # one describe() per format, valid + invalid examples from §4
    ├── checksums.test.ts
    └── gs1.test.ts
```

Public API shape:

```ts
// src/lib/barcode/validation/types.ts
export type Severity = 'ok' | 'info' | 'warning' | 'error';

export interface ValidationResult {
  severity: Severity;
  message?: string;          // i18n KEY, not text — caller resolves with t()
  messageParams?: Record<string, string | number>;
}

export interface FormatRule {
  /** Keystroke-level character class. Empty regex = no filter. */
  mask?: RegExp;
  /** Optional pre-write transform (e.g. uppercase). */
  transform?: (raw: string) => string;
  /** Validate the (possibly placeholder-containing) data string. */
  validate(data: string): ValidationResult;
  /** i18n key for the format's "what does this expect" hint. */
  hintKey: string;
  /** i18n key for the input field placeholder text. */
  placeholderKey: string;
}
```

```ts
// src/lib/barcode/validation/index.ts
export function getRule(format: BarcodeFormat): FormatRule;
export function applyMask(format: BarcodeFormat, raw: string): string;
export function validate(format: BarcodeFormat, data: string): ValidationResult;
export function hasPlaceholders(data: string): boolean;
```

`validate()` returns `{ severity: 'info', message: 'barcode.validation.placeholderBypass' }`
unconditionally when `hasPlaceholders(data)` is true.

### 5.2 Component: `BarcodeProperties.vue` changes

The textarea becomes controlled and gains an inserter button:

```vue
<div class="props__field">
  <div class="props__label-row">
    <span :id="`barcode-data-label-${object.id}`">{{ t('properties.barcode.data') }}</span>
    <InsertVariableButton
      :placeholders="data.placeholders"
      :aria-label="t('properties.barcode.insertVariable')"
      @insert="onInsertVariable"
    />
  </div>
  <textarea
    ref="textareaRef"
    :value="object.data"
    rows="2"
    :class="['props__textarea', validationClass]"
    :aria-invalid="validation.severity === 'error' || null"
    :aria-describedby="`barcode-data-help-${object.id}`"
    :aria-labelledby="`barcode-data-label-${object.id}`"
    :placeholder="t(rule.placeholderKey)"
    @input="onDataInput"
  />
  <p
    :id="`barcode-data-help-${object.id}`"
    :class="['props__help', `props__help--${validation.severity}`]"
  >
    {{ helpMessage }}
  </p>
</div>
```

`onDataInput`:
1. Read raw value.
2. **Mask exception:** `{` and `}` always pass (§3.3a).
3. If the value already contains `{{...}}` somewhere:
   `hasPlaceholders(raw)` → write through unfiltered.
4. Else: `applyMask(format, raw)`. If the masked value differs from
   raw, write the masked value back; the mask drops disallowed chars
   (other than `{` `}`).
5. Caret repositioning: clamp to `Math.min(originalCaret, newLength)`.
6. Run `validate(format, finalValue)` for the helper line.

`onInsertVariable(name: string)`:
1. Reads cursor position from `textareaRef`.
2. Splices `{{${name}}}` into the current value at the cursor.
3. Writes the result to `object.data`.
4. Restores focus to the textarea, places cursor after the inserted
   token.
5. Triggers a normal validate run — which detects the placeholder and
   shows the bypass info line.

**`InsertVariableButton.vue`** — small new component:
- Disabled when `placeholders.length === 0`. Tooltip explains why.
- Click opens a popover listing `placeholders` as buttons; click a
  button → emits `insert(name)`.
- Icon: `{ }` glyph or Lucide `braces` icon.
- a11y: `aria-haspopup="menu"`, focus moves into the popover on
  open, Escape closes and returns focus to the trigger.
- Lives at `src/components/panels/InsertVariableButton.vue` so a
  follow-up can drop it into `TextProperties.vue` too.

`helpMessage` is computed:
- Empty input → `rule.hintKey` (info, format description).
- `validation.severity === 'ok'` → empty.
- Else → `t(validation.message, validation.messageParams)`.

`validationClass` adds `props__textarea--error` / `--warning` based on
severity.

### 5.3 No changes to designer-core or BarcodeNode

`BarcodeNode.vue` keeps its existing try/catch → blank rect path. We do
not pre-validate before render. The two are independent: the validator
guides the user; the renderer either succeeds or shows the blank
placeholder. They will sometimes disagree (we say "valid", bwip-js
fails for a reason we don't model) — that's fine, the user sees the
blank block and adjusts. Validation reduces these disagreements but
doesn't eliminate them.

### 5.4 i18n

New keys under `properties.barcode.validation`:

```json
{
  "properties": {
    "barcode": {
      "hint": {
        "code128": "Any printable text. Example: BURNMARK-001",
        "ean13": "12 digits (we'll add the checksum) or 13 digits with checksum.",
        "qrcode": "Any text or URL.",
        "gs1_128": "GS1 with parenthesised AIs. Example: (01)12345678901234(17)260101"
        // ... one per format
      },
      "placeholder": {
        "code128": "BURNMARK-001",
        "ean13": "590123412345",
        "qrcode": "https://burnmark.io",
        "gs1_128": "(01)12345678901234"
        // ... one per format
      },
      "insertVariable": "Insert a variable from your data",
      "noPlaceholders": "Add a {{token}} to any field first, or import a CSV.",
      "validation": {
        "empty": "Type something to render a barcode.",
        "placeholderBypass": "Will be validated against the actual data when printed.",
        "wrongLength": "Needs {expected} characters — got {got}.",
        "wrongLengthRange": "Needs {min}–{max} characters — got {got}.",
        "wrongLengthChoice": "Needs {choices} characters — got {got}.",
        "checksumAdded": "{count} digits — checksum will be added.",
        "checksumValid": "{count} digits — checksum is correct.",
        "checksumInvalid": "{count} digits — checksum doesn't match. Drop the last digit and we'll add it for you.",
        "badAlphabet": "Some characters aren't allowed for this format.",
        "evenDigitsRequired": "Needs an even number of digits — got {got}.",
        "gs1UnknownAi": "Unknown AI {ai} — this might not scan reliably.",
        "gs1MalformedAi": "Couldn't read the AI structure. Use (AI)data, e.g. (01)12345678901234.",
        "gs1AiWrongLength": "AI {ai} expects {expected} characters — got {got}.",
        "capacityWarning": "Long content — may need a higher version or lower error correction."
      }
    }
  }
}
```

Dutch (`nl.json`) gets the parallel keys. Mark for translator review in
`PLACEHOLDERS.md` (existing pattern).

---

## 6. GS1 AI Table (built-in, partial)

Ship a small table of the most common AIs. The implementor doesn't need
to chase every AI in the GS1 General Specifications — these cover the
overwhelming majority of real-world GS1 payloads:

```ts
// src/lib/barcode/validation/gs1.ts
interface AiSpec {
  ai: string;
  fixedLength?: number;       // total payload chars (excl. AI itself)
  maxLength?: number;         // for variable-length AIs
  alphabet: 'numeric' | 'alphanumeric';
  description: string;        // human label, used in tooltips
}

export const AI_TABLE: Record<string, AiSpec> = {
  '00': { ai: '00', fixedLength: 18, alphabet: 'numeric', description: 'SSCC' },
  '01': { ai: '01', fixedLength: 14, alphabet: 'numeric', description: 'GTIN' },
  '02': { ai: '02', fixedLength: 14, alphabet: 'numeric', description: 'Content GTIN' },
  '10': { ai: '10', maxLength: 20, alphabet: 'alphanumeric', description: 'Batch / Lot' },
  '11': { ai: '11', fixedLength: 6, alphabet: 'numeric', description: 'Production date YYMMDD' },
  '13': { ai: '13', fixedLength: 6, alphabet: 'numeric', description: 'Packaging date YYMMDD' },
  '15': { ai: '15', fixedLength: 6, alphabet: 'numeric', description: 'Best-before YYMMDD' },
  '17': { ai: '17', fixedLength: 6, alphabet: 'numeric', description: 'Expiration YYMMDD' },
  '20': { ai: '20', fixedLength: 2, alphabet: 'numeric', description: 'Variant' },
  '21': { ai: '21', maxLength: 20, alphabet: 'alphanumeric', description: 'Serial number' },
  '30': { ai: '30', maxLength: 8, alphabet: 'numeric', description: 'Count of items' },
  '37': { ai: '37', maxLength: 8, alphabet: 'numeric', description: 'Count of trade items' },
  '90': { ai: '90', maxLength: 30, alphabet: 'alphanumeric', description: 'Internal' },
  '91': { ai: '91', maxLength: 90, alphabet: 'alphanumeric', description: 'Internal' },
  '240': { ai: '240', maxLength: 30, alphabet: 'alphanumeric', description: 'Additional product ID' },
  '241': { ai: '241', maxLength: 30, alphabet: 'alphanumeric', description: 'Customer part number' },
  '310': { ai: '310', fixedLength: 6, alphabet: 'numeric', description: 'Net weight (kg)' },
  '320': { ai: '320', fixedLength: 6, alphabet: 'numeric', description: 'Net weight (lb)' },
  '400': { ai: '400', maxLength: 30, alphabet: 'alphanumeric', description: 'Customer PO number' },
  '410': { ai: '410', fixedLength: 13, alphabet: 'numeric', description: 'Ship-to GLN' },
  '414': { ai: '414', fixedLength: 13, alphabet: 'numeric', description: 'Identification of physical location' },
  '420': { ai: '420', maxLength: 20, alphabet: 'alphanumeric', description: 'Ship-to postal code' },
  '8200': { ai: '8200', maxLength: 70, alphabet: 'alphanumeric', description: 'Extended packaging URL' },
};
```

Notes for the implementor:

- **310 / 320 family**: real GS1 spec uses a 4th digit for decimal
  position (`3100`–`3105`). Treat the prefix `310` (any 4-digit `310x`)
  as one entry rather than 6 — the keystroke filter and length check
  still work; the decimal-position semantics are out of scope.
- **Parenthesised vs non-parenthesised**: in production the FNC1
  separator is invisible. In the user-facing string we **only** support
  the parenthesised form `(AI)data(AI)data`. The renderer translates.
- **Variable-length AIs**: the user signals end-of-AI by starting the
  next AI with `(`. No FNC1 typing required.

`parseGs1(input: string)` returns `{ ais: Array<{ ai, value }>, errors:
Array<{ at, message }> }`. `validate()` for any GS1 format calls
`parseGs1`, then checks each parsed entry against `AI_TABLE`.

---

## 7. UX Walkthrough

### 7.1 Empty field

User adds a barcode object. Properties panel opens, format defaults to
`code128`. Data field is empty:

```
Format:  [Code 128 ▾]
Data:    [_______________]
         Any printable text. Example: BURNMARK-001
```

The hint line is **info** severity (muted grey), shown when empty or
valid.

### 7.2 Typing valid input

User types `BURNMARK-001`. Helper line clears (or shows nothing — both
acceptable). No border change. Canvas updates live.

### 7.3 Switching format with invalid carryover

User had `BURNMARK-001` in the field, switches format to **EAN-13**.
The format change does **not** clear the data. Mask kicks in
retroactively only on next keystroke, but validation runs immediately:

```
Format:  [EAN-13 ▾]
Data:    [BURNMARK-001]                                  ← red border
         Some characters aren't allowed for this format.
```

The next keystroke filters the field to digits only, the user sees the
field collapse to nothing, and types fresh.

> **Implementor judgment call:** an alternative is to filter on format
> switch too (auto-strip invalid chars). The amendment leaves this
> open — pick the one that feels less surprising in practice. Default
> to **don't auto-strip on switch**; preserve the user's input and let
> them see why it's wrong.

### 7.4 Typing with placeholders

Field has `https://shop.burnmark.io/{{slug}}`, format is `qrcode`.
Hint line:

```
qrcode validation bypass:
Will be validated against the actual data when printed.
```

Muted text. No red border. Mask off.

### 7.4.1 Inserting a placeholder into a strict-mask field

Format is **EAN-13**, mask is digits-only. User has imported a CSV
with a `barcode_id` column. The data field shows:

```
Format:  [EAN-13 ▾]
Data:    [_________________________]   { }   ← Insert variable button
         12 digits (we'll add the checksum) or 13 digits with checksum.
```

User clicks `{ }` → popover lists `barcode_id`, `name`, `email`. Clicks
`barcode_id`. Field becomes:

```
Data:    [{{barcode_id}}]
         Will be validated against the actual data when printed.
```

Hint flips to muted info. No red border. Cursor sits after the inserted
token, ready for the user to add a suffix or next placeholder if they
want.

If the user instead types `{` directly (mask exception §3.3a), the
brace passes through. Typing `{{barcode_id}}` by hand works just as
well. The inserter button is a discoverability aid, not the only path.

### 7.5 GS1 with unknown AI

```
Format:  [GS1-128 ▾]
Data:    [(01)12345678901234(99)foo]                     ← amber border
         Unknown AI 99 — this might not scan reliably.
```

Warning, not error. User can ignore.

### 7.6 EAN-13 checksum feedback

```
Data: [590123412345]      → 12 digits — checksum will be added.       (info)
Data: [5901234123457]     → 13 digits — checksum is correct.          (ok, no helper)
Data: [5901234123458]     → 13 digits — checksum doesn't match.       (error)
                            Drop the last digit and we'll add it for you.
```

---

## 8. Implementation Steps

Add as **Phase 11** in `PROGRESS.md` after Phase 10 (Side panel & data
UX).

### Phase 11: Barcode input validation

- [ ] **11.1** Scaffold `src/lib/barcode/validation/` with `types.ts`,
      empty `registry.ts`, empty `checksums.ts`, empty `gs1.ts`,
      `index.ts` re-exporting the public API.
- [ ] **11.2** Implement `checksums.ts` — `ean13`, `ean8`, `upca`
      (mod-10 algorithms). Pure functions, fully unit-tested.
- [ ] **11.3** Implement `gs1.ts` — `AI_TABLE`, `parseGs1`,
      `validateAiString`. Unit tests against the §4.3 valid/invalid
      examples plus a handful of multi-AI cases.
- [ ] **11.4** Populate `registry.ts` — one `FormatRule` per row of
      §4. Parameterised tests over the registry: every format has a
      mask (or explicit `null`), a `validate`, a `hintKey`, a
      `placeholderKey`.
- [ ] **11.5** Add i18n keys (`hint`, `placeholder`, `validation.*`)
      to `en.json`. Mirror to `nl.json` (mark unsure translations in
      `PLACEHOLDERS.md`).
- [ ] **11.6** Wire `BarcodeProperties.vue`:
      - Replace plain textarea with controlled input.
      - Compute `rule`, `validation`, `helpMessage`,
        `validationClass` from the registry.
      - Apply mask on input (with `{` `}` exception), run validate on
        every change.
      - Render helper line below the field.
      - Add `aria-invalid`, `aria-describedby` on the textarea.
- [ ] **11.7** CSS — error / warning / info / ok variants of
      `.props__help` and `.props__textarea`. Re-use existing token
      colours where possible (red is `--color-error`, amber is
      `--color-warning`).
- [ ] **11.8** New component `InsertVariableButton.vue` —
      - Reads `useDataStore.placeholders`.
      - Disabled with tooltip when list is empty.
      - Popover with focus-trapped placeholder list, Escape closes.
      - Emits `insert(name: string)`.
      - Wired into `BarcodeProperties.vue` next to the data textarea;
        click inserts `{{name}}` at current cursor position.
- [ ] **11.9** Component test for `BarcodeProperties.vue` covering:
      mask filters bad chars, `{` and `}` always pass, helper line
      shows correct severity, placeholder bypass disables validation,
      format switch preserves data + flags it, inserter button inserts
      at cursor and triggers the placeholder bypass.
- [ ] **11.10** Update `PROGRESS.md` Phase 11 section, add D-numbered
      decision entries to `DECISIONS.md` for any judgment calls
      (default-don't-auto-strip on format switch; partial AI table
      scope; placeholder bypass policy; mask exception for braces;
      reuse path for `InsertVariableButton` in TextProperties as a
      follow-up).
- [ ] **11.11** **Gate:** typecheck + lint + format + test + build.

---

## 9. Tests

The §4 table doubles as a fixture spec. Suggested layout:

```ts
// src/lib/barcode/validation/__tests__/registry.test.ts
import { describe, expect, it } from 'vitest';
import { validate, applyMask } from '../index.js';

const FIXTURES: Array<{
  format: BarcodeFormat;
  valid: string[];
  invalid: Array<{ data: string; expectedSeverity: 'error' | 'warning' }>;
  maskDrops?: Array<{ raw: string; cleaned: string }>;
}> = [
  {
    format: 'ean13',
    valid: ['590123412345', '5901234123457'],
    invalid: [
      { data: '5901234', expectedSeverity: 'error' },        // too short
      { data: '5901234123458', expectedSeverity: 'error' },  // bad checksum
      { data: 'abc', expectedSeverity: 'error' },            // bad alphabet
    ],
    maskDrops: [
      { raw: '590-1234-1234-5', cleaned: '590123412345' },
    ],
  },
  // ... one per row of §4
];

describe.each(FIXTURES)('format $format', ({ format, valid, invalid, maskDrops }) => {
  it.each(valid)('accepts valid: %s', (data) => {
    expect(validate(format, data).severity).not.toBe('error');
  });
  it.each(invalid)('flags invalid: $data', ({ data, expectedSeverity }) => {
    expect(validate(format, data).severity).toBe(expectedSeverity);
  });
  if (maskDrops) {
    it.each(maskDrops)('mask cleans: $raw', ({ raw, cleaned }) => {
      expect(applyMask(format, raw)).toBe(cleaned);
    });
  }
});
```

Coverage target: every row in §4 has at least 1 valid + 1 invalid
example exercised. The agent should expand each row to ≥ 2 invalid
cases where there are multiple distinct failure modes (length, alphabet,
checksum) — the table examples are starting points, not the full set.

Component-level tests (`BarcodeProperties.vue`):

- Mask drops invalid chars during typing (simulate input event).
- Helper line text matches expected severity.
- Switching format from QR to EAN-13 keeps the data and flags it.
- Typing `{{name}}` shows the placeholder-bypass info line.
- `aria-invalid` toggles correctly.

Skip: a screenshot/canvas test that the rendered barcode actually
appears — that's designer-core / bwip-js territory and already
exercised by Phase 4 gates.

---

## 10. Future / out of scope

- **QR / 2D content helpers** — separate stub, see
  `amendment-barcode-content-helpers.md`.
- **Structured GS1 AI builder** — dropdown + value field UI to
  generate the AI string. Useful for power users. Punt to a follow-up
  amendment.
- **Mode-aware MaxiCode validation** — postal payload structure for
  modes 2/3.
- **Full GS1 AI table** — current registry is a starter set. Expand
  as users hit unknown-AI warnings.
- **Cross-field validation** — e.g. inferring that a 13-digit
  Code 128 input "looks like" an EAN-13 and offering to switch
  format. Cute but probably wrong more often than right.
- **Server-side validation** — n/a, the app has no server.

---

## 11. Open questions for the implementor

These are intentionally left for the implementor to settle and record
as new D-numbered decisions in `DECISIONS.md`:

1. **Format switch behaviour** — strip-invalid-on-switch vs.
   preserve-and-flag (§7.3). Default in this amendment: preserve and
   flag. Revisit if user testing says otherwise.
2. **Auto-uppercase one-shot toast** — when paste triggers
   auto-uppercase (Code 39, KIX, Royal Mail), do we toast "We made it
   uppercase" once, or stay silent? Silent is simpler; toast is
   friendlier.
3. **Capacity warning thresholds for 2D** — §4.2 suggests "warn if >
   2000 chars" for QR. The implementor can tune this against bwip-js's
   actual behaviour at the largest version + lowest EC.
4. **Sample label barcode** — the first-visit sample uses
   `qrcode` with `https://burnmark.io` ([sample-label.ts:105-106](src/services/sample-label.ts#L105-L106)).
   This is already valid; no change needed. Worth a smoke test that
   the sample doesn't trip the validator.

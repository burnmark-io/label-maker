# Plan: Cross-Manufacturer Media Type Library

> **Working title:** `media-catalog` (placeholder — final package name TBD).
> **Status:** Draft plan, not yet started.
> **Owner:** TBD.

This plan is **isolated** — it does not depend on, and is not blocked by, any
other in-flight amendment. It can be picked up at any time. Where it touches
the existing driver libs (`brother-ql`, `labelmanager`, `@thermal-label/contracts`)
those touches are explicitly called out so the work can be sequenced safely.

---

## 1. Why

Today every driver lib carries its own private media registry. Each one mixes
two unrelated concerns into one struct:

1. **Engineering data** — printable dots, left/right margin pins, bytes per line,
   firmware media id, head geometry. Required to actually render a raster.
2. **Consumer-recognisable identity** — the SKU/code people order by
   (`DK-22205`; `45013` + `S0720530`; `30252`), plus finish (matte / glossy /
   metallic), substrate (paper / film / fabric / heat-shrink), media colour,
   ink colour, permanence (permanent / removable / freezer), pack size, etc.

Currently (1) is well covered per-driver and (2) is mostly absent or jammed into
the `name` field as free text (`"62mm continuous (DK-22205)"`,
`"62mm continuous two-color (DK-22251)"`). That is good enough for a printer
driver but useless for:

- a media picker UI ("show me all 12 mm black-on-yellow tapes I can buy")
- an importer that reads a saved label and wants to suggest a compatible roll
- a checkout/purchase link
- search ("which printers can take DK-11241?")
- multi-manufacturer support, where the same physical size is sold under many
  SKUs with different finishes / colours.

We want **one catalogue** that is the single source of truth for both layers.
Drivers and consumer-facing UI both depend on it, so when anything in the
codebase says "media", everyone is talking about the same row. Engineering
data is **not** kept where it currently lives — it migrates into the catalogue,
typed per driver family, so the per-driver registries become thin re-exports
or are deleted entirely.

---

## 2. Goals & Non-Goals

### Goals

- A single source of truth for media across the whole stack — drivers AND
  consumer-facing UI consume it.
- A schema rich enough to drive a media picker (filter by width, colour, finish,
  permanence, substrate, manufacturer, family).
- Carries the engineering data the driver libs need today, typed per driver
  family — so the existing `brother-ql/.../media.ts` etc. become re-exports
  (or are deleted) instead of independent registries.
- A consumer-facing **primary code** per row that lets a user select their
  roll without measuring it (`DK-22205` for Brother, `45013` for DYMO D1,
  `30252` for DYMO LW). Aliases capture secondary codes seen in the wild
  (e.g. the DYMO `S0720530` S-code that ships alongside `45013`).
- Easy to extend: adding a new SKU is a one-entry change, no code edits.
- Easy to gather: data comes from public manufacturer pages and is reproducible.

### Non-Goals

- Pricing, stock levels, regional availability — these change too fast and are
  not our problem.
- Cartridge auto-detection. The catalogue is descriptive; what the printer
  actually reports back is still a driver concern (the driver translates a
  detected `mediaId` into a catalogue row via `findByDriverRef`).
- Locale/translations of cosmetic descriptions in v1 (English only first).

---

## 3. Current state — what we already have

Surveyed at the time of writing:

| Driver lib | File | What it stores | Consumer SKU coverage |
|---|---|---|---|
| Brother QL | [brother-ql/packages/core/src/media.ts](../../thermal-label/brother-ql/packages/core/src/media.ts) | Map keyed by firmware media id (257, 258, …). Engineering fields: `printAreaDots`, `leftMarginPins`, `rightMarginPins`, `dieCutMaskedAreaDots`. | DK code embedded in `name` string only (e.g. `"62mm continuous (DK-22205)"`). No finish/colour/substrate. |
| Dymo LabelManager | [labelmanager/packages/core/src/media.ts](../../thermal-label/labelmanager/packages/core/src/media.ts) | 4 entries by tape width (6/9/12/19 mm). Engineering fields: `printableDots`, `bytesPerLine`. | None. No D1 item numbers, no colour info, no finish. |
| Shared base | [contracts/src/media.ts](../../thermal-label/contracts/src/media.ts) | `MediaDescriptor`: `id`, `name`, `widthMm`, `heightMm?`, `type`, `colorCapable`. | The base does not currently carry SKU/finish/colour fields. |

So the gap is biggest on the LabelManager side (zero SKU data), and on the
Brother side it is "captured but not structured".

---

## 4. Proposed data model

The catalogue is one package, depended on by both driver libs and the
consumer-facing app. Each row carries everything anyone needs to know about
that physical SKU — identity, geometry, cosmetics, and the per-driver
engineering payload required to actually print on it.

### 4.1 The unit: a `MediaSku`

A `MediaSku` is one purchasable item — what a customer types into a search box.

```ts
interface MediaSku {
  /** Stable internal id, e.g. "brother.dk-22205" or "dymo.45013". */
  id: string;

  /** Manufacturer-facing identifiers. */
  codes: {
    /**
     * Primary consumer code — the one a buyer types or reads off the box.
     *   Brother DK   → "DK-22205"
     *   DYMO D1      → "45013"      (5-digit catalog SKU; the S-code goes in aliases)
     *   DYMO LW      → "30252"
     */
    primary: string;
    /**
     * Other codes for the exact same item:
     *   - DYMO S-codes paired with the catalog SKU (e.g. "S0720530" for 45013)
     *   - regional variants (e.g. "DK22205" without the dash, EU vs. US codes)
     *   - EAN / GTIN
     *   - manufacturer part number when distinct from the consumer code
     */
    aliases?: string[];
  };

  /** "Brother", "DYMO", "Epson", "Zebra", "Niimbot", … */
  manufacturer: string;

  /** Product family, e.g. "DK", "D1", "LW", "LT", "ZD". */
  family: string;

  /**
   * Display name shown to the user — composed from the row's other fields,
   * not free-form. Convention (mirrors the existing Brother registry):
   *
   *   {size} {shape}[ {colour-pair-or-flag}] ({primary-code}[ / {alias}])
   *
   * Examples:
   *   "62mm continuous (DK-22205)"
   *   "62mm continuous two-colour (DK-22251)"
   *   "29×90mm die-cut (DK-11201)"
   *   "12mm × 7m black on white (45013 / S0720530)"
   *   "89×36mm address labels (30252)"
   *
   * The catalogue ships a `formatDisplayName(sku)` helper so consumers don't
   * hand-format. Stored on the row anyway (denormalised) for searchability.
   */
  displayName: string;

  /** Physical geometry — same units/conventions as MediaDescriptor. */
  widthMm: number;
  /** Omit for continuous. */
  heightMm?: number;
  /** "continuous" | "die-cut" | "tape" — same vocabulary as the base type. */
  shape: 'continuous' | 'die-cut' | 'tape';

  /** Surface colour (the *background*, what the human sees). */
  mediaColor: ColorSpec;

  /** Ink/print colour. Most thermal media is black; some D1 are blue/red/gold. */
  inkColor: ColorSpec;

  /** Optional second colour for two-colour media (DK-22251 = black + red). */
  secondaryInkColor?: ColorSpec;

  /** Surface finish. */
  finish: 'matte' | 'glossy' | 'satin' | 'metallic' | 'transparent' | 'fabric';

  /** What the label is made of. */
  substrate:
    | 'paper'
    | 'film'             // polyester / polypropylene / vinyl
    | 'fabric'           // iron-on, nylon
    | 'heat-shrink'
    | 'magnetic'
    | 'other';

  /** Adhesive / removability. */
  permanence: 'permanent' | 'removable' | 'freezer' | 'extra-strong' | 'none';

  /** Length (continuous) or label count (die-cut) per roll/cartridge. */
  packaging: {
    rollLengthMm?: number;     // continuous tape
    labelsPerRoll?: number;    // die-cut
    rollsPerBox?: number;      // some SKUs are sold as multi-packs
  };

  /** Links to the manufacturer product page and datasheet (PDF). */
  links?: {
    productUrl?: string;
    datasheetUrl?: string;
    imageUrl?: string;
  };

  /** Free-form tags ("food-safe", "outdoor", "address-labels"). */
  tags?: string[];

  /**
   * Per-driver engineering data. The catalogue is the source of truth — the
   * driver libs import from here, not the other way round. One SKU can carry
   * multiple driver entries when more than one driver family supports the
   * same physical roll.
   *
   * Discriminated by `driver` so each driver gets its own typed payload
   * (Brother QL needs print-area dots + margin pins; LabelManager needs
   * printable dots + bytes-per-line; future drivers add their own variant).
   */
  driverRefs: DriverRef[];

  /** Provenance for audit / regenerating the catalogue. */
  source: {
    fetchedAt: string;        // ISO date
    sourceUrl: string;        // page the data came from
    confidence: 'verified' | 'inferred' | 'community';
  };
}

interface ColorSpec {
  name: string;        // "black", "yellow", "clear", "red"
  hex?: string;        // optional approximation, e.g. "#FFD800"
}

type DriverRef =
  | BrotherQLDriverRef
  | LabelManagerDriverRef
  /* future */;

interface BrotherQLDriverRef {
  driver: 'brother-ql';
  /** Firmware media id reported in the 32-byte status response. */
  registryId: number;
  engineering: {
    printAreaDots: number;
    leftMarginPins: number;
    rightMarginPins: number;
    /** Die-cut only. */
    dieCutMaskedAreaDots?: number;
  };
  notes?: string;
}

interface LabelManagerDriverRef {
  driver: 'labelmanager';
  /** Tape-width key, e.g. "tape-12". */
  registryId: string;
  engineering: {
    tapeWidthMm: 6 | 9 | 12 | 19;
    printableDots: number;
    bytesPerLine: number;
  };
  notes?: string;
}
```

### 4.2 Why this shape

- **Single source of truth.** Drivers `import { findByDriverRef } from
  '@…/media-catalog'` and pull both the engineering payload and the consumer
  metadata in one go. No more two parallel registries to keep in sync.
- **`MediaDescriptor` (contracts) stays as the structural base** — the
  catalogue's row satisfies it, so existing driver code that takes a
  `MediaDescriptor` keeps working unchanged.
- **`driverRefs` is a list, not a single field.** A future Brother PT-family
  driver might support the same physical roll a different way — one SKU, two
  refs, each with its own engineering payload.
- **`codes.primary` is what shows up in the displayName parens.** Aliases are
  for search and for reconciling regional/secondary codes (DYMO's S-codes,
  DK22251 vs DK-22251, EAN, MFR PN).
- **`mediaColor` and `inkColor` are separate** — that is the actual taxonomy of
  D1 tapes ("black on yellow", "white on black", "gold on black"). One field is
  not enough. Where both fields are set, `formatDisplayName` renders them as
  `"<ink> on <media>"` to match how every retailer writes it.
- **Engineering payload is typed per driver, not bag-of-anything.** A
  discriminated union means TypeScript catches "wrong field for wrong driver"
  at compile time. New drivers add a new variant; they don't reach into a
  shared dict.
- **`source.confidence`** — manufacturer pages are the gold standard. A field
  inferred from a third-party retailer should be flagged as such so we can come
  back and verify it later.

### 4.3 Default-inference and normalisation rules

Stress-testing the schema against 7 real 123inkt rows (3 Brother DK, 4 DYMO LW,
including one two-colour and one industrial) surfaced these rules the scraper
must apply:

- **`inkColor` default.** When the page does not state ink colour and the
  family is a direct-thermal LW or QL roll, default to `{ name: 'black' }`
  and tag the source as `confidence: 'inferred'` for that field. (DYMO and
  Brother pages routinely omit "black on…" because it's the obvious default.)
- **`shape` default.** When the page does not state shape and the family is
  DYMO LabelWriter, default to `'die-cut'`. LW is never continuous.
- **Primary-code canonicalisation.** 123inkt's "primary code" varies row to
  row — sometimes the 5-digit SKU (`99014`), sometimes the S-code
  (`S0722540`). Scraper must canonicalise: prefer 5-digit / 7-digit catalog
  SKU, demote S-code to `aliases`. This matches DYMO's own catalogue order.
- **One physical SKU = one row.** Some 123inkt pages (`99010`) list 9 colour
  variants on a single page; each variant has its own purchasable code.
  Scraper splits these into N rows, one per colour, by following each
  variant's individual product link.
- **Unit conversion.** 123inkt reports `roll_length_m` in metres; the
  schema's `packaging.rollLengthMm` is millimetres. Scraper multiplies by
  1000.
- **Substrate vocabulary.** Map Dutch source values into the 6-enum:
  `papier` / `thermisch papier` → `paper`, `polypropyleen (gecoat)` /
  `vinyl` / `polyester` → `film`, `nylon` / `iron-on` → `fabric`. Detail
  text (e.g. "thermisch", "gecoat", temperature range) goes into `tags` so
  it's searchable but doesn't pollute the enum.
- **Permanence vocabulary.** `permanent` / `permanent hechtend` /
  `zelfklevend` → `permanent`; `verwijderbaar` → `removable`;
  `extra permanent` → `extra-strong`; `vriezer` / `freezer` → `freezer`.
- **Compatibility from e-tailers is unreliable.** 123inkt often shows 0–2
  printer models or none at all. Do **not** populate `driverRefs` from the
  scrape. `driverRefs` come from the per-driver lib's existing knowledge of
  which firmware media-id maps to which physical roll — that mapping is a
  separate, manual step done once per driver lib.
- **Image URL normalisation.** 123inkt sometimes returns relative
  `/image/...` URLs. Scraper must absolutise.

The full mapping table lives in the scraper repo as `normalisation.json`,
not in the catalogue itself — it's scrape infrastructure, not data.

### 4.4 Required vs nice-to-have fields

Not every row will be complete. The catalogue is shippable as long as each
row meets the **two minimum bars** below; everything else is decoration that
contributors can fill in later.

**Minimum for the printer to print on it** (driver bar):

- `id`, `codes.primary`
- `widthMm`, plus `heightMm` for die-cut and tape-segment shapes
- `shape`
- At least one `driverRefs[]` entry with the engineering payload required by
  the relevant driver — OR an empty `driverRefs[]`, which marks the row as
  "consumer-known but no driver supports it yet" (still useful for the
  picker; the row gets a driver ref the day a relevant driver lib lands).

**Minimum for the user to identify their roll** (consumer bar):

- `displayName` (computable by `formatDisplayName(sku)` from the fields above)
- `manufacturer`, `family`
- `mediaColor` and `inkColor` (default-inferred when unstated)
- `links.productUrl` so the user can confirm by sight

**Nice-to-have, fill in over time:**

- `secondaryInkColor`, `finish`, `substrate`, `permanence`
- `packaging.*`, `links.imageUrl`, `links.datasheetUrl`
- `tags`, alias codes beyond the primary
- `source.confidence: 'verified'` (vs `'community'`)

CI lints rows: anything below the two minimum bars fails to build. Anything
missing only nice-to-haves builds with a warning, surfaced as
`completeness: 'partial'` on the row so the picker UI can flag "we don't
know everything about this one".

### 4.5 Storage format

Two viable shapes; the plan picks (b):

(a) one giant `media.json` per manufacturer, hand-edited.
(b) one file per SKU (`brother/dk-22205.json`), aggregated by a build step
    into a single `catalog.json` consumed at runtime.

(b) is preferred because it makes diffs reviewable, lets the gathering step in
§5 emit one file per fetched page, and avoids merge conflicts when many SKUs
land at once. The build step can also emit `catalog.d.ts` for type-safe
imports.

---

## 5. Where the data comes from

This is the part that has to actually be done by hand or semi-automation. It is
**not** a code project — it is a data project with a code project around it.

### 5.1 Sources

E-tailer category indexes are the **primary** source. They have everything
the driver and the picker actually need (size, shape, code, colour, pack
size, image), they list product variants in a uniform table that's easy to
parse, and they cover both vendors with one parser. Manufacturer pages and
SDK manifests are valuable as a **cross-reference pass** to catch errors
and fill blanks — not as gatekeepers blocking v1 from shipping.

**Primary seeds (what the v1 scraper hits):**

- **123inkt DYMO LabelWriter rolls.** [Etiket-nummer index](https://www.123inkt.nl/Labels-en-tapes/Dymo/Etiket-nummer-p17033.html)
  — ~60 SKUs. LW only; D1 cassettes are on a separate category page.
- **123inkt Brother labels.** [Etiket-nummer index](https://www.123inkt.nl/Labels-en-tapes/Brother/Etiket-nummer-p17124.html)
  — ~86 SKUs. Full DK coverage plus RD/BCS/BDE/BDL/BRP/BRS/BSP/BSS/BUS/BWP/BWS
  industrial and CK/CZ legacy.
- Detail pages share the same layout shape across both manufacturers, so one
  parser handles the lot.

**Known coverage gap on 123inkt:** no Brother TZe (P-touch tapes) — ~200+
SKUs in that family. Source those separately from `brother.eu` or the b-PAC
SDK manifest. Not a Phase 1 blocker; TZe rolls in once a P-touch driver lib
exists to attach `driverRefs` to.

**Cross-reference sources (later pass, not blocking):**

- Manufacturer pages (`dymo.eu`, `brother.eu`) — verify a row, fill blanks,
  upgrade `confidence` from `community` to `verified`.
- Manufacturer driver/SDK manifests (Brother b-PAC XML, DYMO Connect) —
  exhaustive lists; useful for "did we miss any SKUs" sanity checks.
- Other e-tailers (Amazon, Bol, Reichelt) — fill EANs and pack-size variants.
- Community registries (`python-brother-ql`, `dymojs`, OpenSUSE PPDs) —
  cross-check firmware media ids against `driverRefs`.

**Confidence levels** become:

- `community` — sourced from any e-tailer (default for the seed scrape).
- `verified` — cross-checked against the manufacturer page or SDK.
- `inferred` — fields filled by default-inference rules (e.g. `inkColor: black`
  when a thermal-on-paper page didn't say).

A row at `community` is shippable as long as it satisfies the minimum-fields
rule in §4.4.

### 5.2 How to gather

A throwaway Node scraper does the bulk of the work. The schema is already
stress-tested against 7 hand-pulled rows (3 Brother DK + 4 DYMO LW including
a two-colour and an industrial), so the scraper has a clear target shape.

The flow per manufacturer:

1. Scraper hits the relevant 123inkt index (DYMO or Brother), enumerates
   product detail URLs, and follows colour-variant sub-links so
   one-physical-SKU = one row (see §4.3).
2. For each detail page, scraper extracts the spec table, applies the
   normalisation rules from §4.3, and emits one JSON file per SKU into
   `data/{manufacturer}/{primary-code}.json` with
   `source.fetchedAt`, `source.sourceUrl`, `source.confidence: 'community'`.
3. Driver-lib cross-reference is a **separate, manual** step done once per
   driver lib: walk the existing engineering registry
   (`brother-ql/.../media.ts`, `labelmanager/.../media.ts`), and for each
   entry add a `driverRefs[]` to the matching catalogue row. This step is
   the one that turns "consumer-known SKU" into "driver-supported SKU".
4. Manufacturer cross-reference is a later async pass: walk rows with
   `confidence: 'community'`, verify against `dymo.eu` / `brother.eu`,
   upgrade to `'verified'`. Not blocking on Phase 1 ship — see §4.4.

Scraper lives in `scripts/scrape/` inside the catalogue package, with a
single `pnpm run scrape:dymo` / `pnpm run scrape:brother` command per source.
Idempotent: re-running it on an existing row preserves manual edits to
nice-to-have fields and only updates required fields + `source.fetchedAt`.

A polite-scraping note: rate-limit to ≤1 req/sec, set a `User-Agent` that
identifies the project, and cache responses to a local directory so reruns
during development don't re-hit the source. Skim 123inkt's robots.txt /
ToS before pointing the script at them at scale.

### 5.3 Initial scope

Three shippable batches. Each is independently useful.

| Batch | Family | Primary code | Approx SKUs | Notes |
|---|---|---|---|---|
| A | Brother QL DK | `DK-XXXXX` (DK-22XXX continuous, DK-11XXX die-cut) | ~25 | Highest leverage — existing Brother registry already half-encodes these, mechanical conversion plus finish/colour/substrate. |
| B | DYMO D1 tapes | 5-digit catalog SKU (`45013`); S-code (`S0720530`) lives in `aliases` | ~80 | Largest *new* coverage — LabelManager driver currently has zero SKU data. Colour matrix is the main axis. |
| C | DYMO LW die-cut | 5-digit catalog SKU (`30252`, `30323`) | ~30 | Useful once a LabelWriter driver exists. Until then rows have empty `driverRefs[]`; still useful for the picker UI. |

Anything else (Zebra, Epson LabelWorks, Niimbot, Phomemo) is out of scope for
v1 but the schema is intentionally generic enough to accept them later.

---

## 6. Where the package lives

- New package `@thermal-label/media-catalog` in the `thermal-label` monorepo,
  alongside `contracts`. Depends on `@thermal-label/contracts` for the
  structural `MediaDescriptor` base.
- **Both directions of the stack depend on it:**
  - Driver libs (`brother-ql`, `labelmanager`, …) import the catalogue and
    project rows into their own narrower types where convenient.
  - Consumer apps (`label-maker`, future media-picker UI) import the catalogue
    directly.
- This means catalogue churn (adding SKUs) does trigger driver-lib re-builds.
  Acceptable trade-off given the user's stated goal that "everyone is talking
  about the same thing when they say media". Adding a SKU should be cheap
  anyway — it's a JSON file, no driver code changes.

---

## 7. Integration plan

Phased so each phase is shippable independently.

### Phase 1 — schema + Batch A (Brother DK) + driver migration

- New package skeleton, schema as `.ts` types, JSON Schema generated from those
  types (for editor-side validation of SKU files).
- ~25 Brother DK rows, each carrying a `BrotherQLDriverRef` with the
  engineering payload that currently lives in
  `brother-ql/packages/core/src/media.ts`.
- Lookup helpers: `findByCode("DK-22205")`, `findByCodeOrAlias("S0720530")`,
  `findByDriverRef("brother-ql", 259)`, `formatDisplayName(sku)`.
- **`brother-ql` migrates to read from the catalogue.** The old `MEDIA` map
  becomes a thin re-export computed from the catalogue (filter where
  `driverRefs.some(r => r.driver === 'brother-ql')`, project to the existing
  `BrotherQLMedia` shape). All existing `findMedia` / `findMediaByDimensions`
  / `findMediaByWidth` keep their signatures.
- No consumer-app UI changes yet.

### Phase 2 — Batch B (DYMO D1) + LabelManager driver migration + UI hook

- ~80 DYMO D1 rows with `LabelManagerDriverRef` engineering payloads.
- `labelmanager` migrates the same way `brother-ql` did. Its 4-row registry is
  superseded; the catalogue now drives both display and engineering.
- In `label-maker`, the existing media/tape selector reads `displayName` from
  the catalogue, so users see `"12mm × 7m black on yellow (45018)"` instead
  of `"12mm tape"`.

### Phase 3 — Batch C (DYMO LW) + media picker prototype

- A real picker UI: filter by manufacturer, family, width, colour, finish,
  permanence. Search by primary code or alias.
- Picker outputs a `MediaSku` whose matching `driverRefs` entry is then
  resolved against the active driver to feed the existing print pipeline.

### Phase 4 — community contributions

Promoted from "later, optional" to a real phase. Given the v1 catalogue ships
with deliberately partial rows (see §4.4), contributors filling in blanks and
adding missing SKUs is the steady-state workflow, not an afterthought.

- `CONTRIBUTING.md` in the catalogue package, covering:
  - How to add a new SKU (one JSON file, schema link, the two minimum-fields
    bars from §4.4).
  - How to fill in nice-to-have fields on an existing row (edit-in-place,
    bump `source.fetchedAt`, optionally upgrade `confidence`).
  - How to source data: e-tailer page → manufacturer cross-check pattern,
    with worked examples for both Brother and DYMO.
  - How to add `driverRefs` once a new driver lib is on board.
- CI checks:
  - JSON Schema validation of the row against §4.1.
  - Both minimum-fields bars (`completeness: 'partial' | 'complete'`).
  - Per-driver `engineering` payloads satisfy the discriminated-union variant.
  - `codes.primary` and every alias are unique across the whole catalogue.
  - For each `driverRefs[].registryId`, no other row in the catalogue claims
    the same `(driver, registryId)` pair.
- A small `scripts/new-sku` helper that scaffolds a JSON file from a
  manufacturer code + URL, so contributors don't start from a blank page.
- The throwaway scraper (§5.2) lives in this same repo, in
  `scripts/scrape/`, so contributors can re-run it to refresh seed rows.

---

## 8. Risks & open trade-offs

- **Data drift.** Manufacturers change packaging, drop SKUs, add finishes. Plan
  to refresh `source.fetchedAt` quarterly. `confidence: 'verified'` rows older
  than ~1y should auto-downgrade in the UI to "may be stale".
- **Schema evolution.** Adding a field later is cheap; renaming or removing one
  is a migration. Keep v1 minimal — only fields with a known consumer
  (filter, display, link, lookup). Resist adding speculative fields.
- **Colour representation.** `mediaColor.hex` is approximate by definition
  (real labels reflect light, sRGB does not). It's there for UI swatches, not
  for colour-management. Make this explicit in the type docstring.
- **One-SKU-many-driver-refs.** Fine in principle, but watch for the case where
  the same physical roll has *different* engineering parameters per driver
  (margins differ, etc.). The schema supports it via `DriverRef.notes`; the
  consumer code has to actually pick the right ref by driver, not assume the
  first one.

---

## 9. Concrete first steps (what to do on day one)

These are the smallest steps that produce something reviewable. No code is
landed before this list completes; they form the basis of Phase 1.

1. Create `thermal-label/packages/media-catalog/` package skeleton.
2. Land `schema.ts` (the `MediaSku` interface from §4.1) plus the
   normalisation table from §4.3 as `normalisation.json`.
3. Hand-author **three** SKU JSON files from the already-pulled stress-test
   data (these rows are in this conversation's history; no new fetches
   needed for the dogfood):
   - `brother/dk-22205.json` (continuous, single-colour, common)
   - `brother/dk-22251.json` (continuous, two-colour — exercises
     `secondaryInkColor`)
   - `brother/dk-11201.json` (die-cut address label — exercises `heightMm`
     and the BrotherQL driver-ref engineering payload)
4. Land the build step that aggregates the per-SKU files into `catalog.json`
   + `catalog.d.ts`, plus the lookup helpers (`findByCode`,
   `findByCodeOrAlias`, `findByDriverRef`, `formatDisplayName`).
5. Land the throwaway scraper in `scripts/scrape/`, run it against the two
   123inkt indexes, commit the resulting JSON in a single big PR per
   manufacturer.
6. Land `CONTRIBUTING.md` and CI checks from §7 Phase 4 — needed before the
   first community PR can land.

After this, batches A → B → C proceed in §7's order, with the manufacturer
cross-reference pass running async in the background.

---

## 10. Open questions

To resolve before Phase 1 starts:

- **Naming.** `media-catalog`, `media-library`, `consumables`, `sku-catalog`?
  Decision affects only the package name; defer until Phase 1 PR.
- **Permanence taxonomy.** The list in §4.1 is a guess. Worth scanning Brother
  + DYMO marketing pages once and confirming the closed set covers reality
  before locking the type.
- **DYMO primary-code choice — RESOLVED.** Stress-testing 4 DYMO LW pages on
  123inkt confirmed the retailer is itself inconsistent (sometimes leads with
  the 5-digit, sometimes the S-code). Plan picks the 5-digit / 7-digit
  catalog SKU as primary and demotes the S-code to aliases; the scraper
  canonicalises during ingest.
- **Colour-variant splitting — RESOLVED.** Confirmed 123inkt lumps colour
  variants of the same size on a single page (e.g. 99010 lists 9 colours).
  Scraper follows each variant's individual product link and emits one row
  per physical SKU.
- **i18n.** `displayName` is English-only in v1. If the picker UI needs Dutch
  ("zwart op geel") we will need a `displayNameI18n: Record<string, string>`
  field, OR `formatDisplayName` becomes locale-aware. Decide before Phase 2's
  UI hook.
- **Image hosting.** `links.imageUrl` pointing at the manufacturer's CDN is
  brittle (they rotate URLs). Worth deciding whether we self-host thumbnails
  in the package or live with broken images.
- **Driver-lib breaking change scope.** Phase 1 reshapes how `brother-ql`
  loads its media list (computed from catalogue rather than hand-written).
  External consumers of `brother-ql` should not notice — the public API is
  preserved — but it is worth a minor-version bump and a release note.

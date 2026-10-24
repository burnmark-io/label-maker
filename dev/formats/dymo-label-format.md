# DYMO Label File Format Specification

> Target audience: AI agent implementing import/export for `.label` and `.dymo` files.

## Overview

DYMO label files are XML documents describing the layout and content of labels for DYMO LabelWriter thermal printers. The format is used by two software generations:

- **DYMO Label Software v.8** — saves as `.label` extension
- **DYMO Connect** — saves as `.dymo` extension

Both use the same core XML schema (version `"8.0"`). DYMO Connect may introduce additional elements but remains backward-compatible with the v.8 structure. When importing, accept both extensions and parse identically. When exporting, use `.dymo` for broader compatibility with current software.

The format is cross-platform (Windows, macOS) and is the same format used by the DYMO JavaScript SDK.

## Units

All positional and dimensional values in the file are expressed in **twips**.

```
1 twip = 1/1440 inch
1 inch = 1440 twips
1 mm ≈ 56.693 twips
1 point (1/72 inch) = 20 twips
```

Font sizes within `<Font>` elements are in **points** (standard typographic points, 1/72 inch).

## File Structure

```xml
<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips" MediaType="Default">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Address</Id>
  <IsOutlined>false</IsOutlined>
  <PaperName>30252 Address</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="1581" Height="5040" Rx="270" Ry="270" />
  </DrawCommands>

  <ObjectInfo>
    <!-- First label object -->
    <Bounds X="..." Y="..." Width="..." Height="..." />
  </ObjectInfo>

  <ObjectInfo>
    <!-- Second label object -->
    <Bounds X="..." Y="..." Width="..." Height="..." />
  </ObjectInfo>

  <!-- ... more ObjectInfo elements ... -->
</DieCutLabel>
```

An alternative root element `<ContinuousLabel>` is used for tape/continuous labels (LabelManager tape printers). The structure inside is largely the same.

## Root Element

### `<DieCutLabel>` (or `<ContinuousLabel>`)

| Attribute   | Type   | Description                                                                 |
|-------------|--------|-----------------------------------------------------------------------------|
| `Version`   | string | Always `"8.0"` for all known versions of DLS v.8 through current.          |
| `Units`     | string | Always `"twips"`. No other unit values are currently defined.               |
| `MediaType` | string | Optional. Known values: `"Default"`. May be absent in older files.          |

## Label Metadata Elements

Direct children of the root element:

| Element              | Required | Description                                                                                              |
|----------------------|----------|----------------------------------------------------------------------------------------------------------|
| `<PaperOrientation>` | Yes      | `"Landscape"` or `"Portrait"`.                                                                           |
| `<Id>`               | Yes      | Label type identifier. Corresponds to a built-in layout. Examples: `"Address"`, `"LargeShipping"`, `"ReturnAddress"`, `"LargeAddress"`, `"FileFolder"`, `"Appointment"`, `"Hanging"`, `"Small30330"`. |
| `<PaperName>`        | Yes      | Maps to the physical label SKU. Format: `"<SKU> <HumanName>"`. Examples: `"30252 Address"`, `"30256 Shipping"`, `"30330 Return Address"`, `"30321 Large Address"`, `"99010 Standard Address"` (Dymo EU SKUs use 99xxx). |
| `<DrawCommands>`     | Yes      | Defines the label outline/boundary shape. Contains one or more drawing primitives.                        |
| `<IsOutlined>`       | No       | `"true"` or `"false"`. Whether the label outline is drawn visually.                                      |

### `<DrawCommands>` Children

| Element            | Attributes                              | Description                          |
|--------------------|-----------------------------------------|--------------------------------------|
| `<RoundRectangle>` | `X`, `Y`, `Width`, `Height`, `Rx`, `Ry` | Rounded rectangle outline (most common). `Rx`/`Ry` are corner radii. All values in twips. |
| `<Rectangle>`      | `X`, `Y`, `Width`, `Height`             | Sharp-cornered rectangle outline.    |

The `Width` and `Height` here represent the printable area of the label in twips. This is your canonical label size for coordinate mapping.

## ObjectInfo Container

Each label object is wrapped in an `<ObjectInfo>` element. Inside `<ObjectInfo>` there are exactly two children:

1. **The object element** — one of: `<TextObject>`, `<BarcodeObject>`, `<AddressObject>`, `<ImageObject>`, `<ShapeObject>`, `<CircularTextObject>`, `<CounterObject>`, `<DateTimeObject>`
2. **`<Bounds>`** — the positioning rectangle for this object

### `<Bounds>` Element

| Attribute | Type  | Description                                    |
|-----------|-------|------------------------------------------------|
| `X`       | float | Left edge position in twips from label origin. |
| `Y`       | float | Top edge position in twips from label origin.  |
| `Width`   | float | Width of bounding box in twips.                |
| `Height`  | float | Height of bounding box in twips.               |

**Important:** `<Bounds>` is a sibling of the object element, not a child. Both are children of `<ObjectInfo>`.

## Common Object Properties

All object types share these child elements (directly inside the object element):

| Element               | Type   | Values / Description                                                                          |
|-----------------------|--------|-----------------------------------------------------------------------------------------------|
| `<Name>`              | string | Reference name. Unicode, case-sensitive. Can be empty. Used for SDK access and `LinkedObjectName` references. |
| `<ForeColor>`         | element | Attributes: `Alpha`, `Red`, `Green`, `Blue` (0–255 each).                                    |
| `<BackColor>`         | element | Attributes: `Alpha`, `Red`, `Green`, `Blue` (0–255 each). Alpha=0 means transparent.         |
| `<LinkedObjectName>`  | string | Name of another object to pull content from. Empty string if not linked.                      |
| `<Rotation>`          | string | `"Rotation0"`, `"Rotation90"`, `"Rotation180"`, `"Rotation270"`.                              |
| `<IsMirrored>`        | string | `"True"` or `"False"`.                                                                        |
| `<IsVariable>`        | string | `"True"` or `"False"`. Indicates the object is a variable field (for mail merge / SDK data injection). |

## Object Types

### TextObject

The most common object type. Displays a block of styled text.

```xml
<TextObject>
  <!-- common properties -->
  <HorizontalAlignment>Left</HorizontalAlignment>
  <VerticalAlignment>Top</VerticalAlignment>
  <TextFitMode>ShrinkToFit</TextFitMode>
  <UseFullFontHeight>True</UseFullFontHeight>
  <Verticalized>False</Verticalized>
  <StyledText>
    <Element>
      <String>Hello World</String>
      <Attributes>
        <Font Family="Arial" Size="12" Bold="False" Italic="False"
              Underline="False" Strikeout="False" />
        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      </Attributes>
    </Element>
    <Element>
      <!-- additional styled run -->
    </Element>
  </StyledText>
</TextObject>
```

| Element                 | Values                                                             |
|-------------------------|--------------------------------------------------------------------|
| `<HorizontalAlignment>` | `"Left"`, `"Center"`, `"Right"`, `"Justified"`                   |
| `<VerticalAlignment>`   | `"Top"`, `"Middle"`, `"Bottom"`                                   |
| `<TextFitMode>`         | `"None"` — no auto-sizing. `"ShrinkToFit"` — shrink font to fit bounds. `"AlwaysFit"` — always scale to fill bounds. |
| `<UseFullFontHeight>`   | `"True"` / `"False"`. When true, uses full font ascent+descent for line height. |
| `<Verticalized>`        | `"True"` / `"False"`. Renders text vertically (one character per line). |

#### StyledText / Element

`<StyledText>` contains one or more `<Element>` children. Each `<Element>` is a styled text run (like a `<span>` in HTML):

| Child Element | Description                                                    |
|---------------|----------------------------------------------------------------|
| `<String>`    | The text content of this run.                                  |
| `<Attributes>` | Contains `<Font>` and optionally `<ForeColor>` for this run. |

#### Font Element (within Attributes)

| Attribute    | Type    | Description                    |
|--------------|---------|--------------------------------|
| `Family`     | string  | Font family name (e.g. `"Arial"`, `"Helvetica"`, `"Roboto Mono"`). |
| `Size`       | float   | Font size in **points**.       |
| `Bold`       | string  | `"True"` / `"False"`.         |
| `Italic`     | string  | `"True"` / `"False"`.         |
| `Underline`  | string  | `"True"` / `"False"`.         |
| `Strikeout`  | string  | `"True"` / `"False"`.         |

### AddressObject

Identical structure to `TextObject` but treated as an address field by the DYMO software (enables address formatting, USPS address fixing, etc.). Parse it exactly like `TextObject` for layout purposes. The only difference is semantic — the object is tagged as address content.

### BarcodeObject

```xml
<BarcodeObject>
  <!-- common properties -->
  <Text>DATA_TO_ENCODE</Text>
  <Type>QRCode</Type>
  <Size>Small</Size>
  <TextPosition>Bottom</TextPosition>
  <TextFont Family="Helvetica" Size="10" Bold="False" Italic="False"
            Underline="False" Strikeout="False" />
  <CheckSumFont Family="Helvetica" Size="10" Bold="False" Italic="False"
                Underline="False" Strikeout="False" />
  <TextEmbedding>None</TextEmbedding>
  <ECLevel>0</ECLevel>
  <HorizontalAlignment>Center</HorizontalAlignment>
  <QuietZonesPadding Left="0" Right="0" Top="0" Bottom="0" />
</BarcodeObject>
```

| Element                | Type   | Description                                                                        |
|------------------------|--------|------------------------------------------------------------------------------------|
| `<Text>`               | string | The data to encode in the barcode. For QR codes may be prefixed with `"URL:"`, `"TEL:"`, etc. |
| `<Type>`               | string | Barcode symbology. See table below.                                                |
| `<Size>`               | string | `"Small"`, `"Medium"`, `"Large"`. Affects bar width / module size.                 |
| `<TextPosition>`       | string | `"None"`, `"Top"`, `"Bottom"`. Where human-readable text is rendered.              |
| `<TextFont>`           | element | Font for human-readable text. Same attributes as `<Font>`.                         |
| `<CheckSumFont>`       | element | Font for checksum digits. Same attributes as `<Font>`.                             |
| `<TextEmbedding>`      | string | `"None"`. Rarely used.                                                             |
| `<ECLevel>`            | string | Error correction level (QR Code). `"0"` through `"3"` (L, M, Q, H).              |
| `<HorizontalAlignment>`| string | `"Left"`, `"Center"`, `"Right"`.                                                  |
| `<QuietZonesPadding>`  | element | Attributes: `Left`, `Right`, `Top`, `Bottom` (in twips). Padding around barcode.  |

#### Barcode Type Values

| `<Type>` value       | Symbology             |
|----------------------|-----------------------|
| `"Code39"`           | Code 39               |
| `"Code128Auto"`      | Code 128 Auto         |
| `"Code128A"`         | Code 128 subset A     |
| `"Code128B"`         | Code 128 subset B     |
| `"Code128C"`         | Code 128 subset C     |
| `"I2of5"`            | Interleaved 2 of 5    |
| `"Codabar"`          | Codabar               |
| `"Ean8"`             | EAN-8                 |
| `"Ean13"`            | EAN-13                |
| `"UpcA"`             | UPC-A                 |
| `"UpcE"`             | UPC-E                 |
| `"Ean128"`           | UCC/EAN-128           |
| `"ITF14"`            | ITF-14                |
| `"QRCode"`           | QR Code               |
| `"Pdf417"`           | PDF417                |
| `"Postnet"`          | POSTNET               |
| `"Planet"`           | PLANET                |
| `"IntelligentMail"`  | Intelligent Mail (IMB)|
| `"DataMatrix"`       | GS1 DataMatrix        |

### ImageObject

```xml
<ImageObject>
  <!-- common properties -->
  <ScaleMode>Uniform</ScaleMode>
  <BorderWidth>0</BorderWidth>
  <BorderColor Alpha="255" Red="0" Green="0" Blue="0" />
  <HorizontalAlignment>Center</HorizontalAlignment>
  <VerticalAlignment>Center</VerticalAlignment>
  <Image>BASE64_ENCODED_PNG_DATA</Image>
</ImageObject>
```

| Element                 | Type   | Description                                                    |
|-------------------------|--------|----------------------------------------------------------------|
| `<ScaleMode>`           | string | `"Uniform"` (maintain aspect ratio), `"Fill"` (stretch to fill), `"None"` (original size). |
| `<BorderWidth>`         | int    | Border width in twips. `0` for no border.                      |
| `<BorderColor>`         | element | ARGB color attributes, same as `ForeColor`.                   |
| `<HorizontalAlignment>` | string | `"Left"`, `"Center"`, `"Right"`.                              |
| `<VerticalAlignment>`   | string | `"Top"`, `"Center"`, `"Bottom"`.                              |
| `<Image>`               | string | Base64-encoded image data (typically PNG). Can be empty if using `LinkedObjectName`. |

### ShapeObject

```xml
<ShapeObject>
  <!-- common properties -->
  <ShapeType>Rectangle</ShapeType>
  <LineWidth>20</LineWidth>
  <LineStyle>Solid</LineStyle>
  <FillColor Alpha="255" Red="0" Green="0" Blue="0" />
</ShapeObject>
```

| Element       | Type   | Description                                                      |
|---------------|--------|------------------------------------------------------------------|
| `<ShapeType>` | string | `"Rectangle"`, `"Ellipse"`, `"HorizontalLine"`, `"VerticalLine"`. |
| `<LineWidth>` | int    | Line/border width in twips.                                      |
| `<LineStyle>` | string | `"Solid"`, `"Dash"`, `"Dot"`, `"DashDot"`.                      |
| `<FillColor>` | element | ARGB fill color. Alpha=0 for no fill (outline only).            |

### CircularTextObject

Displays text on a curved arc. Primarily used on CD/DVD labels.

```xml
<CircularTextObject>
  <!-- common properties -->
  <Text>CURVED TEXT HERE</Text>
  <Font Family="Arial" Size="14" Bold="False" Italic="False"
        Underline="False" Strikeout="False" />
  <ArcPlacement>Above</ArcPlacement>
  <StartAngle>0</StartAngle>
  <EndAngle>180</EndAngle>
</CircularTextObject>
```

| Element           | Type   | Description                                          |
|-------------------|--------|------------------------------------------------------|
| `<Text>`          | string | The text content.                                    |
| `<Font>`          | element | Font attributes (same structure as in TextObject).  |
| `<ArcPlacement>`  | string | `"Above"` or `"Below"` the arc.                     |
| `<StartAngle>`    | float  | Start angle in degrees.                              |
| `<EndAngle>`      | float  | End angle in degrees.                                |

### CounterObject

Auto-incrementing serial number. Structure is similar to TextObject but with additional properties:

| Element      | Type | Description                                              |
|--------------|------|----------------------------------------------------------|
| `<Start>`    | int  | Starting value.                                          |
| `<Current>`  | int  | Current value (updated at runtime).                      |
| `<Increment>`| int  | Step value.                                              |
| `<Format>`   | string | Number format string.                                  |

### DateTimeObject

Dynamic date/time stamp. Structure similar to TextObject with these additions:

| Element           | Type   | Description                                             |
|-------------------|--------|---------------------------------------------------------|
| `<DateTimeFormat>` | string | Format string for date/time display.                   |
| `<PreText>`       | string | Text to display before the date/time.                  |
| `<PostText>`      | string | Text to display after the date/time.                   |
| `<IncludeDate>`   | string | `"True"` / `"False"`.                                  |
| `<IncludeTime>`   | string | `"True"` / `"False"`.                                  |

## Common Label SKUs and Dimensions

For reference when validating imported labels or pre-populating label templates:

| PaperName                   | Width (twips) | Height (twips) | Width (mm) | Height (mm) | Description         |
|-----------------------------|---------------|----------------|------------|-------------|---------------------|
| `30252 Address`             | 1581          | 5040           | 28.6       | 88.9        | Standard address    |
| `30256 Shipping`            | 3331          | 5715           | 59.0       | 101.6       | Large shipping      |
| `30330 Return Address`      | 1080          | 2880           | 19.1       | 50.8        | Small return address|
| `30321 Large Address`       | 2025          | 5040           | 35.7       | 88.9        | Large address       |
| `30323 Shipping`            | 3060          | 3060           | 54.0       | 54.0        | Square shipping     |
| `30336 Small Multipurpose`  | 1710          | 3780           | 30.2       | 66.7        | Multipurpose        |
| `99010 Standard Address`    | 1581          | 5040           | 28.6       | 88.9        | EU equivalent 30252 |
| `99012 Large Address`       | 2160          | 5040           | 36.0       | 89.0        | EU equivalent       |
| `99014 Shipping`            | 3060          | 7380           | 54.0       | 101.0       | EU equivalent       |

> Note: EU labels use 99xxx SKUs. The dimensions in `<DrawCommands>` are authoritative — always use those rather than this lookup table.

## Coordinate System

- Origin (0,0) is the **top-left corner** of the label printable area.
- X axis increases **rightward**.
- Y axis increases **downward**.
- All coordinates in the `<Bounds>` element and `<DrawCommands>` are in twips.
- The `<DrawCommands>` `<RoundRectangle>` `Width` and `Height` define the label printable area. Objects can be positioned anywhere within (or technically outside) this area.

## Import Implementation Notes

1. **Parse the XML** using any DOM parser. The root element tells you the label type (`DieCutLabel` or `ContinuousLabel`).
2. **Extract label dimensions** from the `<DrawCommands>` child element's `Width` and `Height` attributes.
3. **Iterate `<ObjectInfo>` elements** in document order. Each contains exactly one object element and one `<Bounds>` element.
4. **Map object types** to your internal representation. Priority for a first implementation: `TextObject` → `BarcodeObject` → `ImageObject` → `ShapeObject`. The rest (`CircularTextObject`, `CounterObject`, `DateTimeObject`) are uncommon.
5. **Convert coordinates** from twips to your internal unit system.
6. **Handle `LinkedObjectName`** — if an object has a non-empty `LinkedObjectName`, its content should be sourced from the referenced object. Resolve these after parsing all objects.
7. **Handle `StyledText` runs** — a single `TextObject` can contain multiple `<Element>` runs with different fonts/colors. Map to your rich text model or flatten to a single style if your model is simpler (use the first run's style).
8. **Font mapping** — Dymo labels may reference system fonts. For import, preserve the font family name and let your renderer handle fallback.
9. **Boolean values** are the strings `"True"` and `"False"` (capital T/F).

## Export Implementation Notes

1. **XML declaration** must be `<?xml version="1.0" encoding="utf-8"?>`.
2. **Root element** should be `<DieCutLabel Version="8.0" Units="twips">` for die-cut labels.
3. **`<PaperName>`** should match a known Dymo label SKU for the label to be recognized by DYMO software.
4. **`<DrawCommands>`** must contain a `<RoundRectangle>` matching the label's printable area.
5. **Object order** matters for z-ordering — objects later in the document render on top.
6. **`<Bounds>`** values can be floating-point (e.g. `X="326.4"`).
7. **Image data** in `<ImageObject>` should be base64-encoded PNG.
8. **The `.dymo` extension** is recommended for files intended for DYMO Connect. The `.label` extension for DYMO Label Software v.8. The XML content is the same.
9. **DYMO Connect** may add additional elements on re-save that are not present in your export. This is expected — the software is tolerant of missing optional elements.

## Reference Implementations

- **`bgentry/dymo_render`** (Ruby, archived) — Renders `.label` XML to PDF. Good reference for parsing and coordinate mapping. https://github.com/bgentry/dymo_render
- **`seven1m/dymo-printer-agent`** (Ruby) — The original codebase `dymo_render` was extracted from.
- **DYMO SDK blog posts** — Official format documentation (2010). The developer blog at `developers.dymo.com` has detailed posts on label objects and file structure.
- **Official XSD** — Was at `http://www.labelwriter.com/software/dls/sdk/LabelFile.xsd` (now dead). Archive.org may have copies.

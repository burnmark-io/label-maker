# Brother LBX File Format Specification

> Target audience: AI agent implementing import/export for `.lbx` files (Brother P-touch Editor labels).

## Overview

LBX is the native file format for Brother's P-touch Editor software, used with Brother label printers including the QL series (QL-700, QL-800, QL-810W, QL-820NWB, QL-1100, etc.) and P-touch series (PT-D600, PT-P700, PT-P900W, etc.).

An `.lbx` file is a **standard ZIP archive** containing XML files and optional embedded images. Renaming `.lbx` to `.zip` and extracting it works with any ZIP tool.

A related format `.lbt` is used by P-touch Editor Lite (the simplified editor). It has a similar but not identical structure. This document covers `.lbx` only.

## Units

All positional and dimensional values in `label.xml` are expressed in **CSS/typographic points (pt)**.

```
1 pt = 1/72 inch
1 inch = 72 pt
1 mm ≈ 2.835 pt
```

## Archive Structure

```
myfile.lbx (ZIP archive)
├── label.xml          # Main label layout and content (required)
├── prop.xml           # Metadata: printer model, software version (required)
├── image0.tif         # Embedded image (optional, TIF/TIFF format)
├── image1.bmp         # Embedded image (optional, BMP format)
└── ...                # Additional image files as needed
```

### prop.xml

Contains metadata about the label. Typical structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<pt:property xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main">
  <pt:application name="P-touch Editor" version="5.0.201" platform="Macintosh" />
  <pt:defaultPrinter printerName="Brother QL-700" printerID="13620" />
</pt:property>
```

| Element                | Description                                                    |
|------------------------|----------------------------------------------------------------|
| `<pt:application>`     | Software that created the file: `name`, `version`, `platform`. |
| `<pt:defaultPrinter>`  | Printer the label was designed for: `printerName`, `printerID`.|

The `printerID` is a Brother-internal numeric identifier for the printer model.

## label.xml Structure

### XML Namespaces

The label XML uses multiple namespaces corresponding to different object domains:

| Prefix     | URI                                                      | Purpose             |
|------------|----------------------------------------------------------|---------------------|
| `pt`       | `http://schemas.brother.info/ptouch/2007/lbx/main`      | Core / document     |
| `style`    | `http://schemas.brother.info/ptouch/2007/lbx/style`     | Layout / paper      |
| `text`     | `http://schemas.brother.info/ptouch/2007/lbx/text`      | Text objects        |
| `draw`     | `http://schemas.brother.info/ptouch/2007/lbx/draw`      | Drawing primitives  |
| `image`    | `http://schemas.brother.info/ptouch/2007/lbx/image`     | Image objects       |
| `barcode`  | `http://schemas.brother.info/ptouch/2007/lbx/barcode`   | Barcode objects     |
| `database` | `http://schemas.brother.info/ptouch/2007/lbx/database`  | Database merge      |
| `table`    | `http://schemas.brother.info/ptouch/2007/lbx/table`     | Table objects       |

### Document Skeleton

```xml
<?xml version="1.0" encoding="UTF-8"?>
<pt:document
  xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main"
  xmlns:style="http://schemas.brother.info/ptouch/2007/lbx/style"
  xmlns:text="http://schemas.brother.info/ptouch/2007/lbx/text"
  xmlns:draw="http://schemas.brother.info/ptouch/2007/lbx/draw"
  xmlns:image="http://schemas.brother.info/ptouch/2007/lbx/image"
  xmlns:barcode="http://schemas.brother.info/ptouch/2007/lbx/barcode"
  xmlns:database="http://schemas.brother.info/ptouch/2007/lbx/database"
  xmlns:table="http://schemas.brother.info/ptouch/2007/lbx/table"
  version="1.1"
  generator="P-touch Editor 5.0.201 Macintosh">

  <pt:body currentSheet="Sheet 1">
    <style:sheet name="Sheet 1">
      <style:paper ... />
      <style:cutLine ... />
      <style:backGround ... />

      <pt:objects>
        <!-- label objects go here -->
      </pt:objects>
    </style:sheet>
  </pt:body>
</pt:document>
```

## Root Element: `<pt:document>`

| Attribute    | Type   | Description                                                  |
|--------------|--------|--------------------------------------------------------------|
| `version`    | string | Format version. Known values: `"1.1"`, `"1.5"`.             |
| `generator`  | string | Creating software identifier and version.                    |

All namespace declarations must be present on the root element.

## Body and Sheet

### `<pt:body>`

| Attribute      | Type   | Description                               |
|----------------|--------|-------------------------------------------|
| `currentSheet` | string | Name of the active sheet. Usually `"Sheet 1"`. |

### `<style:sheet>`

| Attribute | Type   | Description                               |
|-----------|--------|-------------------------------------------|
| `name`    | string | Sheet name. Usually `"Sheet 1"`.          |

## Paper Definition: `<style:paper>`

Defines the label media, dimensions, and print characteristics.

```xml
<style:paper
  media="0"
  width="175.7pt"
  height="319.8pt"
  marginLeft="4.3pt"
  marginTop="8.4pt"
  marginRight="4.3pt"
  marginBottom="8.4pt"
  orientation="landscape"
  autoLength="false"
  monochromeDisplay="true"
  paperColor="#FFFFFF"
  paperInk="#000000"
  split="1"
  format=""
  backgroundTheme="0"
  printerID="13620"
  printerName="Brother QL-700"
/>
```

| Attribute            | Type    | Description                                                                |
|----------------------|---------|----------------------------------------------------------------------------|
| `media`              | string  | Media type identifier. `"0"` is standard. Numeric code for different tape/label types. |
| `width`              | string  | Label width including unit suffix (e.g. `"175.7pt"`).                     |
| `height`             | string  | Label height including unit suffix.                                        |
| `marginLeft`         | string  | Left margin with unit suffix.                                              |
| `marginTop`          | string  | Top margin with unit suffix.                                               |
| `marginRight`        | string  | Right margin with unit suffix.                                             |
| `marginBottom`       | string  | Bottom margin with unit suffix.                                            |
| `orientation`        | string  | `"landscape"` or `"portrait"`.                                             |
| `autoLength`         | string  | `"true"` / `"false"`. If true, label length auto-adjusts to content (continuous tape). |
| `monochromeDisplay`  | string  | `"true"` / `"false"`. Whether the label is monochrome (thermal printers).  |
| `paperColor`         | string  | Hex color of the label background (e.g. `"#FFFFFF"`).                      |
| `paperInk`           | string  | Hex color of the print ink (e.g. `"#000000"`).                             |
| `split`              | string  | Number of label copies/splits. Usually `"1"`.                              |
| `format`             | string  | Label format identifier. Empty string for custom.                          |
| `backgroundTheme`    | string  | Background theme index. `"0"` for none.                                    |
| `printerID`          | string  | Numeric printer model identifier.                                          |
| `printerName`        | string  | Printer model name (e.g. `"Brother QL-700"`).                              |

**Dimension parsing:** Values like `"175.7pt"` need to be parsed by stripping the `pt` suffix and parsing the float. All dimensions are in points.

**Printable area:** The actual printable area is:
- Printable width = `width` - `marginLeft` - `marginRight`
- Printable height = `height` - `marginTop` - `marginBottom`

### `<style:cutLine>`

```xml
<style:cutLine regularCut="0pt" freeCut="" />
```

| Attribute    | Type   | Description                                    |
|--------------|--------|------------------------------------------------|
| `regularCut` | string | Regular cut position with unit suffix.         |
| `freeCut`    | string | Free-form cut position. Empty if not used.     |

### `<style:backGround>`

```xml
<style:backGround
  x="8.4pt" y="4.3pt"
  width="303.0pt" height="167.0pt"
  brushStyle="NULL"
  brushId="0"
  color="#000000"
  backColor="#FFFFFF"
/>
```

| Attribute    | Type   | Description                                         |
|--------------|--------|-----------------------------------------------------|
| `x`, `y`     | string | Position of background area with unit suffix.       |
| `width`, `height` | string | Size of background area with unit suffix.      |
| `brushStyle` | string | `"NULL"` (no brush), `"SOLID"`, etc.                |
| `brushId`    | string | Brush pattern identifier. `"0"` for none.           |
| `color`      | string | Foreground hex color.                                |
| `backColor`  | string | Background hex color.                                |

## Objects Container: `<pt:objects>`

All label objects are children of `<pt:objects>`. Object types are identified by their namespaced element name.

## Common Object Style: `<pt:objectStyle>`

Every object contains a `<pt:objectStyle>` element that defines its position and appearance:

```xml
<pt:objectStyle
  x="231.0pt"
  y="84.8pt"
  width="58.0pt"
  height="58.0pt"
  backColor="#FFFFFF"
  ropMode="COPYPEN"
  angle="0"
  anchor="TOPLEFT"
  flip="NONE">

  <pt:pen style="NULL" widthX="0.50pt" widthY="0.50pt" color="#000000" />
  <pt:brush style="NULL" color="#000000" id="0" />
  <pt:expanded
    objectName="Text2"
    ID="0"
    lock="0"
    templateMergeTarget="LABELLIST"
    templateMergeType="NONE"
    templateMergeID="0"
    dbMergeFieldStyleName=""
    linkStatus="NONE"
    linkID="0"
  />
</pt:objectStyle>
```

### `<pt:objectStyle>` Attributes

| Attribute   | Type   | Description                                                        |
|-------------|--------|--------------------------------------------------------------------|
| `x`         | string | Left position with unit suffix (e.g. `"231.0pt"`).                |
| `y`         | string | Top position with unit suffix.                                     |
| `width`     | string | Object width with unit suffix.                                     |
| `height`    | string | Object height with unit suffix.                                    |
| `backColor` | string | Background hex color (e.g. `"#FFFFFF"`).                           |
| `ropMode`   | string | Raster operation mode. Usually `"COPYPEN"`.                        |
| `angle`     | string | Rotation angle in degrees (e.g. `"0"`, `"90"`, `"180"`, `"270"`). |
| `anchor`    | string | Anchor point for positioning. `"TOPLEFT"` is standard.             |
| `flip`      | string | `"NONE"`, `"HORIZONTAL"`, `"VERTICAL"`, `"BOTH"`.                 |

### `<pt:pen>` (child of objectStyle)

| Attribute | Type   | Description                                          |
|-----------|--------|------------------------------------------------------|
| `style`   | string | `"NULL"` (no pen), `"SOLID"`, `"DASH"`, `"DOT"`.    |
| `widthX`  | string | Horizontal pen width with unit suffix.               |
| `widthY`  | string | Vertical pen width with unit suffix.                 |
| `color`   | string | Hex color.                                           |

### `<pt:brush>` (child of objectStyle)

| Attribute | Type   | Description                                          |
|-----------|--------|------------------------------------------------------|
| `style`   | string | `"NULL"` (no fill), `"SOLID"`, pattern names.        |
| `color`   | string | Hex color.                                           |
| `id`      | string | Brush pattern identifier.                            |

### `<pt:expanded>` (child of objectStyle)

| Attribute              | Type   | Description                                              |
|------------------------|--------|----------------------------------------------------------|
| `objectName`           | string | The reference name of this object. Used for identification. |
| `ID`                   | string | Numeric object identifier.                               |
| `lock`                 | string | `"0"` (unlocked) or `"1"` (locked, not editable).       |
| `templateMergeTarget`  | string | `"LABELLIST"`, `"NONE"`.                                 |
| `templateMergeType`    | string | `"NONE"`, `"TEXT"`, `"BARCODE"`, `"IMAGE"`.              |
| `templateMergeID`      | string | Merge field identifier.                                  |
| `dbMergeFieldStyleName`| string | Database merge field style name. Empty if unused.        |
| `linkStatus`           | string | `"NONE"`, or link status to other objects.               |
| `linkID`               | string | Linked object identifier. `"0"` if not linked.          |

## Object Types

### Text Object: `<text:text>`

```xml
<text:text>
  <pt:objectStyle ... />
  <text:ptFontInfo>
    <text:logFont
      name="Gill Sans"
      width="0.0pt"
      italic="false"
      weight="700"
      charSet="1"
      pitchAndFamily="50"
    />
    <text:fontExt
      effect="NOEFFECT"
      underline="0"
      strikeout="0"
      size="48.00000pt"
      orgSize="48.0pt"
      textColor="#000000"
      textDecoration="NONE"
    />
  </text:ptFontInfo>
  <text:textStyle
    control="AUTOLEN"
    autoLF="false"
    align="LEFT"
    verticalAlignment="TOP"
  />
  <text:textControl ... />
  <pt:data>Your text content here</pt:data>
  <text:stringItem charLen="..." />
</text:text>
```

#### `<text:logFont>` Attributes

| Attribute        | Type   | Description                                                   |
|------------------|--------|---------------------------------------------------------------|
| `name`           | string | Font family name (e.g. `"Gill Sans"`, `"Helsinki"`, `"Arial"`). |
| `width`          | string | Character width with unit suffix. `"0.0pt"` for default/auto. |
| `italic`         | string | `"true"` / `"false"`.                                         |
| `weight`         | string | Font weight. `"400"` = normal, `"700"` = bold. Standard CSS-like numeric weights. |
| `charSet`        | string | Character set code (Windows charset ID). `"0"` = ANSI, `"1"` = default, `"128"` = Shift-JIS, etc. |
| `pitchAndFamily` | string | Pitch and font family (Windows LOGFONT convention). `"2"` is recommended for compatibility. |

#### `<text:fontExt>` Attributes

| Attribute        | Type   | Description                                                   |
|------------------|--------|---------------------------------------------------------------|
| `effect`         | string | `"NOEFFECT"`, `"SHADOW"`, `"OUTLINE"`.                       |
| `underline`      | string | `"0"` (none), `"1"` (underline).                             |
| `strikeout`      | string | `"0"` (none), `"1"` (strikethrough).                         |
| `size`           | string | Font size with unit suffix (e.g. `"48.00000pt"`).            |
| `orgSize`        | string | Original/base font size with unit suffix.                    |
| `textColor`      | string | Hex text color (e.g. `"#000000"`).                           |
| `textDecoration` | string | `"NONE"`, `"UNDERLINE"`, `"STRIKETHROUGH"`.                  |

#### `<text:textStyle>` Attributes

| Attribute           | Type   | Description                                                  |
|---------------------|--------|--------------------------------------------------------------|
| `control`           | string | Text sizing control. `"AUTOLEN"` (auto-size), `"FIXLEN"` (fixed length), `"CLIPLEN"` (clip to bounds). |
| `autoLF`            | string | `"true"` / `"false"`. Automatic line feed / word wrap.       |
| `align`             | string | Horizontal alignment: `"LEFT"`, `"CENTER"`, `"RIGHT"`, `"JUSTIFY"`. |
| `verticalAlignment` | string | Vertical alignment: `"TOP"`, `"MIDDLE"`, `"BOTTOM"`.        |

#### `<pt:data>`

Contains the plain text content of the object. Multi-line text uses literal newlines.

### Barcode Object: `<barcode:barcode>`

```xml
<barcode:barcode>
  <pt:objectStyle ... />
  <barcode:barcodeStyle
    protocol="QRCODE"
    lengths="48"
    zeroFill="false"
    barWidth="1.2pt"
    barRatio="1:3"
    humanReadable="true"
    humanReadableAlignment="LEFT"
    checkDigit="true"
    autoLengths="false"
    margin="false"
    sameLengthBar="false"
    bearerBar="false"
  />
  <pt:data>http://example.com</pt:data>
  <barcode:qrcodeStyle
    model="2"
    eccLevel="15%"
    cellSize="2.0pt"
    mbcs="932"
    removeCharKind="0"
    removeCharString=""
    joint="1"
    jointSpace="8"
    jointVertically="false"
    version="auto"
    changeVersionDrag="false"
  />
</barcode:barcode>
```

#### `<barcode:barcodeStyle>` Attributes

| Attribute                 | Type   | Description                                                      |
|---------------------------|--------|------------------------------------------------------------------|
| `protocol`                | string | Barcode symbology. See table below.                              |
| `lengths`                 | string | Data length. May be number of characters or data-dependent.      |
| `zeroFill`                | string | `"true"` / `"false"`. Pad with leading zeros.                   |
| `barWidth`                | string | Width of narrowest bar with unit suffix.                         |
| `barRatio`                | string | Ratio of wide to narrow bars (e.g. `"1:3"`, `"1:2"`).           |
| `humanReadable`           | string | `"true"` / `"false"`. Show human-readable text below barcode.   |
| `humanReadableAlignment`  | string | `"LEFT"`, `"CENTER"`, `"RIGHT"`.                                |
| `checkDigit`              | string | `"true"` / `"false"`. Include check digit.                      |
| `autoLengths`             | string | `"true"` / `"false"`. Auto-calculate data length.               |
| `margin`                  | string | `"true"` / `"false"`. Include quiet zone margin.                |
| `sameLengthBar`           | string | `"true"` / `"false"`.                                           |
| `bearerBar`               | string | `"true"` / `"false"`. Include bearer bars (ITF barcodes).       |

#### Barcode Protocol Values

| `protocol` value | Symbology             |
|------------------|-----------------------|
| `"CODE39"`       | Code 39               |
| `"CODE128"`      | Code 128              |
| `"ITF"`          | Interleaved 2 of 5    |
| `"CODABAR"`      | Codabar / NW-7        |
| `"EAN13"`        | EAN-13                |
| `"EAN8"`         | EAN-8                 |
| `"UPCA"`         | UPC-A                 |
| `"UPCE"`         | UPC-E                 |
| `"EAN128"`       | GS1-128 (EAN-128)    |
| `"PDF417"`       | PDF417                |
| `"QRCODE"`       | QR Code               |
| `"DATAMATRIX"`   | DataMatrix            |
| `"MAXICODE"`     | MaxiCode              |
| `"POSTNET"`      | POSTNET               |
| `"MICROPDF417"`  | Micro PDF417          |
| `"ISBN"`         | ISBN (EAN-13 variant) |
| `"MSI"`          | MSI/Plessey           |

#### `<barcode:qrcodeStyle>` Attributes (QR Code only)

| Attribute             | Type   | Description                                               |
|-----------------------|--------|-----------------------------------------------------------|
| `model`               | string | QR Code model: `"1"` or `"2"` (model 2 is standard).     |
| `eccLevel`            | string | Error correction level: `"7%"` (L), `"15%"` (M), `"25%"` (Q), `"30%"` (H). |
| `cellSize`            | string | Module/cell size with unit suffix.                        |
| `mbcs`                | string | Multi-byte character set code page (e.g. `"932"` for Shift-JIS). |
| `version`             | string | QR Code version. `"auto"` for automatic.                  |
| `joint`               | string | Joint mode. `"1"` for single QR.                          |
| `jointSpace`          | string | Space between joined QR codes.                            |
| `jointVertically`     | string | `"true"` / `"false"`. Joint direction.                    |
| `changeVersionDrag`   | string | `"true"` / `"false"`. Allow version change on resize.     |

### Image Object: `<image:image>`

```xml
<image:image>
  <pt:objectStyle ... />
  <image:imageStyle
    halftoneType="ERRORDIFFUSION"
    brightness="50"
    contrast="50"
    mode="FIT"
    color="FULLCOLOR"
    effect="NORMAL"
  />
  <image:imageFile fileName="image0.tif" />
</image:image>
```

#### `<image:imageStyle>` Attributes

| Attribute      | Type   | Description                                                         |
|----------------|--------|---------------------------------------------------------------------|
| `halftoneType` | string | `"ERRORDIFFUSION"`, `"PATTERN"`, `"NONE"`. Dithering method.       |
| `brightness`   | string | Brightness level (0–100). `"50"` is default/neutral.               |
| `contrast`     | string | Contrast level (0–100). `"50"` is default/neutral.                 |
| `mode`         | string | Scaling mode: `"FIT"` (fit to bounds maintaining aspect), `"FILL"` (stretch to fill), `"ORIGINAL"` (no scaling). |
| `color`        | string | `"FULLCOLOR"`, `"MONOCHROME"`.                                     |
| `effect`       | string | `"NORMAL"`, `"INVERT"`, etc.                                       |

#### `<image:imageFile>`

| Attribute  | Type   | Description                                                       |
|------------|--------|-------------------------------------------------------------------|
| `fileName` | string | Filename of the image within the ZIP archive (e.g. `"image0.tif"`). |

Supported image formats: TIFF (.tif), BMP (.bmp), and sometimes PNG (.png). TIFF is most common.

### Drawing Objects: `<draw:*>`

Drawing primitives for shapes and lines:

```xml
<draw:rectangle>
  <pt:objectStyle ... />
</draw:rectangle>

<draw:ellipse>
  <pt:objectStyle ... />
</draw:ellipse>

<draw:line>
  <pt:objectStyle ... />
</draw:line>

<draw:roundRectangle>
  <pt:objectStyle ... />
  <draw:roundRectangleStyle rx="5.0pt" ry="5.0pt" />
</draw:roundRectangle>
```

Shape appearance (fill, stroke) is controlled by the `<pt:pen>` and `<pt:brush>` elements within `<pt:objectStyle>`.

For `<draw:roundRectangle>`, the `<draw:roundRectangleStyle>` provides corner radii:

| Attribute | Type   | Description                   |
|-----------|--------|-------------------------------|
| `rx`      | string | Horizontal corner radius.     |
| `ry`      | string | Vertical corner radius.       |

### Table Object: `<table:table>`

Tables are more complex and contain nested text cells. They are less commonly used on small labels but appear on larger formats.

```xml
<table:table>
  <pt:objectStyle ... />
  <table:tableStyle rows="3" columns="2" ... />
  <table:cell row="0" column="0">
    <text:text>...</text:text>
  </table:cell>
  <!-- more cells -->
</table:table>
```

## Coordinate System

- Origin (0,0) is the **top-left corner** of the label.
- X axis increases **rightward**.
- Y axis increases **downward**.
- All coordinates are in points (pt) with the `pt` unit suffix in attribute values.
- Object positions (`x`, `y` in `<pt:objectStyle>`) are relative to the label origin, including margins.
- **Negative coordinates are valid** — objects can be positioned partially outside the label area.

## Common QL Label Sizes

For reference when validating imported labels:

| Label                | Width (pt) | Height (pt) | Width (mm) | Height (mm) | Brother SKU |
|----------------------|------------|-------------|------------|-------------|-------------|
| Standard Address     | 175.7      | 252.3       | 62.0       | 89.0        | DK-11209    |
| Large Address        | 175.7      | 319.8       | 62.0       | 100.0       | DK-11201    |
| Shipping             | 175.7      | 319.8       | 62.0       | 100.0       | DK-11202    |
| Large Shipping       | 277.8      | 575.3       | 102.0      | 152.0       | DK-11241    |
| Continuous 62mm      | 175.7      | auto        | 62.0       | continuous  | DK-22205    |
| Continuous 29mm      | 82.2       | auto        | 29.0       | continuous  | DK-22210    |
| Square 23mm          | 65.2       | 65.2        | 23.0       | 23.0        | DK-11221    |
| Round 12mm           | 34.0       | 34.0        | 12.0       | 12.0        | DK-11219    |

> Note: The `<style:paper>` `width` and `height` attributes are authoritative. Always use those over this table. For continuous labels, `autoLength="true"` and the height is dynamic.

## Import Implementation Notes

1. **Unzip the `.lbx` file.** Use any ZIP library (JSZip, fflate, etc.). Extract `label.xml` (required) and `prop.xml` (optional metadata).
2. **Parse `label.xml`** with a namespace-aware XML parser. All elements are namespaced — use the namespace URIs for lookup, not prefixes (prefixes could theoretically vary, though `pt`, `style`, `text`, etc. are conventional).
3. **Extract label dimensions** from `<style:paper>` `width` and `height` attributes. Parse the `pt` suffix: `parseFloat("175.7pt")` → `175.7`.
4. **Extract margins** from `<style:paper>` `marginLeft`, `marginTop`, `marginRight`, `marginBottom`.
5. **Iterate objects** within `<pt:objects>`. Each child element is a label object.
6. **For each object, read `<pt:objectStyle>`** to get position (`x`, `y`), size (`width`, `height`), rotation (`angle`), and the object name from `<pt:expanded objectName="...">`.
7. **Map object types** to your internal representation:
   - `<text:text>` → Text element
   - `<barcode:barcode>` → Barcode element
   - `<image:image>` → Image element (resolve `fileName` from ZIP archive)
   - `<draw:rectangle>`, `<draw:ellipse>`, `<draw:line>` → Shape elements
8. **Parse dimension strings** — all dimension values include the unit suffix: `"175.7pt"`, `"48.00000pt"`, `"0.50pt"`. Strip the unit and parse the float.
9. **Convert coordinates** from points to your internal unit system.
10. **Extract embedded images** from the ZIP archive using the `fileName` from `<image:imageFile>`. Convert from TIF/BMP to your preferred format.
11. **Handle text content** — text content is in `<pt:data>` elements within text objects.
12. **Handle font info** — combine `<text:logFont>` and `<text:fontExt>` to reconstruct font family, size, weight, and style.

## Export Implementation Notes

1. **Create a ZIP archive** with `label.xml` and `prop.xml` at the root level.
2. **Namespace declarations** on the root `<pt:document>` element are required. Include all namespace URIs even if not all object types are used — P-touch Editor expects them.
3. **Element order within `label.xml` is critical.** P-touch Editor may crash or fail to load files if XML elements are reordered. Maintain the exact order as documented in this specification: `pt:document` → `pt:body` → `style:sheet` → `style:paper` → `style:cutLine` → `style:backGround` → `pt:objects` → objects.
4. **Within each object, maintain element order.** `<pt:objectStyle>` should come first, followed by type-specific style elements, then `<pt:data>` content.
5. **Dimension values must include the `pt` suffix** (e.g. `"175.7pt"`, not `"175.7"`).
6. **Colors are hex strings** with `#` prefix (e.g. `"#000000"`, `"#FFFFFF"`). No alpha channel in hex — use separate opacity attributes where available.
7. **Images** should be saved as TIFF files within the ZIP archive for maximum compatibility. Reference them in `<image:imageFile fileName="image0.tif" />`.
8. **`prop.xml`** should include at minimum the `<pt:application>` element with your application name/version, and `<pt:defaultPrinter>` if a target printer is known.
9. **For text compatibility with P-touch Editor**, the `jdlien/lbx-utils` project recommends using font `"Helsinki"` with `pitchAndFamily="2"`, `size="21.7pt"`, and `orgSize="28.8pt"`, `control="AUTOLEN"`, `autoLF="false"`, `verticalAlignment="TOP"`, and a background width of `"34.4pt"`. These are safe defaults for round-trip compatibility.
10. **Set the `.lbx` extension** on the output file.

## Quirks and Gotchas

- **Element order matters.** This cannot be overstated. P-touch Editor 5.x will crash or silently discard content if elements are in unexpected order.
- **Boolean values** are lowercase strings `"true"` and `"false"` (unlike Dymo which uses `"True"` / `"False"`).
- **Dimension strings** always include the unit suffix, unlike Dymo where values are bare numbers.
- **Font name `"Helsinki"`** is a Brother-specific font bundled with P-touch Editor. It's the safest default for export. When importing, map it to a similar sans-serif font.
- **The `<pt:data>` element** is used for both text content and barcode data. Its meaning is context-dependent on the parent object type.
- **Multi-line text** uses literal newlines within `<pt:data>`.
- **P-touch Editor versions** (5.x, 6.x) may introduce additional attributes. Unknown attributes should be preserved during round-trip if possible, or safely ignored during import.

## Reference Implementations

- **`jdlien/lbx-utils`** (Python) — Parse, create, modify, and extract data from LBX files. Includes XSD schema files and template labels. Best available reference. https://github.com/jdlien/lbx-utils
- **`Alecto3-D/brother-p-touch-editor-format`** — Minimal reverse-engineering documentation with sample `label.xml` and `prop.xml` from a QL-700. https://github.com/Alecto3-D/brother-p-touch-editor-format
- **Archive Team File Format Wiki** — Brief overview of the format. http://fileformats.archiveteam.org/wiki/P-touch_Editor_Label

/**
 * Shape registry — data-driven definitions for decorative shapes and borders.
 *
 * Each definition carries one drawing function (`renderPath`) that paints
 * the shape on a 2D canvas at object-local origin (0, 0). The same function
 * is rasterised to a PNG asset on insert, so the Konva canvas and the
 * designer-core 1bpp render pipeline see identical pixels.
 */

export type ShapeCategory = 'basic' | 'decorative' | 'border';

export interface ShapeDefinition {
  /** Stable id, e.g. `heart`, `border-simple`. Embedded in the object name. */
  id: string;
  /** Localisation key fragment under `shapes.*.<id>`. */
  labelKey: string;
  category: ShapeCategory;
  /** SVG path data shown in the picker grid (24×24 viewbox). */
  iconPath: string;
  /**
   * Default canvas-space dimensions when inserted on a label.
   * For borders this is ignored — they take the canvas dimensions.
   */
  defaultWidth: number;
  defaultHeight: number;
  /** True for borders that must scale to the label canvas. */
  isBorder?: boolean;
  /**
   * Draw the shape on a 2D context, filling the rectangle (0, 0, w, h).
   * Must be deterministic — the same w, h must produce the same pixels.
   * The implementation owns its colour: use `#000` for thermal-black ink.
   */
  renderPath: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

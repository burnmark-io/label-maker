import type { ShapeDefinition } from './types';
import { DECORATIVE_SHAPES } from './decorative';
import { BORDERS } from './borders';

/**
 * The full shape catalogue. Basic shapes (rectangle/ellipse/line) are NOT
 * in this registry — they map directly to designer-core's `ShapeObject`
 * subtypes and are inserted as native shape objects, not rasterised images.
 *
 * Categories used by the picker:
 *   - `decorative`: heart, star, diamond, arrow, badge, ribbon
 *   - `border`:     simple, classical, playful, dotted (auto-resize)
 */
export const SHAPE_REGISTRY: ShapeDefinition[] = [...DECORATIVE_SHAPES, ...BORDERS];

export function findShape(id: string): ShapeDefinition | undefined {
  return SHAPE_REGISTRY.find(s => s.id === id);
}

/** Object name prefix that marks an object as registry-rendered. */
export const SHAPE_NAME_PREFIX = 'shape:';
/** Object name prefix for borders (sub-prefix of `shape:`). */
export const BORDER_NAME_PREFIX = 'shape:border:';

/**
 * Name an object so we can find it later — borders need to re-rasterise
 * on canvas resize, decorative shapes don't but we still mark them so the
 * objects panel can label them sensibly.
 */
export function nameForShape(def: ShapeDefinition): string {
  return def.isBorder
    ? `${BORDER_NAME_PREFIX}${def.id.replace(/^border-/, '')}`
    : `${SHAPE_NAME_PREFIX}${def.id}`;
}

/** Return the shape id encoded in an object name, if any. */
export function shapeIdFromName(name: string | undefined): string | null {
  if (!name) return null;
  if (name.startsWith(BORDER_NAME_PREFIX)) {
    return `border-${name.slice(BORDER_NAME_PREFIX.length)}`;
  }
  if (name.startsWith(SHAPE_NAME_PREFIX)) {
    return name.slice(SHAPE_NAME_PREFIX.length);
  }
  return null;
}

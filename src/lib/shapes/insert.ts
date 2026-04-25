import type { ImageObject } from '@burnmark-io/designer-core';
import type { useDesignerStore } from '@/stores/designer';
import type { ShapeDefinition } from './types';
import { nameForShape, BORDER_NAME_PREFIX, findShape, shapeIdFromName } from './registry';
import { rasteriseShape } from './render';

type DesignerStore = ReturnType<typeof useDesignerStore>;

/**
 * Insert a shape from the registry. Decorative shapes drop near the
 * canvas centre; borders snap to the full canvas. Borders are
 * single-instance per label — adding a second border replaces the first.
 *
 * Returns the new object id, or `null` if the canvas has no resolvable
 * size (unbounded continuous label without height).
 */
export async function insertRegistryShape(
  designer: DesignerStore,
  def: ShapeDefinition,
): Promise<string | null> {
  const canvas = designer.document.canvas;
  const labelWidth = canvas.widthDots;
  const labelHeight = canvas.heightDots;
  const effectiveHeight = labelHeight > 0 ? labelHeight : Math.max(240, def.defaultHeight);

  if (def.isBorder) {
    if (labelWidth <= 0) return null;
    return upsertBorder(designer, def, labelWidth, effectiveHeight);
  }
  return insertDecorative(designer, def, labelWidth, effectiveHeight);
}

async function insertDecorative(
  designer: DesignerStore,
  def: ShapeDefinition,
  labelWidth: number,
  labelHeight: number,
): Promise<string> {
  const w = Math.min(def.defaultWidth, labelWidth * 0.9);
  const aspect = def.defaultHeight / def.defaultWidth;
  const h = w * aspect;
  const x = Math.max(0, Math.round((labelWidth - w) / 2));
  const y = Math.max(0, Math.round((labelHeight - h) / 2));
  const assetKey = await rasteriseShape(def, w, h, designer.assetLoader);
  return designer.addObject<ImageObject>({
    type: 'image',
    name: nameForShape(def),
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#1c1917',
    assetKey,
    fit: 'contain',
    threshold: 128,
    dither: false,
    invert: false,
  });
}

async function upsertBorder(
  designer: DesignerStore,
  def: ShapeDefinition,
  labelWidth: number,
  labelHeight: number,
): Promise<string> {
  const assetKey = await rasteriseShape(def, labelWidth, labelHeight, designer.assetLoader);
  const targetName = nameForShape(def);
  const existing = designer.document.objects.find(
    (o) => o.name && o.name.startsWith(BORDER_NAME_PREFIX),
  );
  if (existing) {
    designer.updateObject(existing.id, {
      name: targetName,
      x: 0,
      y: 0,
      width: labelWidth,
      height: labelHeight,
      ...({ assetKey, fit: 'fill' } as Partial<ImageObject>),
    });
    designer.select([existing.id]);
    return existing.id;
  }
  return designer.addObject<ImageObject>({
    type: 'image',
    name: targetName,
    x: 0,
    y: 0,
    width: labelWidth,
    height: labelHeight,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#1c1917',
    assetKey,
    fit: 'fill',
    threshold: 128,
    dither: false,
    invert: false,
  });
}

/**
 * Re-rasterise the active border (if any) at the given dimensions and
 * update its image object in place. Used by `useBorderResize` when the
 * label canvas dimensions change.
 */
export async function refreshBorder(
  designer: DesignerStore,
  width: number,
  height: number,
): Promise<void> {
  if (width <= 0 || height <= 0) return;
  const existing = designer.document.objects.find(
    (o) => o.name && o.name.startsWith(BORDER_NAME_PREFIX),
  );
  if (!existing || existing.type !== 'image') return;
  const id = shapeIdFromName(existing.name);
  if (!id) return;
  const def = findShape(id);
  if (!def) return;
  const assetKey = await rasteriseShape(def, width, height, designer.assetLoader);
  designer.updateObject(existing.id, {
    x: 0,
    y: 0,
    width,
    height,
    ...({ assetKey, fit: 'fill' } as Partial<ImageObject>),
  });
}

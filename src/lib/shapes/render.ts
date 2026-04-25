import type { AssetLoader } from '@burnmark-io/designer-core';
import type { ShapeDefinition } from './types';

/** Maximum pixel dimension when rasterising a shape into a PNG asset. */
const MAX_RASTER_DIMENSION = 1600;

/**
 * Rasterise a shape definition at the requested label-space size and store
 * the resulting PNG via the asset loader. Returns the asset key.
 *
 * The shape's `renderPath` paints directly onto a transparent canvas
 * sized to (width, height). For very large borders we cap to
 * `MAX_RASTER_DIMENSION` and let the image renderer scale on output.
 */
export async function rasteriseShape(
  def: ShapeDefinition,
  width: number,
  height: number,
  assetLoader: AssetLoader,
): Promise<string> {
  const longest = Math.max(width, height);
  const scale = longest > MAX_RASTER_DIMENSION ? MAX_RASTER_DIMENSION / longest : 1;
  const w = Math.max(8, Math.round(width * scale));
  const h = Math.max(8, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create 2D context for shape rasterisation');
  def.renderPath(ctx, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
  if (!blob) throw new Error('Failed to encode shape PNG');
  const buffer = await blob.arrayBuffer();
  return assetLoader.store(new Uint8Array(buffer));
}

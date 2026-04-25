import type { ShapeDefinition } from './types';

const INK = '#000000';

function fill(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = INK;
  ctx.fill();
}

export const HEART: ShapeDefinition = {
  id: 'heart',
  labelKey: 'heart',
  category: 'decorative',
  iconPath:
    'M12 21s-6.5-4.35-9-8.5C1.5 9 3.5 5 7.5 5c2 0 3.5 1 4.5 2.5C13 6 14.5 5 16.5 5 20.5 5 22.5 9 21 12.5 18.5 16.65 12 21 12 21z',
  defaultWidth: 200,
  defaultHeight: 180,
  renderPath(ctx, w, h) {
    // Two cusps at the top, point at the bottom. Built from cubic curves
    // sized in unit space and scaled to (w, h). The numbers are tuned so
    // the silhouette reads as a "heart" at small thermal-label sizes.
    ctx.save();
    ctx.beginPath();
    const sx = w;
    const sy = h;
    ctx.moveTo(0.5 * sx, 0.95 * sy);
    ctx.bezierCurveTo(0.5 * sx, 0.7 * sy, 0.95 * sx, 0.55 * sy, 0.95 * sx, 0.32 * sy);
    ctx.bezierCurveTo(0.95 * sx, 0.1 * sy, 0.7 * sx, -0.02 * sy, 0.5 * sx, 0.2 * sy);
    ctx.bezierCurveTo(0.3 * sx, -0.02 * sy, 0.05 * sx, 0.1 * sy, 0.05 * sx, 0.32 * sy);
    ctx.bezierCurveTo(0.05 * sx, 0.55 * sy, 0.5 * sx, 0.7 * sy, 0.5 * sx, 0.95 * sy);
    ctx.closePath();
    fill(ctx);
    ctx.restore();
  },
};

export const STAR: ShapeDefinition = {
  id: 'star',
  labelKey: 'star',
  category: 'decorative',
  iconPath: 'M12 2l2.9 6.95L22 10l-5.5 4.7 1.7 7.3L12 18.3 5.8 22l1.7-7.3L2 10l7.1-1.05L12 2z',
  defaultWidth: 200,
  defaultHeight: 200,
  renderPath(ctx, w, h) {
    // Classic 5-point star. Centre on (w/2, h/2), inscribed in min(w,h).
    ctx.save();
    const cx = w / 2;
    const cy = h / 2;
    const rOuter = Math.min(w, h) / 2;
    const rInner = rOuter * 0.42;
    const points = 5;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    fill(ctx);
    ctx.restore();
  },
};

export const DIAMOND: ShapeDefinition = {
  id: 'diamond',
  labelKey: 'diamond',
  category: 'decorative',
  iconPath: 'M12 2l10 10-10 10L2 12 12 2z',
  defaultWidth: 180,
  defaultHeight: 180,
  renderPath(ctx, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w, h / 2);
    ctx.lineTo(w / 2, h);
    ctx.lineTo(0, h / 2);
    ctx.closePath();
    fill(ctx);
    ctx.restore();
  },
};

export const ARROW: ShapeDefinition = {
  id: 'arrow',
  labelKey: 'arrow',
  category: 'decorative',
  iconPath: 'M3 12h14M13 6l6 6-6 6',
  defaultWidth: 240,
  defaultHeight: 120,
  renderPath(ctx, w, h) {
    // Right-pointing block arrow. Shaft is 60% of height, head extends
    // top and bottom by 20% each.
    ctx.save();
    const shaft = h * 0.6;
    const shaftTop = (h - shaft) / 2;
    const headWidth = Math.min(w * 0.35, h);
    const shaftEnd = w - headWidth;
    ctx.beginPath();
    ctx.moveTo(0, shaftTop);
    ctx.lineTo(shaftEnd, shaftTop);
    ctx.lineTo(shaftEnd, 0);
    ctx.lineTo(w, h / 2);
    ctx.lineTo(shaftEnd, h);
    ctx.lineTo(shaftEnd, shaftTop + shaft);
    ctx.lineTo(0, shaftTop + shaft);
    ctx.closePath();
    fill(ctx);
    ctx.restore();
  },
};

export const BADGE: ShapeDefinition = {
  id: 'badge',
  labelKey: 'badge',
  category: 'decorative',
  iconPath:
    'M12 2l2.5 2.5L18 4l.5 3.5L22 9l-1.5 3L22 15l-3.5 1.5L18 20l-3.5-.5L12 22l-2.5-2.5L6 20l-.5-3.5L2 15l1.5-3L2 9l3.5-1.5L6 4l3.5.5L12 2z',
  defaultWidth: 200,
  defaultHeight: 200,
  renderPath(ctx, w, h) {
    // 12-point starburst — looks like a quality seal / "new" badge.
    ctx.save();
    const cx = w / 2;
    const cy = h / 2;
    const rOuter = Math.min(w, h) / 2;
    const rInner = rOuter * 0.85;
    const points = 12;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    fill(ctx);
    // Inner ring to suggest a stamped look. Negative-space via even-odd
    // would require a different fill rule; instead, draw a thick stroke
    // inside with white — but on thermal we only have one ink. So we
    // skip the ring and rely on the burst silhouette alone.
    ctx.restore();
  },
};

export const RIBBON: ShapeDefinition = {
  id: 'ribbon',
  labelKey: 'ribbon',
  category: 'decorative',
  iconPath:
    'M4 4h16l-2 5 2 5h-6l-2 4-2-4H4l2-5-2-5z',
  defaultWidth: 280,
  defaultHeight: 120,
  renderPath(ctx, w, h) {
    // Banner ribbon with V-notched ends — leaves a horizontal band in
    // the middle for placing text on top.
    ctx.save();
    const notch = h * 0.25;
    const tail = w * 0.1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w - tail, h / 2);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.lineTo(tail, h / 2);
    ctx.closePath();
    fill(ctx);
    // Two darker triangles where the ribbon "folds back" — represented
    // as cut-out notches at the ends. On a single-ink thermal target,
    // we skip the fold detail and keep the silhouette clean.
    void notch;
    ctx.restore();
  },
};

export const DECORATIVE_SHAPES: ShapeDefinition[] = [
  HEART,
  STAR,
  DIAMOND,
  ARROW,
  BADGE,
  RIBBON,
];

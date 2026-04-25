import type { ShapeDefinition } from './types';

const INK = '#000000';

/**
 * Border presets — frame-style decorative shapes that wrap the entire label.
 * Each border draws into a transparent rectangle of size (w, h) using only
 * the perimeter — the centre stays empty so other objects show through.
 */

export const BORDER_SIMPLE: ShapeDefinition = {
  id: 'border-simple',
  labelKey: 'simple',
  category: 'border',
  iconPath: 'M4 4h16v16H4z',
  defaultWidth: 0,
  defaultHeight: 0,
  isBorder: true,
  renderPath(ctx, w, h) {
    // Single rounded rectangle stroke at 4% inset.
    const inset = Math.max(6, Math.min(w, h) * 0.04);
    const radius = Math.min(w, h) * 0.06;
    const lineWidth = Math.max(2, Math.min(w, h) * 0.012);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = lineWidth;
    roundedRect(ctx, inset, inset, w - inset * 2, h - inset * 2, radius);
    ctx.stroke();
    ctx.restore();
  },
};

export const BORDER_CLASSICAL: ShapeDefinition = {
  id: 'border-classical',
  labelKey: 'classical',
  category: 'border',
  iconPath: 'M4 4h16v16H4zM7 7h10v10H7z',
  defaultWidth: 0,
  defaultHeight: 0,
  isBorder: true,
  renderPath(ctx, w, h) {
    // Double-line frame with corner flourishes — "wedding invitation" feel.
    const outerInset = Math.max(6, Math.min(w, h) * 0.03);
    const gap = Math.max(3, Math.min(w, h) * 0.012);
    const innerInset = outerInset + gap;
    const outerLine = Math.max(2, Math.min(w, h) * 0.012);
    const innerLine = Math.max(1, outerLine * 0.5);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    // Outer frame
    ctx.lineWidth = outerLine;
    ctx.strokeRect(outerInset, outerInset, w - outerInset * 2, h - outerInset * 2);
    // Inner frame
    ctx.lineWidth = innerLine;
    ctx.strokeRect(innerInset, innerInset, w - innerInset * 2, h - innerInset * 2);
    // Corner flourishes — short diagonal accents pointing inward
    const flourish = Math.min(w, h) * 0.05;
    const c = innerInset + gap;
    ctx.lineWidth = innerLine;
    drawCornerFlourish(ctx, c, c, flourish, 1, 1);
    drawCornerFlourish(ctx, w - c, c, flourish, -1, 1);
    drawCornerFlourish(ctx, c, h - c, flourish, 1, -1);
    drawCornerFlourish(ctx, w - c, h - c, flourish, -1, -1);
    ctx.restore();
  },
};

export const BORDER_PLAYFUL: ShapeDefinition = {
  id: 'border-playful',
  labelKey: 'playful',
  category: 'border',
  iconPath:
    'M4 8c2-3 4-3 6 0s4 3 6 0 4-3 4 0v8c-2 3-4 3-6 0s-4-3-6 0-4 3-4 0V8z',
  defaultWidth: 0,
  defaultHeight: 0,
  isBorder: true,
  renderPath(ctx, w, h) {
    // Scalloped edge — shallow semicircles around the perimeter.
    const inset = Math.max(8, Math.min(w, h) * 0.04);
    const lineWidth = Math.max(2, Math.min(w, h) * 0.012);
    const targetScallop = Math.max(18, Math.min(w, h) * 0.06);
    const innerW = w - inset * 2;
    const innerH = h - inset * 2;
    const cols = Math.max(4, Math.round(innerW / targetScallop));
    const rows = Math.max(4, Math.round(innerH / targetScallop));
    const stepX = innerW / cols;
    const stepY = innerH / rows;
    const radiusX = stepX / 2;
    const radiusY = stepY / 2;
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    // Top edge — left to right, scalloping outward (away from centre)
    for (let i = 0; i < cols; i++) {
      const cx = inset + stepX * (i + 0.5);
      ctx.moveTo(cx - radiusX, inset);
      ctx.arc(cx, inset, radiusX, Math.PI, 0, false);
    }
    // Right edge
    for (let i = 0; i < rows; i++) {
      const cy = inset + stepY * (i + 0.5);
      ctx.moveTo(w - inset, cy - radiusY);
      ctx.arc(w - inset, cy, radiusY, -Math.PI / 2, Math.PI / 2, false);
    }
    // Bottom edge
    for (let i = 0; i < cols; i++) {
      const cx = inset + stepX * (i + 0.5);
      ctx.moveTo(cx + radiusX, h - inset);
      ctx.arc(cx, h - inset, radiusX, 0, Math.PI, false);
    }
    // Left edge
    for (let i = 0; i < rows; i++) {
      const cy = inset + stepY * (i + 0.5);
      ctx.moveTo(inset, cy + radiusY);
      ctx.arc(inset, cy, radiusY, Math.PI / 2, -Math.PI / 2, false);
    }
    ctx.stroke();
    ctx.restore();
  },
};

export const BORDER_DOTTED: ShapeDefinition = {
  id: 'border-dotted',
  labelKey: 'dotted',
  category: 'border',
  iconPath: 'M5 4h2v2H5zM11 4h2v2h-2zM17 4h2v2h-2zM5 18h2v2H5zM17 18h2v2h-2zM5 11h2v2H5zM17 11h2v2h-2z',
  defaultWidth: 0,
  defaultHeight: 0,
  isBorder: true,
  renderPath(ctx, w, h) {
    // Dotted perimeter — small filled circles spaced evenly along all
    // four edges. Reads cleanly at 1bpp.
    const inset = Math.max(8, Math.min(w, h) * 0.04);
    const dotRadius = Math.max(2, Math.min(w, h) * 0.012);
    const targetSpacing = dotRadius * 5;
    const innerW = w - inset * 2;
    const innerH = h - inset * 2;
    const cols = Math.max(4, Math.round(innerW / targetSpacing));
    const rows = Math.max(4, Math.round(innerH / targetSpacing));
    const stepX = innerW / cols;
    const stepY = innerH / rows;
    ctx.save();
    ctx.fillStyle = INK;
    // Corners + horizontal edges
    for (let i = 0; i <= cols; i++) {
      dot(ctx, inset + stepX * i, inset, dotRadius);
      dot(ctx, inset + stepX * i, h - inset, dotRadius);
    }
    // Vertical edges (excluding corners already drawn)
    for (let i = 1; i < rows; i++) {
      dot(ctx, inset, inset + stepY * i, dotRadius);
      dot(ctx, w - inset, inset + stepY * i, dotRadius);
    }
    ctx.restore();
  },
};

export const BORDERS: ShapeDefinition[] = [
  BORDER_SIMPLE,
  BORDER_CLASSICAL,
  BORDER_PLAYFUL,
  BORDER_DOTTED,
];

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCornerFlourish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  dx: number,
  dy: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + dx * size, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + dy * size);
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

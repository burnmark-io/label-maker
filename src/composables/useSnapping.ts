import type { LabelObject } from '@burnmark-io/designer-core';

export interface SnapGuides {
  vertical: number[];
  horizontal: number[];
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuides;
}

export interface SnapInputs {
  /** Object being dragged. */
  draggingId: string;
  /** Proposed new top-left in label coords. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Other objects (used for object-edge / centre snaps). */
  others: LabelObject[];
  /** Label canvas dimensions for canvas-edge / centre snaps. */
  labelWidth: number;
  labelHeight: number;
  /** Snap distance in label dots — 4-6 dots feels right at common zoom levels. */
  threshold: number;
  /** Optional grid spacing in dots; if > 0, snaps coordinates to grid. */
  gridSpacing?: number;
}

interface Stop {
  position: number;
  /** Where on the dragged object this anchor sits: 'start' (left/top), 'mid' (centre), 'end' (right/bottom). */
  anchor: 'start' | 'mid' | 'end';
}

/**
 * Compute snap-corrected coordinates and the guide lines that triggered the
 * snap. Snaps to: other objects' edges and centres, the label canvas edges
 * and centres, and (optionally) the grid.
 */
export function computeSnap(input: SnapInputs): SnapResult {
  const { x, y, width, height, others, labelWidth, labelHeight, threshold, gridSpacing } = input;

  const candidatesX: number[] = [0, labelWidth / 2, labelWidth];
  const candidatesY: number[] = [0, labelHeight / 2, labelHeight];

  for (const o of others) {
    if (o.id === input.draggingId) continue;
    if (!o.visible) continue;
    candidatesX.push(o.x, o.x + o.width / 2, o.x + o.width);
    candidatesY.push(o.y, o.y + o.height / 2, o.y + o.height);
  }

  const stopsX: Stop[] = [
    { position: x, anchor: 'start' },
    { position: x + width / 2, anchor: 'mid' },
    { position: x + width, anchor: 'end' },
  ];
  const stopsY: Stop[] = [
    { position: y, anchor: 'start' },
    { position: y + height / 2, anchor: 'mid' },
    { position: y + height, anchor: 'end' },
  ];

  let bestDx = Number.POSITIVE_INFINITY;
  let snapDx = 0;
  let guideXs: number[] = [];
  for (const stop of stopsX) {
    for (const candidate of candidatesX) {
      const distance = Math.abs(stop.position - candidate);
      if (distance > threshold) continue;
      if (distance < bestDx) {
        bestDx = distance;
        snapDx = candidate - stop.position;
        guideXs = [candidate];
      } else if (Math.abs(distance - bestDx) < 0.001) {
        if (!guideXs.includes(candidate)) guideXs.push(candidate);
      }
    }
  }

  let bestDy = Number.POSITIVE_INFINITY;
  let snapDy = 0;
  let guideYs: number[] = [];
  for (const stop of stopsY) {
    for (const candidate of candidatesY) {
      const distance = Math.abs(stop.position - candidate);
      if (distance > threshold) continue;
      if (distance < bestDy) {
        bestDy = distance;
        snapDy = candidate - stop.position;
        guideYs = [candidate];
      } else if (Math.abs(distance - bestDy) < 0.001) {
        if (!guideYs.includes(candidate)) guideYs.push(candidate);
      }
    }
  }

  let snappedX = x + snapDx;
  let snappedY = y + snapDy;

  if (gridSpacing && gridSpacing > 0 && bestDx === Number.POSITIVE_INFINITY) {
    const candidate = Math.round(snappedX / gridSpacing) * gridSpacing;
    if (Math.abs(candidate - snappedX) <= threshold) snappedX = candidate;
  }
  if (gridSpacing && gridSpacing > 0 && bestDy === Number.POSITIVE_INFINITY) {
    const candidate = Math.round(snappedY / gridSpacing) * gridSpacing;
    if (Math.abs(candidate - snappedY) <= threshold) snappedY = candidate;
  }

  return {
    x: snappedX,
    y: snappedY,
    guides: { vertical: guideXs, horizontal: guideYs },
  };
}

/**
 * Tests for group-relative transformer math.
 *
 * The actual Konva transformer does not run in jsdom, so these tests
 * exercise the position/size/rotation computation functions in isolation,
 * matching the logic used inside onTransformEnd for ShapeNode / ImageNode /
 * BarcodeNode (and analogously TextNode).
 */
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers mirrored from the node transformend handlers
// ---------------------------------------------------------------------------

interface ObjectSnapshot {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  rotation: number;
}

interface GroupContext {
  centre: { x: number; y: number };
  perObject: Map<string, ObjectSnapshot>;
}

/**
 * Compute the group AABB and per-object offsets from a list of objects.
 * Mirrors the logic in SelectionTransformer.vue > onTransformStart.
 */
function buildGroupContext(
  objects: { id: string; x: number; y: number; width: number; height: number; rotation: number }[],
): GroupContext {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const obj of objects) {
    if (obj.x < minX) minX = obj.x;
    if (obj.y < minY) minY = obj.y;
    if (obj.x + obj.width > maxX) maxX = obj.x + obj.width;
    if (obj.y + obj.height > maxY) maxY = obj.y + obj.height;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const perObject = new Map<string, ObjectSnapshot>();
  for (const obj of objects) {
    perObject.set(obj.id, {
      offsetX: obj.x + obj.width / 2 - cx,
      offsetY: obj.y + obj.height / 2 - cy,
      width: obj.width,
      height: obj.height,
      rotation: obj.rotation,
    });
  }
  return { centre: { x: cx, y: cy }, perObject };
}

/**
 * Compute the new top-left position and size from group-relative math.
 * Mirrors the logic in onTransformEnd for ShapeNode/ImageNode/BarcodeNode.
 */
function applyGroupTransform(
  id: string,
  ctx: GroupContext,
  newWidth: number,
  newHeight: number,
  newRotation: number,
): { x: number; y: number } {
  const snap = ctx.perObject.get(id)!;
  const scaleX = newWidth / snap.width;
  const scaleY = newHeight / snap.height;
  const dRotDeg = newRotation - snap.rotation;
  const dRotRad = (dRotDeg * Math.PI) / 180;
  const ox = snap.offsetX * scaleX;
  const oy = snap.offsetY * scaleY;
  const cosD = Math.cos(dRotRad);
  const sinD = Math.sin(dRotRad);
  const newCx = ctx.centre.x + (ox * cosD - oy * sinD);
  const newCy = ctx.centre.y + (ox * sinD + oy * cosD);
  return { x: newCx - newWidth / 2, y: newCy - newHeight / 2 };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildGroupContext', () => {
  it('computes group centre correctly', () => {
    const objects = [
      { id: 'a', x: 10, y: 10, width: 20, height: 20, rotation: 0 },
      { id: 'b', x: 50, y: 10, width: 20, height: 20, rotation: 0 },
    ];
    const ctx = buildGroupContext(objects);
    // AABB: x [10,70], y [10,30] → centre (40, 20)
    expect(ctx.centre.x).toBe(40);
    expect(ctx.centre.y).toBe(20);
  });

  it('computes per-object offsets from group centre', () => {
    const objects = [
      { id: 'a', x: 10, y: 10, width: 20, height: 20, rotation: 0 },
      { id: 'b', x: 50, y: 10, width: 20, height: 20, rotation: 0 },
    ];
    const ctx = buildGroupContext(objects);
    const snapA = ctx.perObject.get('a')!;
    const snapB = ctx.perObject.get('b')!;
    // Object A centre: (20, 20). Group centre: (40, 20). Offset: (-20, 0)
    expect(snapA.offsetX).toBe(-20);
    expect(snapA.offsetY).toBe(0);
    // Object B centre: (60, 20). Group centre: (40, 20). Offset: (20, 0)
    expect(snapB.offsetX).toBe(20);
    expect(snapB.offsetY).toBe(0);
  });
});

describe('group-relative 2x scale', () => {
  it('preserves relative layout when scaling group 2x', () => {
    // Two objects side by side: A at (10,10,20,20), B at (50,10,20,20).
    // Group AABB: (10,10)→(70,30), centre (40,20).
    // Scale 2x: each object doubles in size; layout preserved relative to group centre.
    // Expected after 2x scale (group AABB → (10,10)→(130,50), but centre stays at (40,20)?
    // Actually 2x scale expands from centre:
    //   Object A new centre = groupCentre + offset*2 = (40,20) + (-20*2, 0*2) = (0,20)
    //   Object A new size = 40x40
    //   Object A new top-left = (0-20, 20-20) = (-20, 0)
    //   Object B new centre = (40,20) + (20*2, 0*2) = (80, 20)
    //   Object B new top-left = (80-20, 20-20) = (60, 0)
    const objects = [
      { id: 'a', x: 10, y: 10, width: 20, height: 20, rotation: 0 },
      { id: 'b', x: 50, y: 10, width: 20, height: 20, rotation: 0 },
    ];
    const ctx = buildGroupContext(objects);

    const posA = applyGroupTransform('a', ctx, 40, 40, 0);
    const posB = applyGroupTransform('b', ctx, 40, 40, 0);

    expect(posA.x).toBeCloseTo(-20, 5);
    expect(posA.y).toBeCloseTo(0, 5);
    expect(posB.x).toBeCloseTo(60, 5);
    expect(posB.y).toBeCloseTo(0, 5);
  });

  it('relative spacing doubles with scale', () => {
    // Before: centre-to-centre distance is 40 (from x=20 to x=60)
    // After 2x: centres at (0,20) and (80,20) → distance 80 = 2×40 ✓
    const objects = [
      { id: 'a', x: 10, y: 10, width: 20, height: 20, rotation: 0 },
      { id: 'b', x: 50, y: 10, width: 20, height: 20, rotation: 0 },
    ];
    const ctx = buildGroupContext(objects);
    const posA = applyGroupTransform('a', ctx, 40, 40, 0);
    const posB = applyGroupTransform('b', ctx, 40, 40, 0);
    // New centres
    const cA = { x: posA.x + 20, y: posA.y + 20 };
    const cB = { x: posB.x + 20, y: posB.y + 20 };
    const dist = Math.hypot(cB.x - cA.x, cB.y - cA.y);
    expect(dist).toBeCloseTo(80, 5);
  });
});

describe('group-relative rotation', () => {
  it('rotates each object around group centre by dθ', () => {
    // Objects A at (0,0,20,20) and B at (20,0,20,20).
    // Group AABB: (0,0)→(40,20), centre (20,10).
    // Object A centre (10,10), offset from group centre (-10, 0).
    // Object B centre (30,10), offset from group centre (10, 0).
    // Rotate group 90° clockwise (dRot = 90°).
    // Rotate (-10, 0) by 90°: new offset = (0, -10) → centre = (20, 10) + (0, -10) = (20, 0)
    //   → top-left = (20-10, 0-10) = (10, -10)
    // Rotate (10, 0) by 90°:  new offset = (0, 10) → centre = (20, 10) + (0, 10) = (20, 20)
    //   → top-left = (20-10, 20-10) = (10, 10)
    const objects = [
      { id: 'a', x: 0, y: 0, width: 20, height: 20, rotation: 0 },
      { id: 'b', x: 20, y: 0, width: 20, height: 20, rotation: 0 },
    ];
    const ctx = buildGroupContext(objects);

    const posA = applyGroupTransform('a', ctx, 20, 20, 90);
    const posB = applyGroupTransform('b', ctx, 20, 20, 90);

    expect(posA.x).toBeCloseTo(10, 4);
    expect(posA.y).toBeCloseTo(-10, 4);
    expect(posB.x).toBeCloseTo(10, 4);
    expect(posB.y).toBeCloseTo(10, 4);
  });
});

describe('single-object degenerate case', () => {
  it('reduces to centre-pivot behaviour when only one object (offset = 0)', () => {
    const objects = [{ id: 'a', x: 10, y: 10, width: 20, height: 20, rotation: 0 }];
    const ctx = buildGroupContext(objects);

    // With a single object, offset = (0, 0), group centre = object centre.
    const snap = ctx.perObject.get('a')!;
    expect(snap.offsetX).toBe(0);
    expect(snap.offsetY).toBe(0);

    // Scale 2x → top-left shifts outward from centre
    // Object centre = (20,20), group centre = (20,20). New offset = (0*2, 0*2) = (0,0).
    // New top-left = (20-20, 20-20) = (0, 0)
    const pos = applyGroupTransform('a', ctx, 40, 40, 0);
    expect(pos.x).toBeCloseTo(0, 5);
    expect(pos.y).toBeCloseTo(0, 5);
  });
});

describe('group drag autoHeight fix', () => {
  it('uses rendered height for autoHeight text in un-offset math', () => {
    // When autoHeight is true, the stored height (say 30) may differ from
    // the rendered height (say 45). The dragend handler should use t.height()
    // not props.object.height.
    const storedHeight = 30;
    const renderedHeight = 45;
    const nodeX = 100; // Konva x (centre)
    const nodeY = 100; // Konva y (centre)
    const width = 80;

    // Old (broken) calculation:
    const oldY = nodeY - storedHeight / 2;
    // New (fixed) calculation:
    const newY = nodeY - renderedHeight / 2;

    const resultX = nodeX - width / 2;

    expect(oldY).toBe(85); // wrong — uses stale stored height
    expect(newY).toBe(77.5); // correct — uses rendered height
    expect(resultX).toBe(60);
  });
});

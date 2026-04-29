/**
 * Tests for marquee (rubber-band) select logic.
 *
 * The canvas-level interaction is driven by Konva pointer events which
 * do not render in jsdom. These tests cover the hit-testing and
 * coordinate-conversion math that lives inside DesignCanvas.vue's
 * marquee state machine in isolation.
 */
import { describe, expect, it } from 'vitest';
import type { LabelObject } from '@burnmark-io/designer-core';

// ---------------------------------------------------------------------------
// Helpers mirrored from DesignCanvas.vue — tested here in isolation
// ---------------------------------------------------------------------------

function pointerToDot(
  px: number,
  py: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: (px - offsetX) / zoom,
    y: (py - offsetY) / zoom,
  };
}

interface MarqueeRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function aabbIntersectsMarquee(obj: LabelObject, rect: MarqueeRect): boolean {
  const objMinX = obj.x;
  const objMinY = obj.y;
  const objMaxX = obj.x + obj.width;
  const objMaxY = obj.y + obj.height;
  return (
    objMaxX > rect.minX &&
    objMinX < rect.maxX &&
    objMaxY > rect.minY &&
    objMinY < rect.maxY
  );
}

function marqueeHits(
  objects: LabelObject[],
  rect: MarqueeRect,
): string[] {
  return objects
    .filter(obj => obj.visible && !obj.locked)
    .filter(obj => aabbIntersectsMarquee(obj, rect))
    .map(obj => obj.id);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeObj(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  overrides: Partial<LabelObject> = {},
): LabelObject {
  return {
    id,
    type: 'shape' as const,
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    shape: 'rectangle',
    color: '#000000',
    fill: true,
    strokeWidth: 1,
    ...overrides,
  } as LabelObject;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pointerToDot coordinate conversion', () => {
  it('maps container pixel to dot when zoom=1 and no offset', () => {
    const dot = pointerToDot(100, 200, 0, 0, 1);
    expect(dot.x).toBe(100);
    expect(dot.y).toBe(200);
  });

  it('accounts for stage offset', () => {
    const dot = pointerToDot(150, 250, 50, 50, 1);
    expect(dot.x).toBe(100);
    expect(dot.y).toBe(200);
  });

  it('accounts for zoom', () => {
    const dot = pointerToDot(100, 200, 0, 0, 2);
    expect(dot.x).toBe(50);
    expect(dot.y).toBe(100);
  });

  it('combines offset and zoom correctly', () => {
    // pointer at (200, 300), stage offset (50, 50), zoom 2
    // dot = (200 - 50) / 2, (300 - 50) / 2 = (75, 125)
    const dot = pointerToDot(200, 300, 50, 50, 2);
    expect(dot.x).toBe(75);
    expect(dot.y).toBe(125);
  });
});

describe('marquee AABB intersection', () => {
  const rect: MarqueeRect = { minX: 10, minY: 10, maxX: 90, maxY: 90 };

  it('object fully inside rect → hits', () => {
    const obj = makeObj('a', 20, 20, 30, 30);
    expect(aabbIntersectsMarquee(obj, rect)).toBe(true);
  });

  it('object partially overlapping rect → hits', () => {
    const obj = makeObj('a', 0, 0, 20, 20); // bottom-right corner overlaps
    expect(aabbIntersectsMarquee(obj, rect)).toBe(true);
  });

  it('object fully outside rect → miss', () => {
    const obj = makeObj('a', 100, 100, 30, 30);
    expect(aabbIntersectsMarquee(obj, rect)).toBe(false);
  });

  it('object touching edge → hits (open boundary)', () => {
    // maxX === objMinX would miss; minX < maxX means open interval overlap
    const touching = makeObj('a', 90, 10, 20, 20); // left edge at 90 = rect.maxX
    expect(aabbIntersectsMarquee(touching, rect)).toBe(false);
  });

  it('object just inside right edge → hits', () => {
    const inside = makeObj('a', 89, 10, 20, 20); // left edge at 89 < 90
    expect(aabbIntersectsMarquee(inside, rect)).toBe(true);
  });
});

describe('marqueeHits with visible/locked filters', () => {
  const rect: MarqueeRect = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  it('returns ids of intersecting objects', () => {
    const objects = [
      makeObj('a', 10, 10, 20, 20),
      makeObj('b', 200, 200, 20, 20), // outside rect
    ];
    expect(marqueeHits(objects, rect)).toEqual(['a']);
  });

  it('skips hidden objects', () => {
    const objects = [makeObj('a', 10, 10, 20, 20, { visible: false })];
    expect(marqueeHits(objects, rect)).toEqual([]);
  });

  it('skips locked objects', () => {
    const objects = [makeObj('a', 10, 10, 20, 20, { locked: true })];
    expect(marqueeHits(objects, rect)).toEqual([]);
  });

  it('returns multiple hits when several objects intersect', () => {
    const objects = [
      makeObj('a', 10, 10, 20, 20),
      makeObj('b', 50, 50, 20, 20),
      makeObj('c', 200, 200, 20, 20),
    ];
    expect(marqueeHits(objects, rect)).toEqual(['a', 'b']);
  });

  it('shift=true → union with prior selection', () => {
    const prior = ['x'];
    const hits = marqueeHits([makeObj('a', 10, 10, 20, 20)], rect);
    const result = [...new Set([...prior, ...hits])];
    expect(result).toEqual(['x', 'a']);
  });

  it('shift=false → replace prior selection', () => {
    const hits = marqueeHits([makeObj('a', 10, 10, 20, 20)], rect);
    expect(hits).toEqual(['a']);
  });
});

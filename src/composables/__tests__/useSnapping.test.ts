import { describe, expect, it } from 'vitest';
import type { LabelObject } from '@burnmark-io/designer-core';
import { computeSnap } from '../useSnapping';

const makeObj = (
  id: string,
  partial: Partial<LabelObject> & { x: number; y: number; width: number; height: number },
): LabelObject =>
  ({
    id,
    type: 'shape',
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#000',
    shape: 'rectangle',
    fill: true,
    strokeWidth: 0,
    invert: false,
    ...partial,
  }) as unknown as LabelObject;

describe('computeSnap', () => {
  it('snaps to canvas centre when within threshold', () => {
    const result = computeSnap({
      draggingId: 'dragged',
      x: 248,
      y: 100,
      width: 100,
      height: 50,
      others: [],
      labelWidth: 600,
      labelHeight: 400,
      threshold: 6,
    });
    // Mid stop is at x + 50 = 298, canvas mid is 300, so it should snap.
    expect(result.x).toBe(250);
    expect(result.guides.vertical).toContain(300);
  });

  it('does not snap when nothing is in range', () => {
    const result = computeSnap({
      draggingId: 'dragged',
      x: 50,
      y: 50,
      width: 80,
      height: 40,
      others: [],
      labelWidth: 600,
      labelHeight: 400,
      threshold: 6,
    });
    expect(result.x).toBe(50);
    expect(result.y).toBe(50);
    expect(result.guides.vertical).toHaveLength(0);
    expect(result.guides.horizontal).toHaveLength(0);
  });

  it('snaps to another object\'s left edge', () => {
    const other = makeObj('a', { x: 200, y: 100, width: 100, height: 50 });
    const result = computeSnap({
      draggingId: 'dragged',
      x: 198, // dragged-left close to other-left=200
      y: 0,
      width: 60,
      height: 30,
      others: [other],
      labelWidth: 600,
      labelHeight: 400,
      threshold: 6,
    });
    expect(result.x).toBe(200);
    expect(result.guides.vertical).toContain(200);
  });

  it('snaps to grid when no other candidate matches', () => {
    const result = computeSnap({
      draggingId: 'dragged',
      x: 47,
      y: 47,
      width: 30,
      height: 30,
      others: [],
      labelWidth: 6000, // far from edges
      labelHeight: 4000,
      threshold: 6,
      gridSpacing: 50,
    });
    expect(result.x).toBe(50);
    expect(result.y).toBe(50);
  });

  it('ignores own object when checking against others', () => {
    const self = makeObj('dragged', { x: 100, y: 100, width: 50, height: 50 });
    const result = computeSnap({
      draggingId: 'dragged',
      x: 102,
      y: 102,
      width: 50,
      height: 50,
      others: [self],
      labelWidth: 6000,
      labelHeight: 4000,
      threshold: 6,
    });
    // Should not snap to itself
    expect(result.x).toBe(102);
    expect(result.y).toBe(102);
  });
});

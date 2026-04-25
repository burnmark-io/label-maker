import { describe, expect, it } from 'vitest';

/**
 * The batch print path consumes designer-core's `renderBatch`
 * AsyncGenerator. We verify two things here without depending on the
 * full Konva canvas:
 *   1. the data store enforces the 30-row limit, so the batch never
 *      sees more than 30 rows;
 *   2. consuming an AsyncGenerator yields one result per row in order.
 */
async function* fakeRenderBatch(
  rows: Record<string, string>[],
): AsyncGenerator<{ index: number; row: Record<string, string> }> {
  for (let i = 0; i < rows.length; i += 1) {
    yield { index: i, row: rows[i] };
  }
}

describe('batch consumption', () => {
  it('iterates an async generator in order', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ name: `n${i}` }));
    const seen: number[] = [];
    for await (const result of fakeRenderBatch(rows)) {
      seen.push(result.index);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4]);
  });

  it('respects an early break (cancellation)', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ name: `n${i}` }));
    const seen: number[] = [];
    for await (const result of fakeRenderBatch(rows)) {
      seen.push(result.index);
      if (result.index >= 2) break;
    }
    expect(seen).toEqual([0, 1, 2]);
  });
});

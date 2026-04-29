import { beforeEach, describe, expect, it } from 'vitest';
import {
  useThresholdConfirm,
  __resetThresholdForTests,
  DEFAULT_THRESHOLD,
} from '../useThresholdConfirm';

beforeEach(() => {
  __resetThresholdForTests();
});

describe('useThresholdConfirm', () => {
  it('resolves immediately when count is at or below the threshold', async () => {
    const t = useThresholdConfirm();
    await expect(
      t.confirmIfNeeded({ count: DEFAULT_THRESHOLD, destination: 'thermal' }),
    ).resolves.toBe(true);
    expect(t.open.value).toBe(false);
  });

  it('opens when count exceeds the threshold', async () => {
    const t = useThresholdConfirm();
    const promise = t.confirmIfNeeded({ count: 60, destination: 'thermal' });
    expect(t.open.value).toBe(true);
    expect(t.context.value?.count).toBe(60);
    t.accept(false);
    await expect(promise).resolves.toBe(true);
    expect(t.open.value).toBe(false);
  });

  it('returns false on cancel', async () => {
    const t = useThresholdConfirm();
    const promise = t.confirmIfNeeded({ count: 60, destination: 'thermal' });
    t.decline();
    await expect(promise).resolves.toBe(false);
  });

  it('don\'t-ask-again skips subsequent prompts in the session', async () => {
    const t = useThresholdConfirm();
    const first = t.confirmIfNeeded({ count: 60, destination: 'thermal' });
    t.accept(true);
    await first;
    // No prompt fires for the next call.
    const second = t.confirmIfNeeded({ count: 100, destination: 'thermal' });
    expect(t.open.value).toBe(false);
    await expect(second).resolves.toBe(true);
  });

  it('don\'t-ask-again is per-session — reset clears it', async () => {
    const t = useThresholdConfirm();
    const first = t.confirmIfNeeded({ count: 60, destination: 'thermal' });
    t.accept(true);
    await first;
    __resetThresholdForTests();
    const second = t.confirmIfNeeded({ count: 100, destination: 'thermal' });
    expect(t.open.value).toBe(true);
    t.decline();
    await second;
  });
});

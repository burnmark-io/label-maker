import { beforeEach, describe, expect, it } from 'vitest';
import { useConfirm, __resetConfirmForTests } from '../useConfirm';

beforeEach(() => {
  __resetConfirmForTests();
});

describe('useConfirm singleton', () => {
  it('returns shared `open` and `options` refs across separate calls', () => {
    const a = useConfirm();
    const b = useConfirm();
    expect(a.open).toBe(b.open);
    expect(a.options).toBe(b.options);
  });

  it('a confirm opened from caller A is observable through caller B', async () => {
    const a = useConfirm();
    const b = useConfirm();

    const promise = a.confirm({
      title: 'T',
      message: 'M',
      confirmLabel: 'OK',
      cancelLabel: 'No',
    });

    expect(b.open.value).toBe(true);
    expect(b.options.value?.title).toBe('T');

    b.resolve();
    expect(await promise).toBe(true);
    expect(b.open.value).toBe(false);
  });

  it('cancel resolves the open promise to false', async () => {
    const a = useConfirm();
    const promise = a.confirm({
      title: 'T',
      confirmLabel: 'OK',
      cancelLabel: 'No',
    });
    a.cancel();
    expect(await promise).toBe(false);
    expect(a.open.value).toBe(false);
  });

  it('a second confirm cancels the first (single-flight)', async () => {
    const a = useConfirm();
    const first = a.confirm({ title: '1', confirmLabel: 'OK', cancelLabel: 'No' });
    const second = a.confirm({ title: '2', confirmLabel: 'OK', cancelLabel: 'No' });

    expect(await first).toBe(false);
    expect(a.options.value?.title).toBe('2');

    a.resolve();
    expect(await second).toBe(true);
  });

  it('resolve clears the resolver so a stale resolve is a no-op', () => {
    const a = useConfirm();
    a.resolve();
    a.resolve();
    expect(a.open.value).toBe(false);
  });
});

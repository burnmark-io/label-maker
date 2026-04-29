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

describe('useConfirm.choose (three-way)', () => {
  it("resolves to 'primary' when resolve is called", async () => {
    const a = useConfirm();
    const promise = a.choose({
      title: 'T',
      primaryLabel: 'Save',
      secondaryLabel: 'Discard',
      cancelLabel: 'No',
    });
    expect(a.open.value).toBe(true);
    a.resolve();
    expect(await promise).toBe('primary');
    expect(a.open.value).toBe(false);
  });

  it("resolves to 'secondary' when resolveSecondary is called", async () => {
    const a = useConfirm();
    const promise = a.choose({
      title: 'T',
      primaryLabel: 'Save',
      secondaryLabel: 'Discard',
      cancelLabel: 'No',
    });
    a.resolveSecondary();
    expect(await promise).toBe('secondary');
  });

  it("resolves to 'cancel' when cancel is called", async () => {
    const a = useConfirm();
    const promise = a.choose({
      title: 'T',
      primaryLabel: 'Save',
      secondaryLabel: 'Discard',
      cancelLabel: 'No',
    });
    a.cancel();
    expect(await promise).toBe('cancel');
  });

  it('preempting confirm() with choose() resolves the prior caller to false', async () => {
    const a = useConfirm();
    const first = a.confirm({ title: '1', confirmLabel: 'OK', cancelLabel: 'No' });
    const second = a.choose({
      title: '2',
      primaryLabel: 'Save',
      secondaryLabel: 'Discard',
      cancelLabel: 'No',
    });

    expect(await first).toBe(false);
    a.resolveSecondary();
    expect(await second).toBe('secondary');
  });

  it("preempting choose() with confirm() resolves the prior choose to 'cancel'", async () => {
    const a = useConfirm();
    const first = a.choose({
      title: '1',
      primaryLabel: 'Save',
      secondaryLabel: 'Discard',
      cancelLabel: 'No',
    });
    const second = a.confirm({ title: '2', confirmLabel: 'OK', cancelLabel: 'No' });

    expect(await first).toBe('cancel');
    a.resolve();
    expect(await second).toBe(true);
  });

  it('the options ref carries primaryLabel and secondaryLabel for the dialog to read', async () => {
    const a = useConfirm();
    const promise = a.choose({
      title: 'T',
      primaryLabel: 'Save & open',
      secondaryLabel: 'Discard & open',
      cancelLabel: 'Cancel',
      primaryTone: 'primary',
      secondaryTone: 'danger',
    });
    const opts = a.options.value;
    expect(opts && 'primaryLabel' in opts ? opts.primaryLabel : null).toBe('Save & open');
    expect(opts && 'secondaryLabel' in opts ? opts.secondaryLabel : null).toBe('Discard & open');
    a.cancel();
    await promise;
  });
});

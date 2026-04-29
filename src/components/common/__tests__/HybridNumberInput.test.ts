import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import HybridNumberInput from '../HybridNumberInput.vue';

function makeWrapper(props: Record<string, unknown> = {}) {
  return mount(HybridNumberInput, {
    props: {
      modelValue: 50,
      min: 0,
      max: 100,
      step: 1,
      ariaLabel: 'Test',
      ...props,
    },
  });
}

describe('HybridNumberInput', () => {
  it('renders both number and slider for a regular value', () => {
    const w = makeWrapper();
    expect(w.find('input[type="number"]').exists()).toBe(true);
    expect(w.find('input[type="range"]').exists()).toBe(true);
  });

  it('typing a value into the number input commits via update:modelValue on change', async () => {
    const w = makeWrapper({ modelValue: 50 });
    const num = w.find('input[type="number"]').element as HTMLInputElement;
    num.value = '42';
    await w.find('input[type="number"]').trigger('change');
    const events = w.emitted('update:modelValue') ?? [];
    expect(events.at(-1)).toEqual([42]);
  });

  it('dragging the slider commits via update:modelValue on input', async () => {
    const w = makeWrapper({ modelValue: 50 });
    const range = w.find('input[type="range"]').element as HTMLInputElement;
    range.value = '75';
    await w.find('input[type="range"]').trigger('input');
    const events = w.emitted('update:modelValue') ?? [];
    expect(events.at(-1)).toEqual([75]);
  });

  it('clamps an out-of-range typed value to max on commit', async () => {
    const w = makeWrapper({ modelValue: 50, min: 0, max: 100 });
    const num = w.find('input[type="number"]').element as HTMLInputElement;
    num.value = '999';
    await w.find('input[type="number"]').trigger('change');
    const events = w.emitted('update:modelValue') ?? [];
    expect(events.at(-1)).toEqual([100]);
  });

  it('clamps a too-low typed value to min on commit', async () => {
    const w = makeWrapper({ modelValue: 50, min: 0, max: 100 });
    const num = w.find('input[type="number"]').element as HTMLInputElement;
    num.value = '-10';
    await w.find('input[type="number"]').trigger('change');
    const events = w.emitted('update:modelValue') ?? [];
    expect(events.at(-1)).toEqual([0]);
  });

  it('hides the slider thumb in mixed-value state and shows the placeholder', () => {
    const w = makeWrapper({ mixed: true });
    // v-show keeps the element mounted but display:none — so the slider
    // node's reactivity is intact when mixed flips back to false (no
    // remount race when shared values resolve).
    const slider = w.find('input[type="range"]');
    expect(slider.exists()).toBe(true);
    expect((slider.element as HTMLInputElement).style.display).toBe('none');
    const num = w.find('input[type="number"]').element as HTMLInputElement;
    expect(num.placeholder).toBe('—');
  });

  it('reveals the slider when mixed flips false on the same tick as a value commit', async () => {
    const w = mount(HybridNumberInput, {
      props: { modelValue: 50, min: 0, max: 100, step: 1, mixed: true, ariaLabel: 'Test' },
    });
    const slider = w.find('input[type="range"]');
    expect((slider.element as HTMLInputElement).style.display).toBe('none');

    // Commit a value AND flip mixed to false in one parent update — the
    // pattern used by AppearanceProperties when the user types a shared
    // opacity that resolves the mixed state.
    await w.setProps({ modelValue: 60, mixed: false });
    expect((slider.element as HTMLInputElement).style.display).not.toBe('none');
  });

  it('mixed state still commits a typed value (applies-to-all on multi-select)', async () => {
    const w = makeWrapper({ mixed: true });
    const num = w.find('input[type="number"]').element as HTMLInputElement;
    num.value = '30';
    await w.find('input[type="number"]').trigger('change');
    const events = w.emitted('update:modelValue') ?? [];
    expect(events.at(-1)).toEqual([30]);
  });

  it('does not emit if the committed value equals the current modelValue', async () => {
    const w = makeWrapper({ modelValue: 50 });
    const num = w.find('input[type="number"]').element as HTMLInputElement;
    num.value = '50';
    await w.find('input[type="number"]').trigger('change');
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });

  it('formats the displayed value when format/parse are provided (opacity 0–1 → 0–100)', async () => {
    const w = mount(HybridNumberInput, {
      props: {
        modelValue: 0.5,
        min: 0,
        max: 100,
        step: 1,
        ariaLabel: 'Opacity',
        format: (v: number) => Math.round(v * 100),
        parse: (v: number) => v / 100,
      },
    });
    const num = w.find('input[type="number"]').element as HTMLInputElement;
    expect(num.value).toBe('50');
    num.value = '75';
    await w.find('input[type="number"]').trigger('change');
    const events = w.emitted('update:modelValue') ?? [];
    expect(events.at(-1)).toEqual([0.75]);
  });

  it('disabled state disables both inputs', () => {
    const w = makeWrapper({ disabled: true });
    expect((w.find('input[type="number"]').element as HTMLInputElement).disabled).toBe(true);
    expect((w.find('input[type="range"]').element as HTMLInputElement).disabled).toBe(true);
  });
});

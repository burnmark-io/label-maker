import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import type { ShapeObject } from '@burnmark-io/designer-core';

import en from '@/i18n/locales/en.json';
import ShapeProperties from '../ShapeProperties.vue';
import type * as DesignerStore from '@/stores/designer';

const updateObjectSpy = vi.fn();

vi.mock('@/stores/designer', async () => {
  const actual = await vi.importActual<typeof DesignerStore>('@/stores/designer');
  return {
    ...actual,
    useDesignerStore: () => ({ updateObject: updateObjectSpy }),
  };
});

function makeShape(overrides: Partial<ShapeObject> = {}): ShapeObject {
  return {
    id: 'obj-1',
    type: 'shape',
    name: 'Rectangle 1',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    color: '#000000',
    shape: 'rectangle',
    fill: true,
    strokeWidth: 1,
    invert: false,
    ...overrides,
  } as ShapeObject;
}

function mountShape(object: ShapeObject) {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  return mount(ShapeProperties, {
    props: { object },
    global: { plugins: [i18n] },
  });
}

describe('ShapeProperties', () => {
  beforeEach(() => {
    updateObjectSpy.mockClear();
  });

  it('renders three visual picker buttons (Rectangle / Ellipse / Line)', () => {
    const w = mountShape(makeShape());
    const chips = w.findAll('.shape-picker__chip');
    expect(chips.length).toBe(3);
    expect(chips[0]?.attributes('aria-pressed')).toBe('true');
    expect(chips[1]?.attributes('aria-pressed')).toBe('false');
    expect(chips[2]?.attributes('aria-pressed')).toBe('false');
  });

  it('clicking a picker chip updates the shape', async () => {
    const w = mountShape(makeShape());
    const ellipseButton = w
      .findAll('.shape-picker__chip')
      .find(b => b.attributes('aria-label') === 'Circle');
    await ellipseButton?.trigger('click');
    expect(updateObjectSpy).toHaveBeenCalledWith('obj-1', { shape: 'ellipse' });
  });

  it('shows cornerRadius only for rectangles', () => {
    const rect = mountShape(makeShape({ shape: 'rectangle' }));
    expect(rect.text()).toContain('Corner radius');

    const ellipse = mountShape(makeShape({ shape: 'ellipse' }));
    expect(ellipse.text()).not.toContain('Corner radius');
  });

  it('shows lineDirection only for lines', () => {
    const line = mountShape(makeShape({ shape: 'line', fill: false, strokeWidth: 2 }));
    expect(line.text()).toContain('Direction');

    const rect = mountShape(makeShape({ shape: 'rectangle' }));
    expect(rect.text()).not.toContain('Direction');
  });

  it('hides Fill toggle for lines', () => {
    const line = mountShape(makeShape({ shape: 'line', fill: false, strokeWidth: 2 }));
    expect(line.text()).not.toContain('Fill');
  });
});

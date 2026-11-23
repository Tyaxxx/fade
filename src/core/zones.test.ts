import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, type FadeParams } from './params';
import { layoutZones } from './zones';

const base: FadeParams = { ...DEFAULT_PARAMS, zones: { count: 6, size: 0.7, sizeVariation: 0.5 } };
const geometry = (p: FadeParams) => layoutZones(p).map(({ x, y, radius, aspect, angle }) => ({ x, y, radius, aspect, angle }));
const centres = (p: FadeParams) => layoutZones(p).map(({ x, y }) => ({ x, y }));

describe('layoutZones', () => {
  it('returns count zones deterministically', () => {
    expect(layoutZones(base)).toHaveLength(6);
    expect(layoutZones(base)).toEqual(layoutZones(base));
  });

  it('different layout seeds move zones', () => {
    expect(centres({ ...base, seeds: { ...base.seeds, layout: 77 } })).not.toEqual(centres(base));
  });

  it('is prefix-stable when the zone count rises', () => {
    const five = layoutZones({ ...base, zones: { ...base.zones, count: 5 } });
    const six = layoutZones({ ...base, zones: { ...base.zones, count: 6 } });
    expect(six.slice(0, 5)).toEqual(five);
  });

  it('geometry ignores palette, colour/grain seeds, grain, blur and pixel size', () => {
    const g = geometry(base);
    expect(geometry({ ...base, palette: ['#000000', '#ffffff', '#ff0000'] })).toEqual(g);
    expect(geometry({ ...base, seeds: { ...base.seeds, colors: 5, grain: 9 } })).toEqual(g);
    expect(geometry({ ...base, grain: { amount: 1, size: 4, mode: 'color' }, blur: 0.9 })).toEqual(g);
    expect(geometry({ ...base, width: 400, height: 3000 })).toEqual(g);
  });

  it('centres ignore the shape seed and zone size', () => {
    const c = centres(base);
    expect(centres({ ...base, seeds: { ...base.seeds, shape: 31337 } })).toEqual(c);
    expect(centres({ ...base, zones: { ...base.zones, size: 1.4 } })).toEqual(c);
  });

  it('assigns every palette colour when count >= palette length', () => {
    const p = { ...base, palette: ['#000000', '#111111', '#222222', '#333333'], zones: { ...base.zones, count: 4 } };
    for (let s = 0; s < 20; s++) {
      const idx = layoutZones({ ...p, seeds: { ...p.seeds, colors: s } }).map((z) => z.color).sort();
      expect(idx).toEqual([0, 1, 2, 3]);
    }
  });

  it('keeps geometry in range: centres near frame, aspect 1..4, radius scales with size', () => {
    for (let s = 0; s < 30; s++) {
      for (const z of layoutZones({ ...base, seeds: { ...base.seeds, layout: s, shape: s } })) {
        expect(z.x).toBeGreaterThanOrEqual(-0.2);
        expect(z.x).toBeLessThanOrEqual(1.2);
        expect(z.y).toBeGreaterThanOrEqual(-0.2);
        expect(z.y).toBeLessThanOrEqual(1.2);
        expect(z.aspect).toBeGreaterThanOrEqual(1);
        expect(z.aspect).toBeLessThanOrEqual(4);
        expect(z.radius).toBeGreaterThan(0);
      }
    }
    const fixed = { ...base, zones: { ...base.zones, sizeVariation: 0 } };
    expect(layoutZones(fixed)[0].radius).toBeCloseTo(0.7, 6);
  });
});

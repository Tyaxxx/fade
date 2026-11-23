import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, FALLOFF_CURVES, LIMITS, type FadeParams } from '../../core/index';
import { keptHint, randomizeLooks, unlockedLooks } from './randomize';

/** Small deterministic LCG so tests don't depend on Math.random. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const P: FadeParams = DEFAULT_PARAMS;
const isStep = (v: number, step: number) => Math.abs(Math.round(v / step) * step - v) < 1e-9;

describe('randomizeLooks', () => {
  it('colours: changes the palette (same length) and the colours seed only', () => {
    const out = randomizeLooks(P, ['colors'], lcg(1));
    expect(out.palette).toHaveLength(P.palette.length);
    expect(out.palette).not.toEqual(P.palette);
    expect(out.seeds.colors).not.toBe(P.seeds.colors);
    expect({ ...out, palette: P.palette, seeds: { ...out.seeds, colors: 0 } }).toEqual({ ...P, seeds: { ...P.seeds, colors: 0 } });
  });

  it('shape: changes zones, falloff and the layout/shape seeds only', () => {
    const out = randomizeLooks(P, ['shape'], lcg(2));
    expect(out.seeds.layout).not.toBe(P.seeds.layout);
    expect(out.seeds.shape).not.toBe(P.seeds.shape);
    expect({ ...out, zones: P.zones, falloff: P.falloff, seeds: { ...out.seeds, layout: 0, shape: 0 } }).toEqual({
      ...P,
      seeds: { ...P.seeds, layout: 0, shape: 0 },
    });
  });

  it('texture: changes grain, blur and the grain seed only', () => {
    const out = randomizeLooks(P, ['texture'], lcg(3));
    expect(out.seeds.grain).not.toBe(P.seeds.grain);
    expect({ ...out, grain: P.grain, blur: P.blur, seeds: { ...out.seeds, grain: 0 } }).toEqual({
      ...P,
      seeds: { ...P.seeds, grain: 0 },
    });
  });

  it('keeps every value in its curated range and on its slider step', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const o = randomizeLooks(P, ['colors', 'shape', 'texture'], lcg(seed));
      expect(Number.isInteger(o.zones.count)).toBe(true);
      expect(o.zones.count).toBeGreaterThanOrEqual(3);
      expect(o.zones.count).toBeLessThanOrEqual(10);
      expect(o.zones.size).toBeGreaterThanOrEqual(0.5);
      expect(o.zones.size).toBeLessThanOrEqual(1.1);
      expect(o.zones.sizeVariation).toBeGreaterThanOrEqual(0.2);
      expect(o.zones.sizeVariation).toBeLessThanOrEqual(0.8);
      expect(FALLOFF_CURVES).toContain(o.falloff.curve);
      expect(o.falloff.softness).toBeGreaterThanOrEqual(0.4);
      expect(o.falloff.softness).toBeLessThanOrEqual(0.95);
      expect(o.grain.amount).toBeGreaterThanOrEqual(0.05);
      expect(o.grain.amount).toBeLessThanOrEqual(0.45);
      expect(o.grain.size).toBeGreaterThanOrEqual(0.6);
      expect(o.grain.size).toBeLessThanOrEqual(2.5);
      expect(['mono', 'color']).toContain(o.grain.mode);
      expect(o.blur).toBeGreaterThanOrEqual(0);
      expect(o.blur).toBeLessThanOrEqual(0.5);
      for (const v of [o.zones.size, o.zones.sizeVariation, o.falloff.softness, o.grain.amount, o.blur]) expect(isStep(v, 0.01)).toBe(true);
      expect(isStep(o.grain.size, 0.1)).toBe(true);
      expect(o.zones.size).toBeLessThanOrEqual(LIMITS.zoneSize.max);
      expect(o.grain.size).toBeGreaterThanOrEqual(LIMITS.grainSize.min);
      expect(o.palette).toHaveLength(P.palette.length);
      expect([o.width, o.height, o.dither]).toEqual([P.width, P.height, P.dither]);
    }
  });

  it('returns the same reference when no looks are given', () => {
    expect(randomizeLooks(P, [], lcg(4))).toBe(P);
  });
});

describe('unlockedLooks', () => {
  it('lists the looks that are not locked', () => {
    expect(unlockedLooks({ colors: true, shape: false, texture: true })).toEqual(['shape']);
  });
});

describe('keptHint', () => {
  it('names the locked looks', () => {
    expect(keptHint({ colors: false, shape: false, texture: false })).toBeNull();
    expect(keptHint({ colors: true, shape: false, texture: false })).toBe('Colours kept');
    expect(keptHint({ colors: true, shape: false, texture: true })).toBe('Colours and texture kept');
    expect(keptHint({ colors: true, shape: true, texture: true })).toBe('Everything kept, so nothing will change');
  });
});

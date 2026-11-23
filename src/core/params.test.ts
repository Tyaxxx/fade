import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, LIMITS, normalizeParams } from './params';

describe('normalizeParams', () => {
  it('returns defaults for garbage input and never throws', () => {
    expect(normalizeParams(undefined)).toEqual(DEFAULT_PARAMS);
    expect(normalizeParams(42)).toEqual(DEFAULT_PARAMS);
    expect(normalizeParams({ zones: 'x', palette: 5 })).toEqual(DEFAULT_PARAMS);
  });

  it('clamps every numeric limit', () => {
    const low = normalizeParams({
      width: 1, height: -5,
      zones: { count: 0, size: 0, sizeVariation: -1 },
      falloff: { curve: 'smooth', softness: -1 },
      blur: -2,
      grain: { amount: -1, size: 0, mode: 'mono' },
    });
    expect(low.width).toBe(16);
    expect(low.height).toBe(16);
    expect(low.zones).toEqual({ count: 1, size: 0.1, sizeVariation: 0 });
    expect(low.falloff.softness).toBe(0);
    expect(low.blur).toBe(0);
    expect(low.grain.amount).toBe(0);
    expect(low.grain.size).toBe(0.5);

    const high = normalizeParams({
      width: 99999, height: 9000.7,
      zones: { count: 40, size: 9, sizeVariation: 3 },
      falloff: { curve: 'gaussian', softness: 5 },
      blur: 7,
      grain: { amount: 4, size: 60, mode: 'color' },
    });
    expect(high.width).toBe(8192);
    expect(high.height).toBe(8192);
    expect(high.zones).toEqual({ count: 16, size: 1.5, sizeVariation: 1 });
    expect(high.falloff).toEqual({ curve: 'gaussian', softness: 1 });
    expect(high.blur).toBe(1);
    expect(high.grain).toEqual({ amount: 1, size: 6, mode: 'color' });
    expect(LIMITS.width.max).toBe(8192);
  });

  it('rounds dimensions and zone count to integers', () => {
    const p = normalizeParams({ width: 1000.6, height: 499.2, zones: { count: 3.7 } });
    expect(p.width).toBe(1001);
    expect(p.height).toBe(499);
    expect(p.zones.count).toBe(4);
  });

  it('drops bad hex, normalises case, pads to 2 and caps at 8', () => {
    expect(normalizeParams({ palette: ['#FF0000', 'nope', '#0f0'] }).palette).toEqual(['#ff0000', '#00ff00']);
    const one = normalizeParams({ palette: ['#123456'] }).palette;
    expect(one).toHaveLength(2);
    expect(one[0]).toBe('#123456');
    expect(normalizeParams({ palette: Array(12).fill('#abcdef') }).palette).toHaveLength(8);
  });

  it('rejects unknown enum values and coerces seeds to uint32', () => {
    const p = normalizeParams({
      falloff: { curve: 'zigzag' }, grain: { mode: 'sparkle' },
      seeds: { layout: -1, shape: 2.9, colors: 'x', grain: 2 ** 33 + 5 },
    });
    expect(p.falloff.curve).toBe(DEFAULT_PARAMS.falloff.curve);
    expect(p.grain.mode).toBe(DEFAULT_PARAMS.grain.mode);
    expect(p.seeds.layout).toBe(4294967295);
    expect(p.seeds.shape).toBe(2);
    expect(p.seeds.colors).toBe(DEFAULT_PARAMS.seeds.colors);
    expect(p.seeds.grain).toBe(5);
  });

  it('keeps dither boolean', () => {
    expect(normalizeParams({ dither: false }).dither).toBe(false);
    expect(normalizeParams({ dither: 'yes' }).dither).toBe(DEFAULT_PARAMS.dither);
  });
});

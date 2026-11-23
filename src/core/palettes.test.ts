import { describe, expect, it } from 'vitest';
import { parseHex, srgbToLab } from './color';
import { DEFAULT_PARAMS } from './params';
import { PALETTES, randomPalette } from './palettes';

const L = (hex: string) => srgbToLab(parseHex(hex)!)[0];

describe('palettes', () => {
  it('ships 6–9 valid presets with 2–8 colours and unique ids', () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(6);
    expect(PALETTES.length).toBeLessThanOrEqual(9);
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
    for (const p of PALETTES) {
      expect(p.colors.length).toBeGreaterThanOrEqual(2);
      expect(p.colors.length).toBeLessThanOrEqual(8);
      for (const c of p.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('lists the default palette first', () => {
    expect(PALETTES[0].colors).toEqual(DEFAULT_PARAMS.palette);
  });

  it('randomPalette is deterministic, sized, and has a dark and a light colour', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const n of [2, 3, 5, 8]) {
        const p = randomPalette(seed, n);
        expect(p).toEqual(randomPalette(seed, n));
        expect(p).toHaveLength(n);
        for (const c of p) expect(c).toMatch(/^#[0-9a-f]{6}$/);
        const ls = p.map(L);
        expect(Math.min(...ls)).toBeLessThan(0.45);
        expect(Math.max(...ls)).toBeGreaterThan(0.7);
      }
    }
    expect(randomPalette(1, 5)).not.toEqual(randomPalette(2, 5));
  });

  it('clamps the requested count to 2..8', () => {
    expect(randomPalette(3, 1)).toHaveLength(2);
    expect(randomPalette(3, 20)).toHaveLength(8);
  });
});

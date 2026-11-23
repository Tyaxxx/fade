import { describe, expect, it } from 'vitest';
import { formatHex, labToSrgb, parseHex, srgbToLab } from './color';

describe('color', () => {
  it('parses #rrggbb and #rgb, rejects garbage', () => {
    expect(parseHex('#ff8000')).toEqual([255, 128, 0]);
    expect(parseHex('FF8000')).toEqual([255, 128, 0]);
    expect(parseHex('#f80')).toEqual([255, 136, 0]);
    expect(parseHex('#ggg000')).toBeNull();
    expect(parseHex('')).toBeNull();
    expect(parseHex('#12345')).toBeNull();
  });

  it('formats lowercase #rrggbb with clamping', () => {
    expect(formatHex([255, 128, 0])).toBe('#ff8000');
    expect(formatHex([300, -4, 15.6])).toBe('#ff0010');
  });

  it('white has L≈1 and black L≈0 in OKLab', () => {
    const w = srgbToLab([255, 255, 255]);
    expect(w[0]).toBeCloseTo(1, 3);
    expect(Math.abs(w[1])).toBeLessThan(1e-3);
    expect(Math.abs(w[2])).toBeLessThan(1e-3);
    expect(srgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 6);
  });

  it('matches the published OKLab value for pure red', () => {
    // Björn Ottosson's reference: sRGB red ≈ (0.6279, 0.2249, 0.1258)
    const r = srgbToLab([255, 0, 0]);
    expect(r[0]).toBeCloseTo(0.628, 2);
    expect(r[1]).toBeCloseTo(0.225, 2);
    expect(r[2]).toBeCloseTo(0.126, 2);
  });

  it('round-trips sRGB through OKLab within 1/255', () => {
    const samples: [number, number, number][] = [
      [12, 200, 99], [255, 255, 0], [3, 4, 5], [128, 64, 250], [250, 240, 230],
    ];
    for (const c of samples) {
      const back = labToSrgb(srgbToLab(c));
      for (let i = 0; i < 3; i++) expect(Math.abs(back[i] - c[i])).toBeLessThanOrEqual(1);
    }
  });
});

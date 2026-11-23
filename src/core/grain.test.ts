import { describe, expect, it } from 'vitest';
import { generate, type RenderedImage } from './generate';
import { DEFAULT_PARAMS, type FadeParams } from './params';
import { maxNeighbourDelta } from './__test__/util';

const base: FadeParams = {
  ...DEFAULT_PARAMS,
  width: 256,
  height: 256,
  blur: 0.3,
  dither: false,
  palette: ['#405060', '#708090'],
  falloff: { curve: 'gaussian', softness: 1 },
};
const noGrain = { ...base, grain: { amount: 0, size: 1, mode: 'mono' as const } };

/** Residual (grain only) of one channel: render minus the no-grain render. */
function residual(img: RenderedImage, ref: RenderedImage, c: number): Float64Array {
  const r = new Float64Array(img.width * img.height);
  for (let i = 0; i < r.length; i++) r[i] = img.data[i * 4 + c] - ref.data[i * 4 + c];
  return r;
}

function variance(a: Float64Array): number {
  let s = 0;
  let q = 0;
  for (const v of a) {
    s += v;
    q += v * v;
  }
  return q / a.length - (s / a.length) ** 2;
}

/** Horizontal autocorrelation at `lag` px. */
function autocorr(a: Float64Array, w: number, lag: number): number {
  const h = a.length / w;
  let mean = 0;
  for (const v of a) mean += v;
  mean /= a.length;
  let num = 0;
  let den = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = a[y * w + x] - mean;
      den += d * d;
      if (x + lag < w) num += d * (a[y * w + x + lag] - mean);
    }
  }
  return num / den;
}

describe('grain', () => {
  const ref = generate(noGrain);

  it('amount 0 without dither is perfectly smooth', () => {
    expect(maxNeighbourDelta(ref)).toBeLessThanOrEqual(2);
  });

  it('amount 0.5 adds high-frequency energy', () => {
    const img = generate({ ...base, grain: { amount: 0.5, size: 1, mode: 'mono' } });
    expect(variance(residual(img, ref, 1))).toBeGreaterThan(4);
  });

  it('mono grain shifts R, G and B together; colour grain does not', () => {
    const spread = (img: RenderedImage) => {
      const r = residual(img, ref, 0);
      const g = residual(img, ref, 1);
      const d = new Float64Array(r.length);
      for (let i = 0; i < r.length; i++) d[i] = r[i] - g[i];
      return variance(d);
    };
    const mono = spread(generate({ ...base, grain: { amount: 0.5, size: 1, mode: 'mono' } }));
    const color = spread(generate({ ...base, grain: { amount: 0.5, size: 1, mode: 'color' } }));
    expect(mono).toBeLessThan(1);
    expect(color).toBeGreaterThan(4);
  });

  it('coarse grain is clumpy, fine grain is not', () => {
    const coarse = generate({ ...base, grain: { amount: 0.4, size: 3, mode: 'mono' } });
    const fine = generate({ ...base, grain: { amount: 0.4, size: 0.8, mode: 'mono' } });
    expect(autocorr(residual(coarse, ref, 1), 256, 2)).toBeGreaterThan(0.3);
    expect(autocorr(residual(fine, ref, 1), 256, 2)).toBeLessThan(0.1);
  });

  it('grain seed changes the grain but not the field', () => {
    const p = { ...base, grain: { amount: 0.5, size: 1, mode: 'mono' as const } };
    const a = generate(p);
    const b = generate({ ...p, seeds: { ...p.seeds, grain: 12345 } });
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(false);
    let mean = 0;
    for (let i = 0; i < a.data.length; i++) mean += a.data[i] - b.data[i];
    expect(Math.abs(mean / a.data.length)).toBeLessThan(0.5);
  });
});

describe('dither', () => {
  // Dark, narrow-range two-colour gradient: prone to banding.
  const p: FadeParams = {
    ...noGrain,
    width: 512,
    height: 64,
    palette: ['#101418', '#181c22'],
    zones: { count: 2, size: 1.2, sizeVariation: 0 },
    blur: 0.6,
  };

  const longestRun = (img: RenderedImage) => {
    let best = 0;
    for (let y = 0; y < img.height; y++) {
      let run = 1;
      for (let x = 1; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        const same = img.data[i] === img.data[i - 4] && img.data[i + 1] === img.data[i - 3] && img.data[i + 2] === img.data[i - 2];
        run = same ? run + 1 : 1;
        best = Math.max(best, run);
      }
    }
    return best;
  };

  it('breaks up flat bands without shifting the mean colour', () => {
    const off = generate({ ...p, dither: false });
    const on = generate({ ...p, dither: true });
    expect(longestRun(off)).toBeGreaterThan(24);
    expect(longestRun(on)).toBeLessThanOrEqual(24);
    let shift = 0;
    for (let i = 0; i < on.data.length; i++) if (i % 4 !== 3) shift += on.data[i] - off.data[i];
    expect(Math.abs(shift / (on.data.length * 0.75))).toBeLessThanOrEqual(0.5);
  });
});

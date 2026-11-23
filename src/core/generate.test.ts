import { describe, expect, it } from 'vitest';
import { srgbToLab } from './color';
import { generate } from './generate';
import { DEFAULT_PARAMS, type FadeParams } from './params';
import { laplacianVariance, maxNeighbourDelta } from './__test__/util';
import { layoutZones } from './zones';

const clean: FadeParams = {
  ...DEFAULT_PARAMS,
  width: 320,
  height: 180,
  grain: { amount: 0, size: 1, mode: 'mono' },
  dither: false,
  blur: 0,
};

describe('generate: shape and determinism', () => {
  it('returns RGBA of the requested size with opaque alpha', () => {
    const img = generate(clean);
    expect(img.width).toBe(320);
    expect(img.height).toBe(180);
    expect(img.data).toBeInstanceOf(Uint8ClampedArray);
    expect(img.data.length).toBe(320 * 180 * 4);
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 255) throw new Error(`alpha at ${i}`);
  });

  it('scale 0.25 gives round(w/4) × round(h/4)', () => {
    const img = generate({ ...clean, width: 322, height: 182 }, { scale: 0.25 });
    expect([img.width, img.height]).toEqual([81, 46]);
  });

  it('is byte-identical for identical params and differs for another layout seed', () => {
    const p = { ...DEFAULT_PARAMS, width: 200, height: 120 };
    const a = generate(p).data;
    const b = generate(p).data;
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    const c = generate({ ...p, seeds: { ...p.seeds, layout: 999 } }).data;
    expect(Buffer.from(a).equals(Buffer.from(c))).toBe(false);
  });

  it('normalises params so out-of-range input still renders', () => {
    const img = generate({ ...clean, width: 2, height: 5 } as FadeParams);
    expect([img.width, img.height]).toEqual([16, 16]);
  });
});

describe('generate: colour field', () => {
  it('a single zone renders its colour at the zone centre (ΔE < 0.03)', () => {
    const p: FadeParams = { ...clean, palette: ['#e0338f', '#1f3fae'], zones: { count: 1, size: 0.6, sizeVariation: 0 }, falloff: { curve: 'smooth', softness: 0.1 } };
    const z = layoutZones(p)[0];
    const img = generate(p);
    const x = Math.min(img.width - 1, Math.max(0, Math.round(z.x * img.width)));
    const y = Math.min(img.height - 1, Math.max(0, Math.round(z.y * img.height)));
    const i = (y * img.width + x) * 4;
    const got = srgbToLab([img.data[i], img.data[i + 1], img.data[i + 2]]);
    const want = srgbToLab(z.color === 0 ? [0xe0, 0x33, 0x8f] : [0x1f, 0x3f, 0xae]);
    expect(Math.hypot(got[0] - want[0], got[1] - want[1], got[2] - want[2])).toBeLessThan(0.03);
  });

  it('higher softness gives gentler transitions', () => {
    const p: FadeParams = { ...clean, palette: ['#000000', '#ffffff'], zones: { count: 4, size: 0.5, sizeVariation: 0.3 } };
    const hard = maxNeighbourDelta(generate({ ...p, falloff: { curve: 'smooth', softness: 0 } }));
    const soft = maxNeighbourDelta(generate({ ...p, falloff: { curve: 'smooth', softness: 1 } }));
    expect(soft).toBeLessThan(hard);
  });

  it('each falloff curve produces a different image', () => {
    const imgs = (['linear', 'smooth', 'gaussian'] as const).map((curve) =>
      Buffer.from(generate({ ...clean, falloff: { curve, softness: 0.4 } }).data),
    );
    expect(imgs[0].equals(imgs[1])).toBe(false);
    expect(imgs[1].equals(imgs[2])).toBe(false);
  });

  it('blur lowers the variance of the Laplacian', () => {
    const p: FadeParams = { ...clean, falloff: { curve: 'linear', softness: 0 } };
    expect(laplacianVariance(generate({ ...p, blur: 0.5 }))).toBeLessThan(laplacianVariance(generate({ ...p, blur: 0 })));
  });

  it('reduced scale looks like a downsampled full render (mean abs diff ≤ 3/255)', () => {
    const p: FadeParams = { ...clean, width: 1600, height: 900, blur: 0.2 };
    const full = generate(p);
    const small = generate(p, { scale: 0.25 });
    expect([small.width, small.height]).toEqual([400, 225]);
    let diff = 0;
    for (let y = 0; y < small.height; y++) {
      for (let x = 0; x < small.width; x++) {
        for (let c = 0; c < 3; c++) {
          let s = 0;
          for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) s += full.data[((y * 4 + dy) * full.width + x * 4 + dx) * 4 + c];
          diff += Math.abs(s / 16 - small.data[(y * small.width + x) * 4 + c]);
        }
      }
    }
    expect(diff / (small.width * small.height * 3)).toBeLessThanOrEqual(3);
  });

  it('renders 3840×2160 in under 2 s', () => {
    const t = performance.now();
    generate({ ...DEFAULT_PARAMS, width: 3840, height: 2160 });
    expect(performance.now() - t).toBeLessThan(2000);
  });
});

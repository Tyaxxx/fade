// Visual tuning harness: `npm run samples` renders parameter sets to out/samples/*.png
// for side-by-side comparison with assets/examples/. Not part of `npm test`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { DEFAULT_PARAMS, generate, PALETTES, type FadeParams } from '../src/core/index';
import { encodePng } from './png';

const OUT = join(process.cwd(), 'out', 'samples');
const pal = (id: string) => PALETTES.find((p) => p.id === id)!.colors;
const W = Number(process.env.SAMPLE_W ?? 1600);
const H = Number(process.env.SAMPLE_H ?? 900);

type Sample = [name: string, overrides: Partial<FadeParams>];
const seeds = (n: number) => ({ layout: n * 7919, shape: n * 104729, colors: n * 31, grain: n });

const samples: Sample[] = [
  ['default', {}],
  ['spectrum-fine', { palette: pal('spectrum'), seeds: seeds(3), grain: { amount: 0.3, size: 0.8, mode: 'mono' } }],
  ['nightfall-streak', { palette: pal('nightfall'), zones: { count: 5, size: 0.7, sizeVariation: 0.6 }, seeds: seeds(11) }],
  ['prism', { palette: pal('prism'), zones: { count: 9, size: 0.55, sizeVariation: 0.5 }, seeds: seeds(5) }],
  ['sunset-rough', { palette: pal('sunset'), zones: { count: 5, size: 0.8, sizeVariation: 0.4 }, grain: { amount: 0.45, size: 3, mode: 'mono' }, seeds: seeds(2) }],
  ['neon-night', { palette: pal('neon-night'), zones: { count: 5, size: 0.6, sizeVariation: 0.6 }, seeds: seeds(8) }],
  ['ember-glow', { palette: pal('ember-glow'), zones: { count: 5, size: 0.65, sizeVariation: 0.5 }, seeds: seeds(4) }],
  ['pastel-sky-clean', { palette: pal('pastel-sky'), zones: { count: 4, size: 1.0, sizeVariation: 0.3 }, falloff: { curve: 'gaussian', softness: 0.9 }, grain: { amount: 0, size: 1, mode: 'mono' }, blur: 0.4, seeds: seeds(6) }],
  ['golden-hour', { palette: pal('golden-hour'), seeds: seeds(9) }],
  ['spectrum-hard', { palette: pal('spectrum'), falloff: { curve: 'linear', softness: 0 }, blur: 0, seeds: seeds(3) }],
  ['spectrum-color-grain', { palette: pal('spectrum'), grain: { amount: 0.6, size: 1, mode: 'color' }, seeds: seeds(12) }],
];

it('renders samples', () => {
  mkdirSync(OUT, { recursive: true });
  const only = process.env.SAMPLE;
  // Contact sheet: 3 columns of quarter-size renders (scale 0.25 → same look, smaller).
  const cols = 3;
  const tw = Math.round(W / 4);
  const th = Math.round(H / 4);
  const rows = Math.ceil(samples.length / cols);
  const sheet = new Uint8ClampedArray(cols * tw * rows * th * 4).fill(255);
  samples.forEach(([name, o], n) => {
    if (only && !name.includes(only)) return;
    const p: FadeParams = { ...DEFAULT_PARAMS, width: W, height: H, ...o };
    const img = generate(p);
    writeFileSync(join(OUT, `${name}.png`), encodePng(img.width, img.height, img.data));
    const t = generate(p, { scale: 0.25 });
    const ox = (n % cols) * tw;
    const oy = Math.floor(n / cols) * th;
    for (let y = 0; y < Math.min(th, t.height); y++) {
      for (let x = 0; x < Math.min(tw, t.width); x++) {
        const s = (y * t.width + x) * 4;
        sheet.set(t.data.subarray(s, s + 4), ((oy + y) * cols * tw + ox + x) * 4);
      }
    }
  });
  writeFileSync(join(OUT, '_sheet.png'), encodePng(cols * tw, rows * th, sheet));
});

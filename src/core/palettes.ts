import { formatHex, oklchToSrgb } from './color';
import { LIMITS } from './params';
import { mulberry32 } from './rng';

export interface Palette {
  id: string;
  name: string;
  colors: string[];
}

/** Presets sampled from the reference images. */
export const PALETTES: Palette[] = [
  // First on purpose: the default palette (DEFAULT_PARAMS.palette), so a fresh start shows its name.
  { id: 'bloom', name: 'Bloom', colors: ['#5b2bd6', '#e0338f', '#ff8a3d', '#3fd0e6', '#1f3fae'] },
  { id: 'spectrum', name: 'Spectrum', colors: ['#3a1a5e', '#d8357a', '#f5821f', '#2fc6e0', '#1f3fb8'] },
  { id: 'nightfall', name: 'Nightfall', colors: ['#03043a', '#0a1a8c', '#f2a66a', '#fbf1e2', '#38c3f5'] },
  { id: 'prism', name: 'Prism', colors: ['#050507', '#ff3b30', '#ffb02e', '#33d17a', '#2a7bff', '#a645ff', '#0a0a10'] },
  { id: 'sunset', name: 'Sunset', colors: ['#1b2a3a', '#2f6f86', '#f7e3cc', '#ff7a2f', '#14202c'] },
  { id: 'neon-night', name: 'Neon night', colors: ['#060608', '#1e4dff', '#ff2e3c', '#bfeaff', '#0b0b12'] },
  { id: 'ember-glow', name: 'Ember glow', colors: ['#0d0c0c', '#f0b45a', '#d9433f', '#3fa3e8', '#141313'] },
  { id: 'pastel-sky', name: 'Pastel sky', colors: ['#5fcbef', '#fdfbf4', '#fde2bf', '#f6857a'] },
  { id: 'golden-hour', name: 'Golden hour', colors: ['#ffd23f', '#ff8a1e', '#fff1d6', '#1f8f8a', '#f15a24'] },
];

/**
 * A pleasant random palette in OKLCH: a random base hue with spread hues,
 * always one dark and one light colour among mid-tone accents.
 */
export function randomPalette(seed: number, count: number): string[] {
  const n = Math.min(LIMITS.paletteLength.max, Math.max(LIMITS.paletteLength.min, Math.round(count)));
  const rnd = mulberry32(seed ^ 0x9a1e77e);
  const base = rnd() * Math.PI * 2;
  const spread = (0.35 + rnd() * 0.6) * Math.PI * 2;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const hue = base + (spread * i) / Math.max(1, n - 1) + (rnd() - 0.5) * 0.3;
    let L: number;
    let C: number;
    if (i === 0) {
      L = 0.16 + rnd() * 0.16; // dark anchor
      C = 0.04 + rnd() * 0.1;
    } else if (i === n - 1) {
      L = 0.86 + rnd() * 0.1; // light anchor
      C = 0.03 + rnd() * 0.08;
    } else {
      L = 0.55 + rnd() * 0.25;
      C = 0.12 + rnd() * 0.1;
    }
    out.push(formatHex(oklchToSrgb(L, C, hue)));
  }
  return out;
}

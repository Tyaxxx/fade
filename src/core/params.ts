import { formatHex, parseHex } from './color';

export type FalloffCurve = 'linear' | 'smooth' | 'gaussian';
export type GrainMode = 'mono' | 'color';
export interface Seeds { layout: number; shape: number; colors: number; grain: number }
export interface FadeParams {
  width: number;
  height: number;
  palette: string[];
  zones: { count: number; size: number; sizeVariation: number };
  falloff: { curve: FalloffCurve; softness: number };
  blur: number;
  grain: { amount: number; size: number; mode: GrainMode };
  /**
   * Adds triangular-PDF noise of ±1 LSB per channel before 8-bit rounding,
   * which breaks up banding in smooth, grain-free gradients. Invisible at
   * normal viewing, and mostly redundant when grain > 0. Default true.
   * Not exposed in the UI. Set `"dither": false` in a settings file (or
   * params) to turn it off.
   */
  dither: boolean;
  seeds: Seeds;
}

export const FALLOFF_CURVES: readonly FalloffCurve[] = ['linear', 'smooth', 'gaussian'];
export const GRAIN_MODES: readonly GrainMode[] = ['mono', 'color'];
export const SEED_STREAMS: readonly (keyof Seeds)[] = ['layout', 'shape', 'colors', 'grain'];

export const LIMITS = {
  width: { min: 16, max: 8192 },
  height: { min: 16, max: 8192 },
  paletteLength: { min: 2, max: 8 },
  zoneCount: { min: 1, max: 16 },
  zoneSize: { min: 0.1, max: 1.5 },
  sizeVariation: { min: 0, max: 1 },
  softness: { min: 0, max: 1 },
  blur: { min: 0, max: 1 },
  grainAmount: { min: 0, max: 1 },
  grainSize: { min: 0.5, max: 6 },
} as const;

export const DEFAULT_PARAMS: FadeParams = {
  width: 1920,
  height: 1080,
  palette: ['#5b2bd6', '#e0338f', '#ff8a3d', '#3fd0e6', '#1f3fae'],
  zones: { count: 6, size: 0.75, sizeVariation: 0.45 },
  falloff: { curve: 'smooth', softness: 0.7 },
  blur: 0.25,
  grain: { amount: 0.2, size: 0.8, mode: 'mono' },
  dither: true,
  seeds: { layout: 1958215, shape: 734221, colors: 99172, grain: 4311 },
};

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});

function num(v: unknown, fallback: number, lim: { min: number; max: number }, int = false): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  const x = int ? Math.round(v) : v;
  return Math.min(lim.max, Math.max(lim.min, x));
}

function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}

function seed(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) >>> 0 : fallback;
}

function palette(v: unknown): string[] {
  if (!Array.isArray(v)) return [...DEFAULT_PARAMS.palette];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') continue;
    const rgb = parseHex(item);
    if (rgb) out.push(formatHex(rgb));
  }
  if (out.length === 0) return [...DEFAULT_PARAMS.palette];
  const fill = ['#0b0b14', '#f4efe6'];
  for (let i = 0; out.length < LIMITS.paletteLength.min; i++) out.push(fill[i % 2]);
  return out.slice(0, LIMITS.paletteLength.max);
}

/** Clamp and fill a possibly-partial params object. Never throws. */
export function normalizeParams(input: unknown): FadeParams {
  const o = asObj(input);
  const d = DEFAULT_PARAMS;
  const z = asObj(o.zones);
  const f = asObj(o.falloff);
  const g = asObj(o.grain);
  const s = asObj(o.seeds);
  return {
    width: num(o.width, d.width, LIMITS.width, true),
    height: num(o.height, d.height, LIMITS.height, true),
    palette: palette(o.palette),
    zones: {
      count: num(z.count, d.zones.count, LIMITS.zoneCount, true),
      size: num(z.size, d.zones.size, LIMITS.zoneSize),
      sizeVariation: num(z.sizeVariation, d.zones.sizeVariation, LIMITS.sizeVariation),
    },
    falloff: {
      curve: oneOf(f.curve, FALLOFF_CURVES, d.falloff.curve),
      softness: num(f.softness, d.falloff.softness, LIMITS.softness),
    },
    blur: num(o.blur, d.blur, LIMITS.blur),
    grain: {
      amount: num(g.amount, d.grain.amount, LIMITS.grainAmount),
      size: num(g.size, d.grain.size, LIMITS.grainSize),
      mode: oneOf(g.mode, GRAIN_MODES, d.grain.mode),
    },
    dither: typeof o.dither === 'boolean' ? o.dither : d.dither,
    seeds: {
      layout: seed(s.layout, d.seeds.layout),
      shape: seed(s.shape, d.seeds.shape),
      colors: seed(s.colors, d.seeds.colors),
      grain: seed(s.grain, d.seeds.grain),
    },
  };
}

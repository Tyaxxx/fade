import { FALLOFF_CURVES, randomizeSeeds, randomPalette, SEED_STREAMS, type FadeParams, type Seeds } from '../../core/index';

/** The look sections that can be locked and randomized. Format and Seed never are. */
export type Look = 'colors' | 'shape' | 'texture';
export const LOOKS: readonly Look[] = ['colors', 'shape', 'texture'];
export type LookLocks = Record<Look, boolean>;
export const LOOK_LABELS: Record<Look, string> = { colors: 'Colours', shape: 'Shape', texture: 'Texture' };

const STREAMS: Record<Look, (keyof Seeds)[]> = { colors: ['colors'], shape: ['layout', 'shape'], texture: ['grain'] };

type Rng = () => number;
/** Uniform value in [min, max], rounded to `step` (float noise removed). */
const pick = (rng: Rng, min: number, max: number, step: number) => {
  const v = Math.round((min + rng() * (max - min)) / step) * step;
  return Number(Math.min(max, Math.max(min, v)).toFixed(4));
};

/**
 * Re-roll the given looks: their visible parameters (within curated, pleasant
 * ranges) and the seed streams behind them. Everything else (size, dither,
 * other looks) is untouched. `looks = []` returns `params` itself.
 */
export function randomizeLooks(params: FadeParams, looks: readonly Look[], rng: Rng = Math.random): FadeParams {
  if (looks.length === 0) return params;
  const reroll = new Set(looks.flatMap((l) => STREAMS[l]));
  const locks = Object.fromEntries(SEED_STREAMS.map((k) => [k, !reroll.has(k)]));
  const next: FadeParams = { ...params, seeds: randomizeSeeds(params.seeds, locks, rng) };
  if (looks.includes('colors')) {
    next.palette = randomPalette(Math.floor(rng() * 2 ** 32), params.palette.length);
  }
  if (looks.includes('shape')) {
    next.zones = {
      count: Math.min(10, 3 + Math.floor(rng() * 8)),
      size: pick(rng, 0.5, 1.1, 0.01),
      sizeVariation: pick(rng, 0.2, 0.8, 0.01),
    };
    next.falloff = {
      curve: FALLOFF_CURVES[Math.min(FALLOFF_CURVES.length - 1, Math.floor(rng() * FALLOFF_CURVES.length))],
      softness: pick(rng, 0.4, 0.95, 0.01),
    };
  }
  if (looks.includes('texture')) {
    next.grain = {
      amount: pick(rng, 0.05, 0.45, 0.01),
      size: pick(rng, 0.6, 2.5, 0.1),
      mode: rng() < 0.75 ? 'mono' : 'color',
    };
    next.blur = pick(rng, 0, 0.5, 0.01);
  }
  return next;
}

export function unlockedLooks(locks: LookLocks): Look[] {
  return LOOKS.filter((l) => !locks[l]);
}

/** Names of the locked looks as a sentence, e.g. "Colours and texture kept"; null when nothing is locked. */
export function keptHint(locks: LookLocks): string | null {
  const names = LOOKS.filter((l) => locks[l]).map((l) => LOOK_LABELS[l].toLowerCase());
  if (names.length === 0) return null;
  if (names.length === LOOKS.length) return 'Everything kept, so nothing will change';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} kept`;
}

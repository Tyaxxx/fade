import type { Seeds } from './params';
import { SEED_STREAMS } from './params';

const MAX = 0xffffffff;

export function encodeSeedCode(seeds: Seeds): string {
  return SEED_STREAMS.map((k) => (seeds[k] >>> 0).toString(36)).join('-');
}

export function decodeSeedCode(code: string): Seeds | null {
  const parts = code.trim().toLowerCase().split('-');
  if (parts.length !== SEED_STREAMS.length) return null;
  const values: number[] = [];
  for (const p of parts) {
    if (!/^[0-9a-z]{1,7}$/.test(p)) return null;
    const v = parseInt(p, 36);
    if (!Number.isFinite(v) || v > MAX) return null;
    values.push(v);
  }
  const [layout, shape, colors, grain] = values;
  return { layout, shape, colors, grain };
}

/** Re-roll every unlocked stream; locked streams are kept as they are. */
export function randomizeSeeds(
  seeds: Seeds,
  locks: Partial<Record<keyof Seeds, boolean>>,
  rng: () => number = Math.random,
): Seeds {
  const out = { ...seeds };
  for (const k of SEED_STREAMS) {
    if (locks[k]) continue;
    let v = Math.floor(rng() * 4294967296) >>> 0;
    if (v === seeds[k]) v = (v + 1) >>> 0;
    out[k] = v;
  }
  return out;
}

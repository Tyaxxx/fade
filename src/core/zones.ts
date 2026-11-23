import type { FadeParams } from './params';
import { hashUnit } from './rng';

/**
 * One colour blob. `x`/`y` are frame-relative (0..1 spans the frame, may bleed
 * outside), `radius` is relative to the short side, `aspect` ≥ 1 stretches the
 * blob along `angle` (radians). `color` indexes the palette.
 */
export interface Zone {
  x: number;
  y: number;
  radius: number;
  aspect: number;
  angle: number;
  color: number;
}

// R2 low-discrepancy sequence constants (spread zones without clustering, prefix-stable).
const R2X = 0.7548776662466927;
const R2Y = 0.5698402909980532;
const BLEED = 0.15;

function frac(v: number): number {
  return v - Math.floor(v);
}

/** Deterministic zone geometry. Each value is hashed per zone, so streams are independent. */
export function layoutZones(params: FadeParams): Zone[] {
  const { count, size, sizeVariation } = params.zones;
  const { layout, shape, colors } = params.seeds;
  const n = params.palette.length;

  // Colour cycle: a seeded shuffle of the palette, repeated. Independent of count.
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(hashUnit(colors, 0x5eed, i) * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }

  const ox = hashUnit(layout, 0xa1);
  const oy = hashUnit(layout, 0xa2);
  const zones: Zone[] = [];
  for (let i = 0; i < count; i++) {
    const jx = (hashUnit(layout, i, 1) - 0.5) * 0.35;
    const jy = (hashUnit(layout, i, 2) - 0.5) * 0.35;
    const x = -BLEED + (1 + 2 * BLEED) * frac(ox + (i + 1) * R2X + jx);
    const y = -BLEED + (1 + 2 * BLEED) * frac(oy + (i + 1) * R2Y + jy);
    const jitter = hashUnit(layout, i, 3) * 2 - 1;
    const radius = size * Math.max(0.15, 1 + sizeVariation * 0.7 * jitter);

    // Elongation biased toward 1..2.5, occasionally reaching 4:1 streaks.
    const e = hashUnit(shape, i, 1);
    const aspect = 1 + 3 * Math.pow(e, 2.2);
    const angle = hashUnit(shape, i, 2) * Math.PI;

    const cycle = Math.floor(i / n);
    const color = perm[(i + cycle) % n];
    zones.push({ x, y, radius, aspect, angle, color });
  }
  return zones;
}

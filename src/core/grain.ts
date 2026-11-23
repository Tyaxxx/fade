import { hash2 as importedHash2 } from './noise';

// Local alias: keeps the hot loop calling a plain function (some module loaders wrap imports in getters).
const hash2 = importedHash2;
import type { FadeParams } from './params';

// Internal look constants (tuned against assets/examples).
const SIGMA_AT_FULL = 0.075; // grain std-dev (0..1 units) at amount = 1
const PIXEL_WEIGHT_COARSE = 0.4; // per-pixel layer under clumped grain
const CLUMP_NEAREST = 0.65; // hard-edged share of the clumped layer
const MOTTLE_CELLS = 12; // mottle cell size, in grain cells
const MOTTLE_MAX = 0.55; // mottle weight at size ≥ 4
const COARSE_DAMP = 0.7; // coarse specks read stronger than fine grain at equal variance

/** Unit-variance, roughly gaussian value in about [-2.45, 2.45] from a hash. */
const TRI_K = 2.449 / 65536;
function tri(h: number): number {
  return TRI_K * ((h & 0xffff) + (h >>> 16) - 65536);
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export interface GrainSampler {
  /** Channels per sample: 1 (mono) or 3 (colour). */
  channels: 1 | 3;
  /** Fill `out` with `width × channels` grain values (0..1 units, signed) for row `y`. */
  row(y: number, width: number, out: Float32Array): void;
}

/** Layered grain in render-pixel space. Returns null when amount is 0. */
export function createGrain(params: FadeParams, scale: number): GrainSampler | null {
  const { amount, size, mode } = params.grain;
  if (amount <= 0) return null;
  const sigma = amount * SIGMA_AT_FULL;
  const channels = mode === 'mono' ? 1 : 3;
  const seeds = [0, 1, 2].map((c) => hash2(params.seeds.grain | 0, c, 0x6a41));

  if (size <= 1) {
    return {
      channels,
      row(y, width, out) {
        for (let c = 0; c < channels; c++) {
          const s = seeds[c];
          const yh = Math.imul(y, 0x165667b1);
          for (let x = 0; x < width; x++) {
            // Inlined hash2(x, y, s) + tri() for speed.
            let h = (s ^ Math.imul(x, 0x27d4eb2d) ^ yh) | 0;
            h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
            h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
            h ^= h >>> 16;
            out[x * channels + c] = sigma * TRI_K * ((h & 0xffff) + (h >>> 16) - 65536);
          }
        }
      },
    };
  }

  const cell = Math.max(1, size * scale);
  const inv = 1 / cell;
  const mInv = inv / MOTTLE_CELLS;
  const mottleW = MOTTLE_MAX * Math.min(1, (size - 1) / 3);
  // Rough variance normalisation so amount means the same at every size.
  const norm = (COARSE_DAMP * sigma) / Math.sqrt(0.62 + PIXEL_WEIGHT_COARSE ** 2 + mottleW * mottleW * 0.45);

  // Lattice values interpolated vertically for the current row, reused across x.
  const latticeRow = (fy: number, cells: number, s: number, near: Float32Array | null, col: Float32Array) => {
    const j = Math.floor(fy);
    const ty = smooth(fy - j);
    for (let i = 0; i < cells; i++) {
      const a = tri(hash2(i, j, s));
      const b = tri(hash2(i, j + 1, s));
      if (near) near[i] = a;
      col[i] = a + ty * (b - a);
    }
  };
  let near = new Float32Array(0);
  let col = new Float32Array(0);
  let mcol = new Float32Array(0);

  return {
    channels,
    row(y, width, out) {
      const cells = Math.floor((width - 1) * inv) + 2;
      const mcells = Math.floor((width - 1) * mInv) + 2;
      if (near.length < cells) {
        near = new Float32Array(cells);
        col = new Float32Array(cells);
      }
      if (mcol.length < mcells) mcol = new Float32Array(mcells);
      for (let c = 0; c < channels; c++) {
        const s = seeds[c];
        const yh = Math.imul(y, 0x165667b1);
        latticeRow(y * inv, cells, s ^ 0x1234567, near, col);
        if (mottleW > 0) latticeRow(y * mInv, mcells, s ^ 0x7654321, null, mcol);
        coarseRow(out, width, channels, c, s, yh, inv, mInv, mottleW, norm, near, col, mcol);
      }
    },
  };
}

/** Grain strength by luminance: k = DARK - SLOPE × lum (stronger in shadows and midtones). */
export const GRAIN_SHAPE_DARK = 1.25;
export const GRAIN_SHAPE_SLOPE = 0.6;

/** Clumped grain for one channel of one row (top-level so the engine optimises it well). */
function coarseRow(
  out: Float32Array, width: number, channels: number, c: number, s: number, yh: number,
  inv: number, mInv: number, mottleW: number, norm: number,
  near: Float32Array, col: Float32Array, mcol: Float32Array,
): void {
  const keepNear = CLUMP_NEAREST;
  const keepBil = 1 - CLUMP_NEAREST;
  const pixelW = PIXEL_WEIGHT_COARSE;
  const triK = TRI_K;
  for (let x = 0; x < width; x++) {
    const fx = x * inv;
    const i = fx | 0;
    let tx = fx - i;
    tx = tx * tx * (3 - 2 * tx);
    const bil = col[i] + tx * (col[i + 1] - col[i]);
    let h = (s ^ Math.imul(x, 0x27d4eb2d) ^ yh) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    const px = triK * ((h & 0xffff) + (h >>> 16) - 65536);
    let v = keepNear * near[i] + keepBil * bil + pixelW * px;
    if (mottleW > 0) {
      const mx = x * mInv;
      const mi = mx | 0;
      let mt = mx - mi;
      mt = mt * mt * (3 - 2 * mt);
      v += mottleW * (mcol[mi] + mt * (mcol[mi + 1] - mcol[mi]));
    }
    out[x * channels + c] = norm * v;
  }
}

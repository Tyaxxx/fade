import { srgbToLab } from './color';
import { parseHex } from './color';
import { fbm } from './noise';
import type { FadeParams } from './params';
import type { Zone } from './zones';

export interface Field {
  width: number;
  height: number;
  /** Interleaved OKLab, 3 floats per pixel. */
  data: Float32Array;
}

// Internal look constants (tuned against assets/examples).
export const FIELD_MAX_EDGE = 768;
const WARP_STRENGTH = 0.16; // in short-side units
const WARP_FREQ = 1.3; // cycles per short side
const WARP_GRID = 48; // warp samples per short side

/**
 * Blend sharpness β of the soft-Voronoi weights w = exp(-β·E(d)).
 * Softness 0 → near-Voronoi (still soft), 1 → wide, mushy blends.
 */
export function softnessToSharpness(softness: number): number {
  const t = 1 - softness;
  return 3.2 + t * t * 26;
}

// Share of lost chroma restored after blending (keeps orange→teal from going grey).
const CHROMA_KEEP = 0.5;

// Per-curve energy scale so the three curves have comparable softness.
const CURVE_SCALE = [1, 1.1, 0.55];

/**
 * Render the colour field for `zones` at `fw×fh`. Geometry is resolution
 * independent: everything is measured in short-side units of the output frame.
 */
export function renderField(params: FadeParams, zones: Zone[], fw: number, fh: number): Field {
  const aspectX = params.width / Math.min(params.width, params.height);
  const aspectY = params.height / Math.min(params.width, params.height);
  const labs = params.palette.map((hex) => srgbToLab(parseHex(hex) ?? [0, 0, 0]));
  const curveCode = params.falloff.curve === 'gaussian' ? 2 : params.falloff.curve === 'smooth' ? 1 : 0;
  const beta = softnessToSharpness(params.falloff.softness) * CURVE_SCALE[curveCode];
  const energy = new Float64Array(zones.length);
  const seed = params.seeds.shape | 0;

  const n = zones.length;
  const zx = new Float64Array(n);
  const zy = new Float64Array(n);
  const cosA = new Float64Array(n);
  const sinA = new Float64Array(n);
  const invU = new Float64Array(n);
  const invV = new Float64Array(n);
  const zl = new Float64Array(n);
  const za = new Float64Array(n);
  const zb = new Float64Array(n);
  const zc = new Float64Array(n);
  zones.forEach((z, i) => {
    zx[i] = z.x * aspectX;
    zy[i] = z.y * aspectY;
    cosA[i] = Math.cos(z.angle);
    sinA[i] = Math.sin(z.angle);
    const s = Math.sqrt(z.aspect);
    invU[i] = 1 / (z.radius * s);
    invV[i] = s / z.radius;
    const lab = labs[z.color] ?? labs[0];
    zl[i] = lab[0];
    za[i] = lab[1];
    zb[i] = lab[2];
    zc[i] = Math.hypot(lab[1], lab[2]);
  });

  // One shared domain warp makes all blob edges organic. It is low-frequency, so it is
  // sampled on a fixed grid in short-side units (identical at every render scale) and
  // interpolated bilinearly.
  const gw = Math.ceil(aspectX * WARP_GRID) + 2;
  const gh = Math.ceil(aspectY * WARP_GRID) + 2;
  const warp = new Float64Array(gw * gh * 2);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const gx = (i / WARP_GRID) * WARP_FREQ;
      const gy = (j / WARP_GRID) * WARP_FREQ;
      warp[(j * gw + i) * 2] = WARP_STRENGTH * fbm(gx, gy, seed, 3);
      warp[(j * gw + i) * 2 + 1] = WARP_STRENGTH * fbm(gx + 31.7, gy - 17.3, seed ^ 0x51ed, 3);
    }
  }

  const data = new Float32Array(fw * fh * 3);
  for (let y = 0; y < fh; y++) {
    const py0 = ((y + 0.5) / fh) * aspectY;
    const gyf = py0 * WARP_GRID;
    const gj = Math.floor(gyf);
    const ty = gyf - gj;
    for (let x = 0; x < fw; x++) {
      const px0 = ((x + 0.5) / fw) * aspectX;
      const gxf = px0 * WARP_GRID;
      const gi = Math.floor(gxf);
      const tx = gxf - gi;
      const g00 = (gj * gw + gi) * 2;
      const g10 = g00 + 2;
      const g01 = g00 + gw * 2;
      const g11 = g01 + 2;
      const wx0 = warp[g00] + tx * (warp[g10] - warp[g00]);
      const wx1 = warp[g01] + tx * (warp[g11] - warp[g01]);
      const wy0 = warp[g00 + 1] + tx * (warp[g10 + 1] - warp[g00 + 1]);
      const wy1 = warp[g01 + 1] + tx * (warp[g11 + 1] - warp[g01 + 1]);
      const px = px0 + wx0 + ty * (wx1 - wx0);
      const py = py0 + wy0 + ty * (wy1 - wy0);

      // Soft Voronoi: each zone claims space by a smooth distance energy; softmax blends.
      let emin = Infinity;
      for (let i = 0; i < n; i++) {
        const dx = px - zx[i];
        const dy = py - zy[i];
        const u = (dx * cosA[i] + dy * sinA[i]) * invU[i];
        const v = (-dx * sinA[i] + dy * cosA[i]) * invV[i];
        const d2 = u * u + v * v;
        // linear: E = d; smooth: hyperbolic (quadratic core, linear tail); gaussian: E = d².
        const e = curveCode === 0 ? Math.sqrt(d2) : curveCode === 1 ? Math.sqrt(1 + d2) - 1 : d2;
        energy[i] = e;
        if (e < emin) emin = e;
      }
      let sw = 0;
      let sl = 0;
      let sa = 0;
      let sb = 0;
      let sc = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.exp(-beta * (energy[i] - emin));
        sw += w;
        sl += w * zl[i];
        sa += w * za[i];
        sb += w * zb[i];
        sc += w * zc[i];
      }
      const a = sa / sw;
      const b = sb / sw;
      const c = Math.hypot(a, b);
      // Restore part of the chroma lost by averaging different hues.
      const gain = c > 1e-4 ? (c + CHROMA_KEEP * (sc / sw - c)) / c : 1;
      const o = (y * fw + x) * 3;
      data[o] = sl / sw;
      data[o + 1] = a * gain;
      data[o + 2] = b * gain;
    }
  }
  return { width: fw, height: fh, data };
}

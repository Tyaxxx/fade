import { labToLinearInto, linearToSrgb } from './color';
import { blurField } from './blur';
import { DITHER_SEED_A, DITHER_SEED_B } from './dither';
import { FIELD_MAX_EDGE, renderField } from './field';
import { createGrain, GRAIN_SHAPE_DARK, GRAIN_SHAPE_SLOPE } from './grain';
import { normalizeParams, type FadeParams } from './params';
import { cubicTaps } from './resample';
import { layoutZones } from './zones';

export interface RenderedImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const INV256 = 1 / 256;

/** Field (OKLab) → sRGB 0..1 floats, in place. */
function fieldToSrgb(data: Float32Array): void {
  const lin = [0, 0, 0];
  for (let i = 0; i < data.length; i += 3) {
    labToLinearInto(data[i], data[i + 1], data[i + 2], lin, 0);
    for (let c = 0; c < 3; c++) data[i + c] = linearToSrgb(Math.min(1, Math.max(0, lin[c])));
  }
}

/**
 * Shade one output row: horizontal Catmull-Rom from the vertically interpolated
 * field row, then grain, dither and 8-bit quantisation. Kept as its own small
 * function so the engine optimises the hot loop.
 */
function shadeRow(
  out: Uint8ClampedArray, o: number, width: number, y: number,
  row: Float32Array, idx: Int32Array, wt: Float32Array,
  grainRow: Float32Array | null, grainChannels: number,
  shapeDark: number, shapeSlope: number, dither: boolean, seedA: number, seedB: number,
): void {
  const yh = Math.imul(y, 0x165667b1);
  for (let x = 0; x < width; x++) {
    const t = x * 4;
    const c0 = idx[t] * 3;
    const c1 = idx[t + 1] * 3;
    const c2 = idx[t + 2] * 3;
    const c3 = idx[t + 3] * 3;
    const v0 = wt[t];
    const v1 = wt[t + 1];
    const v2 = wt[t + 2];
    const v3 = wt[t + 3];
    let r = v0 * row[c0] + v1 * row[c1] + v2 * row[c2] + v3 * row[c3];
    let g = v0 * row[c0 + 1] + v1 * row[c1 + 1] + v2 * row[c2 + 1] + v3 * row[c3 + 1];
    let b = v0 * row[c0 + 2] + v1 * row[c1 + 2] + v2 * row[c2 + 2] + v3 * row[c3 + 2];
    if (grainRow !== null) {
      const k = shapeDark - shapeSlope * (0.2126 * r + 0.7152 * g + 0.0722 * b);
      if (grainChannels === 1) {
        const n = k * grainRow[x];
        r += n;
        g += n;
        b += n;
      } else {
        r += k * grainRow[x * 3];
        g += k * grainRow[x * 3 + 1];
        b += k * grainRow[x * 3 + 2];
      }
    }
    r *= 255;
    g *= 255;
    b *= 255;
    if (dither) {
      // TPDF dither (±1 LSB) from two inlined hashes of (x, y).
      const xh = Math.imul(x, 0x27d4eb2d);
      let a = (seedA ^ xh ^ yh) | 0;
      a = Math.imul(a ^ (a >>> 15), 0x85ebca6b);
      a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
      a ^= a >>> 16;
      let d = (seedB ^ xh ^ yh) | 0;
      d = Math.imul(d ^ (d >>> 15), 0x85ebca6b);
      d = Math.imul(d ^ (d >>> 13), 0xc2b2ae35);
      d ^= d >>> 16;
      r += ((a & 255) + ((a >>> 8) & 255) - 255) * INV256;
      g += (((a >>> 16) & 255) + (a >>> 24) - 255) * INV256;
      b += ((d & 255) + ((d >>> 8) & 255) - 255) * INV256;
    }
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
    o += 4;
  }
}

/**
 * Render a fade image. Deterministic: identical params give identical bytes.
 * `scale` (0..1] renders a smaller image that looks like the full one.
 */
export function generate(input: FadeParams, opts: { scale?: number } = {}): RenderedImage {
  const params = normalizeParams(input);
  const scale = Math.min(1, Math.max(1e-3, opts.scale ?? 1));
  const width = Math.max(1, Math.round(params.width * scale));
  const height = Math.max(1, Math.round(params.height * scale));

  // 1. Low-frequency colour field (OKLab) at ≤ FIELD_MAX_EDGE, blurred, then to sRGB.
  const long = Math.max(width, height);
  const fieldLong = Math.min(FIELD_MAX_EDGE, long);
  const fw = Math.max(2, Math.round((width * fieldLong) / long));
  const fh = Math.max(2, Math.round((height * fieldLong) / long));
  const field = renderField(params, layoutZones(params), fw, fh);
  blurField(field.data, fw, fh, params.blur * Math.min(fw, fh) * 0.1);
  fieldToSrgb(field.data);

  // 2. Bicubic upsample row by row, 3. grain + dither + quantise.
  const out = new Uint8ClampedArray(width * height * 4);
  const tx = cubicTaps(fw, width);
  const ty = cubicTaps(fh, height);
  const src = field.data;
  const row = new Float32Array(fw * 3);
  const grain = createGrain(params, scale);
  const grainRow = grain ? new Float32Array(width * grain.channels) : null;
  const stride = fw * 3;
  for (let y = 0; y < height; y++) {
    const r0 = ty.idx[y * 4] * stride;
    const r1 = ty.idx[y * 4 + 1] * stride;
    const r2 = ty.idx[y * 4 + 2] * stride;
    const r3 = ty.idx[y * 4 + 3] * stride;
    const w0 = ty.wt[y * 4];
    const w1 = ty.wt[y * 4 + 1];
    const w2 = ty.wt[y * 4 + 2];
    const w3 = ty.wt[y * 4 + 3];
    for (let i = 0; i < stride; i++) {
      row[i] = w0 * src[r0 + i] + w1 * src[r1 + i] + w2 * src[r2 + i] + w3 * src[r3 + i];
    }
    if (grain && grainRow) grain.row(y, width, grainRow);
    shadeRow(
      out, y * width * 4, width, y, row, tx.idx, tx.wt, grainRow, grain?.channels ?? 1,
      GRAIN_SHAPE_DARK, GRAIN_SHAPE_SLOPE, params.dither, DITHER_SEED_A, DITHER_SEED_B,
    );
  }
  return { width, height, data: out };
}

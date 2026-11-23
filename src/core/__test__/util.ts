import type { RenderedImage } from '../generate';

/** Luma (0..255) of every pixel. */
export function luma(img: RenderedImage): Float64Array {
  const out = new Float64Array(img.width * img.height);
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2];
  }
  return out;
}

export function maxNeighbourDelta(img: RenderedImage): number {
  let m = 0;
  const { width: w, height: h, data } = img;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        if (x + 1 < w) m = Math.max(m, Math.abs(data[i + c] - data[i + 4 + c]));
        if (y + 1 < h) m = Math.max(m, Math.abs(data[i + c] - data[i + w * 4 + c]));
      }
    }
  }
  return m;
}

export function laplacianVariance(img: RenderedImage): number {
  const L = luma(img);
  const { width: w, height: h } = img;
  let sum = 0;
  let sq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = L[i - 1] + L[i + 1] + L[i - w] + L[i + w] - 4 * L[i];
      sum += v;
      sq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sq / n - mean * mean;
}

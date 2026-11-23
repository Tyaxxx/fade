/** Fast integer hash of a lattice point (int32, stays a small integer for speed). */
export function hash2(x: number, y: number, seed: number): number {
  let h = (seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return h ^ (h >>> 16);
}

const GRADS = new Float64Array(32);
for (let i = 0; i < 16; i++) {
  GRADS[i * 2] = Math.cos((i / 16) * Math.PI * 2);
  GRADS[i * 2 + 1] = Math.sin((i / 16) * Math.PI * 2);
}

function grad(ix: number, iy: number, seed: number, dx: number, dy: number): number {
  const g = (hash2(ix, iy, seed) & 15) << 1;
  return GRADS[g] * dx + GRADS[g + 1] * dy;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Seeded 2D gradient noise, roughly in [-0.7, 0.7]. */
export function gradientNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fade(fx);
  const v = fade(fy);
  const n00 = grad(ix, iy, seed, fx, fy);
  const n10 = grad(ix + 1, iy, seed, fx - 1, fy);
  const n01 = grad(ix, iy + 1, seed, fx, fy - 1);
  const n11 = grad(ix + 1, iy + 1, seed, fx - 1, fy - 1);
  const a = n00 + u * (n10 - n00);
  const b = n01 + u * (n11 - n01);
  return a + v * (b - a);
}

/** Fractal (fBm) gradient noise with `octaves` layers. */
export function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * gradientNoise(x * f, y * f, (seed + o * 0x9e3779b9) | 0);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

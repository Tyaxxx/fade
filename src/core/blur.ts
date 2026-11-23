/** One box-blur pass along lines of interleaved 3-channel data (edge clamped). */
function boxPass(
  src: Float32Array, dst: Float32Array, len: number, lines: number,
  lineStride: number, step: number, r: number,
): void {
  const inv = 1 / (2 * r + 1);
  const last = (len - 1) * step;
  for (let line = 0; line < lines; line++) {
    const base = line * lineStride;
    for (let c = 0; c < 3; c++) {
      const b = base + c;
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[b + (i < 0 ? 0 : i >= len ? last : i * step)];
      for (let i = 0; i < len; i++) {
        dst[b + i * step] = acc * inv;
        const add = i + r + 1;
        const sub = i - r;
        acc += src[b + (add >= len ? last : add * step)] - src[b + (sub < 0 ? 0 : sub * step)];
      }
    }
  }
}

/** Approximate gaussian blur (3 box passes per axis), in place. `radius` in pixels. */
export function blurField(data: Float32Array, w: number, h: number, radius: number): void {
  if (radius < 0.5) return;
  const r = Math.max(1, Math.round(radius * 0.8));
  const tmp = new Float32Array(data.length);
  for (let pass = 0; pass < 3; pass++) {
    boxPass(data, tmp, w, h, w * 3, 3, r);
    boxPass(tmp, data, h, w, 3, w * 3, r);
  }
}

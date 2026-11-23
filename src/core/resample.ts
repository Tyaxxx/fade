/** Catmull-Rom weights and indices for mapping `srcLen` samples onto `dstLen`. */
export function cubicTaps(srcLen: number, dstLen: number): { idx: Int32Array; wt: Float32Array } {
  const idx = new Int32Array(dstLen * 4);
  const wt = new Float32Array(dstLen * 4);
  const ratio = srcLen / dstLen;
  for (let i = 0; i < dstLen; i++) {
    const s = (i + 0.5) * ratio - 0.5;
    const i0 = Math.floor(s);
    const t = s - i0;
    const t2 = t * t;
    const t3 = t2 * t;
    const w = [
      -0.5 * t3 + t2 - 0.5 * t,
      1.5 * t3 - 2.5 * t2 + 1,
      -1.5 * t3 + 2 * t2 + 0.5 * t,
      0.5 * t3 - 0.5 * t2,
    ];
    for (let k = 0; k < 4; k++) {
      idx[i * 4 + k] = Math.min(srcLen - 1, Math.max(0, i0 - 1 + k));
      wt[i * 4 + k] = w[k];
    }
  }
  return { idx, wt };
}

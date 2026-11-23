/**
 * Dithering: the last step before 8-bit output.
 *
 * Without it, a smooth gradient is rounded to 256 levels per channel and shows
 * visible steps (banding/contouring), most of all in dark, grain-free areas.
 * Dithering adds TPDF (triangular probability density) noise of ±1 LSB per
 * channel before rounding: each channel gets (u1 + u2 - 255) / 256 LSB, with
 * u1 and u2 uniform bytes from two hash streams, so the noise is triangular
 * in (-1, 1) with mean 0. That is smaller than one 8-bit step, so it is
 * invisible at normal viewing, and it is mostly masked when grain > 0.
 *
 * The step is inlined in `shadeRow` in `generate.ts` for speed; these seeds
 * pick its hash streams. It runs when `FadeParams.dither` is true (default).
 * There is no UI switch: set `"dither": false` in a settings file, or pass
 * `dither: false` to `generate`, to turn it off.
 */
export const DITHER_SEED_A = 0x0d17e5;
export const DITHER_SEED_B = 0x0d17e5 ^ 0x5bd1e995;

export type Rgb = [number, number, number]; // sRGB 0..255
export type Lab = [number, number, number]; // OKLab

const HEX6 = /^#?([0-9a-f]{6})$/i;
const HEX3 = /^#?([0-9a-f]{3})$/i;

export function parseHex(hex: string): Rgb | null {
  const s = hex.trim();
  let m = HEX6.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  m = HEX3.exec(s);
  if (m) {
    const [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16));
    return [r, g, b];
  }
  return null;
}

export function formatHex(rgb: Rgb): string {
  return (
    '#' +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Linear sRGB (0..1) → OKLab. */
export function linearToLab(r: number, g: number, b: number): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → linear sRGB (0..1, unclamped), written into `out` at `o`. */
export function labToLinearInto(L: number, a: number, b: number, out: Float32Array | number[], o: number): void {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  out[o] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[o + 1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[o + 2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}

export function srgbToLab(rgb: Rgb): Lab {
  return linearToLab(srgbToLinear(rgb[0] / 255), srgbToLinear(rgb[1] / 255), srgbToLinear(rgb[2] / 255));
}

/** OKLab → sRGB 0..255 floats (clamped to gamut). */
export function labToSrgb(lab: Lab): Rgb {
  const lin = [0, 0, 0];
  labToLinearInto(lab[0], lab[1], lab[2], lin, 0);
  return lin.map((c) => 255 * linearToSrgb(Math.max(0, Math.min(1, c)))) as Rgb;
}

/** OKLCH (L, C, hue in radians) → sRGB, reducing chroma until it fits the gamut. */
export function oklchToSrgb(L: number, C: number, h: number): Rgb {
  let c = C;
  for (let i = 0; i < 24; i++) {
    const lin = [0, 0, 0];
    labToLinearInto(L, c * Math.cos(h), c * Math.sin(h), lin, 0);
    if (lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4)) break;
    c *= 0.9;
  }
  return labToSrgb([L, c * Math.cos(h), c * Math.sin(h)]);
}

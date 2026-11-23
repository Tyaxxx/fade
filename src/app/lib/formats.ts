import { LIMITS } from '../../core/index';

export interface FormatPreset {
  id: string;
  name: string;
  width: number;
  height: number;
}

export const FORMAT_PRESETS: FormatPreset[] = [
  { id: 'square', name: 'Square', width: 2048, height: 2048 },
  { id: 'portrait', name: 'Portrait 4:5', width: 1080, height: 1350 },
  { id: 'story', name: 'Story 9:16', width: 1080, height: 1920 },
  { id: 'landscape', name: 'Landscape 16:9', width: 1920, height: 1080 },
  { id: 'phone', name: 'Phone wallpaper', width: 1290, height: 2796 },
  { id: 'desktop', name: 'Desktop', width: 2560, height: 1440 },
  { id: '4k', name: '4K UHD', width: 3840, height: 2160 },
];

const COMMON: [number, number][] = [
  [1, 1], [5, 4], [4, 3], [3, 2], [16, 10], [16, 9], [2, 1], [21, 9], [19.5, 9],
];

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** "16:9"; "≈9:19.5" for near-common ratios; otherwise "1.85:1". */
export function aspectLabel(w: number, h: number): string {
  const rw = Math.round(w);
  const rh = Math.round(h);
  const g = gcd(rw, rh) || 1;
  if (rw / g <= 32 && rh / g <= 32) return `${rw / g}:${rh / g}`;
  const r = w / h;
  for (const [x, y] of COMMON) {
    if (Math.abs(r / (x / y) - 1) < 0.01) return `≈${fmt(x)}:${fmt(y)}`;
    if (Math.abs(r / (y / x) - 1) < 0.01) return `≈${fmt(y)}:${fmt(x)}`;
  }
  return r >= 1 ? `${fmt(r)}:1` : `1:${fmt(1 / r)}`;
}

const clampDim = (v: number) => Math.min(LIMITS.width.max, Math.max(LIMITS.width.min, Math.round(v)));

/** Change one side and scale the other to keep the current ratio, within limits. */
export function resizeLocked(
  w: number,
  h: number,
  changed: 'width' | 'height',
  value: number,
): { width: number; height: number } {
  const ratio = w / h;
  let width = changed === 'width' ? value : value * ratio;
  let height = changed === 'height' ? value : value / ratio;
  const over = Math.max(width / LIMITS.width.max, height / LIMITS.height.max, 1);
  width /= over;
  height /= over;
  const under = Math.min(width / LIMITS.width.min, height / LIMITS.height.min, 1);
  width /= under;
  height /= under;
  return { width: clampDim(width), height: clampDim(height) };
}

/** What the stage bar shows: preset name (or "Custom"), pixel size, and the ratio unless the name already states it. */
export function stageReadout(width: number, height: number): { name: string; dims: string; ratio: string | null } {
  const name = FORMAT_PRESETS.find((p) => p.width === width && p.height === height)?.name ?? 'Custom';
  const ratio = aspectLabel(width, height);
  return { name, dims: `${width} × ${height} px`, ratio: name.includes(ratio) ? null : ratio };
}

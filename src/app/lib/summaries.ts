import { PALETTES, type FadeParams } from '../../core/index';

type Grain = FadeParams['grain'];

export const GRAIN_PRESETS: { id: 'none' | 'fine' | 'rough'; label: string; grain: Grain }[] = [
  { id: 'none', label: 'None', grain: { amount: 0, size: 0.8, mode: 'mono' } },
  { id: 'fine', label: 'Fine', grain: { amount: 0.2, size: 0.8, mode: 'mono' } }, // = DEFAULT_PARAMS.grain
  { id: 'rough', label: 'Rough', grain: { amount: 0.45, size: 3, mode: 'mono' } },
];

export type GrainPresetId = (typeof GRAIN_PRESETS)[number]['id'];

/** Which grain preset the values match. Any amount of 0 counts as "none". */
export function grainPresetId(g: Grain): GrainPresetId | null {
  if (g.amount === 0) return 'none';
  const hit = GRAIN_PRESETS.find((p) => p.grain.amount === g.amount && p.grain.size === g.size && p.grain.mode === g.mode);
  return hit?.id ?? null;
}

const TEXTURE_SUMMARY: Record<GrainPresetId, string> = { none: 'No grain', fine: 'Fine grain', rough: 'Rough grain' };

export function textureSummary(g: Grain): string {
  const id = grainPresetId(g);
  return id ? TEXTURE_SUMMARY[id] : 'Custom grain';
}

export function shapeSummary(z: FadeParams['zones']): string {
  return z.count === 1 ? '1 zone' : `${z.count} zones`;
}

export function paletteName(palette: string[]): string {
  const key = palette.join();
  return PALETTES.find((p) => p.colors.join() === key)?.name ?? 'Custom';
}

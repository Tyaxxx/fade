import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, PALETTES } from '../../core/index';
import { GRAIN_PRESETS, grainPresetId, paletteName, shapeSummary, textureSummary } from './summaries';

const preset = (id: string) => GRAIN_PRESETS.find((p) => p.id === id)!.grain;

describe('textureSummary', () => {
  it('calls the default grain Fine', () => {
    expect(textureSummary(DEFAULT_PARAMS.grain)).toBe('Fine grain');
  });

  it('names the grain preset or says custom', () => {
    expect(textureSummary({ amount: 0, size: 2, mode: 'color' })).toBe('No grain');
    expect(textureSummary(preset('fine'))).toBe('Fine grain');
    expect(textureSummary(preset('rough'))).toBe('Rough grain');
    expect(textureSummary({ amount: 0.33, size: 1.4, mode: 'color' })).toBe('Custom grain');
  });
});

describe('grainPresetId', () => {
  it('matches presets and gives null otherwise', () => {
    expect(grainPresetId({ amount: 0, size: 3, mode: 'mono' })).toBe('none');
    expect(grainPresetId(preset('rough'))).toBe('rough');
    expect(grainPresetId({ amount: 0.5, size: 1, mode: 'mono' })).toBeNull();
  });
});

describe('shapeSummary', () => {
  it('counts zones', () => {
    expect(shapeSummary({ ...DEFAULT_PARAMS.zones, count: 6 })).toBe('6 zones');
    expect(shapeSummary({ ...DEFAULT_PARAMS.zones, count: 1 })).toBe('1 zone');
  });
});

describe('paletteName', () => {
  it('gives the preset name or Custom', () => {
    expect(paletteName([...PALETTES[1].colors])).toBe(PALETTES[1].name);
    expect(paletteName(['#000000', '#ffffff'])).toBe('Custom');
    expect(paletteName([...DEFAULT_PARAMS.palette])).toBe('Bloom');
  });
});

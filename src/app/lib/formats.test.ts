import { describe, expect, it } from 'vitest';
import { aspectLabel, FORMAT_PRESETS, resizeLocked, stageReadout } from './formats';

describe('aspectLabel', () => {
  it('reduces simple ratios', () => {
    expect(aspectLabel(1920, 1080)).toBe('16:9');
    expect(aspectLabel(1080, 1350)).toBe('4:5');
    expect(aspectLabel(2048, 2048)).toBe('1:1');
    expect(aspectLabel(2560, 1440)).toBe('16:9');
  });
  it('approximates near-common ratios with ≈', () => {
    expect(aspectLabel(1290, 2796)).toBe('≈9:19.5');
  });
  it('falls back to n:1 for unusual ratios', () => {
    expect(aspectLabel(1850, 1000)).toBe('1.85:1');
    expect(aspectLabel(1000, 1850)).toBe('1:1.85');
  });
});

describe('resizeLocked', () => {
  it('keeps the ratio when width changes', () => {
    expect(resizeLocked(1920, 1080, 'width', 3840)).toEqual({ width: 3840, height: 2160 });
  });
  it('keeps the ratio when height changes', () => {
    expect(resizeLocked(1080, 1350, 'height', 2700)).toEqual({ width: 2160, height: 2700 });
  });
  it('clamps to 16..8192 while keeping the ratio', () => {
    expect(resizeLocked(1920, 1080, 'width', 20000)).toEqual({ width: 8192, height: 4608 });
    expect(resizeLocked(1000, 4000, 'width', 4000)).toEqual({ width: 2048, height: 8192 });
  });
});

describe('FORMAT_PRESETS', () => {
  it('includes the 4K preset', () => {
    expect(FORMAT_PRESETS.find((p) => p.width === 3840 && p.height === 2160)).toBeTruthy();
  });
});

describe('stageReadout (R8)', () => {
  it('omits the ratio when the preset name already contains it', () => {
    expect(stageReadout(1920, 1080)).toEqual({ name: 'Landscape 16:9', dims: '1920 × 1080 px', ratio: null });
  });
  it('shows the ratio for presets without one in their name, and for custom sizes', () => {
    expect(stageReadout(2560, 1440)).toEqual({ name: 'Desktop', dims: '2560 × 1440 px', ratio: '16:9' });
    expect(stageReadout(1000, 700)).toEqual({ name: 'Custom', dims: '1000 × 700 px', ratio: '10:7' });
  });
});

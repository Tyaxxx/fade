import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, normalizeParams } from './params';
import { parseSettings, serializeSettings } from './settings';

describe('settings', () => {
  it('serialises to versioned JSON and parses back to the same params', () => {
    const p = normalizeParams({ ...DEFAULT_PARAMS, width: 1234, palette: ['#010203', '#fefdfc', '#ff0000'] });
    const json = serializeSettings(p);
    const raw = JSON.parse(json);
    expect(raw.app).toBe('fade');
    expect(raw.version).toBe(1);
    expect(parseSettings(json)).toEqual({ ok: true, params: p });
  });

  it('rejects non-JSON with a readable error', () => {
    const r = parseSettings('{not json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/JSON/);
  });

  it('rejects other apps, missing or future versions, and missing params', () => {
    const cases = [
      JSON.stringify({ app: 'other', version: 1, params: {} }),
      JSON.stringify({ app: 'fade', params: {} }),
      JSON.stringify({ app: 'fade', version: 99, params: {} }),
      JSON.stringify({ app: 'fade', version: 1 }),
      JSON.stringify([1, 2]),
      'null',
    ];
    for (const c of cases) {
      const r = parseSettings(c);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(10);
    }
    const missing = parseSettings(JSON.stringify({ app: 'fade', params: {} }));
    if (!missing.ok) expect(missing.error).toMatch(/version/);
  });

  it('clamps out-of-range values instead of rejecting them', () => {
    const r = parseSettings(JSON.stringify({ app: 'fade', version: 1, params: { width: 99999, zones: { count: 50 } } }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.params.width).toBe(8192);
      expect(r.params.zones.count).toBe(16);
    }
  });
});

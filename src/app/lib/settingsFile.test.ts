import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS, serializeSettings } from '../../core/index';
import { MAX_SETTINGS_BYTES, readSettingsFile } from './settingsFile';

describe('readSettingsFile', () => {
  it('rejects files over 100 KB without reading them', async () => {
    const blob = new Blob(['x'.repeat(MAX_SETTINGS_BYTES + 1)]);
    const text = vi.spyOn(blob, 'text');
    const result = await readSettingsFile(blob);
    expect(result).toEqual({ ok: false, error: 'This file is too large to be a Fade settings file (over 100 KB).' });
    expect(text).not.toHaveBeenCalled();
  });

  it('accepts a valid settings file', async () => {
    const result = await readSettingsFile(new Blob([serializeSettings(DEFAULT_PARAMS)]));
    expect(result).toEqual({ ok: true, params: DEFAULT_PARAMS });
  });

  it('keeps the existing message for invalid JSON', async () => {
    const result = await readSettingsFile(new Blob(['{nope']));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/isn't valid JSON/);
  });
});

import { parseSettings, type ParseResult } from '../../core/index';

/** Real settings files are about 1 KB; anything this big is the wrong file. */
export const MAX_SETTINGS_BYTES = 100_000;

/** Read and parse a settings file, rejecting oversized files before reading them. */
export async function readSettingsFile(file: Blob): Promise<ParseResult> {
  if (file.size > MAX_SETTINGS_BYTES) {
    return { ok: false, error: 'This file is too large to be a Fade settings file (over 100 KB).' };
  }
  return parseSettings(await file.text());
}

import { normalizeParams, type FadeParams } from './params';

const APP = 'fade';
const VERSION = 1;

export function serializeSettings(p: FadeParams): string {
  return JSON.stringify({ app: APP, version: VERSION, params: normalizeParams(p) }, null, 2);
}

export type ParseResult = { ok: true; params: FadeParams } | { ok: false; error: string };

export function parseSettings(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "This file isn't valid JSON, so it can't be a Fade settings file." };
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: "This file isn't a Fade settings file (expected an object)." };
  }
  const o = raw as Record<string, unknown>;
  if (o.app !== APP) return { ok: false, error: "This file isn't a Fade settings file (wrong or missing app name)." };
  if (typeof o.version !== 'number') return { ok: false, error: "This file isn't a Fade settings file (missing version)." };
  if (o.version > VERSION) {
    return { ok: false, error: `This settings file is from a newer version of Fade (v${o.version}); this app reads v${VERSION}.` };
  }
  if (o.params === null || typeof o.params !== 'object' || Array.isArray(o.params)) {
    return { ok: false, error: 'This Fade settings file has no settings in it (missing params).' };
  }
  return { ok: true, params: normalizeParams(o.params) };
}

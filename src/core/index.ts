// Public interface of the generator module. Everything else in src/core is internal.
export type { FadeParams, FalloffCurve, GrainMode, Seeds } from './params';
export { DEFAULT_PARAMS, LIMITS, normalizeParams, SEED_STREAMS, FALLOFF_CURVES, GRAIN_MODES } from './params';
export type { RenderedImage } from './generate';
export { generate } from './generate';
export type { Zone } from './zones';
export { layoutZones } from './zones';
export type { Palette } from './palettes';
export { PALETTES, randomPalette } from './palettes';
export { randomizeSeeds, encodeSeedCode, decodeSeedCode } from './seeds';
export type { ParseResult } from './settings';
export { serializeSettings, parseSettings } from './settings';

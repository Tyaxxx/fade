import { describe, expect, it } from 'vitest';
import { decodeSeedCode, encodeSeedCode, randomizeSeeds } from './seeds';

const S = { layout: 1, shape: 4294967295, colors: 123456, grain: 0 };

describe('seeds', () => {
  it('encodes to four base36 groups and round-trips', () => {
    const code = encodeSeedCode(S);
    expect(code).toMatch(/^[0-9a-z]+-[0-9a-z]+-[0-9a-z]+-[0-9a-z]+$/);
    expect(code.split('-')[1]).toBe('1z141z3'); // 4294967295 in base36
    expect(decodeSeedCode(code)).toEqual(S);
  });

  it('decodes case-insensitively with surrounding whitespace', () => {
    expect(decodeSeedCode('  1-1Z141Z3-2N9C-0 ')).toEqual(S);
  });

  it('returns null for garbage', () => {
    expect(decodeSeedCode('')).toBeNull();
    expect(decodeSeedCode('hello')).toBeNull();
    expect(decodeSeedCode('1-2-3')).toBeNull();
    expect(decodeSeedCode('1-2-3-!')).toBeNull();
    expect(decodeSeedCode('1-2-3-zzzzzzzz')).toBeNull(); // > uint32
  });

  it('randomizeSeeds keeps locked streams and changes unlocked ones', () => {
    let i = 0;
    const rng = () => [0.1, 0.2, 0.3, 0.4][i++ % 4];
    const out = randomizeSeeds(S, { layout: true, grain: true }, rng);
    expect(out.layout).toBe(S.layout);
    expect(out.grain).toBe(S.grain);
    expect(out.shape).not.toBe(S.shape);
    expect(out.colors).not.toBe(S.colors);
    for (const v of Object.values(out)) expect(v >>> 0).toBe(v);
  });
});

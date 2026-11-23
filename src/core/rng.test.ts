import { describe, expect, it } from 'vitest';
import { hash32, hashUnit, mulberry32 } from './rng';

describe('rng', () => {
  it('hash32 is deterministic and sensitive to every argument', () => {
    expect(hash32(1, 2, 3)).toBe(hash32(1, 2, 3));
    expect(hash32(1, 2, 3)).not.toBe(hash32(1, 2, 4));
    expect(hash32(1, 2, 3)).not.toBe(hash32(2, 2, 3));
    expect(hash32(1, 2)).not.toBe(hash32(2, 1));
  });

  it('hash32 returns uint32', () => {
    for (let i = 0; i < 100; i++) {
      const h = hash32(i, 7);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });

  it('hashUnit values lie in [0,1) with a roughly uniform mean', () => {
    let sum = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const u = hashUnit(42, i);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      sum += u;
    }
    expect(sum / n).toBeGreaterThan(0.48);
    expect(sum / n).toBeLessThan(0.52);
  });

  it('mulberry32 repeats for the same seed and differs for another', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const c = mulberry32(124);
    const sa = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sa);
    expect([c(), c(), c()]).not.toEqual(sa);
    for (const v of sa) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

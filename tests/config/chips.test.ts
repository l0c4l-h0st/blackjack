import { describe, expect, it } from 'vitest';
import {
  RACK_CHIPS,
  chipStyle,
  decomposeAmount,
  formatCompact,
  formatCredits,
  formatSigned,
} from '../../src/config/chips';

describe('jetons', () => {
  it('8 dénominations dans le rack', () => {
    expect(RACK_CHIPS.map((c) => c.value)).toEqual([10, 50, 100, 500, 1000, 5000, 25000, 100000]);
  });

  it('décompose un montant en pile optimale', () => {
    expect(decomposeAmount(0)).toEqual([]);
    expect(decomposeAmount(10)).toEqual([10]);
    expect(decomposeAmount(160)).toEqual([100, 50, 10]);
    expect(decomposeAmount(1250)).toEqual([1000, 100, 100, 50]);
    expect(decomposeAmount(125_000)).toEqual([100_000, 25_000]);
    expect(decomposeAmount(25)).toEqual([10, 10, 5]);
    expect(decomposeAmount(4)).toEqual([]);
  });

  it('style d’un jeton', () => {
    expect(chipStyle(100_000).name).toBe('noir et or');
    expect(chipStyle(5).label).toBe('5');
    expect(() => chipStyle(7)).toThrow('Jeton inconnu');
  });

  it('formate les montants', () => {
    expect(formatCredits(12450)).toBe('12 450');
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(25_000)).toBe('25K');
    expect(formatCompact(1_500_000)).toBe('1,5M');
    expect(formatSigned(1200)).toBe('+1 200');
    expect(formatSigned(-50)).toBe('−50');
    expect(formatSigned(0)).toBe('0');
  });
});

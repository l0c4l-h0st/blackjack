import { describe, expect, it } from 'vitest';
import type { Rng } from '../../src/engine/rng';
import {
  CryptoRng,
  SeededRng,
  getDefaultRng,
  randomInt,
  shuffleInPlace,
} from '../../src/engine/rng';

/** χ² sur la position de chaque élément après N mélanges d'un tableau de taille n. */
function positionChiSquare(rng: Rng, n: number, trials: number): number {
  const counts = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let t = 0; t < trials; t++) {
    const arr = Array.from({ length: n }, (_, i) => i);
    shuffleInPlace(arr, rng);
    arr.forEach((value, position) => {
      (counts[value] as number[])[position] = ((counts[value] as number[])[position] ?? 0) + 1;
    });
  }
  const expected = trials / n;
  let chi = 0;
  for (const row of counts) for (const c of row) chi += (c - expected) ** 2 / expected;
  return chi;
}

describe('randomInt', () => {
  it('reste dans les bornes', () => {
    const rng = new SeededRng(1);
    for (let i = 0; i < 10_000; i++) {
      const x = randomInt(rng, 7);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(7);
    }
  });

  it('rejette les valeurs du dernier intervalle incomplet (pas de biais modulo)', () => {
    // 2^32 - 1 est au-delà de la limite pour max = 3 : il doit être rejeté.
    const values = [0xffff_ffff, 5];
    const rng: Rng = { nextUint32: () => values.shift() ?? 0 };
    expect(randomInt(rng, 3)).toBe(2);
  });

  it('refuse une borne invalide', () => {
    const rng = new SeededRng(1);
    expect(() => randomInt(rng, 0)).toThrow(RangeError);
    expect(() => randomInt(rng, 1.5)).toThrow(RangeError);
  });
});

describe('Fisher-Yates', () => {
  it('produit des positions uniformes (χ², 100 000 mélanges)', () => {
    // 5 éléments → 16 degrés de liberté ; seuil p = 0,001 ≈ 39,25.
    const chi = positionChiSquare(new SeededRng(2024), 5, 100_000);
    expect(chi).toBeLessThan(39.25);
  });

  it('est uniforme aussi avec le RNG crypto', () => {
    // seuil p = 0,0001 pour 16 ddl ≈ 45,9 (test non déterministe, marge large)
    const chi = positionChiSquare(new CryptoRng(), 5, 100_000);
    expect(chi).toBeLessThan(45.9);
  });

  it('produit les 24 permutations de 4 éléments avec la même fréquence', () => {
    const rng = new SeededRng(99);
    const counts = new Map<string, number>();
    const trials = 120_000;
    for (let t = 0; t < trials; t++) {
      const key = shuffleInPlace([0, 1, 2, 3], rng).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(24);
    const expected = trials / 24;
    let chi = 0;
    for (const c of counts.values()) chi += (c - expected) ** 2 / expected;
    expect(chi).toBeLessThan(49.73); // 23 ddl, p = 0,001
  });

  it('conserve les éléments', () => {
    const arr = shuffleInPlace([1, 2, 3, 4, 5, 6], new SeededRng(3));
    expect([...arr].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('générateurs', () => {
  it('SeededRng est déterministe', () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    const c = new SeededRng(43);
    const seqA = Array.from({ length: 5 }, () => a.nextUint32());
    expect(Array.from({ length: 5 }, () => b.nextUint32())).toEqual(seqA);
    expect(Array.from({ length: 5 }, () => c.nextUint32())).not.toEqual(seqA);
  });

  it('CryptoRng renvoie des entiers 32 bits et recharge son tampon', () => {
    const rng = new CryptoRng();
    for (let i = 0; i < 600; i++) {
      const x = rng.nextUint32();
      expect(Number.isInteger(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(2 ** 32);
    }
  });

  it('fournit un RNG par défaut unique', () => {
    expect(getDefaultRng()).toBe(getDefaultRng());
  });
});

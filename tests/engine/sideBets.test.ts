import { describe, expect, it } from 'vitest';
import { parseCards } from '../../src/engine/cards';
import {
  PERFECT_PAIRS_PAYTABLE,
  evaluatePerfectPairs,
  evaluateTwentyOnePlus3,
  isStraight,
  resolveSideBet,
  sideBetMultiplier,
  theoreticalPerfectPairs,
  theoreticalTwentyOnePlus3,
} from '../../src/engine/sideBets';
import type { Card } from '../../src/engine/types';

const pp = (s: string) => {
  const [a, b] = parseCards(s) as [Card, Card];
  return evaluatePerfectPairs(a, b);
};
const tp = (s: string) => {
  const [a, b, c] = parseCards(s) as [Card, Card, Card];
  return evaluateTwentyOnePlus3(a, b, c);
};

describe('Perfect Pairs', () => {
  it('paire parfaite (même rang, même famille)', () => {
    expect(pp('QS QS')).toBe('perfectPair');
  });
  it('paire colorée (même couleur, familles différentes)', () => {
    expect(pp('QS QC')).toBe('coloredPair');
    expect(pp('7H 7D')).toBe('coloredPair');
  });
  it('paire mixte (couleurs différentes)', () => {
    expect(pp('QS QH')).toBe('mixedPair');
  });
  it('pas de paire', () => {
    expect(pp('QS KS')).toBeNull();
    expect(pp('10S JS')).toBeNull();
  });
  it('paiements', () => {
    expect(PERFECT_PAIRS_PAYTABLE).toEqual({ perfectPair: 25, coloredPair: 12, mixedPair: 6 });
  });
});

describe('21+3', () => {
  it('brelan assorti', () => expect(tp('7H 7H 7H')).toBe('suitedTrips'));
  it('quinte flush', () => expect(tp('5S 6S 7S')).toBe('straightFlush'));
  it('brelan', () => expect(tp('7H 7S 7D')).toBe('threeOfAKind'));
  it('quinte', () => expect(tp('9S 10H JD')).toBe('straight'));
  it('couleur', () => expect(tp('2C 9C KC')).toBe('flush'));
  it('rien', () => expect(tp('2C 9H KC')).toBeNull());

  it('A-2-3 et D-R-A sont des quintes, R-A-2 non', () => {
    expect(tp('AS 2H 3D')).toBe('straight');
    expect(tp('QS KH AD')).toBe('straight');
    expect(tp('KS AH 2D')).toBeNull();
    expect(isStraight(['K', 'A', '2'])).toBe(false);
    expect(isStraight(['A', 'K', 'Q'])).toBe(true);
    expect(isStraight(['7', '7', '8'])).toBe(false);
    expect(isStraight(['7', '8', '8'])).toBe(false);
  });

  it('seule la combinaison la plus haute est payée', () => {
    expect(tp('QS KS AS')).toBe('straightFlush');
    expect(sideBetMultiplier(tp('QS KS AS'))).toBe(40);
    expect(sideBetMultiplier(tp('7H 7H 7H'))).toBe(100);
    expect(sideBetMultiplier(null)).toBe(0);
  });
});

describe('résolution', () => {
  it('calcule le retour brut', () => {
    const [a, b, up] = parseCards('8S 8S 9S') as [Card, Card, Card];
    expect(resolveSideBet('perfectPairs', 10, [a, b], up)).toEqual({
      kind: 'perfectPairs',
      outcome: 'perfectPair',
      multiplier: 25,
      stake: 10,
      payout: 260,
    });
    expect(resolveSideBet('twentyOnePlus3', 10, [a, b], up).payout).toBe(60);
    const [c, d, e] = parseCards('2S 9H KD') as [Card, Card, Card];
    expect(resolveSideBet('twentyOnePlus3', 20, [c, d], e).payout).toBe(0);
  });
});

describe('RTP théorique', () => {
  it('Perfect Pairs 6 jeux = 1 − 19/311', () => {
    const t = theoreticalPerfectPairs(6);
    expect(t.probabilities.perfectPair).toBeCloseTo(5 / 311, 12);
    expect(t.probabilities.coloredPair).toBeCloseTo(6 / 311, 12);
    expect(t.probabilities.mixedPair).toBeCloseTo(12 / 311, 12);
    expect(t.rtp).toBeCloseTo(1 - 19 / 311, 12);
  });

  it('21+3 6 jeux : probabilités exactes', () => {
    const t = theoreticalTwentyOnePlus3(6);
    const n = 312 * 311 * 310;
    // 12 suites × 6 ordres × 24 × 6 × 6 cartes possibles
    expect(t.probabilities.straightFlush).toBeCloseTo((72 * 24 * 36) / n, 12);
    expect(t.probabilities.suitedTrips).toBeCloseTo((312 * 5 * 4) / n, 12);
    expect(t.probabilities.straight).toBeCloseTo((72 * 24 ** 3 - 72 * 24 * 36) / n, 12);
    const sum = Object.values(t.probabilities).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(0.096761, 5);
    expect(t.rtp).toBeCloseTo(0.95379, 5);
  });

  it('21+3 avec un seul jeu : pas de brelan assorti', () => {
    expect(theoreticalTwentyOnePlus3(1).probabilities.suitedTrips).toBe(0);
    expect(theoreticalPerfectPairs(1).probabilities.perfectPair).toBe(0);
  });
});

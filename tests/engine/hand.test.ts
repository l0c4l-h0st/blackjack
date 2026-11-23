import { describe, expect, it } from 'vitest';
import {
  buildOrderedCards,
  cardLabel,
  cardTypeIndex,
  isRed,
  parseCards,
} from '../../src/engine/cards';
import {
  dealerShouldHit,
  formatTotal,
  handValue,
  isBust,
  isSplittablePair,
  isTenValue,
  isTwoCard21,
  rankValue,
} from '../../src/engine/hand';

const v = (n: string) => handValue(parseCards(n));

describe('valeur des mains', () => {
  it('compte les mains dures', () => {
    expect(v('10S 7H')).toEqual({ total: 17, low: 17, soft: false });
    expect(v('5S 4H 3D')).toEqual({ total: 12, low: 12, soft: false });
    expect(v('KS QH')).toEqual({ total: 20, low: 20, soft: false });
  });

  it('compte les mains soft', () => {
    expect(v('AS 6H')).toEqual({ total: 17, low: 7, soft: true });
    expect(v('AS 6H 10D')).toEqual({ total: 17, low: 17, soft: false });
  });

  it('gère plusieurs As', () => {
    expect(v('AS AH')).toEqual({ total: 12, low: 2, soft: true });
    expect(v('AS AH AD AC')).toEqual({ total: 14, low: 4, soft: true });
    expect(v('AS AH 9C')).toEqual({ total: 21, low: 11, soft: true });
  });

  it('détecte le bust', () => {
    expect(isBust(parseCards('10S 7H 5D'))).toBe(true);
    expect(isBust(parseCards('10S AH AD'))).toBe(false);
    expect(v('10S 7H 5D').total).toBe(22);
  });

  it('détecte les 21 en deux cartes', () => {
    expect(isTwoCard21(parseCards('AS KH'))).toBe(true);
    expect(isTwoCard21(parseCards('7S 7H 7D'))).toBe(false);
    expect(isTwoCard21(parseCards('10S 9H'))).toBe(false);
  });

  it('formate les totaux', () => {
    expect(formatTotal(parseCards('AS 6H'))).toBe('7 / 17');
    expect(formatTotal(parseCards('AS KH'))).toBe('21');
    expect(formatTotal(parseCards('AS 6H 4D'))).toBe('21');
    expect(formatTotal(parseCards('9S 8H'))).toBe('17');
    expect(formatTotal([])).toBe('');
  });

  it('valeur des rangs', () => {
    expect(rankValue('A')).toBe(1);
    expect(rankValue('7')).toBe(7);
    expect(rankValue('Q')).toBe(10);
    expect(isTenValue('J')).toBe(true);
    expect(isTenValue('9')).toBe(false);
  });
});

describe('paires', () => {
  it('même rang', () => {
    expect(isSplittablePair(parseCards('8S 8H'), false)).toBe(true);
    expect(isSplittablePair(parseCards('8S 9H'), true)).toBe(false);
  });
  it('par valeur (10-V-D-R)', () => {
    expect(isSplittablePair(parseCards('10S KH'), true)).toBe(true);
    expect(isSplittablePair(parseCards('10S KH'), false)).toBe(false);
  });
  it('exige exactement deux cartes', () => {
    expect(isSplittablePair(parseCards('8S 8H 8D'), true)).toBe(false);
  });
});

describe('croupier', () => {
  it('reste sur soft 17 en S17', () => {
    expect(dealerShouldHit(parseCards('AS 6H'), { dealerHitsSoft17: false })).toBe(false);
  });
  it('tire sur soft 17 en H17', () => {
    expect(dealerShouldHit(parseCards('AS 6H'), { dealerHitsSoft17: true })).toBe(true);
  });
  it('tire sur 16 et reste sur 17 dur', () => {
    expect(dealerShouldHit(parseCards('10S 6H'), { dealerHitsSoft17: false })).toBe(true);
    expect(dealerShouldHit(parseCards('10S 7H'), { dealerHitsSoft17: true })).toBe(false);
  });
});

describe('cartes', () => {
  it('construit 52 cartes par jeu avec des ids uniques', () => {
    const cards = buildOrderedCards(2);
    expect(cards).toHaveLength(104);
    expect(new Set(cards.map((c) => c.id)).size).toBe(104);
    expect(cardTypeIndex('A', 'S')).toBe(0);
    expect(cardTypeIndex('K', 'C')).toBe(51);
  });
  it('produit un texte alternatif français', () => {
    expect(cardLabel({ rank: 'K', suit: 'S' })).toBe('Roi de pique');
    expect(cardLabel({ rank: 'A', suit: 'H' })).toBe('As de cœur');
  });
  it('analyse la notation compacte', () => {
    expect(parseCards('TS 10H qd')).toEqual([
      { id: 10_000, rank: '10', suit: 'S' },
      { id: 10_001, rank: '10', suit: 'H' },
      { id: 10_002, rank: 'Q', suit: 'D' },
    ]);
    expect(() => parseCards('1X')).toThrow('Carte invalide');
  });
  it('couleurs rouge/noir', () => {
    expect(isRed('H')).toBe(true);
    expect(isRed('D')).toBe(true);
    expect(isRed('S')).toBe(false);
  });
});

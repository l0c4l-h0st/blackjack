import type { Card, Rank, RulesConfig } from './types';

export interface HandValue {
  /** Meilleur total (As à 11 si possible sans dépasser 21). */
  total: number;
  /** Total avec tous les As à 1. */
  low: number;
  /** Vrai si un As compte pour 11 dans `total`. */
  soft: boolean;
}

/** Valeur faciale d'un rang (As = 1, figures = 10). */
export function rankValue(rank: Rank): number {
  switch (rank) {
    case 'A':
      return 1;
    case '10':
    case 'J':
    case 'Q':
    case 'K':
      return 10;
    default:
      return Number(rank);
  }
}

export function isTenValue(rank: Rank): boolean {
  return rankValue(rank) === 10;
}

export function handValue(cards: readonly Pick<Card, 'rank'>[]): HandValue {
  let low = 0;
  let hasAce = false;
  for (const card of cards) {
    low += rankValue(card.rank);
    if (card.rank === 'A') hasAce = true;
  }
  if (hasAce && low + 10 <= 21) {
    return { total: low + 10, low, soft: true };
  }
  return { total: low, low, soft: false };
}

export function isBust(cards: readonly Pick<Card, 'rank'>[]): boolean {
  return handValue(cards).total > 21;
}

/** Deux cartes totalisant 21. */
export function isTwoCard21(cards: readonly Pick<Card, 'rank'>[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Paire splittable (même rang, ou même valeur 10 si `splitByValue`). */
export function isSplittablePair(
  cards: readonly Pick<Card, 'rank'>[],
  splitByValue: boolean,
): boolean {
  if (cards.length !== 2) return false;
  const [a, b] = cards as [Pick<Card, 'rank'>, Pick<Card, 'rank'>];
  if (a.rank === b.rank) return true;
  return splitByValue && isTenValue(a.rank) && isTenValue(b.rank);
}

/** Le croupier doit-il tirer ? (S17 / H17 selon les règles). */
export function dealerShouldHit(
  cards: readonly Pick<Card, 'rank'>[],
  rules: Pick<RulesConfig, 'dealerHitsSoft17'>,
): boolean {
  const v = handValue(cards);
  if (v.total < 17) return true;
  return v.total === 17 && v.soft && rules.dealerHitsSoft17;
}

/** Libellé de total : « 7 / 17 » pour une main soft, « 17 » sinon. */
export function formatTotal(cards: readonly Pick<Card, 'rank'>[]): string {
  if (cards.length === 0) return '';
  const v = handValue(cards);
  if (v.soft && v.total !== 21) return `${v.low} / ${v.total}`;
  return String(v.total);
}

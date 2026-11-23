import type { Card, Rank, ShoeState } from '../types';

/** Valeur Hi-Lo : 2–6 = +1, 7–9 = 0, 10–A = −1. */
export function hiLoValue(rank: Rank): -1 | 0 | 1 {
  switch (rank) {
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
      return 1;
    case '7':
    case '8':
    case '9':
      return 0;
    default:
      return -1;
  }
}

export function runningCountOf(cards: readonly Pick<Card, 'rank'>[]): number {
  let rc = 0;
  for (const c of cards) rc += hiLoValue(c.rank);
  return rc;
}

/** Decks restants estimés au demi-jeu près (minimum un demi-jeu). */
export function decksRemaining(cardsLeft: number): number {
  return Math.max(0.5, Math.round((cardsLeft / 52) * 2) / 2);
}

/** True count = running count ÷ decks restants. */
export function trueCount(runningCount: number, decksLeft: number): number {
  return runningCount / decksLeft;
}

/** Arrondi à une décimale pour l'affichage (évite « -0.0 »). */
export function roundCount(value: number): number {
  const r = Math.round(value * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

/** Estimation grossière de l'avantage joueur en % : −0,5 % + 0,5 % × TC. */
export function estimatedPlayerEdge(tc: number): number {
  return -0.5 + 0.5 * tc;
}

export interface CountSnapshot {
  running: number;
  cardsLeft: number;
  decksLeft: number;
  trueCount: number;
}

/** Comptage de toutes les cartes sorties depuis le mélange (hors cartes brûlées). */
export function countFromShoe(
  shoe: Pick<ShoeState, 'cards' | 'position' | 'burned'>,
): CountSnapshot {
  const running = runningCountOf(shoe.cards.slice(shoe.burned, shoe.position));
  const cardsLeft = shoe.cards.length - shoe.position;
  const decksLeft = decksRemaining(cardsLeft);
  return { running, cardsLeft, decksLeft, trueCount: trueCount(running, decksLeft) };
}

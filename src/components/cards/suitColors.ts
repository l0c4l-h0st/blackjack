import type { Suit } from '../../engine/types';

const TWO_COLOR: Record<Suit, string> = {
  S: '#1b2030',
  C: '#1b2030',
  H: '#d63a4f',
  D: '#d63a4f',
};

/** Jeu 4 couleurs : ♠ noir, ♥ rouge, ♦ bleu, ♣ vert. */
const FOUR_COLOR: Record<Suit, string> = {
  S: '#1b2030',
  H: '#d63a4f',
  D: '#2563d9',
  C: '#178a50',
};

export function suitColor(suit: Suit, fourColor: boolean): string {
  return (fourColor ? FOUR_COLOR : TWO_COLOR)[suit];
}

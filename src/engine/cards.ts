import type { Card, Rank, Suit } from './types';
import { RANKS, SUITS } from './types';

const RANK_NAMES_FR: Record<Rank, string> = {
  A: 'As',
  '2': 'Deux',
  '3': 'Trois',
  '4': 'Quatre',
  '5': 'Cinq',
  '6': 'Six',
  '7': 'Sept',
  '8': 'Huit',
  '9': 'Neuf',
  '10': 'Dix',
  J: 'Valet',
  Q: 'Dame',
  K: 'Roi',
};

const SUIT_NAMES_FR: Record<Suit, string> = {
  S: 'pique',
  H: 'cœur',
  D: 'carreau',
  C: 'trèfle',
};

export const SUIT_SYMBOLS: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

/** Lettre de rang affichée dans les coins (V/D/R en français). */
export const RANK_LABELS_FR: Record<Rank, string> = {
  A: 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'V',
  Q: 'D',
  K: 'R',
};

/** Texte alternatif : « Roi de pique ». */
export function cardLabel(card: Pick<Card, 'rank' | 'suit'>): string {
  return `${RANK_NAMES_FR[card.rank]} de ${SUIT_NAMES_FR[card.suit]}`;
}

export function isRed(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

/** Identifiant de la carte dans un jeu neuf (0..51). */
export function cardTypeIndex(rank: Rank, suit: Suit): number {
  return SUITS.indexOf(suit) * 13 + RANKS.indexOf(rank);
}

/** Construit `decks` jeux neufs, ordonnés. */
export function buildOrderedCards(decks: number): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: cards.length, rank, suit });
      }
    }
  }
  return cards;
}

/**
 * Analyse une notation compacte (`"AS KH 10D 9C"`, `T` accepté pour 10).
 * Utilisé par les tests et les outils de debug. Les ids sont attribués à partir de `firstId`.
 */
export function parseCards(notation: string, firstId = 10_000): Card[] {
  const tokens = notation.trim().split(/\s+/).filter(Boolean);
  return tokens.map((token, i) => {
    const upper = token.toUpperCase();
    const suit = upper.slice(-1) as Suit;
    let rank = upper.slice(0, -1);
    if (rank === 'T') rank = '10';
    if (!SUITS.includes(suit) || !RANKS.includes(rank as Rank)) {
      throw new Error(`Carte invalide : ${token}`);
    }
    return { id: firstId + i, rank: rank as Rank, suit };
  });
}

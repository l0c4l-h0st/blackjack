import { buildOrderedCards } from './cards';
import type { Rng } from './rng';
import { randomInt, shuffleInPlace } from './rng';
import type { Card, RulesConfig, ShoeState } from './types';

/** Position de la carte de coupe tirée uniformément entre les deux pénétrations. */
export function drawCutIndex(
  size: number,
  rules: Pick<RulesConfig, 'penetrationMin' | 'penetrationMax'>,
  rng: Rng,
): number {
  const lo = Math.ceil(size * rules.penetrationMin);
  const hi = Math.max(lo, Math.floor(size * rules.penetrationMax));
  return lo + randomInt(rng, hi - lo + 1);
}

/**
 * Crée un sabot neuf mélangé. Les cartes brûlées sont déjà sorties (position) et
 * comptées dans la défausse.
 */
export function createShoe(
  rules: Pick<RulesConfig, 'decks' | 'penetrationMin' | 'penetrationMax' | 'burnCardsAfterShuffle'>,
  rng: Rng,
  shoeId: number,
): ShoeState {
  const cards = shuffleInPlace(buildOrderedCards(rules.decks), rng);
  const burned = Math.min(rules.burnCardsAfterShuffle, cards.length);
  return {
    cards,
    position: burned,
    cutIndex: drawCutIndex(cards.length, rules, rng),
    burned,
    discard: burned,
    shoeId,
    roundsInShoe: 0,
  };
}

/**
 * Sabot de secours construit à partir des cartes qui ne sont pas sur la table
 * (cas extrême où le sabot serait vide en cours de tour).
 */
export function createEmergencyShoe(
  decks: number,
  onTable: ReadonlySet<number>,
  rng: Rng,
  shoeId: number,
): ShoeState {
  const cards = shuffleInPlace(
    buildOrderedCards(decks).filter((c) => !onTable.has(c.id)),
    rng,
  );
  return {
    cards,
    position: 0,
    cutIndex: cards.length + 1,
    burned: 0,
    discard: 0,
    shoeId,
    roundsInShoe: 0,
  };
}

/** Sabot truqué : les cartes sortent exactement dans l'ordre fourni (tests, outils). */
export function createStackedShoe(cards: Card[], options: Partial<ShoeState> = {}): ShoeState {
  return {
    cards,
    position: 0,
    cutIndex: cards.length + 1,
    burned: 0,
    discard: 0,
    shoeId: 1,
    roundsInShoe: 0,
    ...options,
  };
}

export function cardsRemaining(shoe: Pick<ShoeState, 'cards' | 'position'>): number {
  return shoe.cards.length - shoe.position;
}

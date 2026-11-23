/**
 * Stratégie de base ENHC (6 jeux, S17, DAS, abandon contre 2–10 uniquement, croupier
 * sans carte cachée qui ramasse toutes les mises sur un blackjack).
 *
 * Différences avec la stratégie « US peek » : pas de double sur 11 contre 10/As, pas de
 * split 8-8 ni A-A contre un As, abandon élargi contre un 10 (14–16, 7-7, 8-8).
 *
 * Utilisée UNIQUEMENT par le script de simulation (jamais pour conseiller le joueur en jeu).
 */
import { handValue, isSplittablePair, rankValue } from '../hand';
import { getAvailableActions } from '../round';
import type { Card, GameState, PlayerAction, Rank } from '../types';

export type StrategyMove = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

export interface StrategyInput {
  cards: readonly Pick<Card, 'rank'>[];
  dealerUp: Rank;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
}

/** Valeur de la carte du croupier : 2–10, As = 11. */
function upValue(rank: Rank): number {
  return rank === 'A' ? 11 : rankValue(rank);
}

const between = (x: number, lo: number, hi: number) => x >= lo && x <= hi;

function shouldSplit(rank: Rank, up: number): boolean {
  switch (rankValue(rank)) {
    case 1:
      return up !== 11;
    case 2:
    case 3:
      return between(up, 2, 7);
    case 4:
      return between(up, 5, 6);
    case 6:
      return between(up, 2, 6);
    case 7:
      return between(up, 2, 7);
    case 8:
      return between(up, 2, 9);
    case 9:
      return between(up, 2, 6) || up === 8 || up === 9;
    default:
      return false; // 5-5 et 10-10 ne se séparent jamais
  }
}

function softMove(total: number, up: number): StrategyMove | 'doubleOrStand' {
  if (total >= 19) return 'stand';
  if (total === 18) {
    if (between(up, 3, 6)) return 'doubleOrStand';
    return up === 2 || up === 7 || up === 8 ? 'stand' : 'hit';
  }
  if (total === 17) return between(up, 3, 6) ? 'double' : 'hit';
  if (total >= 15) return between(up, 4, 6) ? 'double' : 'hit';
  if (total >= 13) return between(up, 5, 6) ? 'double' : 'hit';
  return 'hit';
}

function hardMove(total: number, up: number): StrategyMove | 'surrenderOrHit' {
  if (total >= 17) return 'stand';
  if (total >= 14 && up === 10) return 'surrenderOrHit';
  if (total >= 13) return up <= 6 ? 'stand' : 'hit';
  if (total === 12) return between(up, 4, 6) ? 'stand' : 'hit';
  if (total === 11) return up <= 9 ? 'double' : 'hit';
  if (total === 10) return up <= 9 ? 'double' : 'hit';
  if (total === 9) return between(up, 3, 6) ? 'double' : 'hit';
  return 'hit';
}

export function basicStrategy(input: StrategyInput): StrategyMove {
  const up = upValue(input.dealerUp);
  const cards = input.cards;
  if (input.canSplit && isSplittablePair(cards, true) && cards[0]) {
    if (shouldSplit(cards[0].rank, up)) return 'split';
    // 7-7 et 8-8 contre un 10 : abandon si possible
    const pairValue = rankValue(cards[0].rank);
    if ((pairValue === 7 || pairValue === 8) && up === 10 && input.canSurrender) {
      return 'surrender';
    }
  }
  const v = handValue(cards);
  if (v.soft) {
    const move = softMove(v.total, up);
    if (move === 'doubleOrStand') return input.canDouble ? 'double' : 'stand';
    if (move === 'double') return input.canDouble ? 'double' : 'hit';
    return move;
  }
  const move = hardMove(v.total, up);
  if (move === 'surrenderOrHit') return input.canSurrender ? 'surrender' : 'hit';
  if (move === 'double') return input.canDouble ? 'double' : 'hit';
  return move;
}

const MOVE_ACTIONS: Record<StrategyMove, PlayerAction> = {
  hit: { type: 'HIT' },
  stand: { type: 'STAND' },
  double: { type: 'DOUBLE' },
  split: { type: 'SPLIT' },
  surrender: { type: 'SURRENDER' },
};

/**
 * Décision complète pour l'état courant (assurance et even money toujours refusés,
 * comme le veut la stratégie de base).
 */
export function decideAction(state: GameState): PlayerAction {
  if (state.phase === 'INSURANCE') return { type: 'INSURANCE', take: false };
  const turn = state.turn;
  const up = state.dealer.cards[0];
  if (state.phase !== 'PLAYER_TURNS' || !turn || !up) {
    throw new Error('decideAction : aucune décision à prendre');
  }
  const hand = state.seats[turn.seat]?.hands[turn.hand];
  if (!hand) throw new Error('decideAction : main introuvable');
  const available = getAvailableActions(state);
  const move = basicStrategy({
    cards: hand.cards,
    dealerUp: up.rank,
    canDouble: available.double,
    canSplit: available.split,
    canSurrender: available.surrender,
  });
  // Mains de As splittés sans tirage : seul « rester » est possible.
  if (move === 'hit' && !available.hit) return MOVE_ACTIONS.stand;
  return MOVE_ACTIONS[move];
}

import { handValue, isSplittablePair, isTwoCard21 } from './hand';
import type { Card, PlayerHand, RulesConfig, SeatState, TableLimits } from './types';

/** Plus petite unité de mise : toutes les mises sont des multiples de 10. */
export const BET_UNIT = 10;

/** Mise maximale d'un side bet : `max / 10`, ramenée à un multiple de l'unité. */
export function sideBetMax(table: Pick<TableLimits, 'max'>): number {
  return Math.floor(table.max / 10 / BET_UNIT) * BET_UNIT;
}

export function isBlackjackHand(
  hand: Pick<PlayerHand, 'cards' | 'fromSplit'>,
  rules: Pick<RulesConfig, 'splitAce21IsBlackjack'>,
): boolean {
  if (!isTwoCard21(hand.cards)) return false;
  return !hand.fromSplit || rules.splitAce21IsBlackjack;
}

export function canHitHand(
  hand: Pick<PlayerHand, 'status' | 'splitAces'>,
  rules: Pick<RulesConfig, 'hitSplitAces'>,
): boolean {
  if (hand.status !== 'playing') return false;
  return !(hand.splitAces && !rules.hitSplitAces);
}

export function canDoubleHand(
  hand: Pick<PlayerHand, 'status' | 'cards' | 'doubled' | 'fromSplit' | 'splitAces' | 'bet'>,
  rules: Pick<RulesConfig, 'doubleAfterSplit' | 'hitSplitAces' | 'doubleOn'>,
  balance: number,
): boolean {
  if (hand.status !== 'playing' || hand.cards.length !== 2 || hand.doubled) return false;
  if (hand.fromSplit && !rules.doubleAfterSplit) return false;
  if (hand.splitAces && !rules.hitSplitAces) return false;
  if (balance < hand.bet) return false;
  if (rules.doubleOn === 'any') return true;
  const v = handValue(hand.cards);
  if (v.soft) return false;
  return rules.doubleOn === '9-11' ? v.total >= 9 && v.total <= 11 : v.total >= 10 && v.total <= 11;
}

export function canSplitHand(
  hand: Pick<PlayerHand, 'status' | 'cards' | 'splitAces' | 'bet'>,
  seat: Pick<SeatState, 'hands'>,
  rules: Pick<RulesConfig, 'splitByValue' | 'maxHandsPerSeat' | 'resplitAces'>,
  balance: number,
): boolean {
  if (hand.status !== 'playing') return false;
  if (!isSplittablePair(hand.cards, rules.splitByValue)) return false;
  if (seat.hands.length >= rules.maxHandsPerSeat) return false;
  if (hand.splitAces && !rules.resplitAces) return false;
  return balance >= hand.bet;
}

export function canSurrenderHand(
  hand: Pick<PlayerHand, 'status' | 'cards' | 'actions' | 'fromSplit'>,
  dealerUp: Pick<Card, 'rank'> | undefined,
  rules: Pick<RulesConfig, 'surrender' | 'surrenderVsAce' | 'surrenderAfterSplit'>,
): boolean {
  if (!rules.surrender || hand.status !== 'playing') return false;
  if (hand.cards.length !== 2 || hand.actions.some((m) => m !== 'split')) return false;
  if (hand.fromSplit && !rules.surrenderAfterSplit) return false;
  if (dealerUp?.rank === 'A' && !rules.surrenderVsAce) return false;
  return true;
}

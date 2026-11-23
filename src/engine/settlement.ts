import { handValue, isTwoCard21 } from './hand';
import type {
  Card,
  GameState,
  HandResult,
  PlayerHand,
  RoundSummary,
  RulesConfig,
  SeatRecord,
} from './types';

export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

export type EngineErrorCode =
  | 'INVALID_PHASE'
  | 'INVALID_ACTION'
  | 'INVALID_AMOUNT'
  | 'BET_LIMIT'
  | 'INSUFFICIENT_FUNDS'
  | 'NO_BET'
  | 'INVARIANT';

/** Vérifie qu'un montant est un entier positif ou nul (aucun flottant dans les soldes). */
export function assertMoney(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new EngineError('INVARIANT', `${label} invalide : ${value}`);
  }
}

/** Gain brut d'un blackjack (mise + mise × 3:2). */
export function blackjackReturn(bet: number, rules: Pick<RulesConfig, 'blackjackPayout'>): number {
  const value = bet + bet * rules.blackjackPayout;
  assertMoney(value, 'Paiement blackjack');
  return value;
}

/** Remboursement d'un abandon (50 % de la mise). */
export function surrenderReturn(bet: number): number {
  const value = bet / 2;
  assertMoney(value, 'Remboursement abandon');
  return value;
}

/** Coût de l'assurance (50 % de la mise principale). */
export function insuranceCost(mainBet: number): number {
  const value = mainBet / 2;
  assertMoney(value, 'Assurance');
  return value;
}

/** Retour brut d'une assurance gagnante (mise + 2:1). */
export function insuranceReturn(amount: number): number {
  return amount * 3;
}

export interface DealerOutcome {
  total: number;
  blackjack: boolean;
  bust: boolean;
}

export function dealerOutcome(cards: readonly Pick<Card, 'rank'>[]): DealerOutcome {
  const v = handValue(cards);
  return { total: v.total, blackjack: isTwoCard21(cards), bust: v.total > 21 };
}

/**
 * Règlement d'une main non encore réglée à la fin du tour du croupier.
 * Retourne le résultat et le montant brut rendu au joueur.
 */
export function settleStandingHand(
  hand: Pick<PlayerHand, 'status' | 'cards' | 'bet' | 'baseBet' | 'original'>,
  dealer: DealerOutcome,
  rules: Pick<RulesConfig, 'enhcLoseAllOnDealerBJ' | 'blackjackPayout'>,
): { result: HandResult; payout: number } {
  if (hand.status === 'blackjack') {
    return dealer.blackjack
      ? { result: 'push', payout: hand.bet }
      : { result: 'blackjack', payout: blackjackReturn(hand.bet, rules) };
  }
  if (dealer.blackjack) {
    if (rules.enhcLoseAllOnDealerBJ) return { result: 'lose', payout: 0 };
    // Règle OBO : seule la mise d'origine est perdue, le reste est rendu.
    const returned = hand.original ? hand.bet - hand.baseBet : hand.bet;
    return { result: returned === hand.bet ? 'push' : 'lose', payout: returned };
  }
  const player = handValue(hand.cards).total;
  if (dealer.bust || player > dealer.total) return { result: 'win', payout: hand.bet * 2 };
  if (player === dealer.total) return { result: 'push', payout: hand.bet };
  return { result: 'lose', payout: 0 };
}

/** Construit le résumé du tour (historique, XP) et vérifie l'invariant monétaire. */
export function buildRoundSummary(state: GameState): RoundSummary {
  const round = state.round;
  if (!round) throw new EngineError('INVARIANT', 'Aucun tour en cours');
  const dealer = dealerOutcome(state.dealer.cards);
  let wagered = 0;
  let returned = 0;
  let mainWagered = 0;
  let blackjacks = 0;
  let sideBetWins = 0;
  let splitHandWins = 0;
  const seats: SeatRecord[] = [];

  for (const seat of state.seats) {
    if (seat.hands.length === 0) continue;
    const hands = seat.hands.map((h) => {
      const result = h.result;
      if (result === null) throw new EngineError('INVARIANT', `Main ${h.id} non réglée`);
      wagered += h.bet;
      mainWagered += h.bet;
      returned += h.payout;
      if (h.status === 'blackjack') blackjacks += 1;
      if (h.fromSplit && (result === 'win' || result === 'blackjack')) splitHandWins += 1;
      return {
        id: h.id,
        cards: [...h.cards],
        actions: [...h.actions],
        bet: h.bet,
        doubled: h.doubled,
        fromSplit: h.fromSplit,
        result,
        payout: h.payout,
        net: h.payout - h.bet,
      };
    });
    for (const side of [seat.sideBets.perfectPairs, seat.sideBets.twentyOnePlus3]) {
      if (!side) continue;
      wagered += side.stake;
      returned += side.payout;
      if (side.payout > 0) sideBetWins += 1;
    }
    wagered += seat.insurance.amount;
    returned += seat.insurance.payout;
    seats.push({
      seat: seat.index,
      bets: { ...seat.bets, insurance: seat.insurance.amount },
      hands,
      sideBets: { ...seat.sideBets },
      insurance: {
        decision: seat.insurance.decision,
        amount: seat.insurance.amount,
        payout: seat.insurance.payout,
      },
    });
  }

  const net = returned - wagered;
  if (state.balance - round.balanceBefore !== net) {
    throw new EngineError(
      'INVARIANT',
      `Écart de solde : ${state.balance - round.balanceBefore} ≠ ${net}`,
    );
  }

  return {
    roundId: round.id,
    shoeId: round.shoeId,
    numberInShoe: round.numberInShoe,
    tableId: state.table.id,
    balanceBefore: round.balanceBefore,
    balanceAfter: state.balance,
    rcStart: round.rcStart,
    tcStart: round.tcStart,
    dealerCards: [...state.dealer.cards],
    dealerTotal: dealer.total,
    dealerBlackjack: dealer.blackjack,
    dealerBust: dealer.bust,
    seats,
    totals: { wagered, returned, net, mainWagered, blackjacks, sideBetWins, splitHandWins },
  };
}

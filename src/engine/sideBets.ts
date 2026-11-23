import { isRed } from './cards';
import type {
  Card,
  PerfectPairsOutcome,
  Rank,
  SideBetKind,
  SideBetOutcome,
  SideBetResult,
  Suit,
  TwentyOnePlus3Outcome,
} from './types';
import { RANKS, SUITS } from './types';

export const PERFECT_PAIRS_PAYTABLE: Readonly<Record<PerfectPairsOutcome, number>> = {
  perfectPair: 25,
  coloredPair: 12,
  mixedPair: 6,
};

export const TWENTY_ONE_PLUS_3_PAYTABLE: Readonly<Record<TwentyOnePlus3Outcome, number>> = {
  suitedTrips: 100,
  straightFlush: 40,
  threeOfAKind: 30,
  straight: 10,
  flush: 5,
};

export const SIDE_BET_OUTCOME_LABELS: Readonly<Record<SideBetOutcome, string>> = {
  perfectPair: 'Paire parfaite',
  coloredPair: 'Paire colorée',
  mixedPair: 'Paire mixte',
  suitedTrips: 'Brelan assorti',
  straightFlush: 'Quinte flush',
  threeOfAKind: 'Brelan',
  straight: 'Quinte',
  flush: 'Couleur',
};

export const SIDE_BET_NAMES: Readonly<Record<SideBetKind, string>> = {
  perfectPairs: 'Perfect Pairs',
  twentyOnePlus3: '21+3',
};

type CardLike = Pick<Card, 'rank' | 'suit'>;

export function evaluatePerfectPairs(a: CardLike, b: CardLike): PerfectPairsOutcome | null {
  if (a.rank !== b.rank) return null;
  if (a.suit === b.suit) return 'perfectPair';
  if (isRed(a.suit) === isRed(b.suit)) return 'coloredPair';
  return 'mixedPair';
}

/** Rang numérique : As = 1, Valet = 11, Dame = 12, Roi = 13. */
function rankNumber(rank: Rank): number {
  return RANKS.indexOf(rank) + 1;
}

/** Trois rangs consécutifs ; l'As est bas (A-2-3) ou haut (D-R-A), jamais « tournant » (R-A-2). */
export function isStraight(ranks: readonly Rank[]): boolean {
  const n = ranks.map(rankNumber).sort((x, y) => x - y);
  const [a, b, c] = n as [number, number, number];
  if (a === b || b === c) return false;
  if (b === a + 1 && c === b + 1) return true;
  return a === 1 && b === 12 && c === 13;
}

export function evaluateTwentyOnePlus3(
  a: CardLike,
  b: CardLike,
  c: CardLike,
): TwentyOnePlus3Outcome | null {
  const sameSuit = a.suit === b.suit && b.suit === c.suit;
  const trips = a.rank === b.rank && b.rank === c.rank;
  if (trips && sameSuit) return 'suitedTrips';
  const straight = isStraight([a.rank, b.rank, c.rank]);
  if (straight && sameSuit) return 'straightFlush';
  if (trips) return 'threeOfAKind';
  if (straight) return 'straight';
  if (sameSuit) return 'flush';
  return null;
}

export function sideBetMultiplier(outcome: SideBetOutcome | null): number {
  if (outcome === null) return 0;
  if (outcome in PERFECT_PAIRS_PAYTABLE) {
    return PERFECT_PAIRS_PAYTABLE[outcome as PerfectPairsOutcome];
  }
  return TWENTY_ONE_PLUS_3_PAYTABLE[outcome as TwentyOnePlus3Outcome];
}

/** Résultat complet d'un side bet pour une mise donnée. */
export function resolveSideBet(
  kind: SideBetKind,
  stake: number,
  playerCards: readonly [CardLike, CardLike],
  dealerUp: CardLike,
): SideBetResult {
  const outcome =
    kind === 'perfectPairs'
      ? evaluatePerfectPairs(playerCards[0], playerCards[1])
      : evaluateTwentyOnePlus3(playerCards[0], playerCards[1], dealerUp);
  const multiplier = sideBetMultiplier(outcome);
  return {
    kind,
    outcome,
    multiplier,
    stake,
    payout: outcome === null ? 0 : stake * (multiplier + 1),
  };
}

export interface TheoreticalSideBet<O extends string> {
  /** Probabilité de chaque combinaison. */
  probabilities: Record<O, number>;
  /** Retour au joueur (1 = 100 %). */
  rtp: number;
}

interface CardType {
  rank: Rank;
  suit: Suit;
}

const CARD_TYPES: CardType[] = SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));

/** Probabilités exactes de Perfect Pairs (dénombrement sur un sabot complet). */
export function theoreticalPerfectPairs(decks: number): TheoreticalSideBet<PerfectPairsOutcome> {
  const counts: Record<PerfectPairsOutcome, number> = {
    perfectPair: 0,
    coloredPair: 0,
    mixedPair: 0,
  };
  let total = 0;
  for (let i = 0; i < CARD_TYPES.length; i++) {
    for (let j = 0; j < CARD_TYPES.length; j++) {
      const w = decks * (decks - (i === j ? 1 : 0));
      if (w === 0) continue;
      total += w;
      const outcome = evaluatePerfectPairs(CARD_TYPES[i] as CardType, CARD_TYPES[j] as CardType);
      if (outcome) counts[outcome] += w;
    }
  }
  return toTheoretical(counts, total, PERFECT_PAIRS_PAYTABLE);
}

/** Probabilités exactes de 21+3 (dénombrement de tous les triplets ordonnés). */
export function theoreticalTwentyOnePlus3(
  decks: number,
): TheoreticalSideBet<TwentyOnePlus3Outcome> {
  const counts: Record<TwentyOnePlus3Outcome, number> = {
    suitedTrips: 0,
    straightFlush: 0,
    threeOfAKind: 0,
    straight: 0,
    flush: 0,
  };
  let total = 0;
  const n = CARD_TYPES.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const wj = decks - (i === j ? 1 : 0);
      if (wj <= 0) continue;
      for (let k = 0; k < n; k++) {
        const wk = decks - (k === i ? 1 : 0) - (k === j ? 1 : 0);
        if (wk <= 0) continue;
        const w = decks * wj * wk;
        total += w;
        const outcome = evaluateTwentyOnePlus3(
          CARD_TYPES[i] as CardType,
          CARD_TYPES[j] as CardType,
          CARD_TYPES[k] as CardType,
        );
        if (outcome) counts[outcome] += w;
      }
    }
  }
  return toTheoretical(counts, total, TWENTY_ONE_PLUS_3_PAYTABLE);
}

function toTheoretical<O extends string>(
  counts: Record<O, number>,
  total: number,
  paytable: Readonly<Record<O, number>>,
): TheoreticalSideBet<O> {
  const probabilities = {} as Record<O, number>;
  let rtp = 0;
  for (const key of Object.keys(counts) as O[]) {
    const p = counts[key] / total;
    probabilities[key] = p;
    rtp += p * (paytable[key] + 1);
  }
  return { probabilities, rtp };
}

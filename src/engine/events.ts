import type {
  Card,
  CreditReason,
  HandResult,
  HandStatus,
  InsuranceDecision,
  Phase,
  RoundSummary,
  SeatSpotKind,
  SideBetKind,
  SideBetOutcome,
  TableLimits,
  Turn,
} from './types';

/** Destination d'une carte. */
export type CardTarget = { kind: 'dealer' } | { kind: 'hand'; seat: number; hand: number };

/** Case de jetons sur la table. */
export type SpotRef =
  | { kind: 'seat'; seat: number; spot: SeatSpotKind }
  | { kind: 'hand'; seat: number; hand: number };

export type ChipReason = 'bet' | 'double' | 'split' | 'insurance';
export type ShuffleReason = 'cut' | 'table' | 'emergency';

/**
 * Événements émis par le moteur, joués dans l'ordre par l'animation director.
 * Chaque événement porte assez d'informations pour mettre à jour la vue sans relire l'état.
 */
export type GameEvent =
  | { type: 'PHASE'; phase: Phase }
  | { type: 'PLACE_CHIPS'; spot: SpotRef; amount: number; balance: number; reason: ChipReason }
  | { type: 'CHIPS_TO_PLAYER'; spot: SpotRef; amount: number; balance: number }
  | { type: 'CHIPS_TO_DEALER'; spot: SpotRef; amount: number }
  | { type: 'CHIPS_FROM_DEALER'; spot: SpotRef; amount: number }
  | {
      type: 'ROUND_START';
      roundId: number;
      hands: { seat: number; handId: string; stake: number }[];
    }
  | { type: 'DEAL_CARD'; target: CardTarget; card: Card; faceUp: boolean }
  | { type: 'FLIP_CARD'; target: CardTarget; index: number; card: Card; slow: boolean }
  | { type: 'DEALER_REVEAL_SUSPENSE' }
  | { type: 'CUT_CARD_REACHED' }
  | {
      type: 'SIDE_BET_RESULT';
      seat: number;
      bet: SideBetKind;
      outcome: SideBetOutcome | null;
      multiplier: number;
      stake: number;
      payout: number;
    }
  | { type: 'BLACKJACK'; target: CardTarget }
  | { type: 'BUST'; target: CardTarget; total: number }
  | { type: 'INSURANCE_OFFERED'; seat: number; kind: 'insurance' | 'evenMoney'; cost: number }
  | {
      type: 'INSURANCE_DECISION';
      seat: number;
      decision: InsuranceDecision;
      amount: number;
      auto: boolean;
    }
  | { type: 'INSURANCE_CLOSED' }
  | { type: 'INSURANCE_RESULT'; seat: number; won: boolean; amount: number; payout: number }
  | { type: 'ACTIVE_HAND'; turn: Turn | null }
  | { type: 'HAND_STATUS'; seat: number; hand: number; status: HandStatus; auto: boolean }
  | { type: 'DOUBLE'; seat: number; hand: number }
  | { type: 'SPLIT'; seat: number; hand: number; newHandId: string }
  | {
      type: 'HAND_RESULT';
      seat: number;
      hand: number;
      handId: string;
      result: HandResult;
      payout: number;
      net: number;
      bet: number;
    }
  | { type: 'ROUND_END'; summary: RoundSummary }
  | { type: 'CLEAR_TABLE'; discard: number }
  | { type: 'SHUFFLE'; shoeId: number; size: number; cutIndex: number; reason: ShuffleReason }
  | { type: 'BURN_CARD'; count: number }
  | { type: 'TABLE_CHANGED'; table: TableLimits }
  | { type: 'BALANCE_CREDITED'; amount: number; balance: number; reason: CreditReason };

export type GameEventType = GameEvent['type'];

export function spotKey(spot: SpotRef): string {
  return spot.kind === 'seat' ? `s${spot.seat}-${spot.spot}` : `s${spot.seat}-h${spot.hand}`;
}

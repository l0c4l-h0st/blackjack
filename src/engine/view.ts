/**
 * Modèle d'affichage de la table.
 *
 * - `projectView(state)` : ce que la table montre quand toutes les animations sont jouées.
 * - `reduceView(view, event)` : applique un événement moteur.
 *
 * Invariant (testé par fuzz) : `events.reduce(reduceView, projectView(avant))`
 * est égal à `projectView(après)`.
 */
import { hiLoValue, countFromShoe } from './count/hiLo';
import type { CardTarget, GameEvent, SpotRef } from './events';
import type {
  Card,
  GameState,
  HandResult,
  HandStatus,
  InsuranceDecision,
  Phase,
  SeatSpots,
  SideBetResult,
  TableLimits,
  Turn,
} from './types';

export interface ViewCard {
  card: Card;
  faceUp: boolean;
}

export interface HandView {
  id: string;
  cards: ViewCard[];
  stake: number;
  doubled: boolean;
  fromSplit: boolean;
  status: HandStatus;
  result: HandResult | null;
  net: number | null;
}

export interface SeatView {
  index: number;
  spots: SeatSpots;
  hands: HandView[];
  sideResults: {
    perfectPairs: SideBetResult | null;
    twentyOnePlus3: SideBetResult | null;
  };
  insurance: { decision: InsuranceDecision; result: 'won' | 'lost' | null };
}

export interface ShoeView {
  shoeId: number;
  size: number;
  position: number;
  cutIndex: number;
  discard: number;
  cutCardOut: boolean;
}

export interface TableView {
  phase: Phase;
  balance: number;
  table: TableLimits;
  roundId: number;
  dealer: { cards: ViewCard[] };
  seats: SeatView[];
  turn: Turn | null;
  insuranceSeat: number | null;
  shoe: ShoeView;
  runningCount: number;
}

function emptySeatView(index: number): SeatView {
  return {
    index,
    spots: { main: 0, perfectPairs: 0, twentyOnePlus3: 0, insurance: 0 },
    hands: [],
    sideResults: { perfectPairs: null, twentyOnePlus3: null },
    insurance: { decision: 'none', result: null },
  };
}

export function projectView(state: GameState): TableView {
  return {
    phase: state.phase,
    balance: state.balance,
    table: state.table,
    roundId: state.roundCounter,
    dealer: { cards: state.dealer.cards.map((card) => ({ card, faceUp: true })) },
    seats: state.seats.map((seat) => ({
      index: seat.index,
      spots: { ...seat.spots },
      hands: seat.hands.map((h) => ({
        id: h.id,
        cards: h.cards.map((card) => ({ card, faceUp: true })),
        stake: h.stake,
        doubled: h.doubled,
        fromSplit: h.fromSplit,
        status: h.status,
        result: h.result,
        net: h.settled ? h.payout - h.bet : null,
      })),
      sideResults: { ...seat.sideBets },
      insurance: {
        decision: seat.insurance.decision,
        result:
          seat.insurance.decision === 'taken' && seat.insurance.settled
            ? seat.insurance.payout > 0
              ? 'won'
              : 'lost'
            : null,
      },
    })),
    turn: state.turn ? { ...state.turn } : null,
    insuranceSeat: state.insuranceSeat,
    shoe: {
      shoeId: state.shoe.shoeId,
      size: state.shoe.cards.length,
      position: state.shoe.position,
      cutIndex: state.shoe.cutIndex,
      discard: state.shoe.discard,
      cutCardOut: state.cutCardReached,
    },
    runningCount: countFromShoe(state.shoe).running,
  };
}

function cloneView(v: TableView): TableView {
  return {
    ...v,
    dealer: { cards: v.dealer.cards.map((c) => ({ ...c })) },
    seats: v.seats.map((s) => ({
      ...s,
      spots: { ...s.spots },
      hands: s.hands.map((h) => ({ ...h, cards: h.cards.map((c) => ({ ...c })) })),
      sideResults: { ...s.sideResults },
      insurance: { ...s.insurance },
    })),
    turn: v.turn ? { ...v.turn } : null,
    shoe: { ...v.shoe },
  };
}

function seatOf(v: TableView, index: number): SeatView {
  const seat = v.seats[index];
  if (!seat) throw new Error(`Vue : place inconnue ${index}`);
  return seat;
}

function handOf(v: TableView, seat: number, hand: number): HandView {
  const h = seatOf(v, seat).hands[hand];
  if (!h) throw new Error(`Vue : main inconnue ${seat}/${hand}`);
  return h;
}

function cardsOf(v: TableView, target: CardTarget): ViewCard[] {
  return target.kind === 'dealer' ? v.dealer.cards : handOf(v, target.seat, target.hand).cards;
}

function adjustSpot(v: TableView, spot: SpotRef, delta: number): void {
  if (spot.kind === 'hand') handOf(v, spot.seat, spot.hand).stake += delta;
  else seatOf(v, spot.seat).spots[spot.spot] += delta;
}

/** Montant de jetons présents sur une case dans la vue. */
export function spotAmount(v: TableView, spot: SpotRef): number {
  if (spot.kind === 'hand') return v.seats[spot.seat]?.hands[spot.hand]?.stake ?? 0;
  return v.seats[spot.seat]?.spots[spot.spot] ?? 0;
}

export function reduceView(view: TableView, event: GameEvent): TableView {
  const v = cloneView(view);
  switch (event.type) {
    case 'PHASE':
      v.phase = event.phase;
      if (event.phase === 'INSURANCE') {
        for (const seat of v.seats) {
          if (seat.hands.length > 0) seat.insurance.decision = 'pending';
        }
      }
      break;
    case 'PLACE_CHIPS':
      adjustSpot(v, event.spot, event.amount);
      v.balance = event.balance;
      break;
    case 'CHIPS_TO_PLAYER':
      adjustSpot(v, event.spot, -event.amount);
      v.balance = event.balance;
      break;
    case 'CHIPS_TO_DEALER':
      adjustSpot(v, event.spot, -event.amount);
      break;
    case 'CHIPS_FROM_DEALER':
      adjustSpot(v, event.spot, event.amount);
      break;
    case 'ROUND_START':
      v.roundId = event.roundId;
      for (const created of event.hands) {
        const seat = seatOf(v, created.seat);
        seat.spots.main = 0;
        seat.hands = [
          {
            id: created.handId,
            cards: [],
            stake: created.stake,
            doubled: false,
            fromSplit: false,
            status: 'playing',
            result: null,
            net: null,
          },
        ];
      }
      break;
    case 'DEAL_CARD':
      cardsOf(v, event.target).push({ card: event.card, faceUp: event.faceUp });
      v.shoe.position += 1;
      if (event.faceUp) v.runningCount += hiLoValue(event.card.rank);
      break;
    case 'FLIP_CARD': {
      const c = cardsOf(v, event.target)[event.index];
      if (c && !c.faceUp) {
        c.faceUp = true;
        v.runningCount += hiLoValue(c.card.rank);
      }
      break;
    }
    case 'CUT_CARD_REACHED':
      v.shoe.cutCardOut = true;
      break;
    case 'SIDE_BET_RESULT':
      seatOf(v, event.seat).sideResults[event.bet] = {
        kind: event.bet,
        outcome: event.outcome,
        multiplier: event.multiplier,
        stake: event.stake,
        payout: event.payout,
      };
      break;
    case 'BLACKJACK':
      if (event.target.kind === 'hand') {
        handOf(v, event.target.seat, event.target.hand).status = 'blackjack';
      }
      break;
    case 'BUST':
      if (event.target.kind === 'hand') {
        handOf(v, event.target.seat, event.target.hand).status = 'bust';
      }
      break;
    case 'INSURANCE_OFFERED':
      v.insuranceSeat = event.seat;
      break;
    case 'INSURANCE_DECISION':
      seatOf(v, event.seat).insurance.decision = event.decision;
      break;
    case 'INSURANCE_CLOSED':
      v.insuranceSeat = null;
      break;
    case 'INSURANCE_RESULT':
      seatOf(v, event.seat).insurance.result = event.won ? 'won' : 'lost';
      break;
    case 'ACTIVE_HAND':
      v.turn = event.turn ? { ...event.turn } : null;
      break;
    case 'HAND_STATUS':
      handOf(v, event.seat, event.hand).status = event.status;
      break;
    case 'DOUBLE':
      handOf(v, event.seat, event.hand).doubled = true;
      break;
    case 'SPLIT': {
      const seat = seatOf(v, event.seat);
      const hand = handOf(v, event.seat, event.hand);
      const moved = hand.cards.splice(1);
      hand.fromSplit = true;
      seat.hands.splice(event.hand + 1, 0, {
        id: event.newHandId,
        cards: moved,
        stake: 0,
        doubled: false,
        fromSplit: true,
        status: 'playing',
        result: null,
        net: null,
      });
      break;
    }
    case 'HAND_RESULT': {
      const hand = handOf(v, event.seat, event.hand);
      hand.result = event.result;
      hand.net = event.net;
      break;
    }
    case 'CLEAR_TABLE':
      v.dealer.cards = [];
      v.seats = v.seats.map((s) => emptySeatView(s.index));
      v.turn = null;
      v.insuranceSeat = null;
      v.shoe.discard = event.discard;
      break;
    case 'SHUFFLE':
      v.shoe = {
        shoeId: event.shoeId,
        size: event.size,
        position: 0,
        cutIndex: event.cutIndex,
        discard: 0,
        cutCardOut: event.reason === 'emergency',
      };
      v.runningCount = 0;
      break;
    case 'BURN_CARD':
      v.shoe.position += event.count;
      v.shoe.discard += event.count;
      break;
    case 'TABLE_CHANGED':
      v.table = event.table;
      break;
    case 'BALANCE_CREDITED':
      v.balance = event.balance;
      break;
    case 'DEALER_REVEAL_SUSPENSE':
    case 'ROUND_END':
      break;
  }
  return v;
}

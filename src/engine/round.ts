/**
 * Machine à états d'un tour de blackjack européen (ENHC).
 *
 * API pure : `applyAction(state, action)` ne modifie jamais `state` ; il retourne un nouvel
 * état et la liste ordonnée des événements à animer.
 */
import { countFromShoe } from './count/hiLo';
import type { CardTarget, GameEvent, SpotRef } from './events';
import { dealerShouldHit, handValue, isTenValue } from './hand';
import type { Rng } from './rng';
import { getDefaultRng } from './rng';
import {
  BET_UNIT,
  canDoubleHand,
  canHitHand,
  canSplitHand,
  canSurrenderHand,
  isBlackjackHand,
  sideBetMax,
} from './rules';
import {
  EngineError,
  assertMoney,
  blackjackReturn,
  buildRoundSummary,
  dealerOutcome,
  insuranceCost,
  insuranceReturn,
  settleStandingHand,
  surrenderReturn,
} from './settlement';
import { createEmergencyShoe, createShoe } from './shoe';
import { resolveSideBet } from './sideBets';
import type {
  AvailableActions,
  BetSpot,
  Card,
  GameState,
  HandResult,
  HandStatus,
  PlayerAction,
  PlayerHand,
  RulesConfig,
  SeatBets,
  SeatState,
  ShoeState,
  SideBetKind,
  TableLimits,
  Turn,
} from './types';

export { EngineError } from './settlement';

export interface EngineDeps {
  rng?: Rng;
}

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
}

interface Ctx {
  s: GameState;
  ev: GameEvent[];
  rng: Rng;
}

const SPOTS: readonly BetSpot[] = ['main', 'perfectPairs', 'twentyOnePlus3'];
const SIDE_SPOTS: readonly SideBetKind[] = ['perfectPairs', 'twentyOnePlus3'];

// ---------------------------------------------------------------------------
// Création & clonage
// ---------------------------------------------------------------------------

export function emptySeat(index: number): SeatState {
  return {
    index,
    bets: { main: 0, perfectPairs: 0, twentyOnePlus3: 0 },
    spots: { main: 0, perfectPairs: 0, twentyOnePlus3: 0, insurance: 0 },
    hands: [],
    insurance: { decision: 'none', amount: 0, payout: 0, settled: false },
    sideBets: { perfectPairs: null, twentyOnePlus3: null },
    handSeq: 0,
  };
}

export interface CreateGameOptions {
  rules: RulesConfig;
  table: TableLimits;
  balance: number;
  rng?: Rng;
  /** Sabot imposé (tests). */
  shoe?: ShoeState;
}

export function createGame(options: CreateGameOptions): GameState {
  assertMoney(options.balance, 'Solde initial');
  const rng = options.rng ?? getDefaultRng();
  return {
    schema: 1,
    rules: options.rules,
    table: options.table,
    balance: options.balance,
    phase: 'BETTING',
    shoe: options.shoe ?? createShoe(options.rules, rng, 1),
    seats: Array.from({ length: options.rules.maxSeats }, (_, i) => emptySeat(i)),
    dealer: { cards: [] },
    turn: null,
    insuranceSeat: null,
    round: null,
    roundCounter: 0,
    lastBets: null,
    cutCardReached: false,
  };
}

function cloneHand(h: PlayerHand): PlayerHand {
  return { ...h, cards: [...h.cards], actions: [...h.actions] };
}

function cloneSeat(seat: SeatState): SeatState {
  return {
    ...seat,
    bets: { ...seat.bets },
    spots: { ...seat.spots },
    hands: seat.hands.map(cloneHand),
    insurance: { ...seat.insurance },
    sideBets: { ...seat.sideBets },
  };
}

/** Copie profonde de tout ce que le moteur peut modifier (les cartes sont immuables et partagées). */
export function cloneState(state: GameState): GameState {
  return {
    ...state,
    shoe: { ...state.shoe },
    seats: state.seats.map(cloneSeat),
    dealer: { cards: [...state.dealer.cards] },
    turn: state.turn ? { ...state.turn } : null,
    round: state.round ? { ...state.round } : null,
    lastBets: state.lastBets ? state.lastBets.map((b) => ({ ...b })) : null,
  };
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

export function applyAction(
  state: GameState,
  action: PlayerAction,
  deps: EngineDeps = {},
): ActionResult {
  const ctx: Ctx = { s: cloneState(state), ev: [], rng: deps.rng ?? getDefaultRng() };
  switch (action.type) {
    case 'PLACE_BET':
      placeBet(ctx, action.seat, action.spot, action.amount);
      break;
    case 'REMOVE_BET':
      ensureBetting(ctx);
      seatAt(ctx.s, action.seat);
      removeBet(ctx, action.seat, action.spot);
      break;
    case 'CLEAR_BETS':
      ensureBetting(ctx);
      clearBets(ctx);
      break;
    case 'REBET':
      rebet(ctx);
      break;
    case 'DOUBLE_BETS':
      doubleBets(ctx);
      break;
    case 'DEAL':
      deal(ctx);
      break;
    case 'INSURANCE':
      insurance(ctx, action.take);
      break;
    case 'HIT':
      hit(ctx);
      break;
    case 'STAND':
      stand(ctx);
      break;
    case 'DOUBLE':
      doubleDown(ctx);
      break;
    case 'SPLIT':
      split(ctx);
      break;
    case 'SURRENDER':
      surrender(ctx);
      break;
    case 'NEW_ROUND':
      if (ctx.s.phase !== 'ROUND_END') {
        throw new EngineError('INVALID_PHASE', 'Aucun tour à terminer');
      }
      newRound(ctx, true);
      break;
    case 'SET_TABLE':
      setTable(ctx, action.table);
      break;
    case 'CREDIT':
      credit(ctx, action.amount, action.reason);
      break;
  }
  assertMoney(ctx.s.balance, 'Solde');
  return { state: ctx.s, events: ctx.ev };
}

/** Montant maximal qu'on peut encore ajouter sur une case (limites de table et solde). */
export function betRoom(state: GameState, seatIndex: number, spot: BetSpot): number {
  if (state.phase !== 'BETTING' && state.phase !== 'ROUND_END') return 0;
  const seat = state.seats[seatIndex];
  if (!seat) return 0;
  // En ROUND_END, la table sera débarrassée : les mises repartent de zéro.
  const bets: SeatBets =
    state.phase === 'ROUND_END' ? { main: 0, perfectPairs: 0, twentyOnePlus3: 0 } : seat.bets;
  let limit: number;
  if (spot === 'main') {
    limit = state.table.max - bets.main;
  } else {
    if (bets.main === 0) return 0;
    limit = sideBetMax(state.table) - bets[spot];
  }
  const room = Math.min(limit, state.balance);
  return Math.max(0, Math.floor(room / BET_UNIT) * BET_UNIT);
}

export function totalBets(state: GameState): number {
  let total = 0;
  for (const seat of state.seats)
    total += seat.bets.main + seat.bets.perfectPairs + seat.bets.twentyOnePlus3;
  return total;
}

export function getAvailableActions(state: GameState): AvailableActions {
  const s = state;
  const betting = s.phase === 'BETTING' || s.phase === 'ROUND_END';
  const current = s.phase === 'BETTING' ? totalBets(s) : 0;
  const dealBlockers: string[] = [];
  if (s.phase === 'BETTING') {
    const active = s.seats.filter((seat) => seat.bets.main > 0);
    if (active.length === 0) dealBlockers.push('Placez une mise principale');
    for (const seat of active) {
      if (seat.bets.main < s.table.min) {
        dealBlockers.push(`Place ${seat.index + 1} : mise minimale ${s.table.min}`);
      }
    }
  }

  const result: AvailableActions = {
    phase: s.phase,
    placeBet: betting && s.balance >= BET_UNIT,
    clearBets: s.phase === 'BETTING' && current > 0,
    rebet: betting && canRebet(s),
    doubleBets: s.phase === 'BETTING' && current > 0 && canDoubleBets(s),
    deal: s.phase === 'BETTING' && dealBlockers.length === 0,
    dealBlockers,
    newRound: s.phase === 'ROUND_END',
    changeTable: betting,
    insurance: null,
    hit: false,
    stand: false,
    double: false,
    split: false,
    surrender: false,
  };

  if (s.phase === 'INSURANCE' && s.insuranceSeat !== null) {
    const seat = s.seats[s.insuranceSeat] as SeatState;
    const kind = insuranceKind(s, seat);
    const cost = kind === 'insurance' ? insuranceCost(seat.bets.main) : 0;
    result.insurance = { seat: seat.index, kind, cost, canAfford: s.balance >= cost };
  }

  if (s.phase === 'PLAYER_TURNS' && s.turn) {
    const seat = s.seats[s.turn.seat] as SeatState;
    const hand = seat.hands[s.turn.hand] as PlayerHand;
    result.hit = canHitHand(hand, s.rules);
    result.stand = hand.status === 'playing';
    result.double = canDoubleHand(hand, s.rules, s.balance);
    result.split = canSplitHand(hand, seat, s.rules, s.balance);
    result.surrender = canSurrenderHand(hand, s.dealer.cards[0], s.rules);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Mises
// ---------------------------------------------------------------------------

function seatAt(s: GameState, index: number): SeatState {
  const seat = s.seats[index];
  if (!seat) throw new EngineError('INVALID_ACTION', `Place inexistante : ${index}`);
  return seat;
}

function ensureBetting(ctx: Ctx): void {
  if (ctx.s.phase === 'ROUND_END') newRound(ctx, true);
  if (ctx.s.phase !== 'BETTING') {
    throw new EngineError('INVALID_PHASE', 'Les mises sont fermées');
  }
}

function assertBetAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount % BET_UNIT !== 0) {
    throw new EngineError('INVALID_AMOUNT', `Mise invalide : ${amount} (multiple de ${BET_UNIT})`);
  }
}

function placeBet(ctx: Ctx, seatIndex: number, spot: BetSpot, amount: number): void {
  ensureBetting(ctx);
  const seat = seatAt(ctx.s, seatIndex);
  assertBetAmount(amount);
  if (amount > ctx.s.balance) throw new EngineError('INSUFFICIENT_FUNDS', 'Solde insuffisant');
  if (spot !== 'main' && seat.bets.main === 0) {
    throw new EngineError('NO_BET', 'Un side bet exige une mise principale');
  }
  if (amount > betRoom(ctx.s, seatIndex, spot)) {
    throw new EngineError('BET_LIMIT', 'Mise maximale de la table dépassée');
  }
  ctx.s.balance -= amount;
  seat.bets[spot] += amount;
  seat.spots[spot] += amount;
  ctx.ev.push({
    type: 'PLACE_CHIPS',
    spot: { kind: 'seat', seat: seatIndex, spot },
    amount,
    balance: ctx.s.balance,
    reason: 'bet',
  });
}

function removeBet(ctx: Ctx, seatIndex: number, spot: BetSpot): void {
  const seat = ctx.s.seats[seatIndex] as SeatState;
  if (spot === 'main') {
    for (const side of SIDE_SPOTS) removeBet(ctx, seatIndex, side);
  }
  const amount = seat.bets[spot];
  if (amount === 0) return;
  ctx.s.balance += amount;
  seat.bets[spot] = 0;
  seat.spots[spot] = 0;
  ctx.ev.push({
    type: 'CHIPS_TO_PLAYER',
    spot: { kind: 'seat', seat: seatIndex, spot },
    amount,
    balance: ctx.s.balance,
  });
}

function clearBets(ctx: Ctx): void {
  for (const seat of ctx.s.seats) {
    for (const spot of [...SIDE_SPOTS, 'main'] as const) removeBet(ctx, seat.index, spot);
  }
}

function lastBetsTotal(bets: SeatBets[]): number {
  return bets.reduce((t, b) => t + b.main + b.perfectPairs + b.twentyOnePlus3, 0);
}

function canRebet(s: GameState): boolean {
  if (!s.lastBets) return false;
  const available = s.balance + (s.phase === 'BETTING' ? totalBets(s) : 0);
  if (lastBetsTotal(s.lastBets) > available) return false;
  const sideMax = sideBetMax(s.table);
  return s.lastBets.every(
    (b) =>
      (b.main === 0 || (b.main >= s.table.min && b.main <= s.table.max)) &&
      b.perfectPairs <= sideMax &&
      b.twentyOnePlus3 <= sideMax,
  );
}

function rebet(ctx: Ctx): void {
  ensureBetting(ctx);
  const last = ctx.s.lastBets;
  if (!last || !canRebet(ctx.s)) {
    throw new EngineError('INVALID_ACTION', 'Impossible de re-miser');
  }
  clearBets(ctx);
  last.forEach((bets, seatIndex) => {
    for (const spot of SPOTS) {
      if (bets[spot] > 0) placeBet(ctx, seatIndex, spot, bets[spot]);
    }
  });
}

function canDoubleBets(s: GameState): boolean {
  const total = totalBets(s);
  if (total === 0 || total > s.balance) return false;
  const sideMax = sideBetMax(s.table);
  return s.seats.every(
    (seat) =>
      seat.bets.main * 2 <= s.table.max &&
      seat.bets.perfectPairs * 2 <= sideMax &&
      seat.bets.twentyOnePlus3 * 2 <= sideMax,
  );
}

function doubleBets(ctx: Ctx): void {
  ensureBetting(ctx);
  if (!canDoubleBets(ctx.s)) throw new EngineError('INVALID_ACTION', 'Impossible de doubler');
  for (const seat of ctx.s.seats) {
    for (const spot of SPOTS) {
      const amount = seat.bets[spot];
      if (amount > 0) placeBet(ctx, seat.index, spot, amount);
    }
  }
}

// ---------------------------------------------------------------------------
// Distribution
// ---------------------------------------------------------------------------

function emergencyShuffle(ctx: Ctx): void {
  const onTable = new Set<number>(ctx.s.dealer.cards.map((c) => c.id));
  for (const seat of ctx.s.seats) {
    for (const hand of seat.hands) for (const c of hand.cards) onTable.add(c.id);
  }
  ctx.s.shoe = createEmergencyShoe(ctx.s.rules.decks, onTable, ctx.rng, ctx.s.shoe.shoeId + 1);
  ctx.s.cutCardReached = true;
  ctx.ev.push({
    type: 'SHUFFLE',
    shoeId: ctx.s.shoe.shoeId,
    size: ctx.s.shoe.cards.length,
    cutIndex: ctx.s.shoe.cutIndex,
    reason: 'emergency',
  });
}

function drawCard(ctx: Ctx): Card {
  if (ctx.s.shoe.position >= ctx.s.shoe.cards.length) emergencyShuffle(ctx);
  const shoe = ctx.s.shoe;
  if (!ctx.s.cutCardReached && shoe.position >= shoe.cutIndex) {
    ctx.s.cutCardReached = true;
    ctx.ev.push({ type: 'CUT_CARD_REACHED' });
  }
  const card = shoe.cards[shoe.position] as Card;
  shoe.position += 1;
  return card;
}

function handAt(s: GameState, seat: number, hand: number): PlayerHand {
  return (s.seats[seat] as SeatState).hands[hand] as PlayerHand;
}

function dealTo(ctx: Ctx, target: CardTarget, faceUp = true): Card {
  const card = drawCard(ctx);
  if (target.kind === 'dealer') ctx.s.dealer.cards.push(card);
  else handAt(ctx.s, target.seat, target.hand).cards.push(card);
  ctx.ev.push({ type: 'DEAL_CARD', target, card, faceUp });
  return card;
}

function handTarget(seat: number, hand: number): CardTarget {
  return { kind: 'hand', seat, hand };
}

function deal(ctx: Ctx): void {
  const s = ctx.s;
  if (s.phase !== 'BETTING') throw new EngineError('INVALID_PHASE', 'Distribution impossible');
  const active = s.seats.filter((seat) => seat.bets.main > 0);
  if (active.length === 0) throw new EngineError('NO_BET', 'Aucune mise principale');
  for (const seat of active) {
    if (seat.bets.main < s.table.min || seat.bets.main > s.table.max) {
      throw new EngineError('BET_LIMIT', `Mise hors limites sur la place ${seat.index + 1}`);
    }
  }
  for (const seat of s.seats) {
    for (const spot of SPOTS) {
      if (seat.bets[spot] % BET_UNIT !== 0) {
        throw new EngineError('INVARIANT', 'Mise non multiple de 10');
      }
    }
  }

  s.lastBets = s.seats.map((seat) => ({ ...seat.bets }));
  s.roundCounter += 1;
  s.shoe.roundsInShoe += 1;
  const count = countFromShoe(s.shoe);
  s.round = {
    id: s.roundCounter,
    shoeId: s.shoe.shoeId,
    numberInShoe: s.shoe.roundsInShoe,
    balanceBefore: s.balance + totalBets(s),
    rcStart: count.running,
    tcStart: count.trueCount,
  };

  ctx.ev.push({ type: 'PHASE', phase: 'DEALING' });
  const created: { seat: number; handId: string; stake: number }[] = [];
  for (const seat of active) {
    const hand: PlayerHand = {
      id: `${s.roundCounter}-${seat.index}-0`,
      cards: [],
      bet: seat.bets.main,
      baseBet: seat.bets.main,
      stake: seat.bets.main,
      doubled: false,
      fromSplit: false,
      original: true,
      splitAces: false,
      status: 'playing',
      actions: [],
      result: null,
      payout: 0,
      settled: false,
    };
    seat.hands = [hand];
    seat.handSeq = 1;
    seat.spots.main = 0;
    created.push({ seat: seat.index, handId: hand.id, stake: hand.stake });
  }
  ctx.ev.push({ type: 'ROUND_START', roundId: s.roundCounter, hands: created });

  for (const seat of active) dealTo(ctx, handTarget(seat.index, 0));
  dealTo(ctx, { kind: 'dealer' });
  for (const seat of active) dealTo(ctx, handTarget(seat.index, 0));

  // Side bets
  if (active.some((seat) => seat.bets.perfectPairs > 0 || seat.bets.twentyOnePlus3 > 0)) {
    ctx.ev.push({ type: 'PHASE', phase: 'SIDE_BETS' });
    const up = s.dealer.cards[0] as Card;
    for (const seat of active) {
      const hand = seat.hands[0] as PlayerHand;
      const pair = [hand.cards[0], hand.cards[1]] as [Card, Card];
      for (const kind of SIDE_SPOTS) {
        const stake = seat.bets[kind];
        if (stake === 0) continue;
        const result = resolveSideBet(kind, stake, pair, up);
        seat.sideBets[kind] = result;
        ctx.ev.push({
          type: 'SIDE_BET_RESULT',
          seat: seat.index,
          bet: kind,
          outcome: result.outcome,
          multiplier: result.multiplier,
          stake,
          payout: result.payout,
        });
        payoutSpot(ctx, { kind: 'seat', seat: seat.index, spot: kind }, stake, result.payout);
        seat.spots[kind] = 0;
      }
    }
  }

  // Blackjacks naturels
  const up = s.dealer.cards[0] as Card;
  const dealerCanHaveBJ = up.rank === 'A' || isTenValue(up.rank);
  for (const seat of active) {
    const hand = seat.hands[0] as PlayerHand;
    if (!isBlackjackHand(hand, s.rules)) continue;
    hand.status = 'blackjack';
    ctx.ev.push({ type: 'BLACKJACK', target: handTarget(seat.index, 0) });
    if (!dealerCanHaveBJ) {
      settleHand(ctx, seat.index, 0, 'blackjack', blackjackReturn(hand.bet, s.rules));
    }
  }

  if (up.rank === 'A' && s.rules.insurance) {
    ctx.ev.push({ type: 'PHASE', phase: 'INSURANCE' });
    for (const seat of active) seat.insurance.decision = 'pending';
    nextInsurance(ctx);
  } else {
    proceedToPlayerTurns(ctx);
  }
}

// ---------------------------------------------------------------------------
// Assurance
// ---------------------------------------------------------------------------

function insuranceKind(s: GameState, seat: SeatState): 'insurance' | 'evenMoney' {
  const hand = seat.hands[0] as PlayerHand;
  return hand.status === 'blackjack' && s.rules.evenMoney ? 'evenMoney' : 'insurance';
}

function nextInsurance(ctx: Ctx): void {
  const s = ctx.s;
  for (const seat of s.seats) {
    if (seat.insurance.decision !== 'pending') continue;
    const kind = insuranceKind(s, seat);
    const cost = kind === 'insurance' ? insuranceCost(seat.bets.main) : 0;
    if (cost > s.balance) {
      seat.insurance.decision = 'declined';
      ctx.ev.push({
        type: 'INSURANCE_DECISION',
        seat: seat.index,
        decision: 'declined',
        amount: 0,
        auto: true,
      });
      continue;
    }
    s.phase = 'INSURANCE';
    s.insuranceSeat = seat.index;
    ctx.ev.push({ type: 'INSURANCE_OFFERED', seat: seat.index, kind, cost });
    return;
  }
  s.insuranceSeat = null;
  ctx.ev.push({ type: 'INSURANCE_CLOSED' });
  proceedToPlayerTurns(ctx);
}

function insurance(ctx: Ctx, take: boolean): void {
  const s = ctx.s;
  if (s.phase !== 'INSURANCE' || s.insuranceSeat === null) {
    throw new EngineError('INVALID_PHASE', "Pas d'assurance en cours");
  }
  const seat = s.seats[s.insuranceSeat] as SeatState;
  const kind = insuranceKind(s, seat);
  if (!take) {
    seat.insurance.decision = 'declined';
    ctx.ev.push({
      type: 'INSURANCE_DECISION',
      seat: seat.index,
      decision: 'declined',
      amount: 0,
      auto: false,
    });
  } else if (kind === 'evenMoney') {
    seat.insurance.decision = 'evenMoney';
    ctx.ev.push({
      type: 'INSURANCE_DECISION',
      seat: seat.index,
      decision: 'evenMoney',
      amount: 0,
      auto: false,
    });
    const hand = seat.hands[0] as PlayerHand;
    settleHand(ctx, seat.index, 0, 'evenMoney', hand.bet * 2);
  } else {
    const cost = insuranceCost(seat.bets.main);
    if (cost > s.balance) throw new EngineError('INSUFFICIENT_FUNDS', 'Solde insuffisant');
    s.balance -= cost;
    seat.insurance.decision = 'taken';
    seat.insurance.amount = cost;
    seat.spots.insurance = cost;
    ctx.ev.push({
      type: 'PLACE_CHIPS',
      spot: { kind: 'seat', seat: seat.index, spot: 'insurance' },
      amount: cost,
      balance: s.balance,
      reason: 'insurance',
    });
    ctx.ev.push({
      type: 'INSURANCE_DECISION',
      seat: seat.index,
      decision: 'taken',
      amount: cost,
      auto: false,
    });
  }
  nextInsurance(ctx);
}

// ---------------------------------------------------------------------------
// Tour des joueurs
// ---------------------------------------------------------------------------

function findPlayingHand(s: GameState): Turn | null {
  for (const seat of s.seats) {
    for (let h = 0; h < seat.hands.length; h++) {
      if ((seat.hands[h] as PlayerHand).status === 'playing') return { seat: seat.index, hand: h };
    }
  }
  return null;
}

function setTurn(ctx: Ctx, turn: Turn | null): void {
  const cur = ctx.s.turn;
  const same =
    cur === turn ||
    (cur !== null && turn !== null && cur.seat === turn.seat && cur.hand === turn.hand);
  if (same) return;
  ctx.s.turn = turn ? { ...turn } : null;
  ctx.ev.push({ type: 'ACTIVE_HAND', turn: turn ? { ...turn } : null });
}

function setStatus(ctx: Ctx, seat: number, hand: number, status: HandStatus, auto: boolean): void {
  handAt(ctx.s, seat, hand).status = status;
  ctx.ev.push({ type: 'HAND_STATUS', seat, hand, status, auto });
}

function proceedToPlayerTurns(ctx: Ctx): void {
  if (findPlayingHand(ctx.s)) {
    ctx.s.phase = 'PLAYER_TURNS';
    ctx.ev.push({ type: 'PHASE', phase: 'PLAYER_TURNS' });
  }
  continueTurns(ctx);
}

function continueTurns(ctx: Ctx): void {
  const s = ctx.s;
  for (;;) {
    const next = findPlayingHand(s);
    if (!next) {
      setTurn(ctx, null);
      dealerTurn(ctx);
      return;
    }
    setTurn(ctx, next);
    const seat = s.seats[next.seat] as SeatState;
    const hand = seat.hands[next.hand] as PlayerHand;
    if (hand.cards.length < 2) dealTo(ctx, handTarget(next.seat, next.hand));
    if (handValue(hand.cards).total === 21) {
      if (isBlackjackHand(hand, s.rules)) {
        hand.status = 'blackjack';
        ctx.ev.push({ type: 'BLACKJACK', target: handTarget(next.seat, next.hand) });
      } else {
        setStatus(ctx, next.seat, next.hand, 'stood', true);
      }
      continue;
    }
    if (hand.splitAces && !s.rules.hitSplitAces && !canSplitHand(hand, seat, s.rules, s.balance)) {
      setStatus(ctx, next.seat, next.hand, 'stood', true);
      continue;
    }
    return;
  }
}

function currentHand(ctx: Ctx): { turn: Turn; seat: SeatState; hand: PlayerHand } {
  const s = ctx.s;
  if (s.phase !== 'PLAYER_TURNS' || !s.turn) {
    throw new EngineError('INVALID_PHASE', "Ce n'est pas le tour du joueur");
  }
  const seat = s.seats[s.turn.seat] as SeatState;
  return { turn: s.turn, seat, hand: seat.hands[s.turn.hand] as PlayerHand };
}

function bust(ctx: Ctx, seat: number, hand: number): void {
  const h = handAt(ctx.s, seat, hand);
  h.status = 'bust';
  ctx.ev.push({ type: 'BUST', target: handTarget(seat, hand), total: handValue(h.cards).total });
  settleHand(ctx, seat, hand, 'bust', 0);
}

function hit(ctx: Ctx): void {
  const { turn, hand } = currentHand(ctx);
  if (!canHitHand(hand, ctx.s.rules)) throw new EngineError('INVALID_ACTION', 'Tirer impossible');
  hand.actions.push('hit');
  dealTo(ctx, handTarget(turn.seat, turn.hand));
  const total = handValue(hand.cards).total;
  if (total > 21) bust(ctx, turn.seat, turn.hand);
  else if (total === 21) setStatus(ctx, turn.seat, turn.hand, 'stood', true);
  else return;
  continueTurns(ctx);
}

function stand(ctx: Ctx): void {
  const { turn, hand } = currentHand(ctx);
  hand.actions.push('stand');
  setStatus(ctx, turn.seat, turn.hand, 'stood', false);
  continueTurns(ctx);
}

function doubleDown(ctx: Ctx): void {
  const { turn, hand } = currentHand(ctx);
  if (!canDoubleHand(hand, ctx.s.rules, ctx.s.balance)) {
    throw new EngineError('INVALID_ACTION', 'Doubler impossible');
  }
  const extra = hand.bet;
  ctx.s.balance -= extra;
  hand.bet += extra;
  hand.stake += extra;
  hand.doubled = true;
  hand.actions.push('double');
  ctx.ev.push({ type: 'DOUBLE', seat: turn.seat, hand: turn.hand });
  ctx.ev.push({
    type: 'PLACE_CHIPS',
    spot: { kind: 'hand', seat: turn.seat, hand: turn.hand },
    amount: extra,
    balance: ctx.s.balance,
    reason: 'double',
  });
  dealTo(ctx, handTarget(turn.seat, turn.hand));
  if (handValue(hand.cards).total > 21) bust(ctx, turn.seat, turn.hand);
  else setStatus(ctx, turn.seat, turn.hand, 'stood', true);
  continueTurns(ctx);
}

function split(ctx: Ctx): void {
  const { turn, seat, hand } = currentHand(ctx);
  if (!canSplitHand(hand, seat, ctx.s.rules, ctx.s.balance)) {
    throw new EngineError('INVALID_ACTION', 'Séparer impossible');
  }
  const amount = hand.bet;
  ctx.s.balance -= amount;
  const [first, second] = hand.cards as [Card, Card];
  const aces = first.rank === 'A' && second.rank === 'A';
  hand.cards = [first];
  hand.fromSplit = true;
  hand.splitAces = aces;
  hand.actions.push('split');
  const newHand: PlayerHand = {
    id: `${ctx.s.roundCounter}-${seat.index}-${seat.handSeq}`,
    cards: [second],
    bet: amount,
    baseBet: amount,
    stake: amount,
    doubled: false,
    fromSplit: true,
    original: false,
    splitAces: aces,
    status: 'playing',
    actions: [],
    result: null,
    payout: 0,
    settled: false,
  };
  seat.handSeq += 1;
  seat.hands.splice(turn.hand + 1, 0, newHand);
  ctx.ev.push({ type: 'SPLIT', seat: turn.seat, hand: turn.hand, newHandId: newHand.id });
  ctx.ev.push({
    type: 'PLACE_CHIPS',
    spot: { kind: 'hand', seat: turn.seat, hand: turn.hand + 1 },
    amount,
    balance: ctx.s.balance,
    reason: 'split',
  });
  continueTurns(ctx);
}

function surrender(ctx: Ctx): void {
  const { turn, hand } = currentHand(ctx);
  if (!canSurrenderHand(hand, ctx.s.dealer.cards[0], ctx.s.rules)) {
    throw new EngineError('INVALID_ACTION', 'Abandon impossible');
  }
  hand.actions.push('surrender');
  setStatus(ctx, turn.seat, turn.hand, 'surrendered', false);
  settleHand(ctx, turn.seat, turn.hand, 'surrender', surrenderReturn(hand.bet));
  continueTurns(ctx);
}

// ---------------------------------------------------------------------------
// Croupier & règlement
// ---------------------------------------------------------------------------

/** Déplace les jetons d'une case selon le montant rendu, et crédite le solde. */
function payoutSpot(ctx: Ctx, spot: SpotRef, stake: number, payout: number): void {
  assertMoney(payout, 'Paiement');
  if (payout > stake) {
    ctx.ev.push({ type: 'CHIPS_FROM_DEALER', spot, amount: payout - stake });
  } else if (payout < stake) {
    ctx.ev.push({ type: 'CHIPS_TO_DEALER', spot, amount: stake - payout });
  }
  if (payout > 0) {
    ctx.s.balance += payout;
    ctx.ev.push({ type: 'CHIPS_TO_PLAYER', spot, amount: payout, balance: ctx.s.balance });
  }
}

function settleHand(
  ctx: Ctx,
  seat: number,
  handIndex: number,
  result: HandResult,
  payout: number,
): void {
  const hand = handAt(ctx.s, seat, handIndex);
  hand.result = result;
  hand.payout = payout;
  hand.settled = true;
  ctx.ev.push({
    type: 'HAND_RESULT',
    seat,
    hand: handIndex,
    handId: hand.id,
    result,
    payout,
    net: payout - hand.bet,
    bet: hand.bet,
  });
  payoutSpot(ctx, { kind: 'hand', seat, hand: handIndex }, hand.stake, payout);
  hand.stake = 0;
}

function dealerTurn(ctx: Ctx): void {
  const s = ctx.s;
  ctx.ev.push({ type: 'PHASE', phase: 'DEALER_TURN' });
  const hands = s.seats.flatMap((seat) => seat.hands);
  const live = hands.filter((h) => h.status === 'stood' && !h.settled);
  const pendingBJ = hands.filter((h) => h.status === 'blackjack' && !h.settled);
  const insured = s.seats.filter((seat) => seat.insurance.decision === 'taken');

  let dealerBJ = false;
  if (live.length + pendingBJ.length + insured.length > 0) {
    const up = s.dealer.cards[0] as Card;
    if (up.rank === 'A' || isTenValue(up.rank)) {
      const card = drawCard(ctx);
      s.dealer.cards.push(card);
      ctx.ev.push({ type: 'DEAL_CARD', target: { kind: 'dealer' }, card, faceUp: false });
      ctx.ev.push({ type: 'DEALER_REVEAL_SUSPENSE' });
      ctx.ev.push({ type: 'FLIP_CARD', target: { kind: 'dealer' }, index: 1, card, slow: true });
    } else {
      dealTo(ctx, { kind: 'dealer' });
    }
    dealerBJ = dealerOutcome(s.dealer.cards).blackjack;
    if (dealerBJ) ctx.ev.push({ type: 'BLACKJACK', target: { kind: 'dealer' } });

    for (const seat of insured) {
      const amount = seat.insurance.amount;
      const payout = dealerBJ ? insuranceReturn(amount) : 0;
      seat.insurance.settled = true;
      seat.insurance.payout = payout;
      ctx.ev.push({ type: 'INSURANCE_RESULT', seat: seat.index, won: dealerBJ, amount, payout });
      payoutSpot(ctx, { kind: 'seat', seat: seat.index, spot: 'insurance' }, amount, payout);
      seat.spots.insurance = 0;
    }

    if (!dealerBJ && live.length > 0) {
      while (dealerShouldHit(s.dealer.cards, s.rules)) dealTo(ctx, { kind: 'dealer' });
      const total = handValue(s.dealer.cards).total;
      if (total > 21) ctx.ev.push({ type: 'BUST', target: { kind: 'dealer' }, total });
    }
  }

  ctx.ev.push({ type: 'PHASE', phase: 'SETTLEMENT' });
  const dealer = dealerOutcome(s.dealer.cards);
  for (const seat of s.seats) {
    seat.hands.forEach((hand, index) => {
      if (hand.settled) return;
      const { result, payout } = settleStandingHand(hand, dealer, s.rules);
      settleHand(ctx, seat.index, index, result, payout);
    });
  }

  const summary = buildRoundSummary(s);
  for (const seat of s.seats) {
    if (
      seat.spots.main +
        seat.spots.perfectPairs +
        seat.spots.twentyOnePlus3 +
        seat.spots.insurance !==
      0
    ) {
      throw new EngineError('INVARIANT', 'Jetons oubliés sur la table');
    }
    seat.bets = { main: 0, perfectPairs: 0, twentyOnePlus3: 0 };
  }
  s.phase = 'ROUND_END';
  ctx.ev.push({ type: 'ROUND_END', summary });
  ctx.ev.push({ type: 'PHASE', phase: 'ROUND_END' });
}

// ---------------------------------------------------------------------------
// Fin de tour, mélange, table, crédits
// ---------------------------------------------------------------------------

function reshuffle(ctx: Ctx, reason: 'cut' | 'table'): void {
  ctx.ev.push({ type: 'PHASE', phase: 'SHUFFLING' });
  ctx.s.shoe = createShoe(ctx.s.rules, ctx.rng, ctx.s.shoe.shoeId + 1);
  ctx.s.cutCardReached = false;
  ctx.ev.push({
    type: 'SHUFFLE',
    shoeId: ctx.s.shoe.shoeId,
    size: ctx.s.shoe.cards.length,
    cutIndex: ctx.s.shoe.cutIndex,
    reason,
  });
  if (ctx.s.shoe.burned > 0) ctx.ev.push({ type: 'BURN_CARD', count: ctx.s.shoe.burned });
}

function newRound(ctx: Ctx, allowShuffle: boolean): void {
  const s = ctx.s;
  const onTable =
    s.dealer.cards.length +
    s.seats.reduce((t, seat) => t + seat.hands.reduce((u, h) => u + h.cards.length, 0), 0);
  s.shoe.discard += onTable;
  ctx.ev.push({ type: 'CLEAR_TABLE', discard: s.shoe.discard });
  s.seats = s.seats.map((seat) => emptySeat(seat.index));
  s.dealer = { cards: [] };
  s.turn = null;
  s.insuranceSeat = null;
  s.round = null;
  if (allowShuffle && s.cutCardReached) reshuffle(ctx, 'cut');
  s.phase = 'BETTING';
  ctx.ev.push({ type: 'PHASE', phase: 'BETTING' });
}

function setTable(ctx: Ctx, table: TableLimits): void {
  const s = ctx.s;
  if (s.phase === 'ROUND_END') newRound(ctx, false);
  if (s.phase !== 'BETTING')
    throw new EngineError('INVALID_PHASE', 'Changement de table impossible');
  if (table.min % BET_UNIT !== 0 || table.max % BET_UNIT !== 0 || table.min > table.max) {
    throw new EngineError('INVALID_AMOUNT', 'Limites de table invalides');
  }
  clearBets(ctx);
  s.table = table;
  s.lastBets = null;
  ctx.ev.push({ type: 'TABLE_CHANGED', table });
  reshuffle(ctx, 'table');
  ctx.ev.push({ type: 'PHASE', phase: 'BETTING' });
}

function credit(
  ctx: Ctx,
  amount: number,
  reason: 'recharge' | 'levelUp' | 'quiz' | 'import',
): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new EngineError('INVALID_AMOUNT', `Crédit invalide : ${amount}`);
  }
  ctx.s.balance += amount;
  ctx.ev.push({ type: 'BALANCE_CREDITED', amount, balance: ctx.s.balance, reason });
}

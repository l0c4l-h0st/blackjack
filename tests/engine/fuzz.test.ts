import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../../src/config/rules';
import type { GameEvent } from '../../src/engine/events';
import { applyAction, createGame, getAvailableActions } from '../../src/engine/round';
import type { Rng } from '../../src/engine/rng';
import { SeededRng, randomInt } from '../../src/engine/rng';
import type { BetSpot, GameState, PlayerAction, RulesConfig } from '../../src/engine/types';
import { projectView, reduceView } from '../../src/engine/view';

const chance = (rng: Rng, p: number) => randomInt(rng, 1_000_000) < p * 1_000_000;

function bettingActions(rng: Rng, s: GameState): PlayerAction[] {
  const a = getAvailableActions(s);
  if (a.rebet && chance(rng, 0.25)) {
    const out: PlayerAction[] = [{ type: 'REBET' }];
    if (chance(rng, 0.2)) out.push({ type: 'DOUBLE_BETS' });
    return out;
  }
  const actions: PlayerAction[] = [];
  const seats = 1 + randomInt(rng, s.rules.maxSeats);
  for (let i = 0; i < seats; i++) {
    const seat = randomInt(rng, s.rules.maxSeats);
    actions.push({ type: 'PLACE_BET', seat, spot: 'main', amount: 10 * (1 + randomInt(rng, 40)) });
    for (const spot of ['perfectPairs', 'twentyOnePlus3'] as BetSpot[]) {
      if (chance(rng, 0.3)) {
        actions.push({ type: 'PLACE_BET', seat, spot, amount: 10 * (1 + randomInt(rng, 4)) });
      }
    }
  }
  if (chance(rng, 0.05)) actions.push({ type: 'REMOVE_BET', seat: 0, spot: 'main' });
  if (chance(rng, 0.02)) actions.push({ type: 'CLEAR_BETS' });
  return actions;
}

function pickAction(rng: Rng, s: GameState): PlayerAction {
  const a = getAvailableActions(s);
  if (s.phase === 'INSURANCE') {
    return { type: 'INSURANCE', take: a.insurance?.canAfford === true && chance(rng, 0.5) };
  }
  const moves: PlayerAction[] = [];
  if (a.hit) moves.push({ type: 'HIT' }, { type: 'HIT' });
  if (a.stand) moves.push({ type: 'STAND' }, { type: 'STAND' });
  if (a.double) moves.push({ type: 'DOUBLE' });
  if (a.split) moves.push({ type: 'SPLIT' }, { type: 'SPLIT' });
  if (a.surrender) moves.push({ type: 'SURRENDER' });
  return moves[randomInt(rng, moves.length)] as PlayerAction;
}

function assertEventsIntegers(events: GameEvent[]): void {
  for (const e of events) {
    for (const key of ['amount', 'balance', 'payout', 'net', 'stake', 'cost', 'bet'] as const) {
      const value = (e as Record<string, unknown>)[key];
      if (typeof value === 'number') expect(Number.isInteger(value)).toBe(true);
    }
  }
}

interface FuzzResult {
  rounds: number;
  actions: number;
}

function fuzz(
  seed: number,
  rounds: number,
  rules: RulesConfig,
  checkViewRounds: number,
): FuzzResult {
  const rng = new SeededRng(seed);
  const engineRng = new SeededRng(seed ^ 0x5eed);
  let s = createGame({
    rules,
    table: { id: 'fuzz', min: 10, max: 500 },
    balance: 20_000,
    rng: engineRng,
  });
  let credits = 20_000;
  let netSum = 0;
  let played = 0;
  let actionCount = 0;

  const step = (action: PlayerAction): boolean => {
    const before = s;
    let result: ReturnType<typeof applyAction>;
    try {
      result = applyAction(before, action, { rng: engineRng });
    } catch (e) {
      // Les actions de mise aléatoires peuvent dépasser les limites : c'est attendu.
      if (['PLACE_BET', 'REMOVE_BET', 'DOUBLE_BETS'].includes(action.type)) return false;
      throw e;
    }
    actionCount += 1;
    s = result.state;
    expect(Number.isSafeInteger(s.balance)).toBe(true);
    expect(s.balance).toBeGreaterThanOrEqual(0);
    assertEventsIntegers(result.events);
    if (played < checkViewRounds) {
      const replayed = result.events.reduce(reduceView, projectView(before));
      expect(replayed).toEqual(projectView(s));
    }
    for (const e of result.events) {
      if (e.type === 'ROUND_END') {
        const t = e.summary.totals;
        expect(t.net).toBe(e.summary.balanceAfter - e.summary.balanceBefore);
        expect(t.returned - t.wagered).toBe(t.net);
        netSum += t.net;
        played += 1;
      }
      if (e.type === 'BALANCE_CREDITED') credits += e.amount;
    }
    if (actionCount % 997 === 0) {
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
    return true;
  };

  while (played < rounds) {
    if (s.phase === 'BETTING' || s.phase === 'ROUND_END') {
      if (s.phase === 'ROUND_END' && chance(rng, 0.5)) step({ type: 'NEW_ROUND' });
      if (s.balance < 2000) step({ type: 'CREDIT', amount: 20_000, reason: 'recharge' });
      for (const a of bettingActions(rng, s)) step(a);
      if (getAvailableActions(s).deal) step({ type: 'DEAL' });
      else if (s.phase === 'BETTING' && s.seats.every((seat) => seat.bets.main === 0)) {
        step({ type: 'PLACE_BET', seat: 0, spot: 'main', amount: 10 });
      }
    } else {
      step(pickAction(rng, s));
    }
  }
  // Conservation : solde = crédits apportés + somme des nets (les mises posées non jouées sont rendues).
  const pending = s.seats.reduce(
    (t, seat) => t + seat.bets.main + seat.bets.perfectPairs + seat.bets.twentyOnePlus3,
    0,
  );
  expect(s.balance + pending).toBe(credits + netSum);
  return { rounds: played, actions: actionCount };
}

describe('fuzz moteur', () => {
  it('50 000 tours aléatoires : montants entiers, solde jamais négatif, vue cohérente', () => {
    const r = fuzz(12345, 50_000, DEFAULT_RULES, 8_000);
    expect(r.rounds).toBe(50_000);
  });

  it('variantes de règles (H17, OBO, re-split As, doubles restreints…)', () => {
    const variants: Partial<RulesConfig>[] = [
      {
        dealerHitsSoft17: true,
        enhcLoseAllOnDealerBJ: false,
        resplitAces: true,
        hitSplitAces: true,
      },
      { doubleOn: '9-11', surrenderVsAce: true, surrenderAfterSplit: true, evenMoney: false },
      {
        doubleOn: '10-11',
        splitAce21IsBlackjack: true,
        doubleAfterSplit: false,
        splitByValue: false,
      },
      { insurance: false, surrender: false, decks: 1, maxSeats: 3 },
    ];
    variants.forEach((v, i) => {
      const r = fuzz(777 + i, 3_000, { ...DEFAULT_RULES, ...v }, 3_000);
      expect(r.rounds).toBe(3_000);
    });
  });
});

import { DEFAULT_RULES } from '../../src/config/rules';
import { parseCards } from '../../src/engine/cards';
import type { GameEvent } from '../../src/engine/events';
import type { EngineDeps } from '../../src/engine/round';
import { applyAction, createGame } from '../../src/engine/round';
import { SeededRng } from '../../src/engine/rng';
import { createStackedShoe } from '../../src/engine/shoe';
import type {
  GameState,
  PlayerAction,
  PlayerHand,
  RulesConfig,
  TableLimits,
} from '../../src/engine/types';

export const TEST_TABLE: TableLimits = { id: 'test', min: 10, max: 1000 };

export interface RigOptions {
  balance?: number;
  rules?: Partial<RulesConfig>;
  table?: TableLimits;
}

/** Partie dont le sabot délivre exactement les cartes données, dans l'ordre. */
export function rigged(cards: string, options: RigOptions = {}): GameState {
  return createGame({
    rules: { ...DEFAULT_RULES, ...options.rules },
    table: options.table ?? TEST_TABLE,
    balance: options.balance ?? 1000,
    rng: new SeededRng(7),
    shoe: createStackedShoe(parseCards(cards)),
  });
}

export interface Played {
  state: GameState;
  events: GameEvent[];
}

export function play(state: GameState, actions: PlayerAction[], deps?: EngineDeps): Played {
  let current = state;
  const events: GameEvent[] = [];
  for (const action of actions) {
    const r = applyAction(current, action, deps ?? { rng: new SeededRng(11) });
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

export interface SeatBet {
  seat?: number;
  main: number;
  pp?: number;
  tp?: number;
}

export function betActions(bets: SeatBet[]): PlayerAction[] {
  const actions: PlayerAction[] = [];
  for (const b of bets) {
    const seat = b.seat ?? 0;
    actions.push({ type: 'PLACE_BET', seat, spot: 'main', amount: b.main });
    if (b.pp) actions.push({ type: 'PLACE_BET', seat, spot: 'perfectPairs', amount: b.pp });
    if (b.tp) actions.push({ type: 'PLACE_BET', seat, spot: 'twentyOnePlus3', amount: b.tp });
  }
  return actions;
}

/** Mise puis distribution sur un sabot truqué. */
export function dealRigged(
  cards: string,
  bets: SeatBet[] = [{ main: 100 }],
  options: RigOptions = {},
): Played {
  return play(rigged(cards, options), [...betActions(bets), { type: 'DEAL' }]);
}

export function hand(state: GameState, seat = 0, index = 0): PlayerHand {
  const h = state.seats[seat]?.hands[index];
  if (!h) throw new Error(`Main absente ${seat}/${index}`);
  return h;
}

export function eventTypes(events: GameEvent[]): string[] {
  return events.map((e) => e.type);
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

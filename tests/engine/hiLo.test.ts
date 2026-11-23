import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../../src/config/rules';
import { parseCards } from '../../src/engine/cards';
import {
  countFromShoe,
  decksRemaining,
  estimatedPlayerEdge,
  hiLoValue,
  roundCount,
  runningCountOf,
  trueCount,
} from '../../src/engine/count/hiLo';
import { createGame } from '../../src/engine/round';
import { createStackedShoe } from '../../src/engine/shoe';
import { projectView, reduceView } from '../../src/engine/view';
import { TEST_TABLE, play } from './helpers';

describe('Hi-Lo', () => {
  it('valeurs des cartes', () => {
    expect(['2', '3', '4', '5', '6'].map((r) => hiLoValue(r as '2'))).toEqual([1, 1, 1, 1, 1]);
    expect(['7', '8', '9'].map((r) => hiLoValue(r as '7'))).toEqual([0, 0, 0]);
    expect(['10', 'J', 'Q', 'K', 'A'].map((r) => hiLoValue(r as 'A'))).toEqual([
      -1, -1, -1, -1, -1,
    ]);
  });

  it('running count', () => {
    expect(runningCountOf(parseCards('2S 5H KD AC 7S 3D'))).toBe(1);
    expect(runningCountOf([])).toBe(0);
  });

  it('decks restants au demi-jeu près', () => {
    expect(decksRemaining(312)).toBe(6);
    expect(decksRemaining(130)).toBe(2.5);
    expect(decksRemaining(118)).toBe(2.5);
    expect(decksRemaining(10)).toBe(0.5);
    expect(decksRemaining(0)).toBe(0.5);
  });

  it('true count et estimation d’avantage', () => {
    expect(trueCount(6, 3)).toBe(2);
    expect(trueCount(-5, 2.5)).toBe(-2);
    expect(estimatedPlayerEdge(0)).toBe(-0.5);
    expect(estimatedPlayerEdge(3)).toBe(1);
    expect(roundCount(-0.04)).toBe(0);
    expect(roundCount(1.26)).toBe(1.3);
  });

  it('ne compte pas la carte brûlée', () => {
    const cards = parseCards('KS 2H 3D 4C');
    const snap = countFromShoe({ cards, position: 3, burned: 1 });
    expect(snap.running).toBe(2);
    expect(snap.cardsLeft).toBe(1);
  });
});

describe('comptage dans la vue', () => {
  it('la 2e carte du croupier ne compte qu’une fois retournée', () => {
    // Joueur 10+9, croupier As (suspense), 2e carte = 5.
    const state = createGame({
      rules: { ...DEFAULT_RULES, insurance: false },
      table: TEST_TABLE,
      balance: 1000,
      shoe: createStackedShoe(parseCards('TS AH 9D 5C 2S 4S')),
    });
    const dealt = play(state, [
      { type: 'PLACE_BET', seat: 0, spot: 'main', amount: 10 },
      { type: 'DEAL' },
    ]);
    let view = projectView(dealt.state);
    expect(view.runningCount).toBe(-2);
    const stood = play(dealt.state, [{ type: 'STAND' }]);
    const flipIndex = stood.events.findIndex((e) => e.type === 'FLIP_CARD');
    for (const e of stood.events.slice(0, flipIndex)) view = reduceView(view, e);
    expect(view.dealer.cards[1]?.faceUp).toBe(false);
    expect(view.runningCount).toBe(-2);
    for (const e of stood.events.slice(flipIndex)) view = reduceView(view, e);
    expect(view.runningCount).toBe(projectView(stood.state).runningCount);
    expect(view).toEqual(projectView(stood.state));
  });

  it('remis à zéro au mélange', () => {
    const state = createGame({
      rules: DEFAULT_RULES,
      table: TEST_TABLE,
      balance: 1000,
      shoe: createStackedShoe(parseCards('2S 9H 3D 4C 5S 6S'), { cutIndex: 1 }),
    });
    const done = play(state, [
      { type: 'PLACE_BET', seat: 0, spot: 'main', amount: 10 },
      { type: 'DEAL' },
      { type: 'STAND' },
    ]);
    expect(projectView(done.state).runningCount).toBeGreaterThan(0);
    const next = play(done.state, [{ type: 'NEW_ROUND' }]);
    const view = next.events.reduce(reduceView, projectView(done.state));
    expect(view.runningCount).toBe(0);
    expect(view).toEqual(projectView(next.state));
  });
});

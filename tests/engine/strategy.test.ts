import { describe, expect, it } from 'vitest';
import { parseCards } from '../../src/engine/cards';
import { applyAction } from '../../src/engine/round';
import type { StrategyInput } from '../../src/engine/strategy/basic';
import { basicStrategy, decideAction } from '../../src/engine/strategy/basic';
import type { Rank } from '../../src/engine/types';
import { dealRigged, play, rigged } from './helpers';

const all = { canDouble: true, canSplit: true, canSurrender: true };
const s = (cards: string, up: Rank, flags: Partial<StrategyInput> = {}) =>
  basicStrategy({ cards: parseCards(cards), dealerUp: up, ...all, ...flags });

describe('stratégie de base ENHC', () => {
  it('totaux durs', () => {
    expect(s('5S 3H', '6')).toBe('hit');
    expect(s('5S 4H', '4')).toBe('double');
    expect(s('5S 4H', '2')).toBe('hit');
    expect(s('6S 4H', '9')).toBe('double');
    expect(s('6S 4H', '10')).toBe('hit');
    expect(s('6S 5H', '9')).toBe('double');
    expect(s('6S 5H', '10')).toBe('hit'); // ENHC : pas de double 11 contre 10
    expect(s('6S 5H', 'A')).toBe('hit');
    expect(s('TS 2H', '4')).toBe('stand');
    expect(s('TS 2H', '3')).toBe('hit');
    expect(s('TS 3H', '2')).toBe('stand');
    expect(s('TS 3H', '7')).toBe('hit');
    expect(s('TS 6H', '10')).toBe('surrender');
    expect(s('TS 4H', '10')).toBe('surrender');
    expect(s('TS 6H', '10', { canSurrender: false })).toBe('hit');
    expect(s('TS 6H', 'A')).toBe('hit');
    expect(s('TS 7H', 'A')).toBe('stand');
    expect(s('6S 5H', '6', { canDouble: false })).toBe('hit');
  });

  it('totaux soft', () => {
    expect(s('AS 2H', '5')).toBe('double');
    expect(s('AS 2H', '4')).toBe('hit');
    expect(s('AS 4H', '4')).toBe('double');
    expect(s('AS 6H', '3')).toBe('double');
    expect(s('AS 6H', '7')).toBe('hit');
    expect(s('AS 7H', '6')).toBe('double');
    expect(s('AS 7H', '6', { canDouble: false })).toBe('stand');
    expect(s('AS 7H', '7')).toBe('stand');
    expect(s('AS 7H', '9')).toBe('hit');
    expect(s('AS 8H', '6')).toBe('stand');
    expect(s('AS 2H 3D', '6', { canDouble: false })).toBe('hit');
  });

  it('paires', () => {
    expect(s('AS AH', '10')).toBe('split');
    expect(s('AS AH', 'A')).toBe('hit'); // ENHC
    expect(s('8S 8H', '9')).toBe('split');
    expect(s('8S 8H', '10')).toBe('surrender');
    expect(s('8S 8H', 'A')).toBe('hit');
    expect(s('7S 7H', '10')).toBe('surrender');
    expect(s('7S 7H', '7')).toBe('split');
    expect(s('9S 9H', '7')).toBe('stand');
    expect(s('9S 9H', '8')).toBe('split');
    expect(s('TS KH', '6')).toBe('stand');
    expect(s('5S 5H', '6')).toBe('double');
    expect(s('4S 4H', '5')).toBe('split');
    expect(s('4S 4H', '4')).toBe('hit');
    expect(s('2S 2H', '7')).toBe('split');
    expect(s('3S 3H', '8')).toBe('hit');
    expect(s('6S 6H', '6')).toBe('split');
    expect(s('6S 6H', '6', { canSplit: false })).toBe('stand');
  });
});

describe('decideAction', () => {
  it('refuse l’assurance et l’even money', () => {
    const d = dealRigged('AS AH KD 9C');
    expect(decideAction(d.state)).toEqual({ type: 'INSURANCE', take: false });
  });

  it('joue un tour complet', () => {
    let st = dealRigged('8S 6H 8D 3C 9D TS 7C KS').state;
    expect(decideAction(st)).toEqual({ type: 'SPLIT' });
    while (st.phase === 'PLAYER_TURNS') st = applyAction(st, decideAction(st)).state;
    expect(st.phase).toBe('ROUND_END');
  });

  it('reste sur des As splittés sans tirage possible', () => {
    const d = dealRigged('AS 9H AD AC 5D 8S 9C 2D', [{ main: 100 }], {
      rules: { resplitAces: true },
    });
    const r = play(d.state, [{ type: 'SPLIT' }]);
    // A-A contre 9 : la stratégie voudrait re-splitter
    expect(decideAction(r.state)).toEqual({ type: 'SPLIT' });
    const broke = { ...r.state, balance: 0 };
    expect(decideAction(broke)).toEqual({ type: 'STAND' });
  });

  it('erreur hors décision', () => {
    expect(() => decideAction(rigged('TS'))).toThrow('aucune décision');
    const d = dealRigged('8S 6H 8D');
    const corrupted = { ...d.state, turn: { seat: 0, hand: 5 } };
    expect(() => decideAction(corrupted)).toThrow('main introuvable');
  });
});

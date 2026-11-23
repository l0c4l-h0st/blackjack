import { describe, expect, it } from 'vitest';
import { spotKey } from '../../src/engine/events';
import {
  blackjackReturn,
  dealerOutcome,
  insuranceCost,
  settleStandingHand,
  surrenderReturn,
} from '../../src/engine/settlement';
import { EngineError, buildRoundSummary } from '../../src/engine/settlement';
import { parseCards } from '../../src/engine/cards';
import { projectView, reduceView, spotAmount } from '../../src/engine/view';
import { dealRigged, play, rigged } from './helpers';

describe('vue', () => {
  it('rejoue une partie complète à l’identique', () => {
    const start = rigged('8S 6H 8D 3C 9D TS 7C KS');
    const actions = [
      { type: 'PLACE_BET', seat: 0, spot: 'main', amount: 100 },
      { type: 'PLACE_BET', seat: 0, spot: 'perfectPairs', amount: 10 },
      { type: 'DEAL' },
      { type: 'SPLIT' },
      { type: 'DOUBLE' },
      { type: 'STAND' },
    ] as const;
    let state = start;
    let view = projectView(start);
    for (const action of actions) {
      const r = play(state, [action]);
      view = r.events.reduce(reduceView, view);
      state = r.state;
      expect(view).toEqual(projectView(state));
    }
  });

  it('expose le montant des cases', () => {
    const d = play(rigged('TS 9H 8D'), [
      { type: 'PLACE_BET', seat: 1, spot: 'main', amount: 50 },
      { type: 'PLACE_BET', seat: 1, spot: 'twentyOnePlus3', amount: 20 },
    ]);
    const view = projectView(d.state);
    expect(spotAmount(view, { kind: 'seat', seat: 1, spot: 'main' })).toBe(50);
    expect(spotAmount(view, { kind: 'seat', seat: 1, spot: 'twentyOnePlus3' })).toBe(20);
    expect(spotAmount(view, { kind: 'hand', seat: 1, hand: 0 })).toBe(0);
    expect(spotAmount(view, { kind: 'seat', seat: 9, spot: 'main' })).toBe(0);
    expect(spotKey({ kind: 'hand', seat: 1, hand: 2 })).toBe('s1-h2');
    expect(spotKey({ kind: 'seat', seat: 0, spot: 'insurance' })).toBe('s0-insurance');
  });

  it('signale une incohérence d’événement', () => {
    const view = projectView(rigged('TS'));
    expect(() =>
      reduceView(view, { type: 'HAND_STATUS', seat: 0, hand: 3, status: 'stood', auto: false }),
    ).toThrow('main inconnue');
    expect(() => reduceView(view, { type: 'DOUBLE', seat: 8, hand: 0 })).toThrow('place inconnue');
  });

  it('ignore le retournement d’une carte déjà visible', () => {
    const d = dealRigged('TS 9H 8D');
    const view = projectView(d.state);
    const card = d.state.dealer.cards[0];
    if (!card) throw new Error('carte attendue');
    const after = reduceView(view, {
      type: 'FLIP_CARD',
      target: { kind: 'dealer' },
      index: 0,
      card,
      slow: false,
    });
    expect(after.runningCount).toBe(view.runningCount);
  });
});

describe('règlement', () => {
  const rules = { enhcLoseAllOnDealerBJ: true, blackjackPayout: 1.5 };
  const dealer = (n: string) => dealerOutcome(parseCards(n));
  const handOf = (n: string, bet = 100) => ({
    status: 'stood' as const,
    cards: parseCards(n),
    bet,
    baseBet: bet,
    original: true,
  });

  it('montants', () => {
    expect(blackjackReturn(10, rules)).toBe(25);
    expect(surrenderReturn(10)).toBe(5);
    expect(insuranceCost(10)).toBe(5);
    expect(() => blackjackReturn(15, { blackjackPayout: 1.5 })).toThrow(EngineError);
  });

  it('compare les mains', () => {
    expect(settleStandingHand(handOf('TS 9H'), dealer('TS 8H'), rules)).toEqual({
      result: 'win',
      payout: 200,
    });
    expect(settleStandingHand(handOf('TS 7H'), dealer('TS 8H'), rules)).toEqual({
      result: 'lose',
      payout: 0,
    });
    expect(settleStandingHand(handOf('TS 8H'), dealer('TS 8H'), rules)).toEqual({
      result: 'push',
      payout: 100,
    });
    expect(settleStandingHand(handOf('TS 2H'), dealer('TS 6H 9C'), rules)).toEqual({
      result: 'win',
      payout: 200,
    });
    expect(settleStandingHand(handOf('TS AH'), dealer('AS KH'), rules).result).toBe('lose');
  });

  it('refuse un résumé sans tour', () => {
    expect(() => buildRoundSummary(rigged('TS'))).toThrow('Aucun tour');
  });

  it('détecte une main non réglée ou un écart de solde', () => {
    const d = dealRigged('TS 9H 8D');
    expect(() => buildRoundSummary(d.state)).toThrow('non réglée');
    const done = play(dealRigged('TS 9H 8D 7C 2S').state, [{ type: 'STAND' }]).state;
    const round = done.round;
    if (!round) throw new Error('tour attendu');
    expect(() => buildRoundSummary({ ...done, round: { ...round, balanceBefore: 1 } })).toThrow(
      'Écart de solde',
    );
  });
});

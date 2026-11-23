import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine/events';
import {
  EngineError,
  applyAction,
  betRoom,
  getAvailableActions,
  totalBets,
} from '../../src/engine/round';
import type { GameState, PlayerAction } from '../../src/engine/types';
import { betActions, dealRigged, deepFreeze, eventTypes, hand, play, rigged } from './helpers';

const STAND: PlayerAction = { type: 'STAND' };
const HIT: PlayerAction = { type: 'HIT' };
const SPLIT: PlayerAction = { type: 'SPLIT' };
const DOUBLE: PlayerAction = { type: 'DOUBLE' };
const NO_INSURANCE: PlayerAction = { type: 'INSURANCE', take: false };
const INSURE: PlayerAction = { type: 'INSURANCE', take: true };

function expectEngineError(fn: () => unknown, code: EngineError['code']): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(EngineError);
    expect((e as EngineError).code).toBe(code);
    return;
  }
  throw new Error(`EngineError ${code} attendue`);
}

function indexOfType(events: GameEvent[], type: GameEvent['type']): number {
  return events.findIndex((e) => e.type === type);
}

describe('distribution', () => {
  it('distribue dans l’ordre réaliste : places de droite à gauche, croupier, 2e carte', () => {
    const r = dealRigged('AS 2H 3D 4C 5S', [
      { seat: 0, main: 10 },
      { seat: 1, main: 10 },
    ]);
    const deals = r.events.filter((e) => e.type === 'DEAL_CARD');
    expect(deals.map((e) => (e.type === 'DEAL_CARD' ? e.target : null))).toEqual([
      { kind: 'hand', seat: 0, hand: 0 },
      { kind: 'hand', seat: 1, hand: 0 },
      { kind: 'dealer' },
      { kind: 'hand', seat: 0, hand: 0 },
      { kind: 'hand', seat: 1, hand: 0 },
    ]);
    expect(r.state.dealer.cards).toHaveLength(1);
    expect(hand(r.state, 0).cards.map((c) => c.rank)).toEqual(['A', '4']);
    expect(hand(r.state, 1).cards.map((c) => c.rank)).toEqual(['2', '5']);
    expect(r.state.turn).toEqual({ seat: 0, hand: 0 });
    expect(r.state.phase).toBe('PLAYER_TURNS');
  });

  it('enregistre le tour (solde avant, comptage, dernière mise)', () => {
    const r = dealRigged('9S 5H 7D', [{ main: 100, pp: 10 }]);
    expect(r.state.round).toMatchObject({ id: 1, balanceBefore: 1000, rcStart: 0, tcStart: 0 });
    expect(r.state.lastBets?.[0]).toEqual({ main: 100, perfectPairs: 10, twentyOnePlus3: 0 });
  });
});

describe('blackjack', () => {
  it('paye 3:2 immédiatement contre un 2–9 et le croupier ne tire pas', () => {
    const r = dealRigged('AS 9H KD');
    expect(hand(r.state).status).toBe('blackjack');
    expect(hand(r.state).result).toBe('blackjack');
    expect(r.state.balance).toBe(1150);
    expect(r.state.phase).toBe('ROUND_END');
    expect(r.state.dealer.cards).toHaveLength(1);
    const result = r.events.find((e) => e.type === 'HAND_RESULT');
    expect(result).toMatchObject({ result: 'blackjack', payout: 250, net: 150 });
    const dealerTurn = r.events.findIndex((e) => e.type === 'PHASE' && e.phase === 'DEALER_TURN');
    expect(indexOfType(r.events, 'HAND_RESULT')).toBeLessThan(dealerTurn);
  });

  it('met le BJ en attente contre un 10 puis le paye si le croupier n’a pas BJ', () => {
    const r = dealRigged('AS KH KD 7C');
    expect(r.state.phase).toBe('ROUND_END');
    expect(r.state.dealer.cards).toHaveLength(2);
    expect(r.state.balance).toBe(1150);
    expect(indexOfType(r.events, 'DEALER_REVEAL_SUSPENSE')).toBeLessThan(
      indexOfType(r.events, 'HAND_RESULT'),
    );
  });

  it('BJ joueur contre BJ croupier = push', () => {
    const r = dealRigged('AS KH KD AC');
    expect(hand(r.state).result).toBe('push');
    expect(r.state.balance).toBe(1000);
    expect(r.events.some((e) => e.type === 'BLACKJACK' && e.target.kind === 'dealer')).toBe(true);
  });

  it('21 en trois cartes n’est pas un blackjack (paye 1:1)', () => {
    const r = play(dealRigged('TS 9H 5D 6C 8S').state, [HIT]);
    expect(hand(r.state).status).toBe('stood');
    expect(hand(r.state).result).toBe('win');
    expect(r.state.balance).toBe(1100);
  });

  it('As splittés + 10 = 21, payé 1:1, une seule carte par As', () => {
    const r = play(dealRigged('AS 9H AD KC QD 8S').state, [SPLIT]);
    expect(r.state.phase).toBe('ROUND_END');
    expect(r.state.seats[0]?.hands).toHaveLength(2);
    for (const h of r.state.seats[0]?.hands ?? []) {
      expect(h.cards).toHaveLength(2);
      expect(h.result).toBe('win');
      expect(h.splitAces).toBe(true);
    }
    expect(r.state.balance).toBe(1200);
  });

  it('variante : 21 après split compté comme BJ', () => {
    const r = play(
      dealRigged('AS 9H AD KC QD 8S', [{ main: 100 }], { rules: { splitAce21IsBlackjack: true } })
        .state,
      [SPLIT],
    );
    expect(r.state.seats[0]?.hands.map((h) => h.result)).toEqual(['blackjack', 'blackjack']);
    expect(r.state.balance).toBe(1000 - 200 + 500);
  });
});

describe('croupier', () => {
  it('reste sur soft 17 (S17)', () => {
    const r = play(dealRigged('TS AH 8D 6C 9S').state, [NO_INSURANCE, STAND]);
    expect(r.state.dealer.cards.map((c) => c.rank)).toEqual(['A', '6']);
    expect(hand(r.state).result).toBe('win');
  });

  it('tire sur soft 17 en H17', () => {
    const r = play(
      dealRigged('TS AH 8D 6C 2S', [{ main: 100 }], { rules: { dealerHitsSoft17: true } }).state,
      [NO_INSURANCE, STAND],
    );
    expect(r.state.dealer.cards).toHaveLength(3);
    expect(hand(r.state).result).toBe('lose');
  });

  it('tire sur 16', () => {
    const r = play(dealRigged('TS TH 8D 6C 5S').state, [STAND]);
    expect(r.state.dealer.cards.map((c) => c.rank)).toEqual(['10', '6', '5']);
    expect(hand(r.state).result).toBe('lose');
    expect(r.state.balance).toBe(900);
  });

  it('bust du croupier : toutes les mains debout gagnent', () => {
    const r = play(dealRigged('TS TH 8D 6C KS').state, [STAND]);
    expect(r.events.some((e) => e.type === 'BUST' && e.target.kind === 'dealer')).toBe(true);
    expect(hand(r.state).result).toBe('win');
  });

  it('égalité = push', () => {
    const r = play(dealRigged('TS TH 8D 8C').state, [STAND]);
    expect(hand(r.state).result).toBe('push');
    expect(r.state.balance).toBe(1000);
  });

  it('ne tire rien si toutes les mains ont sauté', () => {
    const r = play(dealRigged('TS 9H 6D KC 5S').state, [HIT]);
    expect(hand(r.state).result).toBe('bust');
    expect(r.state.dealer.cards).toHaveLength(1);
    expect(r.state.phase).toBe('ROUND_END');
  });

  it('tire seulement sa 2e carte s’il reste une assurance', () => {
    const r = play(dealRigged('TS AH 6D KC 5S 9S').state, [INSURE, HIT]);
    expect(hand(r.state).result).toBe('bust');
    expect(r.state.dealer.cards.map((c) => c.rank)).toEqual(['A', '5']);
    expect(r.state.seats[0]?.insurance).toMatchObject({ amount: 50, payout: 0, settled: true });
    expect(r.state.balance).toBe(850);
  });
});

describe('ENHC : blackjack du croupier', () => {
  it('le joueur perd la mise doublée', () => {
    const r = play(dealRigged('6S TH 5D 9C AS').state, [DOUBLE]);
    expect(hand(r.state).doubled).toBe(true);
    expect(hand(r.state).result).toBe('lose');
    expect(r.state.balance).toBe(800);
  });

  it('le joueur perd toutes les mises splittées', () => {
    const r = play(dealRigged('8S AH 8D 3C TC 9S KD').state, [NO_INSURANCE, SPLIT, DOUBLE, STAND]);
    const hands = r.state.seats[0]?.hands ?? [];
    expect(hands.map((h) => h.result)).toEqual(['lose', 'lose']);
    expect(hands.map((h) => h.bet)).toEqual([200, 100]);
    expect(r.state.balance).toBe(700);
  });

  it('variante OBO : seule la mise d’origine est perdue', () => {
    const r = play(
      dealRigged('8S AH 8D 3C TC 9S KD', [{ main: 100 }], {
        rules: { enhcLoseAllOnDealerBJ: false },
      }).state,
      [NO_INSURANCE, SPLIT, DOUBLE, STAND],
    );
    const hands = r.state.seats[0]?.hands ?? [];
    expect(hands.map((h) => [h.result, h.payout])).toEqual([
      ['lose', 100],
      ['push', 100],
    ]);
    expect(r.state.balance).toBe(900);
  });
});

describe('assurance', () => {
  it('payée 2:1 si BJ croupier', () => {
    const r = play(dealRigged('TS AH 9D KC').state, [INSURE, STAND]);
    expect(r.state.seats[0]?.insurance).toMatchObject({
      decision: 'taken',
      amount: 50,
      payout: 150,
    });
    expect(hand(r.state).result).toBe('lose');
    expect(r.state.balance).toBe(1000);
    expect(r.events.find((e) => e.type === 'INSURANCE_RESULT')).toMatchObject({ won: true });
  });

  it('perdue sinon', () => {
    const r = play(dealRigged('TS AH 9D 7C').state, [INSURE, STAND]);
    expect(r.state.seats[0]?.insurance.payout).toBe(0);
    expect(hand(r.state).result).toBe('win');
    expect(r.state.balance).toBe(1050);
  });

  it('even money : BJ payé 1:1 immédiatement', () => {
    const d = dealRigged('AS AH KD 9C');
    expect(d.state.phase).toBe('INSURANCE');
    expect(getAvailableActions(d.state).insurance).toEqual({
      seat: 0,
      kind: 'evenMoney',
      cost: 0,
      canAfford: true,
    });
    const r = play(d.state, [INSURE]);
    expect(hand(r.state).result).toBe('evenMoney');
    expect(r.state.balance).toBe(1100);
    expect(r.state.dealer.cards).toHaveLength(1);
    expect(r.state.phase).toBe('ROUND_END');
  });

  it('even money refusé : BJ en attente, payé 3:2 ou push', () => {
    const win = play(dealRigged('AS AH KD 9C').state, [NO_INSURANCE]);
    expect(win.state.balance).toBe(1150);
    const push = play(dealRigged('AS AH KD KC').state, [NO_INSURANCE]);
    expect(push.state.balance).toBe(1000);
  });

  it('sans even money, un BJ se voit proposer l’assurance classique', () => {
    const d = dealRigged('AS AH KD KC', [{ main: 100 }], { rules: { evenMoney: false } });
    expect(getAvailableActions(d.state).insurance?.kind).toBe('insurance');
    const r = play(d.state, [INSURE]);
    // BJ vs BJ = push (100) + assurance 2:1 (150)
    expect(r.state.balance).toBe(1000 - 100 - 50 + 100 + 150);
  });

  it('refusée automatiquement si le solde est insuffisant', () => {
    const r = dealRigged('TS AH 9D 7C', [{ main: 100 }], { balance: 100 });
    expect(r.state.phase).toBe('PLAYER_TURNS');
    expect(r.events.find((e) => e.type === 'INSURANCE_DECISION')).toMatchObject({
      decision: 'declined',
      auto: true,
    });
  });

  it('demande place par place', () => {
    const d = dealRigged('TS 9S AH 9D 9C 7C', [
      { seat: 0, main: 100 },
      { seat: 1, main: 100 },
    ]);
    expect(d.state.insuranceSeat).toBe(0);
    const r1 = play(d.state, [INSURE]);
    expect(r1.state.insuranceSeat).toBe(1);
    expect(r1.state.phase).toBe('INSURANCE');
    const r2 = play(r1.state, [NO_INSURANCE]);
    expect(r2.state.phase).toBe('PLAYER_TURNS');
    expect(r2.state.seats.map((s) => s.insurance.decision)).toEqual(['taken', 'declined', 'none']);
  });

  it('pas de phase d’assurance si la règle est désactivée', () => {
    const r = dealRigged('TS AH 9D 7C', [{ main: 100 }], { rules: { insurance: false } });
    expect(r.state.phase).toBe('PLAYER_TURNS');
  });

  it('INSURANCE hors phase = erreur', () => {
    expectEngineError(() => applyAction(dealRigged('TS 9H 9D').state, INSURE), 'INVALID_PHASE');
  });

  it('assurance refusée si le solde ne suffit plus', () => {
    const d = dealRigged('TS AH 9D 7C', [{ main: 100 }], { balance: 150 });
    expect(d.state.phase).toBe('INSURANCE');
    const broke = { ...d.state, balance: 40 };
    expect(getAvailableActions(broke).insurance?.canAfford).toBe(false);
    expectEngineError(() => applyAction(broke, INSURE), 'INSUFFICIENT_FUNDS');
  });
});

describe('abandon', () => {
  it('disponible sur 2 cartes contre un 10, rend 50 %', () => {
    const d = dealRigged('TS TH 6D 9C');
    expect(getAvailableActions(d.state).surrender).toBe(true);
    const r = play(d.state, [{ type: 'SURRENDER' }]);
    expect(hand(r.state).result).toBe('surrender');
    expect(r.state.balance).toBe(950);
    expect(r.state.dealer.cards).toHaveLength(1);
  });

  it('indisponible contre un As', () => {
    const d = play(dealRigged('TS AH 6D 9C').state, [NO_INSURANCE]);
    expect(getAvailableActions(d.state).surrender).toBe(false);
    expectEngineError(() => applyAction(d.state, { type: 'SURRENDER' }), 'INVALID_ACTION');
  });

  it('autorisé contre un As si la règle le permet', () => {
    const d = play(
      dealRigged('TS AH 6D 9C', [{ main: 100 }], { rules: { surrenderVsAce: true } }).state,
      [NO_INSURANCE],
    );
    expect(getAvailableActions(d.state).surrender).toBe(true);
  });

  it('indisponible après split et après un tirage', () => {
    const s = play(dealRigged('8S 9H 8D 2C 3C').state, [SPLIT]);
    expect(getAvailableActions(s.state).surrender).toBe(false);
    const h = play(dealRigged('2S 9H 3D 4C').state, [HIT]);
    expect(getAvailableActions(h.state).surrender).toBe(false);
  });

  it('autorisé après split si la règle le permet', () => {
    const s = play(
      dealRigged('8S 9H 8D 2C 3C', [{ main: 100 }], { rules: { surrenderAfterSplit: true } }).state,
      [SPLIT],
    );
    expect(getAvailableActions(s.state).surrender).toBe(true);
  });
});

describe('split', () => {
  it('re-split jusqu’à 4 mains', () => {
    const d = dealRigged('8S 6H 8D 8C 8H 8C 2S 3S 4S TS TC');
    let s = play(d.state, [SPLIT, SPLIT, SPLIT]).state;
    expect(s.seats[0]?.hands).toHaveLength(4);
    expect(getAvailableActions(s).split).toBe(false);
    s = play(s, [STAND, STAND, STAND, STAND]).state;
    expect(s.phase).toBe('ROUND_END');
    expect(s.seats[0]?.hands.map((h) => h.result)).toEqual(['win', 'win', 'win', 'win']);
    expect(s.balance).toBe(1400);
  });

  it('les mains splittées se jouent de gauche à droite', () => {
    const d = dealRigged('8S 6H 8D 2C 3D TS TC');
    const r = play(d.state, [SPLIT]);
    expect(r.state.turn).toEqual({ seat: 0, hand: 0 });
    expect(hand(r.state, 0, 0).cards.map((c) => c.rank)).toEqual(['8', '2']);
    expect(hand(r.state, 0, 1).cards.map((c) => c.rank)).toEqual(['8']);
    const r2 = play(r.state, [STAND]);
    expect(r2.state.turn).toEqual({ seat: 0, hand: 1 });
    expect(hand(r2.state, 0, 1).cards.map((c) => c.rank)).toEqual(['8', '3']);
  });

  it('pas de re-split des As', () => {
    const r = play(dealRigged('AS 9H AD AC 5D 8S').state, [SPLIT]);
    expect(r.state.phase).toBe('ROUND_END');
    expect(hand(r.state, 0, 0).cards.map((c) => c.rank)).toEqual(['A', 'A']);
    expect(hand(r.state, 0, 0).status).toBe('stood');
  });

  it('variante : re-split et tirage des As autorisés', () => {
    const d = dealRigged('AS 9H AD AC 5D 8S 9C 2D', [{ main: 100 }], {
      rules: { resplitAces: true, hitSplitAces: true },
    });
    const r = play(d.state, [SPLIT]);
    expect(r.state.phase).toBe('PLAYER_TURNS');
    expect(getAvailableActions(r.state).split).toBe(true);
    expect(getAvailableActions(r.state).hit).toBe(true);
    const r2 = play(r.state, [SPLIT]);
    expect(r2.state.seats[0]?.hands).toHaveLength(3);
  });

  it('variante : As splittés re-splittables mais sans tirage', () => {
    const d = dealRigged('AS 9H AD AC 5D 8S 9C 2D', [{ main: 100 }], {
      rules: { resplitAces: true, hitSplitAces: false },
    });
    const r = play(d.state, [SPLIT]);
    const a = getAvailableActions(r.state);
    expect([a.split, a.hit, a.double, a.stand]).toEqual([true, false, false, true]);
  });

  it('double après split autorisé (DAS)', () => {
    const r = play(dealRigged('8S 6H 8D 3C 9D TS 7C').state, [SPLIT]);
    expect(getAvailableActions(r.state).double).toBe(true);
    const r2 = play(r.state, [DOUBLE]);
    expect(hand(r2.state, 0, 0).bet).toBe(200);
    expect(r2.state.turn).toEqual({ seat: 0, hand: 1 });
  });

  it('double après split interdit si la règle est désactivée', () => {
    const r = play(
      dealRigged('8S 6H 8D 3C', [{ main: 100 }], { rules: { doubleAfterSplit: false } }).state,
      [SPLIT],
    );
    expect(getAvailableActions(r.state).double).toBe(false);
  });

  it('split 10 + Roi autorisé (par valeur)', () => {
    const d = dealRigged('TS 6H KD 5C 4C');
    expect(getAvailableActions(d.state).split).toBe(true);
    const r = play(d.state, [SPLIT]);
    expect(r.state.seats[0]?.hands).toHaveLength(2);
  });

  it('split 10 + Roi interdit si splitByValue = false', () => {
    const d = dealRigged('TS 6H KD', [{ main: 100 }], { rules: { splitByValue: false } });
    expect(getAvailableActions(d.state).split).toBe(false);
    expectEngineError(() => applyAction(d.state, SPLIT), 'INVALID_ACTION');
  });

  it('21 atteint après split : la main se termine seule', () => {
    const r = play(dealRigged('TS 6H KD AC 5C TC').state, [SPLIT]);
    expect(hand(r.state, 0, 0).status).toBe('stood');
    expect(r.state.turn).toEqual({ seat: 0, hand: 1 });
  });
});

describe('doublement', () => {
  it('une seule carte puis la main est terminée', () => {
    const r = play(dealRigged('6S 9H 5D 8C 9S').state, [DOUBLE]);
    expect(hand(r.state).cards).toHaveLength(3);
    expect(hand(r.state).result).toBe('win');
    expect(r.state.balance).toBe(1200);
  });

  it('bust après doublement', () => {
    const r = play(dealRigged('TS 9H 5D 8C').state, [DOUBLE]);
    expect(hand(r.state).result).toBe('bust');
    expect(r.state.balance).toBe(800);
  });

  it('respecte doubleOn 9-11 et 10-11', () => {
    const nine = dealRigged('5S 6H 4D', [{ main: 100 }], { rules: { doubleOn: '9-11' } });
    expect(getAvailableActions(nine.state).double).toBe(true);
    const nineTen = dealRigged('5S 6H 4D', [{ main: 100 }], { rules: { doubleOn: '10-11' } });
    expect(getAvailableActions(nineTen.state).double).toBe(false);
    const ten = dealRigged('5S 6H 5D', [{ main: 100 }], { rules: { doubleOn: '10-11' } });
    expect(getAvailableActions(ten.state).double).toBe(true);
    const soft = dealRigged('AS 6H 8D', [{ main: 100 }], { rules: { doubleOn: '9-11' } });
    expect(getAvailableActions(soft.state).double).toBe(false);
    const twelve = dealRigged('7S 6H 5D', [{ main: 100 }], { rules: { doubleOn: '9-11' } });
    expect(getAvailableActions(twelve.state).double).toBe(false);
  });

  it('interdit après un tirage', () => {
    const r = play(dealRigged('2S 9H 3D 4C').state, [HIT]);
    expect(getAvailableActions(r.state).double).toBe(false);
  });
});

describe('solde insuffisant', () => {
  it('désactive doubler et séparer', () => {
    const d = dealRigged('8S 6H 8D', [{ main: 100 }], { balance: 150 });
    const a = getAvailableActions(d.state);
    expect(d.state.balance).toBe(50);
    expect(a.double).toBe(false);
    expect(a.split).toBe(false);
    expect(a.hit).toBe(true);
    expectEngineError(() => applyAction(d.state, DOUBLE), 'INVALID_ACTION');
    expectEngineError(() => applyAction(d.state, SPLIT), 'INVALID_ACTION');
  });
});

describe('side bets', () => {
  it('résolus juste après la distribution', () => {
    const r = dealRigged('QS 7D QS', [{ main: 100, pp: 10, tp: 20 }]);
    const sides = r.events.filter((e) => e.type === 'SIDE_BET_RESULT');
    expect(sides).toHaveLength(2);
    expect(sides[0]).toMatchObject({ bet: 'perfectPairs', outcome: 'perfectPair', payout: 260 });
    expect(sides[1]).toMatchObject({ bet: 'twentyOnePlus3', outcome: null, payout: 0 });
    expect(indexOfType(r.events, 'SIDE_BET_RESULT')).toBeLessThan(
      r.events.findIndex((e) => e.type === 'PHASE' && e.phase === 'PLAYER_TURNS'),
    );
    expect(r.state.balance).toBe(1000 - 130 + 260);
    expect(r.state.seats[0]?.spots).toEqual({
      main: 0,
      perfectPairs: 0,
      twentyOnePlus3: 0,
      insurance: 0,
    });
  });

  it('21+3 gagnant avec la carte du croupier', () => {
    const r = dealRigged('5S 7S 6S', [{ main: 100, tp: 10 }]);
    expect(r.state.seats[0]?.sideBets.twentyOnePlus3).toMatchObject({
      outcome: 'straightFlush',
      payout: 410,
    });
  });
});

describe('mises', () => {
  const base = () => rigged('TS 9H 8D 7C', { balance: 1000 });

  it('refuse les montants non multiples de 10', () => {
    expectEngineError(
      () => applyAction(base(), { type: 'PLACE_BET', seat: 0, spot: 'main', amount: 15 }),
      'INVALID_AMOUNT',
    );
    expectEngineError(
      () => applyAction(base(), { type: 'PLACE_BET', seat: 0, spot: 'main', amount: 0 }),
      'INVALID_AMOUNT',
    );
  });

  it('refuse au-delà du solde, du max de table, et les side bets orphelins', () => {
    const s = { ...base(), balance: 50 };
    expectEngineError(
      () => applyAction(s, { type: 'PLACE_BET', seat: 0, spot: 'main', amount: 60 }),
      'INSUFFICIENT_FUNDS',
    );
    const rich = { ...base(), balance: 5000 };
    expectEngineError(
      () => applyAction(rich, { type: 'PLACE_BET', seat: 0, spot: 'main', amount: 1010 }),
      'BET_LIMIT',
    );
    expectEngineError(
      () => applyAction(base(), { type: 'PLACE_BET', seat: 0, spot: 'perfectPairs', amount: 10 }),
      'NO_BET',
    );
    const withMain = play(base(), betActions([{ main: 100 }])).state;
    expect(betRoom(withMain, 0, 'perfectPairs')).toBe(100);
    expectEngineError(
      () =>
        applyAction(withMain, { type: 'PLACE_BET', seat: 0, spot: 'perfectPairs', amount: 110 }),
      'BET_LIMIT',
    );
    expectEngineError(
      () => applyAction(base(), { type: 'PLACE_BET', seat: 7, spot: 'main', amount: 10 }),
      'INVALID_ACTION',
    );
  });

  it('calcule la place disponible', () => {
    const s = base();
    expect(betRoom(s, 0, 'main')).toBe(1000);
    expect(betRoom(s, 0, 'twentyOnePlus3')).toBe(0);
    expect(betRoom({ ...s, balance: 95 }, 0, 'main')).toBe(90);
    expect(betRoom(s, 9, 'main')).toBe(0);
    const dealt = dealRigged('TS 9H 8D').state;
    expect(betRoom(dealt, 0, 'main')).toBe(0);
  });

  it('retirer la mise principale retire aussi les side bets', () => {
    const s = play(base(), betActions([{ main: 100, pp: 10, tp: 10 }])).state;
    expect(s.balance).toBe(880);
    const r = play(s, [{ type: 'REMOVE_BET', seat: 0, spot: 'main' }]);
    expect(r.state.balance).toBe(1000);
    expect(r.state.seats[0]?.bets).toEqual({ main: 0, perfectPairs: 0, twentyOnePlus3: 0 });
    expect(eventTypes(r.events)).toEqual(['CHIPS_TO_PLAYER', 'CHIPS_TO_PLAYER', 'CHIPS_TO_PLAYER']);
    expect(play(r.state, [{ type: 'REMOVE_BET', seat: 0, spot: 'main' }]).events).toEqual([]);
  });

  it('efface toutes les mises', () => {
    const s = play(
      base(),
      betActions([
        { seat: 0, main: 100 },
        { seat: 2, main: 50, tp: 10 },
      ]),
    ).state;
    expect(totalBets(s)).toBe(160);
    const r = play(s, [{ type: 'CLEAR_BETS' }]);
    expect(totalBets(r.state)).toBe(0);
    expect(r.state.balance).toBe(1000);
  });

  it('double les mises', () => {
    const s = play(base(), betActions([{ main: 100, pp: 10 }])).state;
    expect(getAvailableActions(s).doubleBets).toBe(true);
    const r = play(s, [{ type: 'DOUBLE_BETS' }]);
    expect(r.state.seats[0]?.bets).toEqual({ main: 200, perfectPairs: 20, twentyOnePlus3: 0 });
    const big = play(base(), betActions([{ main: 600 }])).state;
    expect(getAvailableActions(big).doubleBets).toBe(false);
    expectEngineError(() => applyAction(big, { type: 'DOUBLE_BETS' }), 'INVALID_ACTION');
  });

  it('re-mise après un tour (la table est débarrassée d’abord)', () => {
    const done = play(dealRigged('TS 9H 8D 7C 2S', [{ main: 100, pp: 10 }]).state, [STAND]);
    expect(done.state.phase).toBe('ROUND_END');
    expect(getAvailableActions(done.state).rebet).toBe(true);
    const r = play(done.state, [{ type: 'REBET' }]);
    expect(r.events[0]?.type).toBe('CLEAR_TABLE');
    expect(r.state.phase).toBe('BETTING');
    expect(r.state.seats[0]?.bets).toEqual({ main: 100, perfectPairs: 10, twentyOnePlus3: 0 });
  });

  it('re-mise impossible sans historique ou sans fonds', () => {
    expect(getAvailableActions(base()).rebet).toBe(false);
    expectEngineError(() => applyAction(base(), { type: 'REBET' }), 'INVALID_ACTION');
    const done = play(dealRigged('TS 9H 7D TC', [{ main: 100 }], { balance: 100 }).state, [STAND]);
    expect(done.state.balance).toBe(0);
    expect(getAvailableActions(done.state).rebet).toBe(false);
    const otherTable: GameState = { ...done.state, table: { id: 'x', min: 200, max: 1000 } };
    expect(getAvailableActions({ ...otherTable, balance: 5000 }).rebet).toBe(false);
  });

  it('une mise posée en fin de tour débarrasse la table', () => {
    const done = play(dealRigged('TS 9H 8D 7C 2S').state, [STAND]);
    const r = play(done.state, [{ type: 'PLACE_BET', seat: 1, spot: 'main', amount: 10 }]);
    expect(eventTypes(r.events)).toEqual(['CLEAR_TABLE', 'PHASE', 'PLACE_CHIPS']);
    expect(r.state.dealer.cards).toHaveLength(0);
  });

  it('distribution impossible sans mise ou sous le minimum', () => {
    expectEngineError(() => applyAction(base(), { type: 'DEAL' }), 'NO_BET');
    const table = { id: 't', min: 50, max: 1000 };
    const s = play(rigged('TS 9H 8D', { table }), betActions([{ main: 20 }])).state;
    const a = getAvailableActions(s);
    expect(a.deal).toBe(false);
    expect(a.dealBlockers).toEqual(['Place 1 : mise minimale 50']);
    expectEngineError(() => applyAction(s, { type: 'DEAL' }), 'BET_LIMIT');
    expect(getAvailableActions(base()).dealBlockers).toEqual(['Placez une mise principale']);
  });

  it('les mises sont fermées pendant le tour', () => {
    const d = dealRigged('TS 9H 8D');
    expectEngineError(
      () => applyAction(d.state, { type: 'PLACE_BET', seat: 0, spot: 'main', amount: 10 }),
      'INVALID_PHASE',
    );
    expectEngineError(() => applyAction(d.state, { type: 'DEAL' }), 'INVALID_PHASE');
  });

  it('détecte une mise corrompue (invariant multiple de 10)', () => {
    const s = play(base(), betActions([{ main: 100 }])).state;
    const corrupted: GameState = {
      ...s,
      seats: s.seats.map((seat, i) =>
        i === 0 ? { ...seat, bets: { ...seat.bets, main: 105 } } : seat,
      ),
    };
    expectEngineError(() => applyAction(corrupted, { type: 'DEAL' }), 'INVARIANT');
  });
});

describe('actions hors tour', () => {
  it('refuse les actions joueur hors de son tour', () => {
    const s = rigged('TS 9H 8D');
    for (const a of [HIT, STAND, DOUBLE, SPLIT, { type: 'SURRENDER' } as const]) {
      expectEngineError(() => applyAction(s, a), 'INVALID_PHASE');
    }
    expectEngineError(() => applyAction(s, { type: 'NEW_ROUND' }), 'INVALID_PHASE');
  });

  it('refuse de tirer sur des As splittés', () => {
    const d = dealRigged('AS 9H AD AC 5D 8S 9C 2D', [{ main: 100 }], {
      rules: { resplitAces: true },
    });
    const r = play(d.state, [SPLIT]);
    expectEngineError(() => applyAction(r.state, HIT), 'INVALID_ACTION');
  });
});

describe('table et crédits', () => {
  it('change de table : mises rendues, nouveau sabot, re-mise effacée', () => {
    const s = play(rigged('TS 9H 8D'), betActions([{ main: 100 }])).state;
    const table = { id: 'onyx', min: 50, max: 5000 };
    const r = play(s, [{ type: 'SET_TABLE', table }]);
    expect(r.state.table).toEqual(table);
    expect(r.state.balance).toBe(1000);
    expect(r.state.shoe.cards).toHaveLength(312);
    expect(r.state.lastBets).toBeNull();
    expect(eventTypes(r.events)).toEqual([
      'CHIPS_TO_PLAYER',
      'TABLE_CHANGED',
      'PHASE',
      'SHUFFLE',
      'BURN_CARD',
      'PHASE',
    ]);
  });

  it('change de table depuis la fin de tour, jamais pendant', () => {
    const done = play(dealRigged('TS 9H 8D 7C').state, [STAND]);
    const r = play(done.state, [{ type: 'SET_TABLE', table: { id: 'n', min: 10, max: 1000 } }]);
    expect(r.events[0]?.type).toBe('CLEAR_TABLE');
    expect(r.state.phase).toBe('BETTING');
    const d = dealRigged('TS 9H 8D');
    expectEngineError(
      () => applyAction(d.state, { type: 'SET_TABLE', table: { id: 'n', min: 10, max: 1000 } }),
      'INVALID_PHASE',
    );
    expectEngineError(
      () => applyAction(rigged('TS'), { type: 'SET_TABLE', table: { id: 'n', min: 15, max: 10 } }),
      'INVALID_AMOUNT',
    );
  });

  it('crédite le solde', () => {
    const r = play(rigged('TS'), [{ type: 'CREDIT', amount: 5000, reason: 'recharge' }]);
    expect(r.state.balance).toBe(6000);
    expect(r.events).toEqual([
      { type: 'BALANCE_CREDITED', amount: 5000, balance: 6000, reason: 'recharge' },
    ]);
    expectEngineError(
      () => applyAction(rigged('TS'), { type: 'CREDIT', amount: -5, reason: 'recharge' }),
      'INVALID_AMOUNT',
    );
  });
});

describe('pureté et sérialisation', () => {
  it('ne modifie jamais l’état reçu', () => {
    let s = deepFreeze(rigged('8S 6H 8D 3C 9D TS 7C 5S 4S'));
    for (const action of [
      ...betActions([{ main: 100, pp: 10, tp: 10 }]),
      { type: 'DEAL' } as const,
      SPLIT,
      DOUBLE,
      STAND,
      { type: 'NEW_ROUND' } as const,
    ]) {
      s = deepFreeze(applyAction(s, action).state);
    }
    expect(s.phase).toBe('BETTING');
  });

  it('JSON.parse(JSON.stringify(state)) reprend la partie à l’identique', () => {
    const d = dealRigged('8S 6H 8D 3C 9D TS 7C 5S 4S', [{ main: 100, pp: 10 }]);
    const restored = JSON.parse(JSON.stringify(d.state)) as GameState;
    expect(restored).toEqual(d.state);
    const rest: PlayerAction[] = [SPLIT, DOUBLE, STAND, { type: 'NEW_ROUND' }];
    const a = play(d.state, rest);
    const b = play(restored, rest);
    expect(b.state).toEqual(a.state);
    expect(b.events).toEqual(a.events);
  });
});

describe('getAvailableActions', () => {
  it('en phase de mise', () => {
    const a = getAvailableActions(rigged('TS'));
    expect(a).toMatchObject({
      phase: 'BETTING',
      placeBet: true,
      clearBets: false,
      deal: false,
      newRound: false,
      changeTable: true,
      hit: false,
    });
  });

  it('pendant le tour du joueur', () => {
    const a = getAvailableActions(dealRigged('8S 6H 8D').state);
    expect(a).toMatchObject({
      phase: 'PLAYER_TURNS',
      placeBet: false,
      hit: true,
      stand: true,
      double: true,
      split: true,
      surrender: true,
      changeTable: false,
    });
  });

  it('en fin de tour', () => {
    const done = play(dealRigged('TS 9H 8D 7C').state, [STAND]);
    expect(getAvailableActions(done.state)).toMatchObject({
      phase: 'ROUND_END',
      newRound: true,
      placeBet: true,
      deal: false,
    });
  });
});

describe('résumé du tour', () => {
  it('contient mises, cartes, actions et nets', () => {
    const r = play(dealRigged('8S 6H 8D 3C 9D TS 7C KS', [{ main: 100, pp: 10 }]).state, [
      SPLIT,
      DOUBLE,
      STAND,
    ]);
    const end = r.events.find((e) => e.type === 'ROUND_END');
    if (end?.type !== 'ROUND_END') throw new Error('ROUND_END attendu');
    const { summary } = end;
    expect(summary.seats).toHaveLength(1);
    expect(summary.seats[0]?.hands.map((h) => h.actions)).toEqual([['split', 'double'], ['stand']]);
    expect(summary.totals.wagered).toBe(310);
    expect(summary.totals.mainWagered).toBe(300);
    expect(summary.totals.net).toBe(summary.balanceAfter - summary.balanceBefore);
    expect(summary.dealerCards.map((c) => c.rank)).toEqual(['6', '7', 'K']);
    expect(summary.dealerTotal).toBe(23);
    expect(summary.dealerBust).toBe(true);
    expect(summary.totals.splitHandWins).toBe(2);
    expect(summary.totals.sideBetWins).toBe(1);
  });
});

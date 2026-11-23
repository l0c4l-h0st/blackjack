import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../../src/config/rules';
import { parseCards } from '../../src/engine/cards';
import { applyAction, createGame } from '../../src/engine/round';
import { SeededRng } from '../../src/engine/rng';
import {
  cardsRemaining,
  createEmergencyShoe,
  createShoe,
  createStackedShoe,
  drawCutIndex,
} from '../../src/engine/shoe';
import { TEST_TABLE, eventTypes, play, rigged } from './helpers';

describe('sabot', () => {
  it('contient 312 cartes, 6 exemplaires de chaque carte', () => {
    const shoe = createShoe(DEFAULT_RULES, new SeededRng(1), 1);
    expect(shoe.cards).toHaveLength(312);
    expect(new Set(shoe.cards.map((c) => c.id)).size).toBe(312);
    const byType = new Map<string, number>();
    for (const c of shoe.cards) byType.set(c.rank + c.suit, (byType.get(c.rank + c.suit) ?? 0) + 1);
    expect(byType.size).toBe(52);
    for (const n of byType.values()) expect(n).toBe(6);
  });

  it('brûle une carte après le mélange', () => {
    const shoe = createShoe(DEFAULT_RULES, new SeededRng(1), 1);
    expect(shoe.position).toBe(1);
    expect(shoe.burned).toBe(1);
    expect(shoe.discard).toBe(1);
    expect(cardsRemaining(shoe)).toBe(311);
  });

  it('place la carte de coupe entre 70 % et 80 %', () => {
    const rng = new SeededRng(5);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 5000; i++) {
      const cut = createShoe(DEFAULT_RULES, rng, i).cutIndex;
      expect(cut / 312).toBeGreaterThanOrEqual(0.7);
      expect(cut / 312).toBeLessThanOrEqual(0.8);
      min = Math.min(min, cut);
      max = Math.max(max, cut);
    }
    expect(min).toBe(219);
    expect(max).toBe(249);
  });

  it('gère une pénétration dégénérée', () => {
    expect(drawCutIndex(100, { penetrationMin: 0.5, penetrationMax: 0.5 }, new SeededRng(1))).toBe(
      50,
    );
  });

  it('sabot de secours sans les cartes de la table', () => {
    const shoe = createEmergencyShoe(1, new Set([0, 1, 2]), new SeededRng(1), 9);
    expect(shoe.cards).toHaveLength(49);
    expect(shoe.cards.some((c) => c.id <= 2)).toBe(false);
    expect(shoe.shoeId).toBe(9);
  });
});

describe('carte de coupe et re-mélange', () => {
  it('termine le tour puis re-mélange avant le suivant', () => {
    // Coupe après 2 cartes : la 3e carte (croupier) fait sortir la coupe.
    const cards = parseCards('10S 9H 7D 8C 10H');
    const state = createGame({
      rules: DEFAULT_RULES,
      table: TEST_TABLE,
      balance: 1000,
      shoe: createStackedShoe(cards, { cutIndex: 2 }),
    });
    const r = play(state, [
      { type: 'PLACE_BET', seat: 0, spot: 'main', amount: 10 },
      { type: 'DEAL' },
    ]);
    expect(eventTypes(r.events)).toContain('CUT_CARD_REACHED');
    expect(r.state.cutCardReached).toBe(true);
    const done = play(r.state, [{ type: 'STAND' }]);
    expect(done.state.phase).toBe('ROUND_END');
    // Pas de mélange tant que le tour n'est pas débarrassé.
    expect(eventTypes(done.events)).not.toContain('SHUFFLE');
    const next = play(done.state, [{ type: 'NEW_ROUND' }]);
    const types = eventTypes(next.events);
    expect(types).toEqual(['CLEAR_TABLE', 'PHASE', 'SHUFFLE', 'BURN_CARD', 'PHASE']);
    expect(next.state.shoe.cards).toHaveLength(312);
    expect(next.state.shoe.shoeId).toBe(2);
    expect(next.state.cutCardReached).toBe(false);
    expect(next.state.shoe.position).toBe(1);
  });

  it('mélange de secours si le sabot est vide en plein tour', () => {
    const state = rigged('10S 9H 7D');
    const r = play(state, [
      { type: 'PLACE_BET', seat: 0, spot: 'main', amount: 10 },
      { type: 'DEAL' },
      { type: 'STAND' },
    ]);
    // 3 cartes truquées seulement : la 4e (croupier) provoque un sabot de secours.
    const shuffle = r.events.find((e) => e.type === 'SHUFFLE');
    expect(shuffle).toMatchObject({ type: 'SHUFFLE', reason: 'emergency' });
    expect(r.state.cutCardReached).toBe(true);
    expect(r.state.phase).toBe('ROUND_END');
    expect(r.state.dealer.cards.length).toBeGreaterThanOrEqual(2);
    const next = play(r.state, [{ type: 'NEW_ROUND' }]);
    expect(next.events.find((e) => e.type === 'SHUFFLE')).toMatchObject({ reason: 'cut' });
    expect(next.state.shoe.cards).toHaveLength(312);
  });

  it('défausse : cartes de la table + carte brûlée', () => {
    const state = createGame({
      rules: DEFAULT_RULES,
      table: TEST_TABLE,
      balance: 1000,
      rng: new SeededRng(3),
    });
    const r = play(state, [
      { type: 'PLACE_BET', seat: 0, spot: 'main', amount: 10 },
      { type: 'DEAL' },
    ]);
    let s = r.state;
    while (s.phase === 'PLAYER_TURNS' || s.phase === 'INSURANCE') {
      s = applyAction(
        s,
        s.phase === 'INSURANCE' ? { type: 'INSURANCE', take: false } : { type: 'STAND' },
      ).state;
    }
    const onTable =
      s.dealer.cards.length +
      s.seats.reduce((t, seat) => t + seat.hands.reduce((u, h) => u + h.cards.length, 0), 0);
    const cleared = applyAction(s, { type: 'NEW_ROUND' }).state;
    expect(cleared.shoe.discard).toBe(1 + onTable);
    expect(cleared.shoe.discard).toBe(cleared.shoe.position);
  });
});

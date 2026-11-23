import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DirectorEvent } from '../../src/fx/animationDirector';
import { AnimationDirector, eventTiming } from '../../src/fx/animationDirector';

function setup(factor = 1) {
  const applied: string[] = [];
  const effects: string[] = [];
  const playing: boolean[] = [];
  const director = new AnimationDirector({
    applyEvent: (e) => applied.push(e.type),
    runEffects: (e) => effects.push(e.type),
    speedFactor: () => factor,
    setPlaying: (p) => playing.push(p),
  });
  return { director, applied, effects, playing };
}

const bet: DirectorEvent = {
  type: 'PLACE_CHIPS',
  spot: { kind: 'seat', seat: 0, spot: 'main' },
  amount: 10,
  balance: 990,
  reason: 'bet',
};
const phase: DirectorEvent = { type: 'PHASE', phase: 'DEALING' };
const roundEnd: DirectorEvent = { type: 'CLEAR_TABLE', discard: 4 };
const fromDealer: DirectorEvent = {
  type: 'CHIPS_FROM_DEALER',
  spot: { kind: 'hand', seat: 0, hand: 0 },
  amount: 10,
};

describe('animation director', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('joue les événements dans l’ordre avec leur durée', async () => {
    const { director, applied, playing } = setup();
    director.enqueue([roundEnd, phase]);
    expect(applied).toEqual(['CLEAR_TABLE']);
    expect(playing).toEqual([true]);
    await vi.advanceTimersByTimeAsync(eventTiming(roundEnd).duration);
    expect(applied).toEqual(['CLEAR_TABLE', 'PHASE']);
    expect(playing).toEqual([true, false]);
    expect(director.isRunning).toBe(false);
  });

  it('applique certains événements à la fin (jetons qui atterrissent)', async () => {
    const { director, applied } = setup();
    director.enqueue([fromDealer]);
    expect(applied).toEqual([]);
    await vi.advanceTimersByTimeAsync(eventTiming(fromDealer).duration);
    expect(applied).toEqual(['CHIPS_FROM_DEALER']);
  });

  it('les jetons de mise ne bloquent pas, un événement bloquant attend leur atterrissage', async () => {
    const { director, applied, playing } = setup();
    director.enqueue([bet, bet]);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([]);
    expect(playing).toEqual([]);
    director.enqueue([roundEnd]);
    await vi.advanceTimersByTimeAsync(10);
    expect(applied).toEqual([]);
    await vi.advanceTimersByTimeAsync(300);
    expect(applied).toEqual(['PLACE_CHIPS', 'PLACE_CHIPS', 'CLEAR_TABLE']);
  });

  it('skip accélère tout le reste de la file sans effets', async () => {
    const { director, applied, effects } = setup();
    director.enqueue([roundEnd, fromDealer, phase]);
    expect(applied).toEqual(['CLEAR_TABLE']);
    director.skip();
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual(['CLEAR_TABLE', 'CHIPS_FROM_DEALER', 'PHASE']);
    expect(effects).toEqual(['CLEAR_TABLE']);
    // une nouvelle file repart à vitesse normale
    director.enqueue([roundEnd, phase]);
    expect(applied.at(-1)).toBe('CLEAR_TABLE');
    await vi.advanceTimersByTimeAsync(600);
    expect(applied.at(-1)).toBe('PHASE');
  });

  it('skip hors lecture pose immédiatement les jetons en vol', async () => {
    const { director, applied } = setup();
    director.enqueue([bet]);
    await vi.advanceTimersByTimeAsync(0);
    director.skip();
    expect(applied).toEqual(['PLACE_CHIPS']);
  });

  it('vitesse instantanée : tout est appliqué sans attendre', async () => {
    const { director, applied } = setup(0);
    director.enqueue([bet, roundEnd, fromDealer, phase]);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual(['PLACE_CHIPS', 'CLEAR_TABLE', 'CHIPS_FROM_DEALER', 'PHASE']);
  });

  it('ignore une file vide', () => {
    const { director, playing } = setup();
    director.enqueue([]);
    expect(playing).toEqual([]);
  });

  it('chaque type d’événement a une durée', () => {
    const samples: DirectorEvent[] = [
      { type: 'XP_GAINED', amount: 5, level: 1, xp: 5 },
      { type: 'LEVEL_UP', level: 2, bonus: 2000 },
      { type: 'SHUFFLE', shoeId: 2, size: 312, cutIndex: 230, reason: 'cut' },
      {
        type: 'FLIP_CARD',
        target: { kind: 'dealer' },
        index: 1,
        card: { id: 1, rank: 'A', suit: 'S' },
        slow: true,
      },
    ];
    for (const e of samples) expect(eventTiming(e).duration).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { SeededRng } from '../../src/engine/rng';
import { expectedTrueCount, newExercise } from '../../src/stats/drills';

describe('exercice true count', () => {
  it('génère des défausses de 0,5 à 5 jeux', () => {
    const rng = new SeededRng(3);
    for (let i = 0; i < 500; i++) {
      const ex = newExercise(rng);
      expect(ex.discard).toBeGreaterThanOrEqual(26);
      expect(ex.discard).toBeLessThanOrEqual(260);
      expect(Number.isInteger(ex.rc)).toBe(true);
    }
  });

  it('TC = RC ÷ jeux restants au demi-jeu près', () => {
    expect(expectedTrueCount({ rc: 6, discard: 156 })).toBe(2);
    expect(expectedTrueCount({ rc: -5, discard: 182 })).toBe(-2);
    expect(expectedTrueCount({ rc: 7, discard: 104 })).toBe(1.8);
  });
});

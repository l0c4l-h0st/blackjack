/** Exercices de comptage (logique pure). */
import { decksRemaining } from '../engine/count/hiLo';
import type { Rng } from '../engine/rng';
import { getDefaultRng, randomInt } from '../engine/rng';

export const SHOE_SIZE = 312;

export interface TcExercise {
  rc: number;
  discard: number;
}

export function newExercise(rng: Rng = getDefaultRng()): TcExercise {
  const discard = 26 + randomInt(rng, 235); // de 0,5 à 5 jeux défaussés
  const decksLeft = (SHOE_SIZE - discard) / 52;
  const spread = Math.max(4, Math.round(12 / Math.max(1, decksLeft)) * 2);
  return { rc: randomInt(rng, 2 * spread + 1) - spread, discard };
}

export function expectedTrueCount(ex: TcExercise): number {
  return Math.round((ex.rc / decksRemaining(SHOE_SIZE - ex.discard)) * 10) / 10;
}

import type { RoundSummary } from '../engine/types';

export const STARTING_BALANCE = 10_000;
export const MAX_LEVEL = 50;

export const RECHARGE_THRESHOLD = 500;
export const RECHARGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const RECHARGE_BASE = 5_000;
export const RECHARGE_PER_LEVEL = 1_000;
export const RECHARGE_CAP = 50_000;

export const XP_BONUS = {
  blackjack: 20,
  sideBetWin: 15,
  splitHandWin: 5,
  quizCorrect: 10,
} as const;

/** XP nécessaire pour passer du niveau `level` au suivant : round(250 × niveau^1,6). */
export function xpToNext(level: number): number {
  return Math.round(250 * level ** 1.6);
}

/** XP gagnée sur un tour : floor(total misé / 10) + bonus. */
export function xpForRound(summary: Pick<RoundSummary, 'totals'>): number {
  const t = summary.totals;
  return (
    Math.floor(t.wagered / 10) +
    XP_BONUS.blackjack * t.blackjacks +
    XP_BONUS.sideBetWin * t.sideBetWins +
    XP_BONUS.splitHandWin * t.splitHandWins
  );
}

export interface LevelState {
  level: number;
  /** XP accumulée dans le niveau courant. */
  xp: number;
}

export interface XpGain {
  next: LevelState;
  /** Niveaux atteints (dans l'ordre) pendant ce gain. */
  levelsGained: number[];
  /** Bonus de crédits total (1 000 × chaque nouveau niveau). */
  bonus: number;
}

export function levelUpBonus(newLevel: number): number {
  return 1_000 * newLevel;
}

export function applyXp(state: LevelState, gained: number): XpGain {
  let { level, xp } = state;
  xp += Math.max(0, Math.floor(gained));
  const levelsGained: number[] = [];
  let bonus = 0;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    levelsGained.push(level);
    bonus += levelUpBonus(level);
  }
  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    xp = Math.min(xp, xpToNext(MAX_LEVEL));
  }
  return { next: { level, xp }, levelsGained, bonus };
}

/** Montant de la recharge quotidienne : 5 000 + 1 000 × (niveau − 1), plafonné à 50 000. */
export function rechargeAmount(level: number): number {
  const raw = Math.min(RECHARGE_BASE + RECHARGE_PER_LEVEL * (level - 1), RECHARGE_CAP);
  return Math.round(raw / 10) * 10;
}

export interface RechargeStatus {
  available: boolean;
  /** Raison d'indisponibilité. */
  reason: 'balance' | 'cooldown' | null;
  /** Millisecondes avant la prochaine recharge (0 si disponible ou bloquée par le solde). */
  remainingMs: number;
  amount: number;
}

export function rechargeStatus(
  balance: number,
  level: number,
  lastRechargeAt: number | null,
  now: number,
): RechargeStatus {
  const amount = rechargeAmount(level);
  const elapsed = lastRechargeAt === null ? Infinity : now - lastRechargeAt;
  const remainingMs = elapsed >= RECHARGE_COOLDOWN_MS ? 0 : RECHARGE_COOLDOWN_MS - elapsed;
  if (remainingMs > 0) return { available: false, reason: 'cooldown', remainingMs, amount };
  if (balance >= RECHARGE_THRESHOLD)
    return { available: false, reason: 'balance', remainingMs: 0, amount };
  return { available: true, reason: null, remainingMs: 0, amount };
}

/** « 23 h 59 min » / « 4 min 12 s ». */
export function formatDuration(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return `${m} min ${String(s).padStart(2, '0')} s`;
  return `${s} s`;
}

/** Progression vers le niveau requis (0..1), XP du niveau courant incluse. */
export function unlockProgress(level: number, xp: number, required: number): number {
  if (level >= required) return 1;
  const partial = level >= MAX_LEVEL ? 0 : Math.min(1, xp / xpToNext(level));
  return Math.min(1, (level - 1 + partial) / Math.max(1, required - 1));
}

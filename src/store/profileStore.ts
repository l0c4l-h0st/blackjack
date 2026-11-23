import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { XpGain } from '../config/progression';
import { MAX_LEVEL, applyXp } from '../config/progression';
import { blobStorage } from './persistence';

export interface Profile {
  level: number;
  /** XP dans le niveau courant. */
  xp: number;
  /** XP cumulée depuis le début. */
  totalXp: number;
  lastRechargeAt: number | null;
  createdAt: number;
  roundsPlayed: number;
  /** Tours joués depuis le dernier quiz Hi-Lo. */
  roundsSinceQuiz: number;
}

export function defaultProfile(now = Date.now()): Profile {
  return {
    level: 1,
    xp: 0,
    totalXp: 0,
    lastRechargeAt: null,
    createdAt: now,
    roundsPlayed: 0,
    roundsSinceQuiz: 0,
  };
}

interface ProfileStore extends Profile {
  addXp: (amount: number) => XpGain;
  markRecharge: (now: number) => void;
  countRound: () => number;
  resetQuizCounter: () => void;
  reset: () => void;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.floor(value)))
    : fallback;
}

export function sanitizeProfile(
  raw: Partial<Profile> | null | undefined,
  now = Date.now(),
): Profile {
  const base = defaultProfile(now);
  if (!raw) return base;
  return {
    level: clampInt(raw.level, 1, MAX_LEVEL, 1),
    xp: clampInt(raw.xp, 0, Number.MAX_SAFE_INTEGER, 0),
    totalXp: clampInt(raw.totalXp, 0, Number.MAX_SAFE_INTEGER, 0),
    lastRechargeAt:
      typeof raw.lastRechargeAt === 'number' && Number.isFinite(raw.lastRechargeAt)
        ? raw.lastRechargeAt
        : null,
    createdAt: clampInt(raw.createdAt, 0, Number.MAX_SAFE_INTEGER, base.createdAt),
    roundsPlayed: clampInt(raw.roundsPlayed, 0, Number.MAX_SAFE_INTEGER, 0),
    roundsSinceQuiz: clampInt(raw.roundsSinceQuiz, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      ...defaultProfile(),
      addXp: (amount) => {
        const s = get();
        const gain = applyXp({ level: s.level, xp: s.xp }, amount);
        set({
          level: gain.next.level,
          xp: gain.next.xp,
          totalXp: s.totalXp + Math.max(0, Math.floor(amount)),
        });
        return gain;
      },
      markRecharge: (now) => set({ lastRechargeAt: now }),
      countRound: () => {
        const next = get().roundsSinceQuiz + 1;
        set({ roundsPlayed: get().roundsPlayed + 1, roundsSinceQuiz: next });
        return next;
      },
      resetQuizCounter: () => set({ roundsSinceQuiz: 0 }),
      reset: () => set(defaultProfile()),
    }),
    {
      name: 'profile',
      version: 1,
      storage: createJSONStorage(() => blobStorage),
      partialize: (s): Profile => ({
        level: s.level,
        xp: s.xp,
        totalXp: s.totalXp,
        lastRechargeAt: s.lastRechargeAt,
        createdAt: s.createdAt,
        roundsPlayed: s.roundsPlayed,
        roundsSinceQuiz: s.roundsSinceQuiz,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeProfile(persisted as Partial<Profile> | null),
      }),
    },
  ),
);

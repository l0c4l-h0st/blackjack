import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { blobStorage } from './persistence';

export type AnimationSpeed = 'x1' | 'x2' | 'x4' | 'instant';

// Déclaré avant la création du store : l'hydratation (synchrone) l'utilise.
const SPEEDS: AnimationSpeed[] = ['x1', 'x2', 'x4', 'instant'];

export const SPEED_FACTORS: Record<AnimationSpeed, number> = {
  x1: 1,
  x2: 0.5,
  x4: 0.25,
  instant: 0,
};

export interface Settings {
  speed: AnimationSpeed;
  volume: number;
  muted: boolean;
  ambience: boolean;
  fourColor: boolean;
  showHiLo: boolean;
  quizEnabled: boolean;
  quizEvery: number;
  autoRebet: boolean;
}

export function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function defaultSettings(): Settings {
  return {
    speed: prefersReducedMotion() ? 'instant' : 'x1',
    volume: 0.7,
    muted: false,
    ambience: false,
    fourColor: false,
    showHiLo: true,
    quizEnabled: false,
    quizEvery: 5,
    autoRebet: false,
  };
}

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings(),
      update: (patch) => set(sanitize(patch)),
      reset: () => set(defaultSettings()),
    }),
    {
      name: 'settings',
      version: 1,
      storage: createJSONStorage(() => blobStorage),
      partialize: (s): Settings => ({
        speed: s.speed,
        volume: s.volume,
        muted: s.muted,
        ambience: s.ambience,
        fourColor: s.fourColor,
        showHiLo: s.showHiLo,
        quizEnabled: s.quizEnabled,
        quizEvery: s.quizEvery,
        autoRebet: s.autoRebet,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...sanitize((persisted ?? {}) as Partial<Settings>),
      }),
    },
  ),
);

function sanitize(patch: Partial<Settings>): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (patch.speed !== undefined && SPEEDS.includes(patch.speed)) out.speed = patch.speed;
  if (typeof patch.volume === 'number') out.volume = Math.min(1, Math.max(0, patch.volume));
  if (typeof patch.muted === 'boolean') out.muted = patch.muted;
  if (typeof patch.ambience === 'boolean') out.ambience = patch.ambience;
  if (typeof patch.fourColor === 'boolean') out.fourColor = patch.fourColor;
  if (typeof patch.showHiLo === 'boolean') out.showHiLo = patch.showHiLo;
  if (typeof patch.quizEnabled === 'boolean') out.quizEnabled = patch.quizEnabled;
  if (typeof patch.quizEvery === 'number' && Number.isFinite(patch.quizEvery)) {
    out.quizEvery = Math.min(50, Math.max(1, Math.round(patch.quizEvery)));
  }
  if (typeof patch.autoRebet === 'boolean') out.autoRebet = patch.autoRebet;
  return out;
}

export function speedFactor(): number {
  return SPEED_FACTORS[useSettingsStore.getState().speed];
}

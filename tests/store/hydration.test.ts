import { describe, expect, it, vi } from 'vitest';

describe('hydratation des réglages et du profil', () => {
  it('relit la sauvegarde existante au démarrage', async () => {
    const data: Record<string, string> = {
      'nocturne21:v1': JSON.stringify({
        schemaVersion: 1,
        settings: { state: { speed: 'instant', fourColor: true, quizEvery: 99, volume: 3 }, version: 1 },
        profile: { state: { level: 7, xp: 120, lastRechargeAt: 42, roundsPlayed: -3 }, version: 1 },
      }),
    };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
      removeItem: (k: string) => {
        delete data[k];
      },
    });
    vi.resetModules();
    const { useSettingsStore } = await import('../../src/store/settingsStore');
    const { useProfileStore } = await import('../../src/store/profileStore');
    const settings = useSettingsStore.getState();
    expect(settings.speed).toBe('instant');
    expect(settings.fourColor).toBe(true);
    expect(settings.quizEvery).toBe(50);
    expect(settings.volume).toBe(1);
    const profile = useProfileStore.getState();
    expect(profile.level).toBe(7);
    expect(profile.xp).toBe(120);
    expect(profile.lastRechargeAt).toBe(42);
    expect(profile.roundsPlayed).toBe(0);
    vi.unstubAllGlobals();
    vi.resetModules();
  });
});

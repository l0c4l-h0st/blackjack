import { describe, expect, it } from 'vitest';
import {
  MAX_LEVEL,
  RECHARGE_COOLDOWN_MS,
  applyXp,
  formatDuration,
  levelUpBonus,
  rechargeAmount,
  rechargeStatus,
  unlockProgress,
  xpForRound,
  xpToNext,
} from '../../src/config/progression';
import {
  TABLES,
  getTable,
  isTableUnlocked,
  rgbChannels,
  tableLimits,
  withAlpha,
} from '../../src/config/tables';

const totals = (
  t: Partial<Record<'wagered' | 'blackjacks' | 'sideBetWins' | 'splitHandWins', number>>,
) => ({
  totals: {
    wagered: 0,
    returned: 0,
    net: 0,
    mainWagered: 0,
    blackjacks: 0,
    sideBetWins: 0,
    splitHandWins: 0,
    ...t,
  },
});

describe('courbe d’XP', () => {
  it('round(250 × niveau^1,6)', () => {
    expect(xpToNext(1)).toBe(250);
    expect(xpToNext(2)).toBe(Math.round(250 * 2 ** 1.6));
    expect(xpToNext(10)).toBe(9953);
    for (let l = 1; l < MAX_LEVEL; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('XP d’un tour : misé / 10 + bonus', () => {
    expect(xpForRound(totals({ wagered: 105 }))).toBe(10);
    expect(
      xpForRound(totals({ wagered: 100, blackjacks: 1, sideBetWins: 2, splitHandWins: 1 })),
    ).toBe(10 + 20 + 30 + 5);
  });

  it('monte de niveau et cumule les bonus', () => {
    const g = applyXp({ level: 1, xp: 200 }, 100);
    expect(g.next).toEqual({ level: 2, xp: 50 });
    expect(g.levelsGained).toEqual([2]);
    expect(g.bonus).toBe(2000);
    const big = applyXp({ level: 1, xp: 0 }, xpToNext(1) + xpToNext(2) + xpToNext(3));
    expect(big.next.level).toBe(4);
    expect(big.levelsGained).toEqual([2, 3, 4]);
    expect(big.bonus).toBe(levelUpBonus(2) + levelUpBonus(3) + levelUpBonus(4));
  });

  it('plafonne au niveau 50', () => {
    const g = applyXp({ level: 49, xp: 0 }, 10_000_000);
    expect(g.next.level).toBe(50);
    expect(g.next.xp).toBeLessThanOrEqual(xpToNext(50));
    expect(applyXp({ level: 50, xp: 0 }, 1000).levelsGained).toEqual([]);
    expect(applyXp({ level: 3, xp: 5 }, -10).next).toEqual({ level: 3, xp: 5 });
  });
});

describe('tables', () => {
  it('cinq tables avec niveaux requis croissants', () => {
    expect(TABLES.map((t) => [t.name, t.levelRequired, t.min, t.max])).toEqual([
      ['Néon', 1, 10, 1000],
      ['Onyx', 5, 50, 5000],
      ['Saphir', 10, 200, 20000],
      ['Obsidienne', 20, 1000, 100000],
      ['Diamant', 35, 5000, 500000],
    ]);
  });

  it('déverrouillage par niveau', () => {
    const onyx = getTable('onyx');
    expect(isTableUnlocked(onyx, 4)).toBe(false);
    expect(isTableUnlocked(onyx, 5)).toBe(true);
    expect(getTable('inconnue').id).toBe('neon');
    expect(tableLimits(onyx)).toEqual({ id: 'onyx', min: 50, max: 5000 });
  });

  it('progression vers une table', () => {
    expect(unlockProgress(5, 0, 5)).toBe(1);
    expect(unlockProgress(1, 0, 5)).toBe(0);
    expect(unlockProgress(3, 0, 5)).toBe(0.5);
    expect(unlockProgress(1, xpToNext(1) / 2, 5)).toBeCloseTo(0.125, 6);
  });

  it('couleurs', () => {
    expect(withAlpha('#7c5cff', 0.5)).toBe('rgba(124, 92, 255, 0.5)');
    expect(rgbChannels('#7c5cff')).toBe('124 92 255');
  });
});

describe('recharge quotidienne', () => {
  const now = 1_700_000_000_000;

  it('montant : 5 000 + 1 000 × (niveau − 1), plafonné à 50 000', () => {
    expect(rechargeAmount(1)).toBe(5000);
    expect(rechargeAmount(7)).toBe(11000);
    expect(rechargeAmount(46)).toBe(50000);
    expect(rechargeAmount(50)).toBe(50000);
  });

  it('disponible si solde < 500 et 24 h écoulées', () => {
    expect(rechargeStatus(499, 1, null, now)).toEqual({
      available: true,
      reason: null,
      remainingMs: 0,
      amount: 5000,
    });
    expect(rechargeStatus(500, 1, null, now).reason).toBe('balance');
    expect(rechargeStatus(100, 1, now - RECHARGE_COOLDOWN_MS + 1000, now)).toMatchObject({
      available: false,
      reason: 'cooldown',
      remainingMs: 1000,
    });
    expect(rechargeStatus(100, 3, now - RECHARGE_COOLDOWN_MS, now)).toMatchObject({
      available: true,
      amount: 7000,
    });
  });

  it('affiche le compte à rebours', () => {
    expect(formatDuration(3 * 3600_000 + 5 * 60_000)).toBe('3 h 05 min');
    expect(formatDuration(65_000)).toBe('1 min 05 s');
    expect(formatDuration(4_200)).toBe('5 s');
  });
});

describe('contraste des couleurs d’accent', () => {
  it('ratio WCAG', async () => {
    const { contrastRatio } = await import('../../src/config/tables');
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('variantes ≥ 4,5:1 pour toutes les tables', async () => {
    const { accentVariants, contrastRatio } = await import('../../src/config/tables');
    for (const t of TABLES) {
      const v = accentVariants(t.accent);
      expect(contrastRatio(v.light, '#1a2233')).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(v.light, '#0b0f17')).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(v.strong, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  });
});

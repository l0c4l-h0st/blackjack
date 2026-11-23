import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../../src/config/rules';
import { xpToNext } from '../../src/config/progression';
import { parseCards } from '../../src/engine/cards';
import { createStackedShoe } from '../../src/engine/shoe';
import type { GameState } from '../../src/engine/types';
import { projectView } from '../../src/engine/view';
import { freshEngine, isGameState, refreshConfig, useGameStore } from '../../src/store/gameStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useSettingsStore } from '../../src/store/settingsStore';

function rig(cards: string, patch: Partial<GameState> = {}): void {
  const engine: GameState = {
    ...freshEngine(),
    shoe: createStackedShoe(parseCards(cards)),
    ...patch,
  };
  useGameStore.setState({ engine, view: projectView(engine) });
}

const game = () => useGameStore.getState();

describe('gameStore', () => {
  beforeEach(() => {
    useSettingsStore.getState().update({ speed: 'instant', quizEnabled: false, autoRebet: false });
    useProfileStore.getState().reset();
    game().resetGame();
  });

  it('joue un tour complet et synchronise la vue', () => {
    rig('TS 9H 8D 7C 2S');
    expect(game().dispatch({ type: 'PLACE_BET', seat: 0, spot: 'main', amount: 100 })).toBe(true);
    game().dispatch({ type: 'DEAL' });
    game().dispatch({ type: 'STAND' });
    const s = game();
    expect(s.engine.phase).toBe('ROUND_END');
    expect(s.playing).toBe(false);
    expect(s.view).toEqual(projectView(s.engine));
    expect(useProfileStore.getState().xp).toBe(10);
    expect(useProfileStore.getState().roundsPlayed).toBe(1);
    expect(s.displayLevel).toEqual({ level: 1, xp: 10 });
  });

  it('montée de niveau : bonus crédité et modale', () => {
    useProfileStore.setState({ level: 1, xp: xpToNext(1) - 5 });
    rig('TS 9H 8D 7C 2S');
    game().dispatch({ type: 'PLACE_BET', seat: 0, spot: 'main', amount: 100 });
    game().dispatch({ type: 'DEAL' });
    game().dispatch({ type: 'STAND' });
    expect(useProfileStore.getState().level).toBe(2);
    expect(game().levelUp).toEqual({ level: 2, bonus: 2000 });
    expect(game().engine.balance).toBe(10_000 + 2000);
    expect(game().view.balance).toBe(game().engine.balance);
    game().dismissLevelUp();
    expect(game().levelUp).toBeNull();
  });

  it('quiz de comptage après N tours', () => {
    useSettingsStore.getState().update({ quizEnabled: true, quizEvery: 1 });
    rig('TS 9H 8D 7C 2S');
    game().dispatch({ type: 'PLACE_BET', seat: 0, spot: 'main', amount: 10 });
    game().dispatch({ type: 'DEAL' });
    game().dispatch({ type: 'STAND' });
    expect(game().quizDue).toBe(true);
    const expected = game().view.runningCount;
    const before = useProfileStore.getState().totalXp;
    expect(game().answerQuiz(expected, 1200)).toEqual({
      correct: true,
      expected,
      answer: expected,
    });
    expect(game().quizDue).toBe(false);
    expect(useProfileStore.getState().totalXp).toBe(before + 10);
    expect(useProfileStore.getState().roundsSinceQuiz).toBe(0);
    expect(game().answerQuiz(expected + 1, 500).correct).toBe(false);
    game().skipQuiz();
    expect(game().quizDue).toBe(false);
  });

  it('recharge quotidienne', () => {
    rig('TS', { balance: 100 });
    expect(game().claimRecharge(1_000)).toBe(true);
    expect(game().engine.balance).toBe(5100);
    expect(useProfileStore.getState().lastRechargeAt).toBe(1_000);
    expect(game().claimRecharge(2_000)).toBe(false);
  });

  it('tables verrouillées et changement de table', () => {
    expect(game().changeTable('onyx')).toBe(false);
    expect(game().notice?.text).toContain('niveau 5 requis');
    useProfileStore.setState({ level: 5 });
    expect(game().changeTable('onyx')).toBe(true);
    expect(game().engine.table.id).toBe('onyx');
    expect(game().changeTable('onyx')).toBe(true);
  });

  it('refuse un changement de table pendant un tour', () => {
    useProfileStore.setState({ level: 5 });
    rig('TS 9H 8D 7C 2S');
    game().dispatch({ type: 'PLACE_BET', seat: 0, spot: 'main', amount: 10 });
    game().dispatch({ type: 'DEAL' });
    expect(game().changeTable('onyx')).toBe(false);
    expect(game().notice?.tone).toBe('error');
  });

  it('action invalide : message et état inchangé', () => {
    const before = game().engine;
    expect(game().dispatch({ type: 'HIT' })).toBe(false);
    expect(game().notice?.tone).toBe('error');
    expect(game().engine).toBe(before);
    game().clearNotice();
    expect(game().notice).toBeNull();
  });

  it('sélection du jeton, place et mode d’affichage', () => {
    game().selectChip(500);
    game().setFocusSeat(9);
    game().setLayoutMode('mobile');
    expect(game().selectedChip).toBe(500);
    expect(game().focusSeat).toBe(2);
    expect(game().layoutMode).toBe('mobile');
    game().skip();
  });

  it('valide et rafraîchit un état persisté', () => {
    expect(isGameState(null)).toBe(false);
    expect(isGameState({ schema: 1 })).toBe(false);
    const fresh = freshEngine();
    expect(isGameState(JSON.parse(JSON.stringify(fresh)))).toBe(true);
    const old = {
      ...fresh,
      rules: { ...DEFAULT_RULES, decks: 2 },
      table: { id: 'disparue', min: 1, max: 2 },
    };
    const refreshed = refreshConfig(old);
    expect(refreshed.rules).toEqual(DEFAULT_RULES);
    expect(refreshed.table.id).toBe('neon');
    const midRound = { ...old, phase: 'PLAYER_TURNS' as const };
    expect(refreshConfig(midRound)).toBe(midRound);
  });
});

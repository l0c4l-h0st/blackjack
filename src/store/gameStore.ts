/**
 * Store principal : état moteur (vérité, persisté après chaque action), vue affichée
 * (mise à jour par l'animation director) et orchestration fin de tour (XP, historique, quiz).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_RULES } from '../config/rules';
import { RACK_CHIPS } from '../config/chips';
import {
  STARTING_BALANCE,
  XP_BONUS,
  levelUpBonus,
  rechargeStatus,
  xpForRound,
} from '../config/progression';
import {
  DEFAULT_TABLE_ID,
  TABLES,
  getTable,
  isTableUnlocked,
  rgbChannels,
  tableLimits,
  withAlpha,
} from '../config/tables';
import type { GameEvent } from '../engine/events';
import {
  EngineError,
  applyAction,
  createGame,
  getAvailableActions,
  totalBets,
} from '../engine/round';
import type { GameState, PlayerAction, RestingPhase, RoundSummary } from '../engine/types';
import type { TableView } from '../engine/view';
import { projectView, reduceView } from '../engine/view';
import type { DirectorEvent } from '../fx/animationDirector';
import { AnimationDirector } from '../fx/animationDirector';
import { runEffects } from '../fx/effects';
import type { LayoutMode } from '../fx/layout';
import { blobStorage } from './persistence';
import { useProfileStore } from './profileStore';
import { prefersReducedMotion, speedFactor, useSettingsStore } from './settingsStore';

export interface Notice {
  id: number;
  text: string;
  tone: 'info' | 'error' | 'win' | 'loss';
}

export interface QuizResult {
  correct: boolean;
  expected: number;
  answer: number;
}

interface GameStoreState {
  engine: GameState;
  view: TableView;
  playing: boolean;
  /** Facteur de vitesse effectif des animations (0 = instantané / accéléré). */
  animFactor: number;
  selectedChip: number;
  focusSeat: number;
  layoutMode: LayoutMode;
  displayLevel: { level: number; xp: number };
  notice: Notice | null;
  quizDue: boolean;
  levelUp: { level: number; bonus: number } | null;
}

interface GameStoreActions {
  dispatch: (action: PlayerAction) => boolean;
  skip: () => void;
  selectChip: (value: number) => void;
  setFocusSeat: (seat: number) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  notify: (text: string, tone?: Notice['tone']) => void;
  clearNotice: () => void;
  dismissLevelUp: () => void;
  claimRecharge: (now?: number) => boolean;
  changeTable: (id: string) => boolean;
  answerQuiz: (answer: number, responseMs: number) => QuizResult;
  skipQuiz: () => void;
  resetGame: () => void;
}

export type GameStore = GameStoreState & GameStoreActions;

const RESTING: RestingPhase[] = ['BETTING', 'INSURANCE', 'PLAYER_TURNS', 'ROUND_END'];

export function freshEngine(tableId = DEFAULT_TABLE_ID, balance = STARTING_BALANCE): GameState {
  return createGame({
    rules: DEFAULT_RULES,
    table: tableLimits(getTable(tableId)),
    balance,
  });
}

/** Vérifie grossièrement qu'un état persisté est exploitable. */
export function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<GameState>;
  return (
    s.schema === 1 &&
    typeof s.balance === 'number' &&
    Number.isSafeInteger(s.balance) &&
    s.balance >= 0 &&
    RESTING.includes(s.phase as RestingPhase) &&
    Array.isArray(s.shoe?.cards) &&
    s.shoe.cards.length > 0 &&
    Array.isArray(s.seats) &&
    s.seats.length === DEFAULT_RULES.maxSeats &&
    Array.isArray(s.dealer?.cards) &&
    typeof s.table?.id === 'string'
  );
}

/** Remet les règles et limites à jour entre deux tours (si la config a changé). */
export function refreshConfig(state: GameState): GameState {
  if (state.phase !== 'BETTING' && state.phase !== 'ROUND_END') return state;
  const exists = TABLES.some((t) => t.id === state.table.id);
  return {
    ...state,
    rules: DEFAULT_RULES,
    table: tableLimits(getTable(exists ? state.table.id : DEFAULT_TABLE_ID)),
  };
}

export function applyTableTheme(tableId: string): void {
  if (typeof document === 'undefined') return;
  const t = getTable(tableId);
  const root = document.documentElement.style;
  root.setProperty('--accent', t.accent);
  root.setProperty('--accent-rgb', rgbChannels(t.accent));
  root.setProperty('--accent-soft', withAlpha(t.accent, 0.16));
  root.setProperty('--accent-glow', withAlpha(t.accent, 0.45));
  root.setProperty('--felt-1', t.felt[0]);
  root.setProperty('--felt-2', t.felt[1]);
  document.documentElement.dataset.table = t.id;
}

let noticeId = 0;
let autoRebetTimer: ReturnType<typeof setTimeout> | null = null;

function initialState(engine: GameState): GameStoreState {
  const profile = useProfileStore.getState();
  return {
    engine,
    view: projectView(engine),
    playing: false,
    animFactor: speedFactor(),
    selectedChip: RACK_CHIPS[0]?.value ?? 10,
    focusSeat: 0,
    layoutMode: 'desktop',
    displayLevel: { level: profile.level, xp: profile.xp },
    notice: null,
    quizDue: false,
    levelUp: null,
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      const director = new AnimationDirector({
        applyEvent: (e) => applyDirectorEvent(e),
        runEffects: (e, factor) => {
          const s = get();
          runEffects(e, factor, {
            view: s.view,
            layout: { mode: s.layoutMode, seats: s.engine.rules.maxSeats, focusSeat: s.focusSeat },
            reducedMotion: prefersReducedMotion(),
          });
        },
        speedFactor,
        recover: () => set((s) => ({ view: projectView(s.engine) })),
        setPlaying: (playing, factor) => {
          set({ playing, animFactor: playing ? factor : speedFactor() });
          if (!playing) scheduleAutoRebet();
        },
      });

      function applyDirectorEvent(e: DirectorEvent): void {
        switch (e.type) {
          case 'XP_GAINED':
            set({ displayLevel: { level: e.level, xp: e.xp } });
            return;
          case 'LEVEL_UP':
            set({ levelUp: { level: e.level, bonus: e.bonus } });
            return;
          default: {
            const view = reduceView(get().view, e);
            const patch: Partial<GameStoreState> = { view };
            if (e.type === 'ACTIVE_HAND' && e.turn) patch.focusSeat = e.turn.seat;
            if (e.type === 'INSURANCE_OFFERED') patch.focusSeat = e.seat;
            if (e.type === 'TABLE_CHANGED') applyTableTheme(e.table.id);
            set(patch);
          }
        }
      }

      function scheduleAutoRebet(): void {
        if (autoRebetTimer) clearTimeout(autoRebetTimer);
        const s = get();
        if (!useSettingsStore.getState().autoRebet || s.engine.phase !== 'ROUND_END') return;
        const round = s.engine.roundCounter;
        autoRebetTimer = setTimeout(
          () => {
            autoRebetTimer = null;
            const now = get();
            if (
              now.engine.phase === 'ROUND_END' &&
              now.engine.roundCounter === round &&
              !now.playing &&
              !now.quizDue &&
              !now.levelUp &&
              getAvailableActions(now.engine).rebet
            ) {
              now.dispatch({ type: 'REBET' });
            }
          },
          900 + 600 * speedFactor(),
        );
      }

      function onRoundEnd(
        summary: RoundSummary,
        engine: GameState,
      ): { engine: GameState; events: DirectorEvent[] } {
        const profile = useProfileStore.getState();
        const xp = xpForRound(summary);
        const gain = profile.addXp(xp);
        const events: DirectorEvent[] = [
          { type: 'XP_GAINED', amount: xp, level: gain.next.level, xp: gain.next.xp },
        ];
        for (const level of gain.levelsGained) {
          events.push({ type: 'LEVEL_UP', level, bonus: levelUpBonus(level) });
        }
        let next = engine;
        if (gain.bonus > 0) {
          const credited = applyAction(next, {
            type: 'CREDIT',
            amount: gain.bonus,
            reason: 'levelUp',
          });
          next = credited.state;
          events.push(...credited.events);
        }
        const tableName = getTable(summary.tableId).name;
        void import('../db/dexie')
          .then((m) => m.recordRound(summary, tableName))
          .catch((e: unknown) => console.warn('Historique indisponible', e));
        const count = profile.countRound();
        const settings = useSettingsStore.getState();
        if (settings.quizEnabled && count >= settings.quizEvery) set({ quizDue: true });
        return { engine: next, events };
      }

      return {
        ...initialState(freshEngine()),

        dispatch: (action) => {
          if (autoRebetTimer && action.type !== 'REBET') {
            clearTimeout(autoRebetTimer);
            autoRebetTimer = null;
          }
          const s = get();
          let result: { state: GameState; events: GameEvent[] };
          try {
            result = applyAction(s.engine, action);
          } catch (e) {
            if (e instanceof EngineError) {
              get().notify(e.message, 'error');
              return false;
            }
            throw e;
          }
          let engine = result.state;
          const events: DirectorEvent[] = [...result.events];
          const end = result.events.find((e) => e.type === 'ROUND_END');
          if (end?.type === 'ROUND_END') {
            const extra = onRoundEnd(end.summary, engine);
            engine = extra.engine;
            events.push(...extra.events);
          }
          set({ engine });
          director.enqueue(events);
          return true;
        },

        skip: () => {
          if (get().playing) set({ animFactor: 0 });
          director.skip();
        },

        selectChip: (value) => set({ selectedChip: value }),
        setFocusSeat: (seat) =>
          set({ focusSeat: Math.max(0, Math.min(get().engine.rules.maxSeats - 1, seat)) }),
        setLayoutMode: (mode) => set({ layoutMode: mode }),

        notify: (text, tone = 'info') => set({ notice: { id: ++noticeId, text, tone } }),
        clearNotice: () => set({ notice: null }),
        dismissLevelUp: () => {
          set({ levelUp: null });
          scheduleAutoRebet();
        },

        claimRecharge: (now = Date.now()) => {
          const s = get();
          const profile = useProfileStore.getState();
          const pending = s.engine.phase === 'BETTING' ? totalBets(s.engine) : 0;
          const status = rechargeStatus(
            s.engine.balance + pending,
            profile.level,
            profile.lastRechargeAt,
            now,
          );
          if (!status.available) return false;
          const ok = get().dispatch({ type: 'CREDIT', amount: status.amount, reason: 'recharge' });
          if (ok) profile.markRecharge(now);
          return ok;
        },

        changeTable: (id) => {
          const s = get();
          const table = getTable(id);
          if (!isTableUnlocked(table, useProfileStore.getState().level)) {
            get().notify(`Table ${table.name} : niveau ${table.levelRequired} requis`, 'error');
            return false;
          }
          if (s.engine.table.id === table.id) return true;
          if (!getAvailableActions(s.engine).changeTable) {
            get().notify('Terminez le tour avant de changer de table', 'error');
            return false;
          }
          return get().dispatch({ type: 'SET_TABLE', table: tableLimits(table) });
        },

        answerQuiz: (answer, responseMs) => {
          const expected = get().view.runningCount;
          const correct = answer === expected;
          set({ quizDue: false });
          const profile = useProfileStore.getState();
          profile.resetQuizCounter();
          void import('../db/dexie')
            .then((m) =>
              m.recordDrill({
                timestamp: Date.now(),
                kind: 'quiz',
                correct,
                expected,
                answer,
                responseMs,
              }),
            )
            .catch((e: unknown) => console.warn('Historique indisponible', e));
          if (correct) {
            const gain = profile.addXp(XP_BONUS.quizCorrect);
            const events: DirectorEvent[] = [
              {
                type: 'XP_GAINED',
                amount: XP_BONUS.quizCorrect,
                level: gain.next.level,
                xp: gain.next.xp,
              },
            ];
            for (const level of gain.levelsGained) {
              events.push({ type: 'LEVEL_UP', level, bonus: levelUpBonus(level) });
            }
            if (gain.bonus > 0) {
              const r = applyAction(get().engine, {
                type: 'CREDIT',
                amount: gain.bonus,
                reason: 'levelUp',
              });
              set({ engine: r.state });
              events.push(...r.events);
            }
            director.enqueue(events);
          }
          scheduleAutoRebet();
          return { correct, expected, answer };
        },

        skipQuiz: () => {
          set({ quizDue: false });
          useProfileStore.getState().resetQuizCounter();
          scheduleAutoRebet();
        },

        resetGame: () => {
          director.skip();
          const engine = freshEngine();
          applyTableTheme(engine.table.id);
          set(initialState(engine));
        },
      };
    },
    {
      name: 'game',
      version: 1,
      storage: createJSONStorage(() => blobStorage),
      partialize: (s) => ({ engine: s.engine }),
      merge: (persisted, current) => {
        const raw = (persisted as { engine?: unknown } | undefined)?.engine;
        const engine = isGameState(raw) ? refreshConfig(raw) : current.engine;
        return { ...current, engine, view: projectView(engine) };
      },
    },
  ),
);

applyTableTheme(useGameStore.getState().engine.table.id);

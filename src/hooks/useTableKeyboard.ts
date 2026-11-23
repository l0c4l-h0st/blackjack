import { useEffect } from 'react';
import { RACK_CHIPS } from '../config/chips';
import { getAvailableActions } from '../engine/round';
import type { PlayerAction } from '../engine/types';
import { primaryBettingAction, runActions } from '../components/actions/bettingActions';
import { isModalOpen } from '../components/modals/modalState';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';

const MOVES: Record<
  string,
  { action: PlayerAction; allowed: (a: ReturnType<typeof getAvailableActions>) => boolean }
> = {
  h: { action: { type: 'HIT' }, allowed: (a) => a.hit },
  s: { action: { type: 'STAND' }, allowed: (a) => a.stand },
  d: { action: { type: 'DOUBLE' }, allowed: (a) => a.double },
  p: { action: { type: 'SPLIT' }, allowed: (a) => a.split },
  r: { action: { type: 'SURRENDER' }, allowed: (a) => a.surrender },
};

/** Raccourcis clavier de la table (voir la liste dans les réglages). */
export function useTableKeyboard(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = e.key.toLowerCase();
      const store = useGameStore.getState();
      const dialogOpen = isModalOpen();
      const a = getAvailableActions(store.engine);

      if (key === ' ' || key === 'enter') {
        const native = target?.closest('button, a, [role="switch"], [role="radio"]');
        if (native && !native.hasAttribute('data-game-control')) return;
        e.preventDefault();
        if (store.playing) {
          store.skip();
          return;
        }
        if (dialogOpen) return;
        const primary = primaryBettingAction();
        if (primary) runActions(primary.actions);
        return;
      }

      if (store.playing) {
        if (key in MOVES || key === 'i' || key === 'n') store.skip();
        return;
      }

      if ((key === 'i' || key === 'n') && a.insurance) {
        if (key === 'i' && !a.insurance.canAfford) return;
        e.preventDefault();
        store.dispatch({ type: 'INSURANCE', take: key === 'i' });
        return;
      }
      if (dialogOpen) return;

      const move = MOVES[key];
      if (move) {
        if (move.allowed(a)) {
          e.preventDefault();
          store.dispatch(move.action);
        }
        return;
      }
      if (key === 'c') {
        const settings = useSettingsStore.getState();
        settings.update({ showHiLo: !settings.showHiLo });
        return;
      }
      const n = Number.parseInt(key, 10);
      if (n >= 1 && n <= RACK_CHIPS.length) {
        const chip = RACK_CHIPS[n - 1];
        if (chip && chip.value <= store.engine.table.max) store.selectChip(chip.value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

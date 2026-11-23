import { getAvailableActions } from '../../engine/round';
import type { PlayerAction } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

/** Action principale en phase de mise / fin de tour (bouton « Distribuer » et touche Espace). */
export function primaryBettingAction(): { label: string; actions: PlayerAction[] } | null {
  const { engine } = useGameStore.getState();
  const a = getAvailableActions(engine);
  if (engine.phase === 'BETTING') {
    if (a.deal) return { label: 'Distribuer', actions: [{ type: 'DEAL' }] };
    if (a.dealBlockers.includes('Placez une mise principale') && a.rebet) {
      return { label: 'Re-miser & distribuer', actions: [{ type: 'REBET' }, { type: 'DEAL' }] };
    }
    return null;
  }
  if (engine.phase === 'ROUND_END') {
    if (a.rebet)
      return { label: 'Re-miser & distribuer', actions: [{ type: 'REBET' }, { type: 'DEAL' }] };
    return { label: 'Nouveau tour', actions: [{ type: 'NEW_ROUND' }] };
  }
  return null;
}

export function runActions(actions: PlayerAction[]): void {
  const { dispatch } = useGameStore.getState();
  for (const action of actions) {
    if (!dispatch(action)) break;
  }
}

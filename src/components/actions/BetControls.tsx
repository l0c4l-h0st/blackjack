import { getAvailableActions } from '../../engine/round';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useGameStore } from '../../store/gameStore';
import { ChipRack } from '../chips/ChipRack';
import { primaryBettingAction, runActions } from './bettingActions';

/** Contrôles de mise : rack de jetons, effacer, re-miser, ×2, distribuer. */
export function BetControls() {
  const engine = useGameStore((s) => s.engine);
  const playing = useGameStore((s) => s.playing);
  const dispatch = useGameStore((s) => s.dispatch);
  const a = getAvailableActions(engine);
  const primary = primaryBettingAction();
  const blockers = engine.phase === 'BETTING' && !a.deal ? a.dealBlockers : [];
  const small = useMediaQuery('(max-width: 639px)');
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <ChipRack disabled={playing} size={small ? 36 : 44} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn whitespace-nowrap px-3 sm:px-4"
          disabled={playing || !a.clearBets}
          onClick={() => dispatch({ type: 'CLEAR_BETS' })}
          aria-label="Effacer les mises"
        >
          Effacer
        </button>
        <button
          type="button"
          className="btn whitespace-nowrap px-3 sm:px-4"
          disabled={playing || !a.rebet || (engine.phase === 'BETTING' && a.clearBets)}
          onClick={() => dispatch({ type: 'REBET' })}
          aria-label="Re-miser comme au tour précédent"
        >
          Re-miser
        </button>
        <button
          type="button"
          className="btn whitespace-nowrap px-3 sm:px-4"
          disabled={playing || !a.doubleBets}
          onClick={() => dispatch({ type: 'DOUBLE_BETS' })}
          aria-label="×2 : doubler toutes les mises"
        >
          ×2
        </button>
        <button
          type="button"
          className="btn-primary min-h-[48px] flex-1 whitespace-nowrap px-4 text-base sm:px-6 lg:flex-none"
          disabled={playing || primary === null}
          onClick={() => primary && runActions(primary.actions)}
          aria-label={`${primary?.label ?? 'Distribuer'} (touche Espace)`}
          aria-keyshortcuts="Space Enter"
          title={blockers.join(' · ') || undefined}
        >
          {primary?.label ?? 'Distribuer'}
          <kbd aria-hidden="true" className="kbd hidden border-white/40 sm:inline">
            Espace
          </kbd>
        </button>
      </div>
    </div>
  );
}

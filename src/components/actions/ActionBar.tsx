import type { ReactNode } from 'react';
import { getAvailableActions } from '../../engine/round';
import { useGameStore } from '../../store/gameStore';
import { BetControls } from './BetControls';

function ActionButton({
  label,
  hotkey,
  onClick,
  disabled,
  tone = 'default',
  ariaLabel,
}: {
  label: ReactNode;
  hotkey: string;
  onClick: () => void;
  disabled: boolean;
  tone?: 'default' | 'primary' | 'danger';
  ariaLabel: string;
}) {
  const cls =
    tone === 'primary'
      ? 'btn-primary'
      : tone === 'danger'
        ? 'btn border-loss/40 text-loss hover:border-loss'
        : 'btn';
  return (
    <button
      type="button"
      className={`${cls} min-h-[48px] whitespace-nowrap px-1 text-[13px] sm:flex-none sm:px-5 sm:text-sm`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${ariaLabel} (touche ${hotkey})`}
      aria-keyshortcuts={hotkey === 'Espace' ? 'Space' : hotkey}
    >
      {label}
      <kbd aria-hidden="true" className="kbd hidden sm:inline">
        {hotkey}
      </kbd>
    </button>
  );
}

/** Barre du bas : jetons et mises, ou actions de jeu selon la phase. */
export function ActionBar() {
  const engine = useGameStore((s) => s.engine);
  const playing = useGameStore((s) => s.playing);
  const dispatch = useGameStore((s) => s.dispatch);
  const a = getAvailableActions(engine);
  const betting = engine.phase === 'BETTING' || engine.phase === 'ROUND_END';
  const blockers = engine.phase === 'BETTING' && !a.deal ? a.dealBlockers : [];
  const hint = playing
    ? 'Clic ou Espace pour accélérer'
    : engine.phase === 'INSURANCE'
      ? 'Décision d’assurance : I = oui, N = non'
      : blockers.join(' · ');

  return (
    <div className="sticky bottom-0 z-30 border-t border-border bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:px-4">
      {betting ? (
        <BetControls />
      ) : (
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
          <ActionButton
            label="Tirer"
            hotkey="H"
            ariaLabel="Tirer une carte"
            tone="primary"
            disabled={playing || !a.hit}
            onClick={() => dispatch({ type: 'HIT' })}
          />
          <ActionButton
            label="Rester"
            hotkey="S"
            ariaLabel="Rester"
            disabled={playing || !a.stand}
            onClick={() => dispatch({ type: 'STAND' })}
          />
          <ActionButton
            label="Doubler"
            hotkey="D"
            ariaLabel="Doubler la mise"
            disabled={playing || !a.double}
            onClick={() => dispatch({ type: 'DOUBLE' })}
          />
          <ActionButton
            label="Séparer"
            hotkey="P"
            ariaLabel="Séparer la paire"
            disabled={playing || !a.split}
            onClick={() => dispatch({ type: 'SPLIT' })}
          />
          <ActionButton
            label="Abandon"
            hotkey="R"
            ariaLabel="Abandonner la main (récupère 50 %)"
            tone="danger"
            disabled={playing || !a.surrender}
            onClick={() => dispatch({ type: 'SURRENDER' })}
          />
        </div>
      )}
      <p
        className="mt-1 min-h-[1rem] text-center text-[11px] text-muted sm:text-xs"
        aria-live="polite"
      >
        {hint}
      </p>
    </div>
  );
}

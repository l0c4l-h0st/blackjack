import { memo } from 'react';
import { formatCredits } from '../../config/chips';
import type { Point } from '../../fx/layout';
import { ChipStack } from '../chips/ChipStack';

export interface BetSpotProps {
  at: Point;
  radius: number;
  label: string;
  /** Libellé complet pour les lecteurs d'écran. */
  ariaLabel: string;
  amount: number;
  interactive: boolean;
  highlighted?: boolean;
  chipSize: number;
  onPlace?: () => void;
  onRemove?: () => void;
}

/** Case de mise circulaire (cliquable pendant les mises). Clic droit : retirer la mise. */
export const BetSpot = memo(function BetSpot({
  at,
  radius,
  label,
  ariaLabel,
  amount,
  interactive,
  highlighted = false,
  chipSize,
  onPlace,
  onRemove,
}: BetSpotProps) {
  const ring = (
    <span
      className={`absolute inset-0 rounded-full border-2 border-dashed transition-colors ${
        highlighted ? 'border-accent bg-accent-soft' : 'border-white/20 bg-black/15'
      } ${interactive ? 'group-hover:border-accent group-hover:bg-accent-soft' : ''}`}
    />
  );
  const content = (
    <>
      {ring}
      {amount === 0 && (
        <span className="relative px-1 text-center font-display text-[11px] font-bold uppercase leading-tight tracking-wider text-white/45">
          {label}
        </span>
      )}
      {amount > 0 && (
        <span className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%, -62%)` }}>
          <ChipStack amount={amount} size={chipSize} />
        </span>
      )}
    </>
  );
  const style = { left: at.x - radius, top: at.y - radius, width: radius * 2, height: radius * 2 };
  if (!interactive) {
    return (
      <div
        className="absolute flex items-center justify-center"
        style={style}
        aria-label={`${ariaLabel} : ${formatCredits(amount)} crédits`}
        role="img"
      >
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-game-control
      className="group absolute flex items-center justify-center rounded-full"
      style={style}
      aria-label={`${ariaLabel}${amount > 0 ? ` (${formatCredits(amount)} crédits misés)` : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onPlace?.();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove?.();
      }}
    >
      {content}
    </button>
  );
});

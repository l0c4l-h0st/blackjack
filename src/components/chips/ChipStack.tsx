import { memo } from 'react';
import { decomposeAmount, formatCredits } from '../../config/chips';
import { Chip } from './Chip';

export interface ChipStackProps {
  amount: number;
  /** Diamètre d'un jeton. */
  size?: number;
  /** Jetons visibles au maximum (au-delà : badge « ×N »). */
  max?: number;
  showLabel?: boolean;
}

/** Pile isométrique : décalage de 3 px par jeton, plus gros jetons en bas. */
export const ChipStack = memo(function ChipStack({
  amount,
  size = 44,
  max = 12,
  showLabel = true,
}: ChipStackProps) {
  const chips = decomposeAmount(amount);
  if (chips.length === 0) return null;
  const visible = chips.slice(0, max);
  const step = (3 * size) / 44;
  const height = size * (68 / 64) + (visible.length - 1) * step;
  return (
    <div
      className="pointer-events-none relative"
      style={{ width: size, height }}
      role="img"
      aria-label={`${formatCredits(amount)} crédits`}
    >
      {visible.map((value, i) => (
        <div
          key={i}
          className="absolute left-0"
          style={{
            bottom: i * step,
            filter: i === 0 ? 'drop-shadow(0 4px 4px rgba(0,0,0,.45))' : undefined,
          }}
        >
          <Chip value={value} size={size} decorative />
        </div>
      ))}
      {chips.length > max && (
        <span className="pill absolute -right-5 top-0 bg-black/70 text-[10px] text-white">
          ×{chips.length}
        </span>
      )}
      {showLabel && (
        <span className="pill absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap bg-black/60 text-[11px] text-white">
          {formatCredits(amount)}
        </span>
      )}
    </div>
  );
});

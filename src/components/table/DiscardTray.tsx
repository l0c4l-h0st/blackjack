import { memo } from 'react';
import type { Point } from '../../fx/layout';
import { CardBack } from '../cards/Card';

/** Défausse : pile de dos de cartes dont la hauteur reflète le nombre de cartes. */
export const DiscardTray = memo(function DiscardTray({ count, at }: { count: number; at: Point }) {
  const layers = Math.min(14, Math.ceil(count / 22));
  return (
    <div
      className="absolute"
      style={{ left: at.x - 48, top: at.y - 46, width: 96, height: 100 }}
      role="img"
      aria-label={`Défausse : ${count} cartes`}
    >
      <div className="absolute inset-x-0 bottom-0 h-[70px] rounded-xl border border-white/10 bg-black/30" />
      {Array.from({ length: layers }, (_, i) => (
        <div
          key={i}
          className="absolute overflow-hidden rounded-md"
          style={{ left: 26, bottom: 10 + i * 2, width: 44, height: 62, transform: 'rotate(4deg)' }}
        >
          <CardBack className="h-full w-full" />
        </div>
      ))}
      <span className="absolute bottom-1 left-2 font-display text-[11px] tabular-nums text-muted">
        {count}
      </span>
    </div>
  );
});

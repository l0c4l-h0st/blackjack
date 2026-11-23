import { useEffect, useRef, useState } from 'react';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { formatCredits } from '../../config/chips';

/** Solde animé avec flash vert (hausse) ou rouge (baisse). */
export function BalanceCounter({ value }: { value: number }) {
  const display = useAnimatedNumber(value);
  const previous = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value === previous.current) return;
    setFlash(value > previous.current ? 'up' : 'down');
    previous.current = value;
    const t = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(t);
  }, [value]);

  const tone =
    flash === 'up'
      ? 'text-win drop-shadow-[0_0_10px_rgba(46,230,166,0.7)]'
      : flash === 'down'
        ? 'text-loss drop-shadow-[0_0_10px_rgba(255,77,109,0.6)]'
        : 'text-text';

  return (
    <div className="flex items-baseline gap-1 whitespace-nowrap sm:gap-1.5">
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Solde : {formatCredits(value)} crédits
      </span>
      <span
        aria-hidden="true"
        className={`font-display text-lg font-bold tabular-nums transition-[color,filter] duration-500 sm:text-xl ${tone}`}
      >
        {formatCredits(display)}
      </span>
      <span aria-hidden="true" className="text-xs font-semibold text-muted">
        cr
      </span>
    </div>
  );
}

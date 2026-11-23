import { useEffect, useRef, useState } from 'react';

/** Nombre qui défile vers sa nouvelle valeur (requestAnimationFrame). */
export function useAnimatedNumber(value: number, durationMs = 650): number {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    if (origin === value) return;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      const current = Math.round(origin + (value - origin) * eased);
      from.current = current;
      setDisplay(current);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, durationMs]);

  return display;
}

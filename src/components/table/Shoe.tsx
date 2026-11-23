import { AnimatePresence, motion } from 'framer-motion';
import { memo, useEffect, useRef, useState } from 'react';
import type { ShoeView } from '../../engine/view';
import type { Point } from '../../fx/layout';
import { CARD_H, CARD_W } from '../../fx/layout';
import { CardBack } from '../cards/Card';

/** Sabot : boîtier, jauge de cartes restantes et position de la carte de coupe. */
export const Shoe = memo(function Shoe({ shoe, at }: { shoe: ShoeView; at: Point }) {
  const remaining = shoe.size - shoe.position;
  const ratio = shoe.size > 0 ? remaining / shoe.size : 0;
  const cutRatio = shoe.size > 0 ? Math.max(0, (shoe.size - shoe.cutIndex) / shoe.size) : 0;
  return (
    <div
      className="absolute"
      style={{ left: at.x - 54, top: at.y - 44, width: 108 }}
      role="img"
      aria-label={`Sabot : ${remaining} cartes restantes sur ${shoe.size}${shoe.cutCardOut ? ', carte de coupe sortie' : ''}`}
    >
      <div className="relative h-[78px] w-[108px] rounded-xl border border-white/10 bg-gradient-to-b from-[#1c2336] to-[#0c101b] shadow-[0_10px_24px_rgba(0,0,0,0.55)]">
        <div className="absolute -left-2 top-3 h-[60px] w-[44px] -rotate-12 overflow-hidden rounded-md shadow-lg">
          <CardBack className="h-full w-full" />
        </div>
        <div className="absolute inset-x-3 bottom-2 top-3 rounded-md bg-black/40" />
        <span className="absolute bottom-2 right-3 font-display text-xs font-semibold tabular-nums text-text/80">
          {remaining}
        </span>
      </div>
      <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${ratio * 100}%` }}
        />
        {!shoe.cutCardOut && (
          <div
            className="absolute top-[-2px] h-3 w-1 rounded bg-gold shadow-[0_0_6px_rgba(245,196,81,0.9)]"
            style={{ left: `calc(${cutRatio * 100}% - 2px)` }}
            title="Carte de coupe"
          />
        )}
      </div>
    </div>
  );
});

/** Animation de mélange (riffle) jouée quand l'identifiant du sabot change. */
export function ShuffleAnimation({
  shoeId,
  center,
  shoeAt,
  factor,
}: {
  shoeId: number;
  center: Point;
  shoeAt: Point;
  factor: number;
}) {
  const first = useRef(shoeId);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (shoeId === first.current || factor === 0) return;
    setActive(shoeId);
    const t = setTimeout(() => setActive(null), 1650 * factor);
    return () => clearTimeout(t);
  }, [shoeId, factor]);

  const w = CARD_W * 0.8;
  const h = CARD_H * 0.8;
  const d = factor || 1;
  return (
    <AnimatePresence>
      {active !== null && (
        <motion.div
          key={active}
          className="pointer-events-none absolute"
          style={{ left: center.x - w / 2, top: center.y - h / 2, width: w, height: h, zIndex: 60 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ x: shoeAt.x - center.x, y: shoeAt.y - center.y, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.25 * d }}
          aria-hidden="true"
        >
          {Array.from({ length: 12 }, (_, i) => {
            const fromLeft = i % 2 === 0;
            return (
              <motion.div
                key={i}
                className="absolute inset-0 overflow-hidden rounded-md shadow-md"
                initial={{ x: fromLeft ? -70 : 70, y: -12, rotate: fromLeft ? -14 : 14 }}
                animate={{
                  x: [fromLeft ? -70 : 70, fromLeft ? -40 : 40, 0],
                  y: [-12, -18, -i * 1.5],
                  rotate: [fromLeft ? -14 : 14, fromLeft ? -22 : 22, 0],
                }}
                transition={{ duration: 0.5 * d, delay: (0.15 + i * 0.06) * d, ease: 'easeOut' }}
              >
                <CardBack className="h-full w-full" />
              </motion.div>
            );
          })}
          <motion.div
            className="absolute left-1/2 h-1.5 w-[110%] -translate-x-1/2 rounded bg-gold shadow-[0_0_10px_rgba(245,196,81,0.9)]"
            initial={{ opacity: 0, top: -20 }}
            animate={{ opacity: [0, 1, 1], top: [-20, h * 0.35, h * 0.35] }}
            transition={{ duration: 0.4 * d, delay: 1.05 * d }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

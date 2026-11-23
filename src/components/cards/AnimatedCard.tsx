import { motion } from 'framer-motion';
import { memo, useEffect, useState } from 'react';
import type { Card } from '../../engine/types';
import type { Placement, Point } from '../../fx/layout';
import { CARD_H, CARD_W } from '../../fx/layout';
import { CardBack, CardFace } from './Card';

export interface AnimatedCardProps {
  card: Card;
  faceUp: boolean;
  placement: Placement;
  /** Point de départ (sabot). */
  origin: Point;
  /** Point d'arrivée en fin de tour (défausse). */
  discard: Point;
  /** Facteur de vitesse (0 = instantané). */
  factor: number;
  fourColor: boolean;
  /** Retournement lent avec zoom (suspense ENHC). */
  slowFlip: boolean;
  /** Joue le vol depuis le sabot (faux pour les cartes déjà présentes au chargement). */
  animateEntry: boolean;
  dimmed?: boolean;
}

const HALF_W = CARD_W / 2;
const HALF_H = CARD_H / 2;

/**
 * Carte animée : sort du sabot en arc (keyframes), se retourne en vol (flip 3D réel),
 * atterrit avec un micro-rebond ; l'ombre s'élargit pendant le vol.
 */
export const AnimatedCard = memo(function AnimatedCard({
  card,
  faceUp,
  placement,
  origin,
  discard,
  factor,
  fourColor,
  slowFlip,
  animateEntry,
  dimmed = false,
}: AnimatedCardProps) {
  const [landed, setLanded] = useState(factor === 0 || !animateEntry);
  const target = {
    x: placement.x - HALF_W,
    y: placement.y - HALF_H,
    rotate: placement.rotate,
    scale: placement.scale,
  };
  // Trajectoire d'entrée figée au montage.
  const [entry] = useState(() => {
    const sx = origin.x - HALF_W;
    const sy = origin.y - HALF_H;
    const mx = (sx + target.x) / 2;
    const my = Math.min(sy, target.y) - 60;
    return {
      x: [sx, mx, target.x, target.x],
      y: [sy, my, target.y - 4, target.y],
      rotate: [-30, target.rotate - 8, target.rotate + 1, target.rotate],
      scale: [0.6, target.scale * 1.14, target.scale * 0.98, target.scale],
    };
  });
  const [flightDuration] = useState(() => 0.5 * factor);

  useEffect(() => {
    if (factor === 0) setLanded(true);
  }, [factor]);

  const instant = factor === 0;
  const skipEntry = instant || !animateEntry;
  return (
    <motion.div
      className="absolute left-0 top-0"
      style={{
        width: CARD_W,
        height: CARD_H,
        zIndex: placement.z,
        perspective: 900,
        willChange: 'transform',
      }}
      initial={
        skipEntry
          ? target
          : { x: entry.x[0], y: entry.y[0], rotate: entry.rotate[0], scale: entry.scale[0] }
      }
      animate={landed ? target : entry}
      exit={{
        x: discard.x - HALF_W,
        y: discard.y - HALF_H,
        rotate: 8,
        scale: 0.5,
        opacity: 0,
        transition: { duration: 0.42 * factor, ease: 'easeIn' },
      }}
      transition={
        landed
          ? instant
            ? { duration: 0 }
            : { type: 'spring', stiffness: 320, damping: 30 }
          : { duration: flightDuration, times: [0, 0.55, 0.88, 1], ease: 'easeOut' }
      }
      onAnimationComplete={() => {
        if (!landed) setLanded(true);
      }}
    >
      {/* ombre : s'élargit et s'éloigne pendant le vol */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-1 rounded-lg bg-black/60 blur-[6px]"
        initial={
          skipEntry
            ? { opacity: 0.35, x: 2, y: 4, scale: 1 }
            : { opacity: 0.15, x: 2, y: 4, scale: 0.9 }
        }
        animate={
          landed
            ? { opacity: 0.35, x: 2, y: 4, scale: 1 }
            : { opacity: [0.15, 0.5, 0.35], x: [2, 10, 2], y: [4, 26, 4], scale: [0.9, 1.25, 1] }
        }
        transition={
          landed ? { duration: 0.2 * factor } : { duration: flightDuration, ease: 'easeOut' }
        }
      />
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d', opacity: dimmed ? 0.55 : 1 }}
        initial={{ rotateY: skipEntry && faceUp ? 0 : 180 }}
        animate={
          slowFlip && faceUp && !instant
            ? { rotateY: 0, scale: [1, 1.18, 1], z: [0, 60, 0] }
            : { rotateY: faceUp ? 0 : 180 }
        }
        transition={{
          duration: (slowFlip ? 0.78 : 0.34) * factor,
          delay: landed ? 0 : 0.12 * factor,
          ease: 'easeInOut',
        }}
      >
        <div className="card-face">
          <CardFace card={card} fourColor={fourColor} />
        </div>
        <div className="card-face" style={{ transform: 'rotateY(180deg)' }}>
          <CardBack />
        </div>
      </motion.div>
    </motion.div>
  );
});

import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState } from 'react';
import type { ChipKeyframes } from '../../fx/physics';
import { simulateSlide, simulateSuck, simulateToss } from '../../fx/physics';
import type { ChipFlight, FloatingText } from '../../store/fxStore';
import { useFxStore } from '../../store/fxStore';
import { Chip } from '../chips/Chip';

const CHIP = 34;

function keyframesFor(f: ChipFlight): ChipKeyframes {
  if (f.mode === 'toss') return simulateToss(f.from, f.to);
  if (f.mode === 'slide') return simulateSlide(f.from, f.to);
  return simulateSuck(f.from, f.to);
}

const Flight = memo(function Flight({ flight }: { flight: ChipFlight }) {
  const removeFlight = useFxStore((s) => s.removeFlight);
  const [k] = useState(() => keyframesFor(flight));
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: CHIP, height: CHIP, zIndex: 70, willChange: 'transform' }}
      initial={{ x: (k.x[0] ?? 0) - CHIP / 2, y: (k.y[0] ?? 0) - CHIP / 2, scale: k.scale[0] ?? 1 }}
      animate={{
        x: k.x.map((v) => v - CHIP / 2),
        y: k.y.map((v) => v - CHIP / 2),
        scale: k.scale,
      }}
      transition={{ duration: k.duration * flight.factor, times: k.times, ease: 'linear' }}
      onAnimationComplete={() => removeFlight(flight.id)}
      aria-hidden="true"
    >
      {flight.chips.map((value, i) => (
        <div
          key={i}
          className="absolute left-0"
          style={{ bottom: i * 3, filter: 'drop-shadow(0 6px 5px rgba(0,0,0,.5))' }}
        >
          <Chip value={value} size={CHIP} decorative />
        </div>
      ))}
    </motion.div>
  );
});

/** Jetons en vol (lancer physique, glissade, aspiration). */
export function FlyingChips() {
  const flights = useFxStore((s) => s.flights);
  return (
    <>
      {flights.map((f) => (
        <Flight key={f.id} flight={f} />
      ))}
    </>
  );
}

const TONES: Record<FloatingText['tone'], string> = {
  win: 'text-win',
  loss: 'text-loss',
  gold: 'text-gold',
  info: 'text-text',
};

/** Textes flottants (gains, annonces) qui montent et s'estompent. */
export function FloatingTexts({ factor }: { factor: number }) {
  const floats = useFxStore((s) => s.floats);
  const removeFloat = useFxStore((s) => s.removeFloat);
  const d = Math.max(0.35, factor);
  return (
    <AnimatePresence>
      {floats.map((f) => (
        <motion.div
          key={f.id}
          className={`pointer-events-none absolute whitespace-nowrap font-display text-xl font-bold [text-shadow:0_2px_8px_rgba(0,0,0,0.9)] ${TONES[f.tone]}`}
          style={{ left: f.x, top: f.y, zIndex: 95, x: '-50%' }}
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], y: [10, -10, -30, -48], scale: [0.8, 1.1, 1, 1] }}
          transition={{ duration: 1.6 * d, times: [0, 0.15, 0.7, 1] }}
          onAnimationComplete={() => removeFloat(f.id)}
          aria-hidden="true"
        >
          {f.text}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

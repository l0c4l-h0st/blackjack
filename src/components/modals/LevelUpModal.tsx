import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { formatCredits } from '../../config/chips';
import { TABLES } from '../../config/tables';
import { useGameStore } from '../../store/gameStore';
import { Modal } from './Modal';

/** Texte qui « s'imprime » lettre par lettre. */
function TypedText({ text }: { text: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    const t = setInterval(() => setCount((c) => (c >= text.length ? c : c + 1)), 38);
    return () => clearInterval(t);
  }, [text]);
  return (
    <span aria-label={text}>
      <span aria-hidden="true">{text.slice(0, count)}</span>
      <span aria-hidden="true" className="opacity-0">
        {text.slice(count)}
      </span>
    </span>
  );
}

export function LevelUpModal() {
  const levelUp = useGameStore((s) => s.levelUp);
  const dismiss = useGameStore((s) => s.dismissLevelUp);
  const unlocked = levelUp ? TABLES.find((t) => t.levelRequired === levelUp.level) : undefined;

  return (
    <Modal open={levelUp !== null} title="Niveau supérieur" onClose={dismiss} size="sm" hideTitle>
      {levelUp && (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <motion.div
            className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-gold bg-gradient-to-br from-accent to-[#1a1240] shadow-[0_0_50px_rgba(245,196,81,0.55)]"
            initial={{ scale: 0.3, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          >
            <span className="font-display text-5xl font-bold tabular-nums text-white">
              {levelUp.level}
            </span>
          </motion.div>
          <p className="font-display text-2xl font-bold text-gold">
            <TypedText text={`Niveau ${levelUp.level} atteint !`} />
          </p>
          <p className="text-muted">
            Bonus :{' '}
            <strong className="font-display text-win">+{formatCredits(levelUp.bonus)} cr</strong>
          </p>
          {unlocked && (
            <p className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-2 text-sm">
              Nouvelle table débloquée : <strong>{unlocked.name}</strong> (
              {formatCredits(unlocked.min)}–{formatCredits(unlocked.max)})
            </p>
          )}
          <button
            type="button"
            className="btn-primary mt-2 w-full"
            onClick={dismiss}
            data-autofocus
          >
            Continuer
          </button>
        </div>
      )}
    </Modal>
  );
}

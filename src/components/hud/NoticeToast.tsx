import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

const TONES = {
  info: 'border-border bg-surface-2 text-text',
  error: 'border-loss/60 bg-[#2a1018] text-[#ffd0d8]',
  win: 'border-win/60 bg-[#0b2a20] text-win',
  loss: 'border-loss/60 bg-[#2a1018] text-loss',
};

/** Message court (mise refusée, table verrouillée…). */
export function NoticeToast() {
  const notice = useGameStore((s) => s.notice);
  const clear = useGameStore((s) => s.clearNotice);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clear, 2600);
    return () => clearTimeout(t);
  }, [notice, clear]);
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center px-3"
      aria-live="assertive"
    >
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            role="alert"
            className={`rounded-xl border px-4 py-2 text-sm font-medium shadow-panel ${TONES[notice.tone]}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {notice.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

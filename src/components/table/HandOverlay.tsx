import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';
import { formatSigned } from '../../config/chips';
import { formatTotal, handValue } from '../../engine/hand';
import type { HandResult } from '../../engine/types';
import type { HandView } from '../../engine/view';
import type { Point } from '../../fx/layout';

const RESULT_LABELS: Record<HandResult, string> = {
  win: 'Gagné',
  lose: 'Perdu',
  push: 'Égalité',
  blackjack: 'Blackjack',
  bust: 'Bust',
  surrender: 'Abandon',
  evenMoney: 'Even money',
};

const RESULT_STYLES: Record<HandResult, string> = {
  win: 'bg-win text-[#032016]',
  blackjack: 'bg-gold text-[#2a1a00]',
  evenMoney: 'bg-win text-[#032016]',
  push: 'bg-surface-2 text-text border border-border',
  lose: 'bg-loss text-white',
  bust: 'bg-loss text-white',
  surrender: 'bg-surface-2 text-muted border border-border',
};

export function TotalPill({
  cards,
  at,
  active,
  label,
}: {
  cards: HandView['cards'];
  at: Point;
  active: boolean;
  label: string;
}) {
  const visible = cards.filter((c) => c.faceUp).map((c) => c.card);
  if (visible.length === 0) return null;
  const v = handValue(visible);
  const bust = v.total > 21;
  const bj = visible.length === 2 && v.total === 21;
  return (
    <div
      key={bust ? 'bust' : 'ok'}
      className={`pill absolute z-[80] -translate-x-1/2 border text-sm shadow-lg ${
        bust
          ? 'total-bust border-loss bg-loss text-white'
          : bj
            ? 'border-gold bg-gold text-[#2a1a00]'
            : active
              ? 'border-accent bg-accent text-white shadow-glow'
              : 'border-white/15 bg-black/75 text-white'
      }`}
      style={{ left: at.x, top: at.y }}
      aria-label={`${label} : ${v.total}${v.soft ? ' (soft)' : ''}`}
    >
      {formatTotal(visible)}
    </div>
  );
}

/** Pastille de total, badge de résultat et halo de la main active. */
export const HandOverlay = memo(function HandOverlay({
  hand,
  anchor,
  totalAt,
  scale,
  active,
  label,
}: {
  hand: HandView;
  anchor: Point;
  totalAt: Point;
  scale: number;
  active: boolean;
  label: string;
}) {
  // Au-dessus de la dernière carte (les cartes montent de 15 unités chacune).
  const base = scale < 1 ? 118 : 146;
  const badgeY = anchor.y - (base + Math.max(0, hand.cards.length - 1) * 15 + 53 + 20) * scale;
  return (
    <>
      {active && (
        <div
          aria-hidden="true"
          className="active-ring pointer-events-none absolute rounded-2xl border-2 border-accent/80 bg-accent/5 shadow-glow"
          style={{
            left: anchor.x + 12 * scale,
            top: anchor.y - 128 * scale,
            width: 150 * scale,
            height: 168 * scale,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
      <TotalPill cards={hand.cards} at={totalAt} active={active} label={label} />
      {hand.doubled && (
        <div
          className="pill absolute z-[80] -translate-x-1/2 bg-accent text-[11px] text-white"
          style={{ left: totalAt.x + 42 * scale, top: totalAt.y }}
          aria-label="Main doublée"
        >
          ×2
        </div>
      )}
      <AnimatePresence>
        {hand.result && (
          <motion.div
            key={hand.result}
            className={`pill absolute z-[90] whitespace-nowrap px-3 py-1 text-sm uppercase tracking-wide shadow-xl ${RESULT_STYLES[hand.result]}`}
            style={{ left: anchor.x, top: badgeY, x: '-50%' }}
            initial={{ opacity: 0, y: 12, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            role="status"
          >
            {RESULT_LABELS[hand.result]}
            {hand.net !== null && hand.net !== 0 && hand.result !== 'bust' && (
              <span className="ml-1.5 font-display normal-case tabular-nums">
                {formatSigned(hand.net)}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

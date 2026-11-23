import { memo } from 'react';
import type { TableView } from '../../engine/view';
import type { LayoutMode } from '../../fx/layout';
import { fixedPoint } from '../../fx/layout';
import { TotalPill } from './HandOverlay';

/** Zone du croupier : étiquette et total visible. */
export const DealerArea = memo(function DealerArea({
  view,
  mode,
}: {
  view: TableView;
  mode: LayoutMode;
}) {
  const tray = fixedPoint(mode, 'dealerTray');
  const rowY = 140;
  return (
    <>
      <div
        className="absolute -translate-x-1/2 rounded-b-2xl border border-t-0 border-white/10 bg-black/30 px-6 pb-1.5 pt-1 font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45"
        style={{ left: tray.x, top: 0 }}
      >
        Croupier
      </div>
      <TotalPill
        cards={view.dealer.cards}
        at={{ x: tray.x, y: rowY + 66 }}
        active={false}
        label="Croupier"
      />
    </>
  );
});

import { memo } from 'react';
import { SIDE_BET_OUTCOME_LABELS } from '../../engine/sideBets';
import type { SideBetResult } from '../../engine/types';
import type { Point } from '../../fx/layout';
import type { BetSpotProps } from './BetSpot';
import { BetSpot } from './BetSpot';

/** Case de side bet + étiquette du résultat (combinaison et multiplicateur). */
export const SideBetSpot = memo(function SideBetSpot({
  result,
  ...spot
}: BetSpotProps & { result: SideBetResult | null }) {
  return (
    <>
      <BetSpot {...spot} />
      {result && <SideBetLabel result={result} at={spot.at} radius={spot.radius} />}
    </>
  );
});

function SideBetLabel({
  result,
  at,
  radius,
}: {
  result: SideBetResult;
  at: Point;
  radius: number;
}) {
  const won = result.payout > 0 && result.outcome !== null;
  return (
    <div
      className={`pill absolute -translate-x-1/2 whitespace-nowrap text-[11px] ${
        won
          ? 'bg-gold text-[#2a1a00] shadow-[0_0_14px_rgba(245,196,81,0.6)]'
          : 'bg-black/60 text-muted'
      }`}
      style={{ left: at.x, top: at.y - radius - 26 }}
      role="status"
    >
      {won && result.outcome
        ? `${SIDE_BET_OUTCOME_LABELS[result.outcome]} ×${result.multiplier}`
        : 'Perdu'}
    </div>
  );
}

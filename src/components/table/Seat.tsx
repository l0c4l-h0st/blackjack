import { memo } from 'react';
import type { BetSpot as BetSpotKind } from '../../engine/types';
import type { SeatView } from '../../engine/view';
import type { LayoutContext } from '../../fx/layout';
import {
  handAnchor,
  handScale,
  handTotalPosition,
  seatAnchor,
  seatSpotPosition,
} from '../../fx/layout';
import { ChipStack } from '../chips/ChipStack';
import { BetSpot } from './BetSpot';
import { HandOverlay } from './HandOverlay';
import { SideBetSpot } from './SideBetSpot';

export interface SeatProps {
  seat: SeatView;
  layout: LayoutContext;
  bettingOpen: boolean;
  activeHand: number | null;
  insuranceAsked: boolean;
  onPlace: (seat: number, spot: BetSpotKind) => void;
  onRemove: (seat: number, spot: BetSpotKind) => void;
}

/** Une place : cases de mise, jetons des mains, totaux et résultats. */
export const Seat = memo(function Seat({
  seat,
  layout,
  bettingOpen,
  activeHand,
  insuranceAsked,
  onPlace,
  onRemove,
}: SeatProps) {
  const n = seat.hands.length;
  const place = seat.index + 1;
  const anchor = seatAnchor(layout, seat.index);
  const mainSpot = seatSpotPosition(layout, seat.index, 'main');
  const pp = seatSpotPosition(layout, seat.index, 'perfectPairs');
  const tp = seatSpotPosition(layout, seat.index, 'twentyOnePlus3');
  const ins = seatSpotPosition(layout, seat.index, 'insurance');
  const scale = handScale(n);

  return (
    <>
      <BetSpot
        at={mainSpot}
        radius={40}
        label="Mise"
        ariaLabel={`Place ${place}, mise principale`}
        amount={seat.spots.main}
        interactive={bettingOpen}
        highlighted={activeHand !== null}
        chipSize={44}
        onPlace={() => onPlace(seat.index, 'main')}
        onRemove={() => onRemove(seat.index, 'main')}
      />
      <SideBetSpot
        at={pp}
        radius={27}
        label="PP"
        ariaLabel={`Place ${place}, Perfect Pairs`}
        amount={seat.spots.perfectPairs}
        interactive={bettingOpen}
        chipSize={32}
        result={seat.sideResults.perfectPairs}
        onPlace={() => onPlace(seat.index, 'perfectPairs')}
        onRemove={() => onRemove(seat.index, 'perfectPairs')}
      />
      <SideBetSpot
        at={tp}
        radius={27}
        label="21+3"
        ariaLabel={`Place ${place}, 21+3`}
        amount={seat.spots.twentyOnePlus3}
        interactive={bettingOpen}
        chipSize={32}
        result={seat.sideResults.twentyOnePlus3}
        onPlace={() => onPlace(seat.index, 'twentyOnePlus3')}
        onRemove={() => onRemove(seat.index, 'twentyOnePlus3')}
      />
      {(insuranceAsked || seat.spots.insurance > 0 || seat.insurance.result !== null) && (
        <BetSpot
          at={ins}
          radius={24}
          label="Ass."
          ariaLabel={`Place ${place}, assurance`}
          amount={seat.spots.insurance}
          interactive={false}
          highlighted={insuranceAsked}
          chipSize={30}
        />
      )}

      {seat.hands.map((hand, i) => {
        const a = handAnchor(layout, seat.index, i, n);
        return (
          <div key={hand.id}>
            {hand.stake > 0 && (
              <div
                className="absolute"
                style={{ left: a.x, top: a.y, transform: 'translate(-50%, -62%)' }}
              >
                <ChipStack amount={hand.stake} size={n > 2 ? 34 : 42} />
              </div>
            )}
            <HandOverlay
              hand={hand}
              anchor={a}
              totalAt={handTotalPosition(layout, seat.index, i, n)}
              scale={scale}
              active={activeHand === i}
              label={`Place ${place}${n > 1 ? `, main ${i + 1}` : ''}`}
            />
          </div>
        );
      })}

      <div
        className={`absolute -translate-x-1/2 whitespace-nowrap font-display text-[11px] font-semibold uppercase tracking-[0.2em] ${
          activeHand !== null ? 'text-accent' : 'text-white/35'
        }`}
        style={{ left: anchor.x, top: anchor.y + 58 }}
      >
        Place {place}
      </div>
    </>
  );
});

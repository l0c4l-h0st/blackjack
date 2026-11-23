import { useGameStore } from '../../store/gameStore';
import { ChevronIcon } from '../icons';

/** Carrousel mobile : place de gauche / de droite (à l'écran, la place 1 est à droite). */
export function MobileSeatNav() {
  const focus = useGameStore((s) => s.focusSeat);
  const seats = useGameStore((s) => s.engine.rules.maxSeats);
  const setFocus = useGameStore((s) => s.setFocusSeat);
  const view = useGameStore((s) => s.view);
  const order = Array.from({ length: seats }, (_, i) => seats - 1 - i);
  const pos = order.indexOf(focus);
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-2 pb-1">
      <button
        type="button"
        className="btn h-10 min-h-0 w-10 rounded-full px-0"
        disabled={pos <= 0}
        onClick={() => setFocus(order[pos - 1] ?? focus)}
        aria-label="Place de gauche"
      >
        <ChevronIcon dir="left" />
      </button>
      <div className="flex items-center gap-3" role="tablist" aria-label="Places">
        {order.map((seat) => {
          const s = view.seats[seat];
          const busy = (s?.hands.length ?? 0) > 0 || (s?.spots.main ?? 0) > 0;
          const selected = seat === focus;
          return (
            <button
              key={seat}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFocus(seat)}
              className={`pill min-h-[32px] gap-1.5 border text-xs ${
                selected ? 'border-accent bg-accent-soft text-text' : 'border-border text-muted'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${busy ? 'bg-accent' : 'bg-white/20'}`}
                aria-hidden="true"
              />
              Place {seat + 1}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="btn h-10 min-h-0 w-10 rounded-full px-0"
        disabled={pos >= seats - 1}
        onClick={() => setFocus(order[pos + 1] ?? focus)}
        aria-label="Place de droite"
      >
        <ChevronIcon />
      </button>
    </div>
  );
}

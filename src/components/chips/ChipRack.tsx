import { RACK_CHIPS, formatCredits } from '../../config/chips';
import { useGameStore } from '../../store/gameStore';
import { Chip } from './Chip';

/** Rack de jetons : sélection du jeton à poser (touches 1 à 8). */
export function ChipRack({ disabled, size = 44 }: { disabled: boolean; size?: number }) {
  const selected = useGameStore((s) => s.selectedChip);
  const select = useGameStore((s) => s.selectChip);
  const balance = useGameStore((s) => s.engine.balance);
  const tableMax = useGameStore((s) => s.engine.table.max);

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto px-1 py-1 sm:gap-2"
      role="radiogroup"
      aria-label="Jetons"
    >
      {RACK_CHIPS.map((chip, i) => {
        const unavailable = chip.value > tableMax;
        const tooBig = chip.value > balance;
        const isSelected = selected === chip.value;
        return (
          <button
            key={chip.value}
            type="button"
            role="radio"
            data-game-control
            aria-checked={isSelected}
            aria-label={`Jeton de ${formatCredits(chip.value)} (touche ${i + 1})`}
            disabled={disabled || unavailable}
            onClick={() => select(chip.value)}
            className={`relative shrink-0 rounded-full p-0.5 transition-transform duration-150 disabled:cursor-not-allowed disabled:opacity-30 ${
              isSelected
                ? '-translate-y-1.5 scale-110 ring-2 ring-accent ring-offset-2 ring-offset-surface'
                : 'hover:-translate-y-1'
            } ${tooBig && !unavailable ? 'opacity-50' : ''}`}
          >
            <Chip value={chip.value} size={size} decorative />
          </button>
        );
      })}
    </div>
  );
}

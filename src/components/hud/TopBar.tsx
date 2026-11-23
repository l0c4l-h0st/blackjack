import { Link, NavLink } from 'react-router';
import { formatCompact } from '../../config/chips';
import { getTable } from '../../config/tables';
import { useGameStore } from '../../store/gameStore';
import { ChartIcon, GearIcon, TableIcon, TargetIcon } from '../icons';
import { BalanceCounter } from './BalanceCounter';
import { DailyRechargeButton } from './DailyRechargeButton';
import { LevelBadge, XpBar } from './LevelBadge';

function Logo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 rounded-lg"
      aria-label="Nocturne 21, retour à la table"
    >
      <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
        <path d="M32 6l22 26-22 26L10 32z" style={{ fill: 'var(--accent)' }} />
        <path d="M32 14l15 18-15 18-15-18z" fill="#0b0f17" opacity="0.55" />
        <text
          x="32"
          y="38"
          textAnchor="middle"
          fontSize="15"
          fontWeight="700"
          fill="#fff"
          fontFamily="'Space Grotesk', sans-serif"
        >
          21
        </text>
      </svg>
      <span className="hidden font-display text-lg font-bold tracking-wide sm:inline">
        Nocturne <span className="text-accent">21</span>
      </span>
    </Link>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `btn-ghost h-10 min-h-0 w-9 px-0 sm:w-10 ${isActive ? 'bg-surface-2 text-accent' : 'text-muted'}`;

export function TopBar({
  onOpenSettings,
  onOpenTables,
}: {
  onOpenSettings: () => void;
  onOpenTables: () => void;
}) {
  const balance = useGameStore((s) => s.view.balance);
  const tableId = useGameStore((s) => s.view.table.id);
  const level = useGameStore((s) => s.displayLevel);
  const table = getTable(tableId);

  return (
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-border bg-surface/80 px-3 backdrop-blur sm:gap-4 sm:px-4">
      <Logo />
      <button
        type="button"
        onClick={onOpenTables}
        className="btn h-9 min-h-0 gap-1.5 whitespace-nowrap px-2 text-xs sm:px-3"
        aria-label={`Table ${table.name}, mises de ${table.min} à ${table.max}. Changer de table`}
        aria-haspopup="dialog"
      >
        <TableIcon width={16} height={16} className="text-accent" />
        <span>{table.name}</span>
        <span className="hidden font-display tabular-nums text-muted md:inline">
          {formatCompact(table.min)}–{formatCompact(table.max)}
        </span>
        <span aria-hidden="true" className="text-muted">
          ▾
        </span>
      </button>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-4">
        <DailyRechargeButton />
        <BalanceCounter value={balance} />
        <div className="hidden items-center gap-2 sm:flex">
          <LevelBadge level={level.level} />
          <XpBar level={level.level} xp={level.xp} />
        </div>
        <nav className="flex items-center" aria-label="Navigation principale">
          <NavLink to="/training" className={navClass} aria-label="Entraînement au comptage">
            <TargetIcon />
          </NavLink>
          <NavLink to="/stats" className={navClass} aria-label="Statistiques et historique">
            <ChartIcon />
          </NavLink>
          <button
            type="button"
            className="btn-ghost h-10 min-h-0 w-9 px-0 text-muted sm:w-10"
            onClick={onOpenSettings}
            aria-label="Réglages"
          >
            <GearIcon />
          </button>
        </nav>
      </div>
    </header>
  );
}

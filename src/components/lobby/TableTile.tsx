import { formatCredits } from '../../config/chips';
import { unlockProgress } from '../../config/progression';
import type { TableTheme } from '../../config/tables';
import { isTableUnlocked } from '../../config/tables';
import { LockIcon } from '../icons';

export function TableTile({
  table,
  level,
  xp,
  current,
  onPlay,
  compact = false,
}: {
  table: TableTheme;
  level: number;
  xp: number;
  current: boolean;
  onPlay: () => void;
  compact?: boolean;
}) {
  const unlocked = isTableUnlocked(table, level);
  const progress = unlockProgress(level, xp, table.levelRequired);
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-panel transition-transform ${
        unlocked ? 'hover:-translate-y-0.5' : ''
      } ${current ? 'border-2' : 'border-border'}`}
      style={{
        background: `radial-gradient(ellipse at 50% 0%, ${table.felt[0]} 0%, ${table.felt[1]} 80%)`,
        borderColor: current ? table.accent : undefined,
        boxShadow: unlocked
          ? `0 0 0 1px ${table.accent}33, 0 10px 30px rgba(0,0,0,.35)`
          : undefined,
      }}
      aria-label={`Table ${table.name}`}
    >
      <div
        className="absolute inset-x-6 top-0 h-px"
        style={{ background: table.accent, boxShadow: `0 0 16px 2px ${table.accent}` }}
      />
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-bold" style={{ color: table.accent }}>
            {table.name}
          </h3>
          <p className="font-display text-sm tabular-nums text-text/90">
            {formatCredits(table.min)} – {formatCredits(table.max)} cr
          </p>
        </div>
        {!unlocked && (
          <span className="pill gap-1 bg-black/50 text-xs text-muted">
            <LockIcon width={14} height={14} /> Niv. {table.levelRequired}
          </span>
        )}
        {current && (
          <span className="pill bg-black/50 text-xs" style={{ color: table.accent }}>
            Table actuelle
          </span>
        )}
      </div>
      {!compact && <p className="mt-2 text-sm text-muted">{table.tagline}</p>}
      {!unlocked ? (
        <div className="mt-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-label={`Progression vers le niveau ${table.levelRequired}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${progress * 100}%`, background: table.accent }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Niveau {table.levelRequired} requis (vous êtes niveau {level})
          </p>
        </div>
      ) : (
        <button
          type="button"
          className="btn mt-4 w-full"
          style={{ borderColor: `${table.accent}88` }}
          onClick={onPlay}
          aria-label={
            current ? `Retourner à la table ${table.name}` : `Jouer à la table ${table.name}`
          }
        >
          {current ? 'Retour à la table' : 'Jouer ici'}
        </button>
      )}
    </article>
  );
}

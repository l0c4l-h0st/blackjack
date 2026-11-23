import { MAX_LEVEL, xpToNext } from '../../config/progression';

export function LevelBadge({ level }: { level: number }) {
  return (
    <span
      className="pill border border-accent/50 bg-accent-soft text-xs text-text"
      aria-label={`Niveau ${level}`}
    >
      Niv. {level}
    </span>
  );
}

export function XpBar({
  level,
  xp,
  compact = false,
}: {
  level: number;
  xp: number;
  compact?: boolean;
}) {
  const needed = xpToNext(level);
  const ratio = level >= MAX_LEVEL ? 1 : Math.min(1, xp / needed);
  return (
    <div className={`flex items-center gap-2 ${compact ? 'w-20' : 'w-28 sm:w-36'}`}>
      <div
        className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Expérience"
        aria-valuemin={0}
        aria-valuemax={needed}
        aria-valuenow={Math.min(xp, needed)}
        aria-valuetext={level >= MAX_LEVEL ? 'Niveau maximum' : `${xp} sur ${needed} XP`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-gold transition-[width] duration-700 ease-out"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

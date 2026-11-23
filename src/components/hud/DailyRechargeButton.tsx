import { useEffect, useState } from 'react';
import { formatCredits } from '../../config/chips';
import { RECHARGE_THRESHOLD, formatDuration, rechargeStatus } from '../../config/progression';
import { totalBets } from '../../engine/round';
import { useGameStore } from '../../store/gameStore';
import { useProfileStore } from '../../store/profileStore';
import { BoltIcon } from '../icons';

/** Recharge quotidienne : visible quand le solde passe sous 500 cr. */
export function DailyRechargeButton() {
  const engine = useGameStore((s) => s.engine);
  const claim = useGameStore((s) => s.claimRecharge);
  const level = useProfileStore((s) => s.level);
  const last = useProfileStore((s) => s.lastRechargeAt);
  const [now, setNow] = useState(() => Date.now());

  const pending = engine.phase === 'BETTING' ? totalBets(engine) : 0;
  const balance = engine.balance + pending;
  const status = rechargeStatus(balance, level, last, now);
  const low = balance < RECHARGE_THRESHOLD;

  useEffect(() => {
    if (!low || status.available) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [low, status.available]);

  if (!low) return null;
  if (status.available) {
    return (
      <button
        type="button"
        className="btn h-9 min-h-0 animate-pulse border-gold/60 bg-gold/15 px-3 text-gold hover:bg-gold/25"
        onClick={() => {
          claim();
          setNow(Date.now());
        }}
        aria-label={`Recharge quotidienne : recevoir ${formatCredits(status.amount)} crédits`}
      >
        <BoltIcon width={16} height={16} />
        <span className="hidden sm:inline">Recharge</span> +{formatCredits(status.amount)}
      </button>
    );
  }
  return (
    <span
      className="pill hidden border border-border bg-surface-2 text-xs font-medium text-muted md:inline-flex"
      aria-label={`Prochaine recharge dans ${formatDuration(status.remainingMs)}`}
    >
      Recharge dans {formatDuration(status.remainingMs)}
    </span>
  );
}

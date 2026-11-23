import {
  decksRemaining,
  estimatedPlayerEdge,
  roundCount,
  trueCount,
} from '../../engine/count/hiLo';
import { useGameStore } from '../../store/gameStore';

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`font-display text-2xl font-bold tabular-nums ${tone ?? 'text-text'}`}>
        {value}
      </dd>
    </div>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** Panneau de comptage Hi-Lo (cartes visibles uniquement). */
export function HiLoPanel() {
  const rc = useGameStore((s) => s.view.runningCount);
  const shoe = useGameStore((s) => s.view.shoe);
  const left = shoe.size - shoe.position;
  const decks = decksRemaining(left);
  const tc = roundCount(trueCount(rc, decks));
  const edge = estimatedPlayerEdge(tc);
  const tone = (n: number) => (n > 0 ? 'text-win' : n < 0 ? 'text-loss' : 'text-text');

  return (
    <section className="panel p-3" aria-labelledby="hilo-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="hilo-title" className="font-display text-sm font-bold uppercase tracking-widest">
          Comptage Hi-Lo
        </h2>
        <kbd aria-hidden="true" className="kbd">
          C
        </kbd>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Running count" value={signed(rc)} tone={tone(rc)} />
        <Stat label="True count" value={signed(tc)} tone={tone(tc)} />
        <Stat label="Decks restants" value={decks.toLocaleString('fr-FR')} />
        <Stat label="Cartes" value={String(left)} />
      </dl>
      <p className="mt-2 text-xs text-muted">
        Avantage joueur <span className="italic">(estimation)</span> :{' '}
        <strong className={`whitespace-nowrap font-display tabular-nums ${tone(edge)}`}>
          {edge > 0 ? '+' : ''}
          {edge.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
        </strong>
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted">
        2–6 : +1 · 7–9 : 0 · 10–As : −1. Seules les cartes visibles comptent ; remis à zéro au
        mélange.
      </p>
    </section>
  );
}

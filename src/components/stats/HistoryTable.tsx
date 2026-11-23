import { useId, useMemo, useState } from 'react';
import { formatCredits, formatSigned } from '../../config/chips';
import { TABLES } from '../../config/tables';
import type { HandRow, RoundOutcome } from '../../db/dexie';
import { formatTotal } from '../../engine/hand';
import type { HistoryFilter } from '../../stats/computeStats';
import { filterRows } from '../../stats/computeStats';
import { HandDetail } from './HandDetail';

const PAGE_SIZE = 15;
const OUTCOMES: { value: RoundOutcome | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'win', label: 'Gagnés' },
  { value: 'lose', label: 'Perdus' },
  { value: 'push', label: 'Nuls' },
];
const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

function dayStart(value: string): number | null {
  if (!value) return null;
  const t = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(t) ? null : t;
}

function dayEnd(value: string): number | null {
  const t = dayStart(value);
  return t === null ? null : t + 86_400_000 - 1;
}

/** Historique paginé et filtrable ; un clic ouvre le détail du tour. */
export function HistoryTable({
  rows,
  onExport,
}: {
  rows: HandRow[];
  onExport: (rows: HandRow[]) => void;
}) {
  const [tableId, setTableId] = useState('all');
  const [outcome, setOutcome] = useState<RoundOutcome | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<HandRow | null>(null);
  const ids = { table: useId(), outcome: useId(), from: useId(), to: useId() };

  const filtered = useMemo(() => {
    const filter: HistoryFilter = { tableId, outcome, from: dayStart(from), to: dayEnd(to) };
    return filterRows(rows, filter).sort((a, b) => b.timestamp - a.timestamp);
  }, [rows, tableId, outcome, from, to]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const reset = () => setPage(0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.table} className="text-xs text-muted">
            Table
          </label>
          <select
            id={ids.table}
            className="field"
            value={tableId}
            onChange={(e) => {
              setTableId(e.target.value);
              reset();
            }}
          >
            <option value="all">Toutes</option>
            {TABLES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.outcome} className="text-xs text-muted">
            Résultat
          </label>
          <select
            id={ids.outcome}
            className="field"
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value as RoundOutcome | 'all');
              reset();
            }}
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.from} className="text-xs text-muted">
            Du
          </label>
          <input
            id={ids.from}
            type="date"
            className="field"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              reset();
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.to} className="text-xs text-muted">
            Au
          </label>
          <input
            id={ids.to}
            type="date"
            className="field"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              reset();
            }}
          />
        </div>
        <button
          type="button"
          className="btn ml-auto"
          onClick={() => onExport(filtered)}
          disabled={filtered.length === 0}
        >
          Exporter en CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Historique des tours ({filtered.length})</caption>
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Date
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Table
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Mains
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Croupier
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Misé
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Net
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                <span className="sr-only">Détail</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.id ?? r.timestamp}
                className="border-t border-border hover:bg-surface-2/60"
              >
                <td className="py-2 pr-3 whitespace-nowrap text-muted">
                  {dateFmt.format(r.timestamp)}
                </td>
                <td className="py-2 pr-3">{r.tableName}</td>
                <td className="py-2 pr-3 font-display tabular-nums">
                  {r.seats.flatMap((s) => s.hands.map((h) => formatTotal(h.cards))).join(' · ')}
                </td>
                <td className="py-2 pr-3 font-display tabular-nums">
                  {formatTotal(r.dealerCards)}
                </td>
                <td className="py-2 pr-3 text-right font-display tabular-nums">
                  {formatCredits(r.totals.wagered)}
                </td>
                <td
                  className={`py-2 pr-3 text-right font-display tabular-nums ${r.totals.net > 0 ? 'text-win' : r.totals.net < 0 ? 'text-loss' : 'text-muted'}`}
                >
                  {formatSigned(r.totals.net)}
                </td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    className="btn-ghost h-8 min-h-0 px-2 text-xs text-accent"
                    onClick={() => setSelected(r)}
                    aria-label={`Détail du tour du ${dateFmt.format(r.timestamp)}`}
                  >
                    Détail
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
                  Aucun tour ne correspond aux filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav
        className="mt-3 flex items-center justify-between text-sm"
        aria-label="Pagination de l’historique"
      >
        <span className="text-muted">
          {filtered.length} tour{filtered.length > 1 ? 's' : ''} · page {current + 1} / {pages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn h-9 min-h-0"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Précédent
          </button>
          <button
            type="button"
            className="btn h-9 min-h-0"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Suivant
          </button>
        </div>
      </nav>
      <HandDetail row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

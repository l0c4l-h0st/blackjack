import { formatSigned } from '../../config/chips';
import type { ActionStat, StartTotalStat } from '../../stats/computeStats';

const pct = (n: number, d: number) =>
  d === 0 ? '—' : `${((n / d) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

const netClass = (n: number) => (n > 0 ? 'text-win' : n < 0 ? 'text-loss' : 'text-muted');

/** Taux de réussite par action (doubles, splits, abandons…). */
export function ActionStatsTable({ actions }: { actions: ActionStat[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Résultats par action</caption>
        <thead className="text-left text-xs uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className="py-2 pr-3 font-semibold">
              Action
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">
              Mains
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">
              Gagnées
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">
              Perdues
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">
              Égalités
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              Net
            </th>
          </tr>
        </thead>
        <tbody className="font-display tabular-nums">
          {actions.map((a) => (
            <tr key={a.action} className="border-t border-border">
              <th scope="row" className="py-2 pr-3 text-left font-sans font-medium">
                {a.label}
              </th>
              <td className="py-2 pr-3 text-right">{a.hands}</td>
              <td className="py-2 pr-3 text-right">{pct(a.wins, a.hands)}</td>
              <td className="py-2 pr-3 text-right">{pct(a.losses, a.hands)}</td>
              <td className="py-2 pr-3 text-right">{pct(a.pushes, a.hands)}</td>
              <td className={`py-2 text-right ${netClass(a.net)}`}>{formatSigned(a.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Résultats selon le total des deux premières cartes. */
export function StartTotalsTable({ totals }: { totals: StartTotalStat[] }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Résultats par total de départ</caption>
        <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className="py-2 pr-3 font-semibold">
              Départ
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">
              Mains
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">
              Victoires
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              Net
            </th>
          </tr>
        </thead>
        <tbody className="font-display tabular-nums">
          {totals.map((t) => (
            <tr key={t.label} className="border-t border-border">
              <th scope="row" className="py-1.5 pr-3 text-left font-semibold">
                {t.label}
              </th>
              <td className="py-1.5 pr-3 text-right">{t.hands}</td>
              <td className="py-1.5 pr-3 text-right">{pct(t.wins, t.hands)}</td>
              <td className={`py-1.5 text-right ${netClass(t.net)}`}>{formatSigned(t.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { StatsSummary } from '../../stats/computeStats';
import { CHART } from './chartTheme';

const pct = (x: number) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

/** Répartition victoires / défaites / égalités / abandons. */
export function ResultsDonut({ stats }: { stats: StatsSummary }) {
  const data = [
    { name: 'Victoires', value: stats.results.win, color: CHART.win },
    { name: 'Défaites', value: stats.results.loss, color: CHART.loss },
    { name: 'Égalités', value: stats.results.push, color: CHART.muted },
    { name: 'Abandons', value: stats.results.surrender, color: CHART.gold },
  ];
  const total = Math.max(1, stats.hands);
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative h-48 w-48 shrink-0"
        role="img"
        aria-label={`Taux de victoire ${pct(stats.winRate)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="95%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              {...CHART.tooltip}
              formatter={(v: number, n: string) => [`${v} (${pct(v / total)})`, n]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold tabular-nums">{pct(stats.winRate)}</span>
          <span className="text-xs text-muted">victoires</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 whitespace-nowrap text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ background: d.color }}
                aria-hidden="true"
              />
              {d.name}
            </span>
            <span className="font-display tabular-nums text-muted">
              {d.value} · {pct(d.value / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

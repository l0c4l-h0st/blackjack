import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DrillPoint } from '../../stats/computeStats';
import { CHART } from './chartTheme';

const LABELS = {
  quiz: 'Quiz en jeu',
  stream: 'Défilé de cartes',
  trueCount: 'True count',
} as const;
const COLORS = { quiz: CHART.accent, stream: CHART.win, trueCount: CHART.gold } as const;

/** Précision glissante (10 derniers essais) des exercices de comptage. */
export function CountAccuracyChart({ points }: { points: DrillPoint[] }) {
  const maxIndex = points.reduce((m, p) => Math.max(m, p.index), 0);
  const data = Array.from({ length: maxIndex }, (_, i) => {
    const row: Record<string, number> = { index: i + 1 };
    for (const p of points) if (p.index === i + 1) row[p.kind] = Math.round(p.accuracy * 100);
    return row;
  });
  const kinds = (Object.keys(LABELS) as (keyof typeof LABELS)[]).filter((k) =>
    points.some((p) => p.kind === k),
  );
  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label="Précision des exercices de comptage dans le temps"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="index" stroke={CHART.axis} tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            unit=" %"
            stroke={CHART.axis}
            tick={{ fontSize: 11 }}
            width={48}
            tickLine={false}
          />
          <Tooltip
            {...CHART.tooltip}
            labelFormatter={(v) => `Essai ${String(v)}`}
            formatter={(v: number, k: string) => [`${v} %`, LABELS[k as keyof typeof LABELS]]}
          />
          <Legend
            formatter={(k: string) => LABELS[k as keyof typeof LABELS]}
            wrapperStyle={{ fontSize: 12 }}
          />
          {kinds.map((k) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={COLORS[k]}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

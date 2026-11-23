import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompact, formatCredits } from '../../config/chips';
import type { StatsSummary } from '../../stats/computeStats';
import { CHART } from './chartTheme';

const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/** Courbe du solde après chaque tour (zoom avec la barre du bas). */
export function BalanceChart({ data }: { data: StatsSummary['balance'] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label={`Courbe du solde sur ${data.length} tours`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={CHART.accent} stopOpacity={0.45} />
              <stop offset="1" stopColor={CHART.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="round" stroke={CHART.axis} tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis
            stroke={CHART.axis}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatCompact(v)}
            width={56}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip
            {...CHART.tooltip}
            labelFormatter={(_, payload) => {
              const p = payload[0]?.payload as { t: number; round: number } | undefined;
              return p ? `Tour ${p.round} · ${dateFmt.format(p.t)}` : '';
            }}
            formatter={(v: number) => [`${formatCredits(v)} cr`, 'Solde']}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={CHART.accent}
            strokeWidth={2}
            fill="url(#balance-fill)"
            isAnimationActive={false}
          />
          {data.length > 20 && (
            <Brush
              dataKey="round"
              height={22}
              stroke={CHART.accent}
              fill="#121826"
              travellerWidth={8}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

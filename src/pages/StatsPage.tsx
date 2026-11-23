import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ActionStatsTable, StartTotalsTable } from '../components/stats/ActionStatsTable';
import { BalanceChart } from '../components/stats/BalanceChart';
import { CountAccuracyChart } from '../components/stats/CountAccuracyChart';
import { HistoryTable } from '../components/stats/HistoryTable';
import { KpiTile } from '../components/stats/KpiTile';
import { ResultsDonut } from '../components/stats/ResultsDonut';
import { SESSION_START } from '../config/app';
import { formatCredits, formatSigned } from '../config/chips';
import type { DrillRow, HandRow } from '../db/dexie';
import { allDrills, allHands } from '../db/dexie';
import {
  SIDE_BET_NAMES,
  theoreticalPerfectPairs,
  theoreticalTwentyOnePlus3,
} from '../engine/sideBets';
import type { SideBetKind } from '../engine/types';
import type { Period } from '../stats/computeStats';
import {
  computeStats,
  drillAccuracy,
  drillSummary,
  outcomeLabel,
  periodStart,
  toCsv,
} from '../stats/computeStats';

const pct = (x: number, digits = 1) =>
  `${(x * 100).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;

const PERIODS: { value: Period; label: string }[] = [
  { value: 'session', label: 'Session' },
  { value: '7d', label: '7 jours' },
  { value: 'all', label: 'Tout' },
];

const THEORY: Record<SideBetKind, number> = {
  perfectPairs: theoreticalPerfectPairs(6).rtp,
  twentyOnePlus3: theoreticalTwentyOnePlus3(6).rtp,
};

function Card({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel p-4 sm:p-5 ${className}`}>
      <h2 className="mb-3 font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function downloadCsv(rows: HandRow[]): void {
  // BOM UTF-8 pour l'ouverture directe dans un tableur.
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nocturne21-historique-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function StatsPage() {
  const [rows, setRows] = useState<HandRow[] | null>(null);
  const [drills, setDrills] = useState<DrillRow[]>([]);
  const [period, setPeriod] = useState<Period>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([allHands(), allDrills()])
      .then(([h, d]) => {
        if (!alive) return;
        setRows(h);
        setDrills(d);
      })
      .catch(
        () => alive && setError('Historique indisponible (IndexedDB bloqué par le navigateur ?).'),
      );
    return () => {
      alive = false;
    };
  }, []);

  const scoped = useMemo(() => {
    const from = periodStart(period, Date.now(), SESSION_START);
    return (rows ?? []).filter((r) => from === null || r.timestamp >= from);
  }, [rows, period]);
  const scopedDrills = useMemo(() => {
    const from = periodStart(period, Date.now(), SESSION_START);
    return drills.filter((d) => from === null || d.timestamp >= from);
  }, [drills, period]);
  const stats = useMemo(() => computeStats(scoped), [scoped]);
  const drillStats = useMemo(() => drillSummary(scopedDrills), [scopedDrills]);
  const accuracy = useMemo(() => drillAccuracy(scopedDrills), [scopedDrills]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Statistiques</h1>
            <p className="text-muted">
              Toutes les mains sont enregistrées localement dans votre navigateur.
            </p>
          </div>
          <div
            className="flex gap-1 rounded-xl bg-surface-2 p-1"
            role="radiogroup"
            aria-label="Période"
          >
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={period === p.value}
                onClick={() => setPeriod(p.value)}
                className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold ${
                  period === p.value ? 'bg-accent-strong text-white' : 'text-muted hover:text-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        {error && <p className="panel p-4 text-loss">{error}</p>}
        {rows === null && !error && (
          <p className="text-muted" role="status">
            Chargement de l’historique…
          </p>
        )}
        {rows !== null && scoped.length === 0 && (
          <div className="panel flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-muted">Aucune main jouée sur cette période.</p>
            <Link to="/" className="btn-primary">
              Aller à la table
            </Link>
          </div>
        )}

        {scoped.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiTile
                label="Mains jouées"
                value={formatCredits(stats.hands)}
                hint={`${formatCredits(stats.rounds)} tours`}
              />
              <KpiTile
                label="Taux de victoire"
                value={pct(stats.winRate)}
                hint="mains gagnées / mains"
              />
              <KpiTile
                label="Profit net"
                value={formatSigned(stats.net)}
                tone={stats.net > 0 ? 'win' : stats.net < 0 ? 'loss' : 'default'}
                hint={`${formatCredits(stats.wagered)} cr misés`}
              />
              <KpiTile label="RTP réel" value={pct(stats.rtp, 2)} hint="total rendu / total misé" />
              <KpiTile
                label="Blackjacks"
                value={formatCredits(stats.blackjacks)}
                tone="gold"
                hint={stats.hands > 0 ? pct(stats.blackjacks / stats.hands) : undefined}
              />
              <KpiTile
                label="Plus gros gain"
                value={formatSigned(stats.biggestWin)}
                tone="win"
                hint="sur un tour"
              />
              <KpiTile
                label="Série de victoires"
                value={stats.longestWinStreak}
                hint="tours consécutifs"
              />
              <KpiTile
                label="Série de défaites"
                value={stats.longestLossStreak}
                hint="tours consécutifs"
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <Card title="Évolution du solde" className="lg:col-span-2">
                <BalanceChart data={stats.balance} />
              </Card>
              <Card title="Résultats des mains">
                <ResultsDonut stats={stats} />
              </Card>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Par action">
                <ActionStatsTable actions={stats.actions} />
                {stats.insurance.taken > 0 && (
                  <p className="mt-3 text-sm text-muted">
                    Assurance prise {stats.insurance.taken} fois, gagnée {stats.insurance.won} fois
                    (RTP {pct(stats.insurance.returned / Math.max(1, stats.insurance.wagered))}).
                  </p>
                )}
              </Card>
              <Card title="Par total de départ">
                <StartTotalsTable totals={stats.startTotals} />
              </Card>
            </div>

            <Card title="Side bets">
              <div className="grid gap-4 md:grid-cols-2">
                {(['perfectPairs', 'twentyOnePlus3'] as const).map((k) => {
                  const s = stats.sideBets[k];
                  return (
                    <div key={k} className="rounded-xl border border-border p-4">
                      <h3 className="font-display font-bold">{SIDE_BET_NAMES[k]}</h3>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <dt className="text-muted">Paris</dt>
                        <dd className="text-right font-display tabular-nums">{s.bets}</dd>
                        <dt className="text-muted">Misé / rendu</dt>
                        <dd className="text-right font-display tabular-nums">
                          {formatCredits(s.wagered)} / {formatCredits(s.returned)}
                        </dd>
                        <dt className="text-muted">RTP réel</dt>
                        <dd className="text-right font-display tabular-nums">
                          {s.wagered > 0 ? pct(s.returned / s.wagered) : '—'}
                        </dd>
                        <dt className="text-muted">RTP théorique</dt>
                        <dd className="text-right font-display tabular-nums">
                          {pct(THEORY[k], 2)}
                        </dd>
                      </dl>
                      <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
                        {Object.entries(s.outcomes).map(([o, n]) => (
                          <li key={o} className="pill bg-gold/15 text-gold">
                            {outcomeLabel(o as Parameters<typeof outcomeLabel>[0])} × {n}
                          </li>
                        ))}
                        {s.wins === 0 && (
                          <li className="text-muted">Aucune combinaison gagnante.</li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}

        {rows !== null && (
          <Card title="Comptage Hi-Lo">
            <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
              {(
                [
                  ['quiz', 'Quiz en jeu'],
                  ['stream', 'Défilé de cartes'],
                  ['trueCount', 'True count'],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="rounded-xl bg-surface-2 p-3">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="font-display text-xl font-bold tabular-nums">
                    {drillStats[k].tries > 0
                      ? pct(drillStats[k].correct / drillStats[k].tries, 0)
                      : '—'}
                  </p>
                  <p className="text-xs text-muted">
                    {drillStats[k].tries} essai{drillStats[k].tries > 1 ? 's' : ''}
                    {drillStats[k].tries > 0 &&
                      ` · ${(drillStats[k].avgMs / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`}
                  </p>
                </div>
              ))}
            </div>
            {accuracy.length > 0 ? (
              <CountAccuracyChart points={accuracy} />
            ) : (
              <p className="text-sm text-muted">
                Activez le quiz dans les réglages ou faites un exercice dans{' '}
                <Link to="/training" className="text-accent-light underline underline-offset-4">
                  l’entraînement
                </Link>
                .
              </p>
            )}
          </Card>
        )}

        {rows !== null && rows.length > 0 && (
          <Card title="Historique">
            <HistoryTable rows={rows} onExport={downloadCsv} />
          </Card>
        )}
      </div>
    </div>
  );
}

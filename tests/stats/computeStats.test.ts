import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../../src/config/rules';
import type { DrillRow, HandRow } from '../../src/db/dexie';
import { roundOutcome } from '../../src/db/dexie';
import { applyAction, createGame } from '../../src/engine/round';
import { SeededRng } from '../../src/engine/rng';
import { decideAction } from '../../src/engine/strategy/basic';
import type { RoundSummary } from '../../src/engine/types';
import {
  classifyResult,
  computeStats,
  drillAccuracy,
  drillSummary,
  filterRows,
  mainAction,
  periodStart,
  toCsv,
} from '../../src/stats/computeStats';
import { dealRigged, play } from '../engine/helpers';

function rowFrom(summary: RoundSummary, timestamp: number): HandRow {
  return { ...summary, timestamp, tableName: 'Néon', outcome: roundOutcome(summary.totals.net) };
}

function simulateRows(n: number): HandRow[] {
  const rng = new SeededRng(4);
  let s = createGame({
    rules: DEFAULT_RULES,
    table: { id: 'neon', min: 10, max: 1000 },
    balance: 100_000,
    rng,
  });
  const rows: HandRow[] = [];
  let t = 1_000;
  while (rows.length < n) {
    let r = applyAction(s, { type: 'PLACE_BET', seat: 0, spot: 'main', amount: 100 }, { rng });
    r = applyAction(
      r.state,
      { type: 'PLACE_BET', seat: 0, spot: 'perfectPairs', amount: 10 },
      { rng },
    );
    r = applyAction(r.state, { type: 'DEAL' }, { rng });
    s = r.state;
    let events = r.events;
    for (;;) {
      for (const e of events)
        if (e.type === 'ROUND_END') rows.push(rowFrom(e.summary, (t += 1000)));
      if (s.phase === 'ROUND_END') break;
      const x = applyAction(s, decideAction(s), { rng });
      s = x.state;
      events = x.events;
    }
  }
  return rows;
}

describe('statistiques', () => {
  const rows = simulateRows(400);
  const stats = computeStats(rows);

  it('agrège tours, mains et résultats', () => {
    expect(stats.rounds).toBe(400);
    expect(stats.hands).toBeGreaterThanOrEqual(400);
    const sum =
      stats.results.win + stats.results.loss + stats.results.push + stats.results.surrender;
    expect(sum).toBe(stats.hands);
    expect(stats.winRate).toBeGreaterThan(0.3);
    expect(stats.winRate).toBeLessThan(0.6);
  });

  it('net, RTP et courbe de solde cohérents', () => {
    expect(stats.net).toBe(rows.reduce((t, r) => t + r.totals.net, 0));
    expect(stats.returned - stats.wagered).toBe(stats.net);
    expect(stats.rtp).toBeCloseTo(stats.returned / stats.wagered, 10);
    expect(stats.balance).toHaveLength(400);
    expect(stats.balance.at(-1)?.balance).toBe(rows.at(-1)?.balanceAfter);
    expect(stats.longestWinStreak).toBeGreaterThan(0);
    expect(stats.longestLossStreak).toBeGreaterThan(0);
    expect(stats.biggestWin).toBeGreaterThan(0);
  });

  it('tableaux par action, total de départ et side bets', () => {
    const totalByAction = stats.actions.reduce((t, a) => t + a.hands, 0);
    expect(totalByAction).toBe(stats.hands);
    expect(stats.actions.find((a) => a.action === 'double')?.hands).toBeGreaterThan(0);
    expect(stats.startTotals.length).toBeGreaterThan(10);
    const pp = stats.sideBets.perfectPairs;
    expect(pp.bets).toBe(400);
    expect(pp.wagered).toBe(4000);
    expect(stats.sideBets.twentyOnePlus3.bets).toBe(0);
  });

  it('filtre par table, résultat et date', () => {
    const wins = filterRows(rows, { tableId: 'all', outcome: 'win', from: null, to: null });
    expect(wins.every((r) => r.totals.net > 0)).toBe(true);
    expect(
      filterRows(rows, { tableId: 'onyx', outcome: 'all', from: null, to: null }),
    ).toHaveLength(0);
    const t0 = rows[100]?.timestamp ?? 0;
    expect(filterRows(rows, { tableId: 'neon', outcome: 'all', from: t0, to: null })).toHaveLength(
      300,
    );
    expect(filterRows(rows, { tableId: 'all', outcome: 'all', from: null, to: t0 })).toHaveLength(
      101,
    );
  });

  it('période', () => {
    expect(periodStart('all', 10, 5)).toBeNull();
    expect(periodStart('session', 10, 5)).toBe(5);
    expect(periodStart('7d', 8 * 86_400_000, 0)).toBe(86_400_000);
  });

  it('export CSV : une ligne par main, valeurs échappées', () => {
    const csv = toCsv(rows.slice(0, 20));
    const lines = csv.split('\n');
    const hands = rows
      .slice(0, 20)
      .reduce((t, r) => t + r.seats.reduce((u, s) => u + s.hands.length, 0), 0);
    expect(lines).toHaveLength(hands + 1);
    expect(lines[0]?.startsWith('date;table;')).toBe(true);
    const odd = { ...rows[0], tableName: 'Table "x"; test' } as HandRow;
    expect(toCsv([odd])).toContain('"Table ""x""; test"');
  });

  it('classe les résultats et les actions', () => {
    expect(classifyResult('blackjack')).toBe('win');
    expect(classifyResult('evenMoney')).toBe('win');
    expect(classifyResult('bust')).toBe('loss');
    expect(classifyResult('push')).toBe('push');
    expect(classifyResult('surrender')).toBe('surrender');
    expect(mainAction(['hit', 'stand'], false)).toBe('hit');
    expect(mainAction(['stand'], false)).toBe('stand');
    expect(mainAction([], false)).toBe('none');
    expect(mainAction(['stand'], true)).toBe('split');
    expect(mainAction(['split', 'double'], true)).toBe('double');
    expect(mainAction(['surrender'], false)).toBe('surrender');
  });

  it('compte assurance et blackjack poussé', () => {
    const pushBJ = dealRigged('AS KH KD AC').events.find((e) => e.type === 'ROUND_END');
    const insured = play(dealRigged('TS AH 9D KC').state, [
      { type: 'INSURANCE', take: true },
      { type: 'STAND' },
    ]).events.find((e) => e.type === 'ROUND_END');
    if (pushBJ?.type !== 'ROUND_END' || insured?.type !== 'ROUND_END') throw new Error('ROUND_END');
    const s = computeStats([rowFrom(pushBJ.summary, 1), rowFrom(insured.summary, 2)]);
    expect(s.blackjacks).toBe(1);
    expect(s.insurance).toEqual({ taken: 1, won: 1, wagered: 50, returned: 150 });
    expect(computeStats([]).rtp).toBe(0);
  });
});

describe('exercices de comptage', () => {
  const drills: DrillRow[] = [
    { timestamp: 1, kind: 'quiz', correct: true, expected: 2, answer: 2, responseMs: 1000 },
    { timestamp: 2, kind: 'quiz', correct: false, expected: 3, answer: 2, responseMs: 3000 },
    {
      timestamp: 3,
      kind: 'stream',
      correct: true,
      expected: -1,
      answer: -1,
      responseMs: 2000,
      speedMs: 500,
      cards: 52,
    },
  ];

  it('précision glissante par type', () => {
    const points = drillAccuracy(drills);
    expect(points.filter((p) => p.kind === 'quiz').map((p) => p.accuracy)).toEqual([1, 0.5]);
    expect(points.find((p) => p.kind === 'stream')?.accuracy).toBe(1);
  });

  it('résumé par type', () => {
    const s = drillSummary(drills);
    expect(s.quiz).toEqual({ tries: 2, correct: 1, avgMs: 2000 });
    expect(s.trueCount.tries).toBe(0);
  });
});

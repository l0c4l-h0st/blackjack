/**
 * Calcul des statistiques à partir de l'historique Dexie (fonctions pures, testées).
 */
import { formatTotal, handValue } from '../engine/hand';
import { SIDE_BET_OUTCOME_LABELS } from '../engine/sideBets';
import type { HandResult, PlayerMove, SideBetKind, SideBetOutcome } from '../engine/types';
import type { DrillKind, DrillRow, HandRow, RoundOutcome } from '../db/dexie';

export type HandClass = 'win' | 'loss' | 'push' | 'surrender';

export function classifyResult(result: HandResult): HandClass {
  switch (result) {
    case 'win':
    case 'blackjack':
    case 'evenMoney':
      return 'win';
    case 'lose':
    case 'bust':
      return 'loss';
    case 'push':
      return 'push';
    case 'surrender':
      return 'surrender';
  }
}

export interface ActionStat {
  action: PlayerMove | 'none';
  label: string;
  hands: number;
  wins: number;
  losses: number;
  pushes: number;
  net: number;
}

export interface StartTotalStat {
  label: string;
  order: number;
  hands: number;
  wins: number;
  net: number;
}

export interface SideBetStat {
  kind: SideBetKind;
  bets: number;
  wagered: number;
  returned: number;
  wins: number;
  outcomes: Partial<Record<SideBetOutcome, number>>;
}

export interface StatsSummary {
  rounds: number;
  hands: number;
  results: Record<HandClass, number>;
  winRate: number;
  net: number;
  wagered: number;
  returned: number;
  rtp: number;
  blackjacks: number;
  biggestWin: number;
  longestWinStreak: number;
  longestLossStreak: number;
  balance: { t: number; balance: number; round: number }[];
  actions: ActionStat[];
  startTotals: StartTotalStat[];
  sideBets: Record<SideBetKind, SideBetStat>;
  insurance: { taken: number; won: number; wagered: number; returned: number };
}

const ACTION_LABELS: Record<ActionStat['action'], string> = {
  double: 'Doubles',
  split: 'Mains splittées',
  surrender: 'Abandons',
  hit: 'Tirages (au moins une carte)',
  stand: 'Restées sur 2 cartes',
  none: 'Sans décision (BJ, 21…)',
};

function emptySide(kind: SideBetKind): SideBetStat {
  return { kind, bets: 0, wagered: 0, returned: 0, wins: 0, outcomes: {} };
}

/** Catégorie d'action d'une main pour le tableau « par action ». */
export function mainAction(
  actions: readonly PlayerMove[],
  fromSplit: boolean,
): ActionStat['action'] {
  if (actions.includes('surrender')) return 'surrender';
  if (actions.includes('double')) return 'double';
  if (fromSplit) return 'split';
  if (actions.includes('hit')) return 'hit';
  if (actions.includes('stand')) return 'stand';
  return 'none';
}

export function computeStats(rows: readonly HandRow[]): StatsSummary {
  const results: Record<HandClass, number> = { win: 0, loss: 0, push: 0, surrender: 0 };
  const actions = new Map<ActionStat['action'], ActionStat>();
  const totals = new Map<string, StartTotalStat>();
  const sideBets: Record<SideBetKind, SideBetStat> = {
    perfectPairs: emptySide('perfectPairs'),
    twentyOnePlus3: emptySide('twentyOnePlus3'),
  };
  const insurance = { taken: 0, won: 0, wagered: 0, returned: 0 };
  let hands = 0;
  let net = 0;
  let wagered = 0;
  let returned = 0;
  let blackjacks = 0;
  let biggestWin = 0;
  let winStreak = 0;
  let lossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  const balance: StatsSummary['balance'] = [];

  const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp);
  sorted.forEach((row, i) => {
    net += row.totals.net;
    wagered += row.totals.wagered;
    returned += row.totals.returned;
    biggestWin = Math.max(biggestWin, row.totals.net);
    balance.push({ t: row.timestamp, balance: row.balanceAfter, round: i + 1 });
    if (row.totals.net > 0) {
      winStreak += 1;
      lossStreak = 0;
    } else if (row.totals.net < 0) {
      lossStreak += 1;
      winStreak = 0;
    } else {
      winStreak = 0;
      lossStreak = 0;
    }
    longestWinStreak = Math.max(longestWinStreak, winStreak);
    longestLossStreak = Math.max(longestLossStreak, lossStreak);

    for (const seat of row.seats) {
      for (const h of seat.hands) {
        hands += 1;
        const cls = classifyResult(h.result);
        results[cls] += 1;
        if (
          h.result === 'blackjack' ||
          h.result === 'evenMoney' ||
          (h.result === 'push' &&
            h.cards.length === 2 &&
            !h.fromSplit &&
            handValue(h.cards).total === 21)
        ) {
          blackjacks += 1;
        }
        const key = mainAction(h.actions, h.fromSplit);
        const a = actions.get(key) ?? {
          action: key,
          label: ACTION_LABELS[key],
          hands: 0,
          wins: 0,
          losses: 0,
          pushes: 0,
          net: 0,
        };
        a.hands += 1;
        a.net += h.net;
        if (cls === 'win') a.wins += 1;
        else if (cls === 'loss' || cls === 'surrender') a.losses += 1;
        else a.pushes += 1;
        actions.set(key, a);

        if (!h.fromSplit && h.cards.length >= 2) {
          const start = h.cards.slice(0, 2);
          const v = handValue(start);
          const label = v.total === 21 ? 'Blackjack' : formatTotal(start);
          const order = v.total === 21 ? 100 : v.soft ? 50 + v.total : v.total;
          const t = totals.get(label) ?? { label, order, hands: 0, wins: 0, net: 0 };
          t.hands += 1;
          t.net += h.net;
          if (cls === 'win') t.wins += 1;
          totals.set(label, t);
        }
      }
      for (const side of [seat.sideBets.perfectPairs, seat.sideBets.twentyOnePlus3]) {
        if (!side) continue;
        const s = sideBets[side.kind];
        s.bets += 1;
        s.wagered += side.stake;
        s.returned += side.payout;
        if (side.payout > 0 && side.outcome) {
          s.wins += 1;
          s.outcomes[side.outcome] = (s.outcomes[side.outcome] ?? 0) + 1;
        }
      }
      if (seat.insurance.decision === 'taken') {
        insurance.taken += 1;
        insurance.wagered += seat.insurance.amount;
        insurance.returned += seat.insurance.payout;
        if (seat.insurance.payout > 0) insurance.won += 1;
      }
    }
  });

  const decided = results.win + results.loss + results.push + results.surrender;
  const ORDER: ActionStat['action'][] = ['double', 'split', 'surrender', 'hit', 'stand', 'none'];
  return {
    rounds: rows.length,
    hands,
    results,
    winRate: decided > 0 ? results.win / decided : 0,
    net,
    wagered,
    returned,
    rtp: wagered > 0 ? returned / wagered : 0,
    blackjacks,
    biggestWin,
    longestWinStreak,
    longestLossStreak,
    balance,
    actions: ORDER.flatMap((k) => {
      const a = actions.get(k);
      return a ? [a] : [];
    }),
    startTotals: [...totals.values()].sort((a, b) => a.order - b.order),
    sideBets,
    insurance,
  };
}

export type Period = 'session' | '7d' | 'all';

export interface HistoryFilter {
  /** Identifiant de table, ou « all ». */
  tableId: string;
  outcome: RoundOutcome | 'all';
  from: number | null;
  to: number | null;
}

export function filterRows(rows: readonly HandRow[], filter: HistoryFilter): HandRow[] {
  return rows.filter(
    (r) =>
      (filter.tableId === 'all' || r.tableId === filter.tableId) &&
      (filter.outcome === 'all' || r.outcome === filter.outcome) &&
      (filter.from === null || r.timestamp >= filter.from) &&
      (filter.to === null || r.timestamp <= filter.to),
  );
}

export function periodStart(period: Period, now: number, sessionStart: number): number | null {
  if (period === 'session') return sessionStart;
  if (period === '7d') return now - 7 * 24 * 60 * 60 * 1000;
  return null;
}

const cardText = (c: { rank: string; suit: string }) => `${c.rank}${c.suit}`;

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export CSV : une ligne par main (séparateur « ; », compatible tableurs français). */
export function toCsv(rows: readonly HandRow[]): string {
  const header = [
    'date',
    'table',
    'sabot',
    'tour',
    'place',
    'main',
    'cartes',
    'actions',
    'mise',
    'resultat',
    'net_main',
    'perfect_pairs',
    'pp_gain',
    'vingt_et_un_plus_3',
    'tp_gain',
    'assurance',
    'assurance_gain',
    'croupier',
    'total_croupier',
    'net_tour',
    'solde_avant',
    'solde_apres',
    'rc_debut',
    'tc_debut',
  ];
  const lines = [header.join(';')];
  for (const r of rows) {
    for (const seat of r.seats) {
      seat.hands.forEach((h, i) => {
        lines.push(
          [
            new Date(r.timestamp).toISOString(),
            r.tableName,
            r.shoeId,
            r.numberInShoe,
            seat.seat + 1,
            i + 1,
            h.cards.map(cardText).join(' '),
            h.actions.join(' '),
            h.bet,
            h.result,
            h.net,
            seat.bets.perfectPairs,
            seat.sideBets.perfectPairs?.payout ?? 0,
            seat.bets.twentyOnePlus3,
            seat.sideBets.twentyOnePlus3?.payout ?? 0,
            seat.insurance.amount,
            seat.insurance.payout,
            r.dealerCards.map(cardText).join(' '),
            r.dealerTotal,
            r.totals.net,
            r.balanceBefore,
            r.balanceAfter,
            r.rcStart,
            Math.round(r.tcStart * 10) / 10,
          ]
            .map(csvCell)
            .join(';'),
        );
      });
    }
  }
  return lines.join('\n');
}

export interface DrillPoint {
  index: number;
  t: number;
  accuracy: number;
  kind: DrillKind;
}

/** Précision glissante (fenêtre de 10 essais) par type d'exercice. */
export function drillAccuracy(drills: readonly DrillRow[], window = 10): DrillPoint[] {
  const byKind = new Map<DrillKind, DrillRow[]>();
  for (const d of [...drills].sort((a, b) => a.timestamp - b.timestamp)) {
    const list = byKind.get(d.kind) ?? [];
    list.push(d);
    byKind.set(d.kind, list);
  }
  const points: DrillPoint[] = [];
  for (const [kind, list] of byKind) {
    list.forEach((d, i) => {
      const slice = list.slice(Math.max(0, i - window + 1), i + 1);
      points.push({
        index: i + 1,
        t: d.timestamp,
        kind,
        accuracy: slice.filter((x) => x.correct).length / slice.length,
      });
    });
  }
  return points;
}

export function drillSummary(
  drills: readonly DrillRow[],
): Record<DrillKind, { tries: number; correct: number; avgMs: number }> {
  const out: Record<DrillKind, { tries: number; correct: number; avgMs: number }> = {
    quiz: { tries: 0, correct: 0, avgMs: 0 },
    stream: { tries: 0, correct: 0, avgMs: 0 },
    trueCount: { tries: 0, correct: 0, avgMs: 0 },
  };
  for (const d of drills) {
    const s = out[d.kind];
    s.avgMs = (s.avgMs * s.tries + d.responseMs) / (s.tries + 1);
    s.tries += 1;
    if (d.correct) s.correct += 1;
  }
  return out;
}

export function outcomeLabel(outcome: SideBetOutcome): string {
  return SIDE_BET_OUTCOME_LABELS[outcome];
}

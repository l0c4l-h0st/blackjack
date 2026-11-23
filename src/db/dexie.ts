/**
 * Base IndexedDB (Dexie) : historique des tours (`hands`) et exercices de comptage
 * (`countDrills`). Chargée à la demande pour ne pas alourdir le bundle initial.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { RoundSummary } from '../engine/types';

export type RoundOutcome = 'win' | 'lose' | 'push';

export interface HandRow extends RoundSummary {
  id?: number;
  timestamp: number;
  tableName: string;
  outcome: RoundOutcome;
}

export type DrillKind = 'quiz' | 'stream' | 'trueCount';

export interface DrillRow {
  id?: number;
  timestamp: number;
  kind: DrillKind;
  correct: boolean;
  expected: number;
  answer: number;
  responseMs: number;
  /** Vitesse de défilement (ms par carte) pour le drill « défilé ». */
  speedMs?: number;
  /** Nombre de cartes montrées. */
  cards?: number;
}

class NocturneDb extends Dexie {
  hands!: EntityTable<HandRow, 'id'>;
  countDrills!: EntityTable<DrillRow, 'id'>;

  constructor() {
    super('nocturne21');
    this.version(1).stores({
      hands: '++id, timestamp, tableId, outcome',
      countDrills: '++id, timestamp, kind',
    });
  }
}

export const db = new NocturneDb();

export function roundOutcome(net: number): RoundOutcome {
  if (net > 0) return 'win';
  if (net < 0) return 'lose';
  return 'push';
}

export async function recordRound(
  summary: RoundSummary,
  tableName: string,
  timestamp = Date.now(),
): Promise<number> {
  const row: HandRow = {
    ...summary,
    timestamp,
    tableName,
    outcome: roundOutcome(summary.totals.net),
  };
  return (await db.hands.add(row)) as number;
}

export async function recordDrill(row: Omit<DrillRow, 'id'>): Promise<number> {
  return (await db.countDrills.add(row)) as number;
}

export async function allHands(): Promise<HandRow[]> {
  return db.hands.orderBy('timestamp').toArray();
}

export async function allDrills(): Promise<DrillRow[]> {
  return db.countDrills.orderBy('timestamp').toArray();
}

export interface HistoryDump {
  hands: HandRow[];
  countDrills: DrillRow[];
}

export async function exportHistory(): Promise<HistoryDump> {
  return { hands: await allHands(), countDrills: await allDrills() };
}

export async function replaceHistory(dump: HistoryDump): Promise<void> {
  await db.transaction('rw', db.hands, db.countDrills, async () => {
    await db.hands.clear();
    await db.countDrills.clear();
    await db.hands.bulkAdd(dump.hands.map(({ id: _id, ...row }) => row));
    await db.countDrills.bulkAdd(dump.countDrills.map(({ id: _id, ...row }) => row));
  });
}

export async function clearHistory(): Promise<void> {
  await db.transaction('rw', db.hands, db.countDrills, async () => {
    await db.hands.clear();
    await db.countDrills.clear();
  });
}

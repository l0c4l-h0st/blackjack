/**
 * Export / import / réinitialisation de la sauvegarde complète
 * (profil + réglages + partie en cours + historique Dexie).
 */
import { APP_VERSION, SAVE_SCHEMA_VERSION } from '../config/app';
import type { HistoryDump } from '../db/dexie';
import { clearSave, readSave, replaceSave } from './persistence';

export interface ExportFile {
  app: 'nocturne21';
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  save: unknown;
  history: HistoryDump;
}

export async function buildExport(now = new Date()): Promise<ExportFile> {
  const { exportHistory } = await import('../db/dexie');
  return {
    app: 'nocturne21',
    appVersion: APP_VERSION,
    schemaVersion: SAVE_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    save: readSave(),
    history: await exportHistory(),
  };
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseExport(text: string): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fichier illisible (JSON invalide).');
  }
  if (!data || typeof data !== 'object') throw new Error('Fichier de sauvegarde invalide.');
  const file = data as Partial<ExportFile>;
  if (file.app !== 'nocturne21' || !file.save || typeof file.save !== 'object') {
    throw new Error('Ce fichier n’est pas une sauvegarde Nocturne 21.');
  }
  const history = file.history ?? { hands: [], countDrills: [] };
  if (!Array.isArray(history.hands) || !Array.isArray(history.countDrills)) {
    throw new Error('Historique invalide dans la sauvegarde.');
  }
  return { ...(file as ExportFile), history };
}

/** Remplace toute la progression par celle du fichier puis recharge l'application. */
export async function importSave(text: string): Promise<void> {
  const file = parseExport(text);
  const { replaceHistory } = await import('../db/dexie');
  await replaceHistory(file.history);
  replaceSave(file.save);
  globalThis.location.reload();
}

export async function resetEverything(): Promise<void> {
  const { clearHistory } = await import('../db/dexie');
  await clearHistory();
  clearSave();
  globalThis.location.reload();
}

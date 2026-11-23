/**
 * Sauvegarde : une seule clé localStorage (`nocturne21:v1`) contenant un objet versionné
 * `{ schemaVersion, game, profile, settings }`. Chaque store Zustand y lit/écrit sa tranche.
 *
 * Migrations : `migrateSave` applique successivement les fonctions de `MIGRATIONS` pour amener
 * une sauvegarde ancienne au schéma courant.
 */
import type { StateStorage } from 'zustand/middleware';
import { SAVE_KEY, SAVE_SCHEMA_VERSION } from '../config/app';

export interface SaveBlob {
  schemaVersion: number;
  [slice: string]: unknown;
}

export type Migration = (blob: SaveBlob) => SaveBlob;

/**
 * `MIGRATIONS[n]` transforme une sauvegarde de schéma n en schéma n + 1.
 * Schéma 0 = sauvegarde sans numéro de version (tout est conservé tel quel).
 */
export const MIGRATIONS: Record<number, Migration> = {
  0: (blob) => ({ ...blob, schemaVersion: 1 }),
};

export function migrateSave(
  raw: unknown,
  target = SAVE_SCHEMA_VERSION,
  migrations: Record<number, Migration> = MIGRATIONS,
): SaveBlob {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { schemaVersion: target };
  }
  let blob = { ...(raw as Record<string, unknown>) } as SaveBlob;
  if (typeof blob.schemaVersion !== 'number') blob.schemaVersion = 0;
  if (blob.schemaVersion > target) {
    // Sauvegarde d'une version plus récente : on ne la casse pas, on l'ignore.
    return { schemaVersion: target };
  }
  while (blob.schemaVersion < target) {
    const step = migrations[blob.schemaVersion];
    if (!step) return { schemaVersion: target };
    blob = step(blob);
  }
  return blob;
}

function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

let cache: SaveBlob | null = null;

export function readSave(): SaveBlob {
  if (cache) return cache;
  const storage = safeStorage();
  let raw: unknown = null;
  try {
    const text = storage?.getItem(SAVE_KEY);
    raw = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    raw = null;
  }
  cache = migrateSave(raw);
  return cache;
}

function writeSave(blob: SaveBlob): void {
  cache = blob;
  try {
    safeStorage()?.setItem(SAVE_KEY, JSON.stringify(blob));
  } catch (e) {
    console.warn('Sauvegarde impossible', e);
  }
}

/** Adaptateur Zustand : chaque store est une tranche du blob de sauvegarde. */
export const blobStorage: StateStorage = {
  getItem: (name) => {
    const value = readSave()[name];
    return value === undefined ? null : JSON.stringify(value);
  },
  setItem: (name, value) => {
    writeSave({ ...readSave(), [name]: JSON.parse(value) as unknown });
  },
  removeItem: (name) => {
    const next = { ...readSave() };
    delete next[name];
    writeSave(next);
  },
};

/** Remplace entièrement la sauvegarde (import). */
export function replaceSave(raw: unknown): SaveBlob {
  const blob = migrateSave(raw);
  writeSave(blob);
  return blob;
}

/** Efface la sauvegarde (réinitialisation de la progression). */
export function clearSave(): void {
  cache = null;
  try {
    safeStorage()?.removeItem(SAVE_KEY);
  } catch (e) {
    console.warn('Effacement impossible', e);
  }
}

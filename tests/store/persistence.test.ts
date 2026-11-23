import { describe, expect, it } from 'vitest';
import type { Migration } from '../../src/store/persistence';
import { migrateSave } from '../../src/store/persistence';
import { parseExport } from '../../src/store/saveTransfer';

describe('migrations de sauvegarde', () => {
  it('sauvegarde absente ou corrompue → schéma courant vide', () => {
    expect(migrateSave(null)).toEqual({ schemaVersion: 1 });
    expect(migrateSave('texte')).toEqual({ schemaVersion: 1 });
    expect(migrateSave([1, 2])).toEqual({ schemaVersion: 1 });
  });

  it('sans version (schéma 0) → migrée en v1 sans perte', () => {
    expect(migrateSave({ profile: { a: 1 } })).toEqual({ schemaVersion: 1, profile: { a: 1 } });
  });

  it('applique les migrations successives', () => {
    const migrations: Record<number, Migration> = {
      1: (b) => ({ ...b, schemaVersion: 2, renamed: b.old }),
      2: (b) => ({ ...b, schemaVersion: 3, extra: true }),
    };
    expect(migrateSave({ schemaVersion: 1, old: 'x' }, 3, migrations)).toEqual({
      schemaVersion: 3,
      old: 'x',
      renamed: 'x',
      extra: true,
    });
  });

  it('migration manquante ou version future → sauvegarde neuve', () => {
    expect(migrateSave({ schemaVersion: 1 }, 3, {})).toEqual({ schemaVersion: 3 });
    expect(migrateSave({ schemaVersion: 9, game: {} })).toEqual({ schemaVersion: 1 });
  });
});

describe('fichier d’export', () => {
  it('valide l’en-tête et l’historique', () => {
    expect(() => parseExport('{')).toThrow('JSON invalide');
    expect(() => parseExport('42')).toThrow('invalide');
    expect(() => parseExport('{"app":"autre","save":{}}')).toThrow('pas une sauvegarde');
    expect(() =>
      parseExport('{"app":"nocturne21","save":{},"history":{"hands":1,"countDrills":[]}}'),
    ).toThrow('Historique');
    const ok = parseExport('{"app":"nocturne21","save":{"schemaVersion":1}}');
    expect(ok.history).toEqual({ hands: [], countDrills: [] });
  });
});

import type { TableLimits } from '../engine/types';

export interface TableTheme {
  id: string;
  name: string;
  levelRequired: number;
  min: number;
  max: number;
  /** Couleur d'accent (liseré, boutons, dos de carte). */
  accent: string;
  /** Teinte secondaire du tapis. */
  felt: [string, string];
  /** Effets brillants (table Diamant). */
  sparkle: boolean;
  tagline: string;
}

export const TABLES: readonly TableTheme[] = [
  {
    id: 'neon',
    name: 'Néon',
    levelRequired: 1,
    min: 10,
    max: 1_000,
    accent: '#7c5cff',
    felt: ['#1f1d3a', '#0d0c1c'],
    sparkle: false,
    tagline: 'La table d’initiation, lueurs violettes.',
  },
  {
    id: 'onyx',
    name: 'Onyx',
    levelRequired: 5,
    min: 50,
    max: 5_000,
    accent: '#22d3ee',
    felt: ['#14283a', '#08131d'],
    sparkle: false,
    tagline: 'Pierre noire et reflets cyan.',
  },
  {
    id: 'saphir',
    name: 'Saphir',
    levelRequired: 10,
    min: 200,
    max: 20_000,
    accent: '#3b82f6',
    felt: ['#13214a', '#070d22'],
    sparkle: false,
    tagline: 'Bleu profond pour joueurs confirmés.',
  },
  {
    id: 'obsidienne',
    name: 'Obsidienne',
    levelRequired: 20,
    min: 1_000,
    max: 100_000,
    accent: '#f43f5e',
    felt: ['#2e1420', '#14070c'],
    sparkle: false,
    tagline: 'Verre volcanique, mises sérieuses.',
  },
  {
    id: 'diamant',
    name: 'Diamant',
    levelRequired: 35,
    min: 5_000,
    max: 500_000,
    accent: '#f5c451',
    felt: ['#2b2415', '#100c05'],
    sparkle: true,
    tagline: 'Le salon privé. Or, éclats et silence.',
  },
];

export const DEFAULT_TABLE_ID = 'neon';

export function getTable(id: string): TableTheme {
  return TABLES.find((t) => t.id === id) ?? (TABLES[0] as TableTheme);
}

export function tableLimits(table: TableTheme): TableLimits {
  return { id: table.id, min: table.min, max: table.max };
}

export function isTableUnlocked(table: TableTheme, level: number): boolean {
  return level >= table.levelRequired;
}

/** Couleur d'accent avec transparence (`#rrggbb` → `rgba(...)`). */
export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Canaux RGB d'une couleur hexadécimale (`#7c5cff` → `124 92 255`). */
export function rgbChannels(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

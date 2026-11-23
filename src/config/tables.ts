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

// --- Contraste (WCAG AA) ---------------------------------------------------------------------

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(hex: string, target: string, t: number): string {
  const a = channels(hex);
  const b = channels(target);
  return toHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

/**
 * Variantes accessibles de la couleur d'accent :
 * `light` pour du texte sur fond sombre, `strong` pour un fond sous du texte blanc (≥ 4,5:1).
 */
export function accentVariants(accent: string): { light: string; strong: string } {
  let light = accent;
  for (let t = 0.05; contrastRatio(light, '#1a2233') < 4.6 && t <= 1; t += 0.05) {
    light = mix(accent, '#ffffff', t);
  }
  let strong = accent;
  for (let t = 0.05; contrastRatio(strong, '#ffffff') < 4.6 && t <= 1; t += 0.05) {
    strong = mix(accent, '#000000', t);
  }
  return { light, strong };
}

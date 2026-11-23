/** Jetons : dénominations, couleurs et décomposition d'un montant en pile optimale. */

export interface ChipStyle {
  value: number;
  label: string;
  /** Couleur principale du jeton. */
  color: string;
  /** Couleur des inserts du bord et de l'anneau. */
  edge: string;
  /** Couleur du texte central. */
  text: string;
  name: string;
}

/** Jetons disponibles dans le rack (10 = plus petite mise). */
export const RACK_CHIPS: readonly ChipStyle[] = [
  { value: 10, label: '10', color: '#5b6b82', edge: '#e8ecf4', text: '#ffffff', name: 'ardoise' },
  { value: 50, label: '50', color: '#e0344c', edge: '#ffe3e8', text: '#ffffff', name: 'rouge' },
  { value: 100, label: '100', color: '#2f6fdc', edge: '#dce8ff', text: '#ffffff', name: 'bleu' },
  { value: 500, label: '500', color: '#7c4dff', edge: '#ece4ff', text: '#ffffff', name: 'violet' },
  { value: 1_000, label: '1K', color: '#f0a020', edge: '#fff2d6', text: '#2a1a00', name: 'ambre' },
  {
    value: 5_000,
    label: '5K',
    color: '#13a874',
    edge: '#d9fff0',
    text: '#ffffff',
    name: 'émeraude',
  },
  { value: 25_000, label: '25K', color: '#e8508f', edge: '#ffe1ee', text: '#ffffff', name: 'rose' },
  {
    value: 100_000,
    label: '100K',
    color: '#141414',
    edge: '#f5c451',
    text: '#f5c451',
    name: 'noir et or',
  },
];

/**
 * Jeton d'appoint de 5, uniquement visuel : il sert à représenter les montants non
 * multiples de 10 (assurance 50 %, gain 3:2 sur une mise de 10…). Il n'est pas dans le rack.
 */
export const HALF_CHIP: ChipStyle = {
  value: 5,
  label: '5',
  color: '#c9d1df',
  edge: '#5b6b82',
  text: '#1a2233',
  name: 'appoint',
};

const ALL_CHIPS: readonly ChipStyle[] = [...RACK_CHIPS].reverse().concat(HALF_CHIP);

export function chipStyle(value: number): ChipStyle {
  const style = ALL_CHIPS.find((c) => c.value === value);
  if (!style) throw new Error(`Jeton inconnu : ${value}`);
  return style;
}

/**
 * Décomposition gloutonne (optimale pour ce système de dénominations canonique) :
 * du plus gros au plus petit jeton. Le reste éventuel < 5 est ignoré (n'arrive jamais).
 */
export function decomposeAmount(amount: number): number[] {
  const chips: number[] = [];
  let rest = Math.max(0, Math.floor(amount));
  for (const chip of ALL_CHIPS) {
    while (rest >= chip.value) {
      chips.push(chip.value);
      rest -= chip.value;
    }
  }
  return chips;
}

/** Formatage compact : 1 250 → « 1 250 », 25 000 → « 25K », 1 500 000 → « 1,5M ». */
export function formatCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${trim(amount / 1_000_000)}M`;
  if (abs >= 10_000) return `${trim(amount / 1_000)}K`;
  return formatCredits(amount);
}

function trim(x: number): string {
  return (Math.round(x * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

const creditsFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** Montant en crédits avec séparateur de milliers français. */
export function formatCredits(amount: number): string {
  return creditsFormatter.format(amount).replace(/[\u202f\u00a0]/g, '\u2009');
}

/** Montant signé : « +1 200 », « −50 », « 0 ». */
export function formatSigned(amount: number): string {
  if (amount > 0) return `+${formatCredits(amount)}`;
  if (amount < 0) return `−${formatCredits(-amount)}`;
  return '0';
}

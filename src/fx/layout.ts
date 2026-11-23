/**
 * Géométrie de la scène de jeu. Toutes les positions sont exprimées dans un repère virtuel
 * fixe (la scène est ensuite mise à l'échelle en CSS) : desktop 1200 × 700, mobile 420 × 760.
 *
 * Sur mobile, les places forment un carrousel : une « caméra » horizontale centre la place
 * sélectionnée, et toutes les positions des places en tiennent compte (les cartes et
 * jetons glissent donc avec le carrousel).
 */
import type { CardTarget, SpotRef } from '../engine/events';
import type { SeatSpotKind } from '../engine/types';

export type LayoutMode = 'desktop' | 'mobile';

export interface Point {
  x: number;
  y: number;
}

export interface Placement extends Point {
  rotate: number;
  scale: number;
  z: number;
}

export const CARD_W = 74;
export const CARD_H = 106;

interface ModeGeometry {
  width: number;
  height: number;
  shoe: Point;
  discard: Point;
  dealerTray: Point;
  playerBank: Point;
  dealerRow: Point;
  dealerSpacing: number;
  dealerScale: number;
  seatY: (screenPos: number) => number;
  seatX: (screenPos: number, focusPos: number, seats: number) => number;
  tilt: number;
}

const GEOMETRY: Record<LayoutMode, ModeGeometry> = {
  desktop: {
    width: 1200,
    height: 700,
    shoe: { x: 1088, y: 104 },
    discard: { x: 112, y: 104 },
    dealerTray: { x: 600, y: 26 },
    playerBank: { x: 600, y: 790 },
    dealerRow: { x: 600, y: 140 },
    dealerSpacing: 50,
    dealerScale: 1,
    seatY: (pos) => (pos === 1 ? 560 : 528),
    seatX: (pos) => 255 + pos * 345,
    tilt: 14,
  },
  mobile: {
    width: 420,
    height: 620,
    shoe: { x: 370, y: 66 },
    discard: { x: 50, y: 66 },
    dealerTray: { x: 210, y: 18 },
    playerBank: { x: 210, y: 700 },
    dealerRow: { x: 210, y: 140 },
    dealerSpacing: 42,
    dealerScale: 0.92,
    seatY: () => 520,
    seatX: (pos, focus) => 210 + (pos - focus) * 300,
    tilt: 8,
  },
};

export function stageSize(mode: LayoutMode): { width: number; height: number } {
  const g = GEOMETRY[mode];
  return { width: g.width, height: g.height };
}

export function stageTilt(mode: LayoutMode): number {
  return GEOMETRY[mode].tilt;
}

export function fixedPoint(
  mode: LayoutMode,
  which: 'shoe' | 'discard' | 'dealerTray' | 'playerBank',
): Point {
  return GEOMETRY[mode][which];
}

/** Position à l'écran d'une place : la place 0 (premier joueur servi) est à droite. */
export function screenPosition(seat: number, seats: number): number {
  return seats - 1 - seat;
}

export interface LayoutContext {
  mode: LayoutMode;
  seats: number;
  /** Place centrée par le carrousel mobile. */
  focusSeat: number;
}

/** Centre de la case de mise principale d'une place. */
export function seatAnchor(ctx: LayoutContext, seat: number): Point {
  const g = GEOMETRY[ctx.mode];
  const pos = screenPosition(seat, ctx.seats);
  const focus = screenPosition(ctx.focusSeat, ctx.seats);
  return { x: g.seatX(pos, focus, ctx.seats), y: g.seatY(pos) };
}

const SPOT_OFFSETS: Record<SeatSpotKind, Point> = {
  main: { x: 0, y: 0 },
  perfectPairs: { x: -84, y: 22 },
  twentyOnePlus3: { x: 84, y: 22 },
  insurance: { x: 92, y: -64 },
};

export function seatSpotPosition(ctx: LayoutContext, seat: number, spot: SeatSpotKind): Point {
  const a = seatAnchor(ctx, seat);
  const o = SPOT_OFFSETS[spot];
  return { x: a.x + o.x, y: a.y + o.y };
}

/** Échelle des cartes selon le nombre de mains de la place. */
export function handScale(handCount: number): number {
  if (handCount <= 1) return 1;
  if (handCount === 2) return 0.86;
  if (handCount === 3) return 0.72;
  return 0.62;
}

function handSpacing(handCount: number): number {
  if (handCount <= 2) return 122;
  if (handCount === 3) return 100;
  return 84;
}

/** Point de référence d'une main (sous ses cartes, là où reposent ses jetons). */
export function handAnchor(
  ctx: LayoutContext,
  seat: number,
  hand: number,
  handCount: number,
): Point {
  const a = seatAnchor(ctx, seat);
  if (handCount <= 1) return a;
  const s = handSpacing(handCount);
  return { x: a.x + (hand - (handCount - 1) / 2) * s, y: a.y - 30 };
}

/** Pseudo-aléa stable par carte : légère rotation ±3°. */
export function cardJitter(cardId: number): number {
  const h = Math.sin(cardId * 12.9898 + 78.233) * 43758.5453;
  return (h - Math.floor(h)) * 6 - 3;
}

/** Placement (centre) d'une carte dans une main. */
export function handCardPlacement(
  ctx: LayoutContext,
  seat: number,
  hand: number,
  handCount: number,
  index: number,
  cardId: number,
): Placement {
  const anchor = handAnchor(ctx, seat, hand, handCount);
  const scale = handScale(handCount);
  const baseY = handCount <= 1 ? -146 : -118;
  return {
    x: anchor.x - 10 * scale + index * 21 * scale,
    y: anchor.y + baseY * scale - index * 15 * scale,
    rotate: cardJitter(cardId),
    scale,
    z: 10 + index,
  };
}

export function dealerCardPlacement(
  ctx: LayoutContext,
  index: number,
  count: number,
  cardId: number,
): Placement {
  const g = GEOMETRY[ctx.mode];
  return {
    x: g.dealerRow.x + (index - (count - 1) / 2) * g.dealerSpacing,
    y: g.dealerRow.y,
    rotate: cardJitter(cardId) / 2,
    scale: g.dealerScale,
    z: 10 + index,
  };
}

export function cardTargetPlacement(
  ctx: LayoutContext,
  target: CardTarget,
  index: number,
  count: number,
  handCount: number,
  cardId: number,
): Placement {
  if (target.kind === 'dealer') return dealerCardPlacement(ctx, index, count, cardId);
  return handCardPlacement(ctx, target.seat, target.hand, handCount, index, cardId);
}

/** Position du total d'une main (pastille sous les cartes). */
export function handTotalPosition(
  ctx: LayoutContext,
  seat: number,
  hand: number,
  handCount: number,
): Point {
  const a = handAnchor(ctx, seat, hand, handCount);
  const scale = handScale(handCount);
  return { x: a.x, y: a.y + (handCount <= 1 ? -76 : -62) * scale };
}

/** Position d'une case de jetons quelconque. */
export function spotPosition(ctx: LayoutContext, spot: SpotRef, handCount: number): Point {
  if (spot.kind === 'seat') return seatSpotPosition(ctx, spot.seat, spot.spot);
  return handAnchor(ctx, spot.seat, spot.hand, handCount);
}

/** Décalage de la seconde pile d'une main doublée (« la pile se duplique à côté »). */
export const DOUBLE_STACK_OFFSET = 46;

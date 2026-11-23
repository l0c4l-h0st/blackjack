import type { Point } from './layout';

/**
 * Conversion coordonnées de scène → coordonnées écran, enregistrée par la scène montée
 * (sert à placer les particules Canvas au bon endroit).
 */
type Mapper = (p: Point) => Point;

let mapper: Mapper | null = null;

export function registerStageMapper(fn: Mapper | null): void {
  mapper = fn;
}

export function stageToScreen(p: Point): Point {
  if (mapper) return mapper(p);
  return { x: globalThis.innerWidth / 2, y: globalThis.innerHeight / 2 };
}

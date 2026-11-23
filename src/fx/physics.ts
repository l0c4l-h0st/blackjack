/**
 * Mini-physique des jetons (pure, testable). Produit des keyframes pour Framer Motion.
 *
 * - `simulateToss` : jeton lancé du rack vers une case — trajectoire balistique (gravité),
 *   rebonds amortis (coefficient de restitution) puis glissement freiné (frottement).
 * - `simulateSlide` : jetons poussés par le croupier — vitesse initiale puis décélération
 *   exponentielle (inertie).
 * - `simulateSuck` : jetons ramassés par le croupier — accélération + rétrécissement.
 */
import type { Point } from './layout';

export interface ChipKeyframes {
  x: number[];
  y: number[];
  scale: number[];
  times: number[];
  /** Durée totale en secondes (avant facteur de vitesse). */
  duration: number;
}

export interface TossOptions {
  /** Durée du vol jusqu'au premier impact (s). */
  flightTime?: number;
  /** Gravité (unités de scène / s²). */
  gravity?: number;
  /** Coefficient de restitution des rebonds (0..1). */
  restitution?: number;
  /** Fraction de la vitesse horizontale conservée à l'impact. */
  slideRetention?: number;
  /** Coefficient de frottement du glissement (1/s). */
  friction?: number;
  dt?: number;
}

const DEFAULT_TOSS: Required<TossOptions> = {
  flightTime: 0.36,
  gravity: 2600,
  restitution: 0.34,
  slideRetention: 0.12,
  friction: 9,
  dt: 1 / 120,
};

/** Hauteur → décalage vertical à l'écran et échelle (le jeton « monte » vers le joueur). */
function project(p: Point, z: number): { x: number; y: number; scale: number } {
  return { x: p.x, y: p.y - z, scale: 1 + z / 520 };
}

function downsample(frames: { x: number; y: number; scale: number; t: number }[], max: number) {
  if (frames.length <= max) return frames;
  const out: typeof frames = [];
  const step = (frames.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    out.push(frames[Math.round(i * step)] as (typeof frames)[number]);
  }
  return out;
}

function toKeyframes(
  frames: { x: number; y: number; scale: number; t: number }[],
  maxFrames = 28,
): ChipKeyframes {
  const sampled = downsample(frames, maxFrames);
  const last = sampled[sampled.length - 1] as (typeof sampled)[number];
  const duration = Math.max(last.t, 1e-6);
  return {
    x: sampled.map((f) => f.x),
    y: sampled.map((f) => f.y),
    scale: sampled.map((f) => f.scale),
    times: sampled.map((f) => f.t / duration),
    duration,
  };
}

export function simulateToss(from: Point, to: Point, options: TossOptions = {}): ChipKeyframes {
  const o = { ...DEFAULT_TOSS, ...options };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const dir = dist > 0 ? { x: dx / dist, y: dy / dist } : { x: 0, y: 0 };
  const flightSpeed = dist / o.flightTime;

  // Distance parcourue en glissade après l'impact (pour viser juste avant la cible).
  const slideSpeed0 = flightSpeed * o.slideRetention;
  let slide = 0;
  for (let v = slideSpeed0; v > 1; v *= 1 - o.friction * o.dt) slide += v * o.dt;
  const landing = { x: to.x - dir.x * slide, y: to.y - dir.y * slide };
  const v = {
    x: (landing.x - from.x) / o.flightTime,
    y: (landing.y - from.y) / o.flightTime,
  };

  const frames: { x: number; y: number; scale: number; t: number }[] = [];
  let t = 0;
  let pos = { ...from };
  let z = 0;
  let vz = (o.gravity * o.flightTime) / 2;
  let vh = { ...v };
  let landed = false;
  let guard = 0;

  for (;;) {
    frames.push({ ...project(pos, z), t });
    if (guard++ > 2000) break;
    t += o.dt;
    vz -= o.gravity * o.dt;
    z += vz * o.dt;
    pos = { x: pos.x + vh.x * o.dt, y: pos.y + vh.y * o.dt };
    if (z <= 0) {
      z = 0;
      if (!landed) {
        landed = true;
        pos = { ...landing };
        vh = { x: dir.x * slideSpeed0, y: dir.y * slideSpeed0 };
      }
      vz = -vz * o.restitution;
      if (vz < 60) vz = 0;
    }
    if (landed) {
      const damp = 1 - o.friction * o.dt;
      vh = { x: vh.x * damp, y: vh.y * damp };
      if (vz === 0 && Math.hypot(vh.x, vh.y) < 1) break;
    }
  }
  frames.push({ x: to.x, y: to.y, scale: 1, t: t + o.dt });
  return toKeyframes(frames);
}

export interface SlideOptions {
  duration?: number;
  /** Constante d'inertie (plus grand = arrêt plus franc). */
  inertia?: number;
}

export function simulateSlide(from: Point, to: Point, options: SlideOptions = {}): ChipKeyframes {
  const duration = options.duration ?? 0.5;
  const k = options.inertia ?? 5;
  const frames: { x: number; y: number; scale: number; t: number }[] = [];
  const steps = 24;
  const norm = 1 - Math.exp(-k * duration);
  for (let i = 0; i <= steps; i++) {
    const t = (duration * i) / steps;
    const p = (1 - Math.exp(-k * t)) / norm;
    frames.push({ x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, scale: 1, t });
  }
  return toKeyframes(frames);
}

export function simulateSuck(from: Point, to: Point, duration = 0.42): ChipKeyframes {
  const frames: { x: number; y: number; scale: number; t: number }[] = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const p = u * u * u; // accélération
    frames.push({
      x: from.x + (to.x - from.x) * p,
      y: from.y + (to.y - from.y) * p,
      scale: 1 - 0.55 * p,
      t: duration * u,
    });
  }
  return toKeyframes(frames);
}

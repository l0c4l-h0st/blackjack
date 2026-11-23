import { describe, expect, it } from 'vitest';
import { simulateSlide, simulateSuck, simulateToss } from '../../src/fx/physics';

describe('physique des jetons', () => {
  it('le lancer atterrit exactement sur la cible', () => {
    const k = simulateToss({ x: 600, y: 760 }, { x: 255, y: 528 });
    expect(k.x.at(-1)).toBe(255);
    expect(k.y.at(-1)).toBe(528);
    expect(k.scale.at(-1)).toBe(1);
    expect(k.times[0]).toBe(0);
    expect(k.times.at(-1)).toBe(1);
    expect(k.x).toHaveLength(k.times.length);
    expect(k.times.every((t, i) => i === 0 || t >= (k.times[i - 1] ?? 0))).toBe(true);
    expect(k.duration).toBeGreaterThan(0.36);
    expect(k.x.length).toBeLessThanOrEqual(28);
  });

  it('le jeton s’élève (gravité) puis rebondit en s’amortissant', () => {
    const k = simulateToss({ x: 0, y: 0 }, { x: 300, y: 0 }, { dt: 1 / 240 });
    const lifts = k.scale.map((s) => s - 1);
    const peak = Math.max(...lifts);
    expect(peak).toBeGreaterThan(0.05);
    expect(lifts.every((l) => l >= -1e-9)).toBe(true);
  });

  it('gère un lancer sur place', () => {
    const k = simulateToss({ x: 10, y: 10 }, { x: 10, y: 10 });
    expect(k.x.every((x) => x === 10)).toBe(true);
  });

  it('glissement avec inertie : monotone et arrive à destination', () => {
    const k = simulateSlide({ x: 0, y: 0 }, { x: 100, y: 50 });
    expect(k.x[0]).toBe(0);
    expect(k.x.at(-1)).toBeCloseTo(100, 6);
    expect(k.y.at(-1)).toBeCloseTo(50, 6);
    for (let i = 1; i < k.x.length; i++) expect(k.x[i]).toBeGreaterThanOrEqual(k.x[i - 1] ?? 0);
    // décélération : le premier pas est le plus long
    const first = (k.x[1] ?? 0) - (k.x[0] ?? 0);
    const last = (k.x.at(-1) ?? 0) - (k.x.at(-2) ?? 0);
    expect(first).toBeGreaterThan(last);
  });

  it('aspiration : accélère et rétrécit', () => {
    const k = simulateSuck({ x: 0, y: 0 }, { x: 0, y: -400 });
    expect(k.y.at(-1)).toBe(-400);
    expect(k.scale.at(-1)).toBeCloseTo(0.45, 6);
    const first = Math.abs((k.y[1] ?? 0) - (k.y[0] ?? 0));
    const last = Math.abs((k.y.at(-1) ?? 0) - (k.y.at(-2) ?? 0));
    expect(last).toBeGreaterThan(first);
  });
});

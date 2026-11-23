/**
 * Générateurs aléatoires et mélange Fisher-Yates sans biais.
 */

export interface Rng {
  /** Entier non signé uniforme sur 32 bits. */
  nextUint32(): number;
}

const TWO_POW_32 = 0x1_0000_0000;

/**
 * Entier uniforme dans [0, maxExclusive) par échantillonnage par rejet
 * (aucun biais modulo).
 */
export function randomInt(rng: Rng, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > TWO_POW_32) {
    throw new RangeError(`randomInt: borne invalide ${maxExclusive}`);
  }
  const limit = TWO_POW_32 - (TWO_POW_32 % maxExclusive);
  for (;;) {
    const x = rng.nextUint32();
    if (x < limit) return x % maxExclusive;
  }
}

/** Mélange de Fisher-Yates (Durstenfeld) en place. */
export function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
  return items;
}

/** RNG cryptographique (`crypto.getRandomValues`) avec tampon. */
export class CryptoRng implements Rng {
  private readonly buffer = new Uint32Array(256);
  private index = this.buffer.length;

  nextUint32(): number {
    if (this.index >= this.buffer.length) {
      globalThis.crypto.getRandomValues(this.buffer);
      this.index = 0;
    }
    const value = this.buffer[this.index] as number;
    this.index += 1;
    return value;
  }
}

/**
 * RNG déterministe xoshiro128** (tests et simulations reproductibles).
 * Initialisé via splitmix32 à partir d'une graine 32 bits.
 */
export class SeededRng implements Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number) {
    let x = seed >>> 0;
    const next = (): number => {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.s0 = next();
    this.s1 = next();
    this.s2 = next();
    this.s3 = next();
  }

  nextUint32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl(this.s3, 11);
    return result;
  }
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

let defaultRng: Rng | null = null;

/** RNG par défaut de l'application (crypto). */
export function getDefaultRng(): Rng {
  defaultRng ??= new CryptoRng();
  return defaultRng;
}

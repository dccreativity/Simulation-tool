/**
 * Seeded randomness and value noise.
 *
 * Every ecosystem is generated from a seed, so a whole class entering the same
 * site code samples the identical population. Nothing here uses Math.random().
 * (Ported from the original Quadrat & Transect Lab.)
 */

export type Rng = () => number;

/** FNV-1a: arbitrary text → 32-bit seed. */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mix several integers into one sub-seed. */
export function mixSeeds(...nums: number[]): number {
  let h = 0x9e3779b9 >>> 0;
  for (const n of nums) {
    h ^= (n | 0) + 0x7ed55d16;
    h = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — small, fast and plenty good for ecology teaching. */
export function rngFrom(seed: number): Rng {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal deviate (Box–Muller). */
export function gaussian(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Poisson deviate: Knuth below 30, normal approximation above. */
export function poisson(rng: Rng, lambda: number): number {
  if (!(lambda > 0)) return 0;
  if (lambda < 30) {
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rng();
    } while (p > limit && k < 400);
    return k - 1;
  }
  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gaussian(rng)));
}

/** Fisher–Yates shuffle (in place). */
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const fade = (t: number) => t * t * (3 - 2 * t);

/** Deterministic 2-D value noise in [0, 1]. */
export function makeNoise2D(seed: number) {
  const at = (xi: number, yi: number) => {
    let n = Math.imul(xi, 374761393) + Math.imul(yi, 668265263) + Math.imul(seed | 0, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  return function noise(x: number, y: number) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };
}

export type Fbm = (x: number, y: number, scale: number) => number;

/** Fractal sum of value noise, in [0, 1]; `scale` is the feature size in metres. */
export function makeFbm(seed: number, octaves = 3): Fbm {
  const layers = Array.from({ length: octaves }, (_, o) => makeNoise2D(mixSeeds(seed, o * 7919)));
  return function fbm(x, y, scale) {
    let total = 0;
    let amp = 1;
    let norm = 0;
    let freq = 1 / Math.max(0.001, scale);
    for (const layer of layers) {
      total += amp * layer(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.07;
    }
    return total / norm;
  };
}

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

/** 0 below e0, 1 above e1, smooth in between. Works reversed (e0 > e1). */
export function smoothstep(e0: number, e1: number, x: number): number {
  if (e0 === e1) return x < e0 ? 0 : 1;
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** Unnormalised Gaussian bump: 1 at d = 0, falling off over `sd`. */
export const bump = (d: number, sd: number) => Math.exp(-0.5 * (d / sd) * (d / sd));

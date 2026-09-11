/* Seeded pseudo-random numbers and value noise.
 *
 * Everything the simulation generates comes from a site code typed by the
 * user, so a whole class entering "HEDGE-07" samples the identical habitat.
 * Nothing here touches Math.random().
 */

/** Turn arbitrary text into a 32-bit integer seed. */
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mix several integers into one, for per-cell / per-species sub-seeds. */
export function mixSeeds(...nums) {
  let h = 0x9e3779b9 >>> 0;
  for (const n of nums) {
    h ^= (n | 0) + 0x7ed55d16;
    h = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough for ecology teaching. */
export function rngFrom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal deviate (Box–Muller). */
export function gaussian(rng) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Poisson deviate: Knuth below 30, normal approximation above. */
export function poisson(rng, lambda) {
  if (!(lambda > 0)) return 0;
  if (lambda < 30) {
    const limit = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= rng(); } while (p > limit && k < 400);
    return k - 1;
  }
  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gaussian(rng)));
}

/* ── value noise ─────────────────────────────────────────────────────────── */

const fade = (t) => t * t * (3 - 2 * t);

/** Deterministic 2-D value noise in [0,1]; `scale` is the feature size in metres. */
export function makeNoise2D(seed) {
  const at = (xi, yi) => {
    let n = Math.imul(xi, 374761393) + Math.imul(yi, 668265263) + Math.imul(seed | 0, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  return function noise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = fade(x - x0), fy = fade(y - y0);
    const a = at(x0, y0), b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };
}

/** Fractal sum of value noise, still in [0,1]. */
export function makeFbm(seed, octaves = 3) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push(makeNoise2D(mixSeeds(seed, o * 7919)));
  return function fbm(x, y, scale) {
    let sum = 0, amp = 1, norm = 0, freq = 1 / Math.max(0.001, scale);
    for (let o = 0; o < layers.length; o++) {
      sum += amp * layers[o](x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.07;
    }
    return sum / norm;
  };
}

/* ── small maths helpers used by the habitat definitions ─────────────────── */

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

/** 0 below e0, 1 above e1, smooth in between. Works with e0 > e1 (reversed). */
export function smoothstep(e0, e1, x) {
  if (e0 === e1) return x < e0 ? 0 : 1;
  return (t => t * t * (3 - 2 * t))(clamp((x - e0) / (e1 - e0)));
}

/** Unnormalised Gaussian bump: 1 at d = 0, falling off over `sd`. */
export const bump = (d, sd) => Math.exp(-0.5 * (d / sd) * (d / sd));

export const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / (arr.length - 1));
}

export function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

import type { Env, MapFeature } from '@/types/ecosystem';
import { makeNoise2D } from '@/lib/simulation/rng';
import { smoothstep } from '@/lib/simulation/rng';

/** Site size. Both sides divide exactly by every quadrat size (0.25–2 m), so the
 * grid of possible quadrat positions tiles the site and the estimator is unbiased. */
export const SITE = { width: 40, height: 24 } as const;

export function baseEnv(): Env {
  return {
    water: 0,
    waterDist: 99,
    trample: 0,
    pathDist: 99,
    shade: 0,
    canopyDist: 99,
    rock: 0,
    elevation: 0,
    edgeDist: 99,
    moisture: 0.4,
  };
}

export type RGB = [number, number, number];

export function hex(h: string): RGB {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** Darken / lighten by a factor (1 = unchanged). */
export function shadeColor(c: RGB, f: number): RGB {
  return [c[0] * f, c[1] * f, c[2] * f];
}

type Tree = Extract<MapFeature, { type: 'tree' }>;
type Rock = Extract<MapFeature, { type: 'rock' }>;

/** Canopy shade and distance to the nearest canopy edge. */
export function canopyAt(x: number, y: number, trees: readonly Tree[]): { shade: number; canopyDist: number; trunk: boolean } {
  let shade = 0;
  let canopyDist = 99;
  let trunk = false;
  for (const t of trees) {
    const d = Math.hypot(x - t.x, y - t.y);
    const edge = d - t.r;
    if (edge < canopyDist) canopyDist = edge;
    const s = 1 - smoothstep(t.r * 0.72, t.r * 1.12, d);
    if (s > shade) shade = s;
    if (t.trunk && d < t.trunk) trunk = true;
  }
  return { shade, canopyDist, trunk };
}

export function rockAt(x: number, y: number, rocks: readonly Rock[]): number {
  for (const r of rocks) {
    if (Math.hypot(x - r.x, y - r.y) < r.r) return 1;
  }
  return 0;
}

/** Fixed noise used for soft, irregular edges of water and paths. */
export const edgeNoise = makeNoise2D(90210);

export const trees = (list: [number, number, number][], kind: Tree['kind'] = 'broadleaf', trunkFrac = 0.09): Tree[] =>
  list.map(([x, y, r]) => ({ type: 'tree', x, y, r, kind, trunk: kind === 'shrub' ? undefined : Math.max(0.25, r * trunkFrac) }));

export const rocks = (list: [number, number, number][]): Rock[] =>
  list.map(([x, y, r], i) => ({ type: 'rock', x, y, r, seed: i * 97 + 13 }));

/**
 * The simulated site: every individual organism, generated once from the
 * ecosystem's environmental model and a site code.
 *
 * The density functions are only used to *generate* the population. Every
 * measurement — quadrat counts, transects, the "true" density used to reveal
 * sampling bias — is made on the generated individuals, exactly as a real
 * survey measures a real population.
 */

import type { EcosystemDef, Env } from '@/types/ecosystem';
import { hashString, makeFbm, mixSeeds, poisson, rngFrom } from './rng';

export interface SpatialIndex {
  cell: number;
  cols: number;
  rows: number;
  /** CSR offsets: items for cell c are items[start[c] .. start[c + 1]). */
  start: Uint32Array;
  items: Uint32Array;
}

export interface SpeciesTruth {
  speciesId: string;
  total: number;
  /** Individuals per m² over the whole site. */
  density: number;
}

export interface Site {
  eco: EcosystemDef;
  siteCode: string;
  seed: number;
  width: number;
  height: number;
  count: number;
  xs: Float32Array;
  ys: Float32Array;
  species: Uint8Array;
  index: SpatialIndex;
  truth: SpeciesTruth[];
  /** Zone index per ZONE_RES cell. */
  zoneGrid: { res: number; cols: number; rows: number; zones: Uint8Array };
  zoneAreas: number[];
  /** Individuals per m² per species on a 1 m grid, lightly smoothed. */
  densityGrids: Float32Array[];
  densityGridCols: number;
  densityGridRows: number;
}

const GEN_CELL = 0.5;
const ZONE_RES = 0.5;
const INDEX_CELL = 1;

export function normaliseSiteCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 24) || 'SITE';
}

/** Patchiness multiplier with mean close to 1 (see SpeciesDef.clump). */
function clumpMod(f: number, clump: { weight: number; power: number }): number {
  const sharpened = Math.pow(f, clump.power) * Math.pow(2, clump.power);
  return 1 - clump.weight + clump.weight * sharpened;
}

function fitsHabitat(habitat: 'land' | 'water' | 'both' | undefined, e: Env): boolean {
  if (e.rock > 0.5) return false;
  if (habitat === 'water') return e.water > 0.5;
  if (habitat === 'both') return true;
  return e.water < 0.5;
}

export function buildIndex(xs: Float32Array, ys: Float32Array, width: number, height: number, cell = INDEX_CELL): SpatialIndex {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const n = xs.length;
  const cellOf = (i: number) => {
    const c = Math.min(cols - 1, Math.max(0, Math.floor(xs[i] / cell)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(ys[i] / cell)));
    return r * cols + c;
  };
  const start = new Uint32Array(cols * rows + 1);
  for (let i = 0; i < n; i++) start[cellOf(i) + 1]++;
  for (let c = 0; c < cols * rows; c++) start[c + 1] += start[c];
  const fill = start.slice(0, cols * rows);
  const items = new Uint32Array(n);
  for (let i = 0; i < n; i++) items[fill[cellOf(i)]++] = i;
  return { cell, cols, rows, start, items };
}

/** Call `visit` for every organism whose cell overlaps the rectangle. */
export function forEachInRect(
  site: Pick<Site, 'index'>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  visit: (i: number) => void,
): void {
  const { cell, cols, rows, start, items } = site.index;
  const c0 = Math.max(0, Math.floor(Math.min(x0, x1) / cell));
  const c1 = Math.min(cols - 1, Math.floor(Math.max(x0, x1) / cell));
  const r0 = Math.max(0, Math.floor(Math.min(y0, y1) / cell));
  const r1 = Math.min(rows - 1, Math.floor(Math.max(y0, y1) / cell));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const k = r * cols + c;
      for (let j = start[k]; j < start[k + 1]; j++) visit(items[j]);
    }
  }
}

export function generateSite(eco: EcosystemDef, siteCode: string): Site {
  const code = normaliseSiteCode(siteCode);
  const seed = hashString(`${eco.id}:${code}`);
  const { width, height } = eco;
  const cols = Math.ceil(width / GEN_CELL);
  const rows = Math.ceil(height / GEN_CELL);

  // Environment at every generation-cell centre, computed once and shared by all species.
  const envs: Env[] = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      envs[r * cols + c] = eco.env((c + 0.5) * GEN_CELL, (r + 0.5) * GEN_CELL);
    }
  }

  const xs: number[] = [];
  const ys: number[] = [];
  const sp: number[] = [];

  eco.species.forEach((s, si) => {
    const rng = rngFrom(mixSeeds(seed, si * 7919 + 1));
    if (s.minSpacing) {
      placeRegular(eco, s, si, rng, envs, cols, rows, xs, ys, sp);
      return;
    }
    const fbm = s.clump ? makeFbm(mixSeeds(seed, si * 104729 + 3), 3) : null;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * GEN_CELL;
        const cy = (r + 0.5) * GEN_CELL;
        const e = envs[r * cols + c];
        let d = s.density(cx, cy, e);
        if (!(d > 0)) continue;
        if (fbm && s.clump) d *= clumpMod(fbm(cx, cy, s.clump.scale), s.clump);
        const k = poisson(rng, d * GEN_CELL * GEN_CELL);
        for (let j = 0; j < k; j++) {
          const x = c * GEN_CELL + rng() * GEN_CELL;
          const y = r * GEN_CELL + rng() * GEN_CELL;
          if (x >= width || y >= height) continue;
          // Exact habitat check at the organism's own position (water edges, rocks, trunks).
          if (!fitsHabitat(s.habitat, eco.env(x, y))) continue;
          xs.push(x);
          ys.push(y);
          sp.push(si);
        }
      }
    }
  });

  const fx = Float32Array.from(xs);
  const fy = Float32Array.from(ys);
  const fs = Uint8Array.from(sp);
  const index = buildIndex(fx, fy, width, height);

  const totals = eco.species.map(() => 0);
  for (let i = 0; i < fs.length; i++) totals[fs[i]]++;
  const area = width * height;
  const truth = eco.species.map((s, i) => ({ speciesId: s.id, total: totals[i], density: totals[i] / area }));

  // Zones on a fine grid, for stratified sampling and bias checks.
  const zCols = Math.ceil(width / ZONE_RES);
  const zRows = Math.ceil(height / ZONE_RES);
  const zones = new Uint8Array(zCols * zRows);
  const zoneAreas = eco.zones.map(() => 0);
  const zoneIndex = new Map(eco.zones.map((z, i) => [z.id, i]));
  for (let r = 0; r < zRows; r++) {
    for (let c = 0; c < zCols; c++) {
      const x = (c + 0.5) * ZONE_RES;
      const y = (r + 0.5) * ZONE_RES;
      const e = GEN_CELL === ZONE_RES ? envs[r * cols + c] : eco.env(x, y);
      const zi = zoneIndex.get(eco.zoneAt(x, y, e)) ?? 0;
      zones[r * zCols + c] = zi;
      zoneAreas[zi] += ZONE_RES * ZONE_RES;
    }
  }

  // Per-species density on a 1 m grid (3 × 3 smoothed) — the "actual population" map.
  const dCols = Math.ceil(width);
  const dRows = Math.ceil(height);
  const densityGrids = eco.species.map((_, si) => {
    const raw = new Float32Array(dCols * dRows);
    for (let i = 0; i < fs.length; i++) {
      if (fs[i] !== si) continue;
      const c = Math.min(dCols - 1, Math.floor(fx[i]));
      const r = Math.min(dRows - 1, Math.floor(fy[i]));
      raw[r * dCols + c]++;
    }
    const smooth = new Float32Array(dCols * dRows);
    for (let r = 0; r < dRows; r++) {
      for (let c = 0; c < dCols; c++) {
        let total = 0;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= dRows || cc >= dCols) continue;
            total += raw[rr * dCols + cc];
            n++;
          }
        }
        smooth[r * dCols + c] = total / n;
      }
    }
    return smooth;
  });

  return {
    eco,
    siteCode: code,
    seed,
    width,
    height,
    count: fs.length,
    xs: fx,
    ys: fy,
    species: fs,
    index,
    truth,
    zoneGrid: { res: ZONE_RES, cols: zCols, rows: zRows, zones },
    zoneAreas,
    densityGrids,
    densityGridCols: dCols,
    densityGridRows: dRows,
  };
}

/** Evenly spaced individuals (competition for water or light): dart throwing with thinning. */
function placeRegular(
  eco: EcosystemDef,
  s: EcosystemDef['species'][number],
  si: number,
  rng: () => number,
  envs: Env[],
  cols: number,
  rows: number,
  xs: number[],
  ys: number[],
  sp: number[],
) {
  const minGap = s.minSpacing ?? 1;
  let expected = 0;
  let maxD = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = s.density((c + 0.5) * GEN_CELL, (r + 0.5) * GEN_CELL, envs[r * cols + c]);
      if (d > 0) {
        expected += d * GEN_CELL * GEN_CELL;
        maxD = Math.max(maxD, d);
      }
    }
  }
  const target = Math.round(expected);
  const placed: { x: number; y: number }[] = [];
  let attempts = 0;
  while (placed.length < target && attempts < target * 400) {
    attempts++;
    const x = rng() * eco.width;
    const y = rng() * eco.height;
    const e = eco.env(x, y);
    const d = s.density(x, y, e);
    if (!(d > 0) || rng() > d / maxD) continue;
    if (!fitsHabitat(s.habitat, e)) continue;
    if (placed.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < minGap * minGap)) continue;
    placed.push({ x, y });
    xs.push(x);
    ys.push(y);
    sp.push(si);
  }
}

/** Zone id at a point, from the precomputed grid. */
export function zoneAtPoint(site: Site, x: number, y: number): string {
  const { res, cols, rows, zones } = site.zoneGrid;
  const c = Math.min(cols - 1, Math.max(0, Math.floor(x / res)));
  const r = Math.min(rows - 1, Math.max(0, Math.floor(y / res)));
  return site.eco.zones[zones[r * cols + c]]?.id ?? site.eco.zones[0].id;
}

export function zoneLabel(site: Pick<Site, 'eco'>, zoneId: string): string {
  return site.eco.zones.find((z) => z.id === zoneId)?.label ?? zoneId;
}

/** Smoothed true density (per m²) of one species at a point. */
export function localDensity(site: Site, speciesIndex: number, x: number, y: number): number {
  const c = Math.min(site.densityGridCols - 1, Math.max(0, Math.floor(x)));
  const r = Math.min(site.densityGridRows - 1, Math.max(0, Math.floor(y)));
  return site.densityGrids[speciesIndex][r * site.densityGridCols + c];
}

/** Nearest organism to a point within `maxDist` metres (for inspecting). */
export function nearestOrganism(site: Site, x: number, y: number, maxDist: number): number | null {
  let best = -1;
  let bestD = maxDist * maxDist;
  forEachInRect(site, x - maxDist, y - maxDist, x + maxDist, y + maxDist, (i) => {
    const d = (site.xs[i] - x) ** 2 + (site.ys[i] - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  });
  return best >= 0 ? best : null;
}

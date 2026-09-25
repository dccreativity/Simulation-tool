/**
 * Sampling tools. Each one queries the generated individuals in the site, so
 * a student's choices (where, how big, how many) genuinely change the data.
 */

import type { Point } from '@/types/ecosystem';
import { forEachInRect, zoneAtPoint, type Site } from '@/lib/simulation/site';
import { shuffle, type Rng } from '@/lib/simulation/rng';

export type Strategy = 'random' | 'systematic' | 'stratified';
export type PlacementStrategy = Strategy | 'manual';

export const QUADRAT_SIZES = [0.25, 0.5, 1, 2] as const;
export type QuadratSize = (typeof QUADRAT_SIZES)[number];

export interface QuadratResult {
  /** Individuals of each species (indexed like eco.species). */
  counts: number[];
  total: number;
  /** Number of species present. */
  richness: number;
  /** Organism indices inside the frame, for highlighting. */
  members: number[];
  zone: string;
}

/**
 * Count everything rooted inside a quadrat whose top-left corner is (x, y).
 * The frame is half-open [x, x + size) so neighbouring quadrats never count the
 * same individual twice, and the grid of possible positions tiles the site.
 */
export function countQuadrat(site: Site, x: number, y: number, size: number): QuadratResult {
  const counts = site.eco.species.map(() => 0);
  const members: number[] = [];
  forEachInRect(site, x, y, x + size, y + size, (i) => {
    const ox = site.xs[i];
    const oy = site.ys[i];
    if (ox >= x && ox < x + size && oy >= y && oy < y + size) {
      counts[site.species[i]]++;
      members.push(i);
    }
  });
  const total = counts.reduce((s, c) => s + c, 0);
  return {
    counts,
    total,
    richness: counts.filter((c) => c > 0).length,
    members,
    zone: zoneAtPoint(site, x + size / 2, y + size / 2),
  };
}

/** Clamp a quadrat so it lies wholly inside the site. */
export function clampQuadrat(site: Pick<Site, 'width' | 'height'>, x: number, y: number, size: number): Point {
  return {
    x: Math.min(site.width - size, Math.max(0, x)),
    y: Math.min(site.height - size, Math.max(0, y)),
  };
}

function gridPositions(site: Site, size: number) {
  const cols = Math.floor(site.width / size + 1e-9);
  const rows = Math.floor(site.height / size + 1e-9);
  return { cols, rows, total: cols * rows };
}

/**
 * Plan quadrat positions (top-left corners) using a sampling strategy.
 *
 *  - random: grid cells drawn without replacement — the classic "two tape
 *    measures and a random number table" method.
 *  - systematic: an even grid across the whole site.
 *  - stratified: samples shared between habitat zones in proportion to their
 *    area, then placed at random within each zone.
 */
export function planLocations(site: Site, strategy: Strategy, n: number, size: number, rng: Rng): Point[] {
  const count = Math.max(1, Math.floor(n));
  if (strategy === 'systematic') return systematic(site, count, size);
  if (strategy === 'stratified') return stratified(site, count, size, rng);
  return random(site, count, size, rng);
}

function random(site: Site, n: number, size: number, rng: Rng): Point[] {
  const { cols, total } = gridPositions(site, size);
  const chosen = new Set<number>();
  const want = Math.min(n, total);
  while (chosen.size < want) chosen.add(Math.floor(rng() * total));
  return [...chosen].map((k) => ({ x: (k % cols) * size, y: Math.floor(k / cols) * size }));
}

function systematic(site: Site, n: number, size: number): Point[] {
  const aspect = site.width / site.height;
  let best = { k: n, m: 1, score: Infinity };
  for (let m = 1; m <= n; m++) {
    const k = Math.ceil(n / m);
    const waste = k * m - n;
    const aspectError = Math.abs(Math.log(k / m / aspect));
    const score = waste * 0.6 + aspectError * 2;
    if (score < best.score) best = { k, m, score };
  }
  const { k, m } = best;
  const dx = site.width / k;
  const dy = site.height / m;
  const cells: Point[] = [];
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < k; i++) {
      const cx = (i + 0.5) * dx;
      const cy = (j + 0.5) * dy;
      // Snap to the quadrat grid so positions match the tape-measure coordinates.
      const x = Math.min(site.width - size, Math.max(0, Math.round((cx - size / 2) / size) * size));
      const y = Math.min(site.height - size, Math.max(0, Math.round((cy - size / 2) / size) * size));
      cells.push({ x, y });
    }
  }
  const surplus = cells.length - n;
  if (surplus <= 0) return cells;
  // Drop surplus positions evenly rather than leaving a gap at the end.
  const step = cells.length / surplus;
  const drop = new Set(Array.from({ length: surplus }, (_, i) => Math.floor(i * step + step / 2)));
  return cells.filter((_, i) => !drop.has(i));
}

function stratified(site: Site, n: number, size: number, rng: Rng): Point[] {
  const { cols, rows } = gridPositions(site, size);
  const zoneCount = site.eco.zones.length;
  const byZone: number[][] = Array.from({ length: zoneCount }, () => []);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const zone = zoneAtPoint(site, c * size + size / 2, r * size + size / 2);
      const zi = site.eco.zones.findIndex((z) => z.id === zone);
      byZone[Math.max(0, zi)].push(r * cols + c);
    }
  }
  const available = byZone.map((z) => z.length);
  const totalCells = available.reduce((s, v) => s + v, 0);
  // Proportional allocation with the largest-remainder method.
  const raw = available.map((a) => (a / totalCells) * n);
  const alloc = raw.map(Math.floor);
  let left = n - alloc.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => ({ i, rem: v - Math.floor(v) })).sort((a, b) => b.rem - a.rem);
  for (const { i } of order) {
    if (left <= 0) break;
    if (available[i] > alloc[i]) {
      alloc[i]++;
      left--;
    }
  }
  // Every zone gets at least one sample when there are enough to go round.
  if (n >= zoneCount) {
    for (let i = 0; i < zoneCount; i++) {
      if (alloc[i] === 0 && available[i] > 0) {
        const donor = alloc.indexOf(Math.max(...alloc));
        if (alloc[donor] > 1) {
          alloc[donor]--;
          alloc[i]++;
        }
      }
    }
  }
  const out: Point[] = [];
  byZone.forEach((cells, zi) => {
    const picks = shuffle([...cells], rng).slice(0, Math.min(alloc[zi], cells.length));
    for (const k of picks) out.push({ x: (k % cols) * size, y: Math.floor(k / cols) * size });
  });
  return shuffle(out, rng);
}

/* ── transects ───────────────────────────────────────────────────────────── */

export interface TransectSegment {
  index: number;
  /** Distance along the transect in metres. */
  from: number;
  to: number;
  midX: number;
  midY: number;
  counts: number[];
  total: number;
  richness: number;
  zone: string;
  /** m² sampled in this section (belt transects only). */
  area?: number;
}

export interface TransectResult {
  kind: 'line' | 'belt';
  start: Point;
  end: Point;
  length: number;
  interval: number;
  width?: number;
  segments: TransectSegment[];
  members: number[];
}

function frame(start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const ux = length > 0 ? dx / length : 1;
  const uy = length > 0 ? dy / length : 0;
  return { length, ux, uy };
}

function emptySegments(site: Site, start: Point, length: number, interval: number, ux: number, uy: number, width?: number) {
  const n = Math.max(1, Math.ceil(length / interval - 1e-9));
  return Array.from({ length: n }, (_, k): TransectSegment => {
    const from = k * interval;
    const to = Math.min(length, (k + 1) * interval);
    const mid = (from + to) / 2;
    const midX = start.x + ux * mid;
    const midY = start.y + uy * mid;
    return {
      index: k,
      from,
      to,
      midX,
      midY,
      counts: site.eco.species.map(() => 0),
      total: 0,
      richness: 0,
      zone: zoneAtPoint(site, midX, midY),
      area: width !== undefined ? (to - from) * width : undefined,
    };
  });
}

function finish(segments: TransectSegment[]) {
  for (const s of segments) {
    s.total = s.counts.reduce((a, b) => a + b, 0);
    s.richness = s.counts.filter((c) => c > 0).length;
  }
}

/**
 * Line transect: record every individual touching the tape, i.e. whose spread
 * (radius) reaches the line, and group records by interval along the line.
 */
export function runLineTransect(site: Site, start: Point, end: Point, interval: number): TransectResult {
  const { length, ux, uy } = frame(start, end);
  const segments = emptySegments(site, start, length, interval, ux, uy);
  const members: number[] = [];
  const maxR = Math.max(...site.eco.species.map((s) => s.radius)) + 0.02;
  forEachInRect(
    site,
    Math.min(start.x, end.x) - maxR,
    Math.min(start.y, end.y) - maxR,
    Math.max(start.x, end.x) + maxR,
    Math.max(start.y, end.y) + maxR,
    (i) => {
      const px = site.xs[i] - start.x;
      const py = site.ys[i] - start.y;
      const u = px * ux + py * uy;
      if (u < 0 || u >= length) return;
      const v = Math.abs(-px * uy + py * ux);
      const reach = site.eco.species[site.species[i]].radius + 0.01; // 1 cm tape
      if (v > reach) return;
      const k = Math.min(segments.length - 1, Math.floor(u / interval));
      segments[k].counts[site.species[i]]++;
      members.push(i);
    },
  );
  finish(segments);
  return { kind: 'line', start, end, length, interval, segments, members };
}

/**
 * Belt transect: a strip `width` metres wide centred on the line, divided into
 * sections `interval` metres long. Individuals rooted inside are counted.
 */
export function runBeltTransect(site: Site, start: Point, end: Point, width: number, interval: number): TransectResult {
  const { length, ux, uy } = frame(start, end);
  const segments = emptySegments(site, start, length, interval, ux, uy, width);
  const members: number[] = [];
  const half = width / 2;
  const nx = -uy * half;
  const ny = ux * half;
  const corners = [
    { x: start.x + nx, y: start.y + ny },
    { x: start.x - nx, y: start.y - ny },
    { x: end.x + nx, y: end.y + ny },
    { x: end.x - nx, y: end.y - ny },
  ];
  forEachInRect(
    site,
    Math.min(...corners.map((c) => c.x)),
    Math.min(...corners.map((c) => c.y)),
    Math.max(...corners.map((c) => c.x)),
    Math.max(...corners.map((c) => c.y)),
    (i) => {
      const px = site.xs[i] - start.x;
      const py = site.ys[i] - start.y;
      const u = px * ux + py * uy;
      if (u < 0 || u >= length) return;
      const v = -px * uy + py * ux;
      if (v < -half || v >= half) return;
      const k = Math.min(segments.length - 1, Math.floor(u / interval));
      segments[k].counts[site.species[i]]++;
      members.push(i);
    },
  );
  finish(segments);
  return { kind: 'belt', start, end, length, interval, width, segments, members };
}

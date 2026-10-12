/* The virtual habitat.
 *
 * World coordinates are metres, x to the right, y upwards, origin at the
 * bottom-left corner — the same axes as the two tape measures on screen.
 * A quadrat is a rect {x, y, side}: (x, y) is its bottom-left corner, which is
 * where the random coordinates put it.
 *
 * Countable species are generated as individuals up front. Carpet species are
 * generated lazily, cell by cell, because a 400 m² field holds well over a
 * hundred thousand tufts of grass — far more than anyone needs at once, but
 * each cell is reproducible from its own sub-seed, so the tufts inside a
 * quadrat are the same every time it is drawn or measured.
 */

import { hashString, mixSeeds, rngFrom, poisson, makeFbm, clamp } from './rng.js';
import { clumpMod, coverVary } from './scenarios.js';

const CELL = 0.25;          // side of a lazily generated carpet cell, metres
const COVER_CAP = 0.965;    // no carpet is ever quite 100% — there is always a gap
/* Plant units are drawn with radius R·(0.72 + u·0.56). Union cover of a Poisson
 * disc process depends on E[r²], not E[r]², so the density is divided by
 * E[(0.72 + u·0.56)²] = 0.72² + 0.72·0.56 + 0.56²/3 to keep the cover that is
 * actually drawn equal to the cover the habitat function asked for. */
const R2_FACTOR = 0.72 * 0.72 + 0.72 * 0.56 + (0.56 * 0.56) / 3;
const INDEX_CELL = 1;       // spatial index cell for individuals, metres

export class Site {
  constructor(scenario, seedText) {
    this.scenario = scenario;
    this.seedText = seedText;
    this.seed = hashString(String(seedText).trim().toUpperCase() || 'SITE');
    this.w = scenario.size.w;
    this.h = scenario.size.h;
    this.area = this.w * this.h;

    this.fbm = new Map();       // species id → patchiness field
    this.individuals = new Map();
    this.index = new Map();
    this.cellCache = new Map();
    this._siteCover = new Map();
    this._posMaps = new Map();

    for (const sp of scenario.species) {
      this.fbm.set(sp.id, makeFbm(mixSeeds(this.seed, hashString(sp.id)), 3));
    }
    for (const sp of scenario.species) {
      if (sp.kind === 'count') this._generateIndividuals(sp);
    }
  }

  species(id) { return this.scenario.species.find((s) => s.id === id); }
  get speciesList() { return this.scenario.species; }

  /* ── countable species ────────────────────────────────────────────────── */

  _generateIndividuals(sp) {
    const rng = rngFrom(mixSeeds(this.seed, hashString(sp.id), 7331));
    const fbm = this.fbm.get(sp.id);
    const list = [];
    const step = 0.5;                       // generate cell by cell for local density
    const cellArea = step * step;
    for (let gx = 0; gx < this.w; gx += step) {
      for (let gy = 0; gy < this.h; gy += step) {
        const cx = gx + step / 2, cy = gy + step / 2;
        const base = sp.density(cx, cy);
        if (base <= 0) continue;
        const mod = sp.clump ? clumpMod(fbm(cx, cy, sp.clump.scale), sp.clump) : 1;
        const n = poisson(rng, base * mod * cellArea);
        for (let i = 0; i < n; i++) {
          list.push({
            x: gx + rng() * step,
            y: gy + rng() * step,
            r: sp.size * (0.78 + rng() * 0.44),
            a: rng() * Math.PI * 2,
          });
        }
      }
    }
    this.individuals.set(sp.id, list);

    const buckets = new Map();
    for (let i = 0; i < list.length; i++) {
      const k = this._key(list[i].x, list[i].y);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(i);
    }
    this.index.set(sp.id, buckets);
  }

  _key(x, y) {
    return Math.floor(x / INDEX_CELL) + 1031 * Math.floor(y / INDEX_CELL);
  }

  /** Individuals whose centre lies inside the rect — the boundary rule. */
  countIn(spId, rect) { return this.individualsIn(spId, rect).length; }

  individualsIn(spId, rect) {
    const list = this.individuals.get(spId);
    if (!list) return [];
    const buckets = this.index.get(spId);
    const out = [];
    const x0 = Math.floor(rect.x / INDEX_CELL), x1 = Math.floor((rect.x + rect.side) / INDEX_CELL);
    const y0 = Math.floor(rect.y / INDEX_CELL), y1 = Math.floor((rect.y + rect.side) / INDEX_CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const b = buckets.get(ix + 1031 * iy);
        if (!b) continue;
        for (const i of b) {
          const p = list[i];
          if (p.x >= rect.x && p.x < rect.x + rect.side && p.y >= rect.y && p.y < rect.y + rect.side) {
            out.push({ ...p, i });
          }
        }
      }
    }
    return out;
  }

  /** Everything within `pad` metres of the rect, for drawing the frame edges. */
  individualsAround(spId, rect, pad) {
    const big = { x: rect.x - pad, y: rect.y - pad, side: rect.side + 2 * pad };
    const list = this.individuals.get(spId) || [];
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.x >= big.x && p.x <= big.x + big.side && p.y >= big.y && p.y <= big.y + big.side) {
        const inside = p.x >= rect.x && p.x < rect.x + rect.side && p.y >= rect.y && p.y < rect.y + rect.side;
        out.push({ ...p, i, inside });
      }
    }
    return out;
  }

  /* ── carpet species ───────────────────────────────────────────────────── */

  /** Target cover fraction at a point: the habitat's own function, made patchy. */
  coverAt(spId, x, y) {
    const sp = this.species(spId);
    if (!sp || sp.kind !== 'cover') return 0;
    const base = sp.cover(x, y);
    if (base <= 0) return 0;
    const f = this.fbm.get(spId)(x, y, sp.patch.scale);
    return Math.min(COVER_CAP, coverVary(base, f, sp.patch.amp));
  }

  /** Plant units inside one 0.25 m cell, reproducible from the cell's sub-seed. */
  _cellUnits(sp, ix, iy) {
    const key = sp.id + ':' + ix + ':' + iy;
    let got = this.cellCache.get(key);
    if (got) return got;
    const x0 = ix * CELL, y0 = iy * CELL;
    const c = this.coverAt(sp.id, x0 + CELL / 2, y0 + CELL / 2);
    got = [];
    if (c > 0.0015) {
      const lambda = -Math.log(1 - c) / (Math.PI * sp.unitR * sp.unitR * R2_FACTOR);
      const rng = rngFrom(mixSeeds(this.seed, hashString(sp.id), ix * 7919 + 13, iy * 104729 + 7));
      const n = poisson(rng, lambda * CELL * CELL);
      for (let i = 0; i < n; i++) {
        got.push({
          x: x0 + rng() * CELL,
          y: y0 + rng() * CELL,
          r: sp.unitR * (0.72 + rng() * 0.56),
          a: rng() * Math.PI * 2,
        });
      }
    }
    if (this.cellCache.size > 20000) this.cellCache.clear();
    this.cellCache.set(key, got);
    return got;
  }

  /** Plant units overlapping a rect (expanded by `pad` metres). */
  coverUnits(spId, rect, pad = 0) {
    const sp = this.species(spId);
    if (!sp || sp.kind !== 'cover') return [];
    const x0 = Math.floor((rect.x - pad) / CELL), x1 = Math.floor((rect.x + rect.side + pad) / CELL);
    const y0 = Math.floor((rect.y - pad) / CELL), y1 = Math.floor((rect.y + rect.side + pad) / CELL);
    const out = [];
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        if (ix < 0 || iy < 0 || ix * CELL >= this.w || iy * CELL >= this.h) continue;
        for (const u of this._cellUnits(sp, ix, iy)) out.push(u);
      }
    }
    return out;
  }

  /** Cover measured off the plants actually drawn in the quadrat.
   *  Returns the true percentage, and the percentage a student would get by the
   *  "count every small square the species more than half fills" rule. */
  measureCover(spId, rect, res = 60) {
    const units = this.coverUnits(spId, rect, this.species(spId).unitR + 0.01);
    const grid = new Uint8Array(res * res);
    const cellSize = rect.side / res;
    for (const u of units) {
      const r = u.r;
      const cx = (u.x - rect.x) / cellSize, cy = (u.y - rect.y) / cellSize;
      const rc = r / cellSize;
      const i0 = Math.max(0, Math.floor(cx - rc)), i1 = Math.min(res - 1, Math.ceil(cx + rc));
      const j0 = Math.max(0, Math.floor(cy - rc)), j1 = Math.min(res - 1, Math.ceil(cy + rc));
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const dx = i + 0.5 - cx, dy = j + 0.5 - cy;
          if (dx * dx + dy * dy <= rc * rc) grid[j * res + i] = 1;
        }
      }
    }
    let hit = 0;
    for (let i = 0; i < grid.length; i++) hit += grid[i];

    // per small square of the 5 × 5 frame
    const per = res / 5;
    const squares = [];
    let halfRule = 0;
    for (let sy = 4; sy >= 0; sy--) {          // top row first, reading order
      for (let sx = 0; sx < 5; sx++) {
        let c = 0;
        for (let j = Math.floor(sy * per); j < Math.floor((sy + 1) * per); j++) {
          for (let i = Math.floor(sx * per); i < Math.floor((sx + 1) * per); i++) c += grid[j * res + i];
        }
        const frac = c / (per * per);
        squares.push(frac);
        if (frac > 0.5) halfRule++;
      }
    }
    return {
      pct: (hit / grid.length) * 100,
      byHalfRule: halfRule * 4,
      squares,
      units: units.length,
    };
  }

  /* ── the truth for the whole site ─────────────────────────────────────── */

  trueTotal(spId) {
    const sp = this.species(spId);
    if (sp.kind === 'count') return this.individuals.get(spId).length;
    if (this._siteCover.has(spId)) return this._siteCover.get(spId);
    const n = 200;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        sum += this.coverAt(spId, ((i + 0.5) / n) * this.w, ((j + 0.5) / n) * this.h);
      }
    }
    const pct = (sum / (n * n)) * 100;
    this._siteCover.set(spId, pct);
    return pct;
  }

  /** Mean of the truth per quadrat, for comparing with a sample mean. */
  trueMeanPerQuadrat(spId, side) {
    const sp = this.species(spId);
    if (sp.kind === 'count') return this.trueTotal(spId) * ((side * side) / this.area);
    return this.trueTotal(spId);
  }

  /* ── candidate quadrat positions, for the Investigate tab ─────────────── */

  /** Every possible quadrat position — the same tiling the coordinate roll
   *  draws from — with the truth at each. Carpet species use the cover field
   *  directly (the expected measurement), which is thousands of times cheaper
   *  than generating every tuft. */
  positionMap(side) {
    const key = side.toFixed(3);
    if (this._posMaps.has(key)) return this._posMaps.get(key);
    const step = side;
    const xs = [], ys = [];
    for (let x = 0; x + side <= this.w + 1e-9; x += step) xs.push(+x.toFixed(3));
    for (let y = 0; y + side <= this.h + 1e-9; y += step) ys.push(+y.toFixed(3));
    const values = new Map();
    for (const sp of this.speciesList) values.set(sp.id, new Float32Array(xs.length * ys.length));

    const sub = 6;
    for (let a = 0; a < xs.length; a++) {
      for (let b = 0; b < ys.length; b++) {
        const rect = { x: xs[a], y: ys[b], side };
        const k = b * xs.length + a;
        for (const sp of this.speciesList) {
          if (sp.kind === 'count') {
            values.get(sp.id)[k] = this.countIn(sp.id, rect);
          } else {
            let s = 0;
            for (let i = 0; i < sub; i++) {
              for (let j = 0; j < sub; j++) {
                s += this.coverAt(sp.id, rect.x + ((i + 0.5) / sub) * side, rect.y + ((j + 0.5) / sub) * side);
              }
            }
            values.get(sp.id)[k] = (s / (sub * sub)) * 100;
          }
        }
      }
    }
    const map = { xs, ys, side, values, count: xs.length * ys.length };
    this._posMaps.set(key, map);
    return map;
  }
}

/** Random coordinates off the tape measures.
 *
 * The tapes are read in quadrat-widths, so the possible quadrat positions tile
 * the area exactly: every point of the site belongs to one and only one
 * possible quadrat. That makes the sample a true simple random sample of the
 * whole area — read the tapes to the nearest whole metre with a half-metre
 * frame and half of every metre strip could never be sampled at all. With a
 * 1 m frame this gives the whole-number coordinates of the textbook method. */
export function rollCoordinates(site, side, rng) {
  const nx = Math.max(1, Math.floor((site.w + 1e-9) / side));
  const ny = Math.max(1, Math.floor((site.h + 1e-9) / side));
  return {
    x: +(Math.floor(rng() * nx) * side).toFixed(2),
    y: +(Math.floor(rng() * ny) * side).toFixed(2),
  };
}

/** Quadrat stations at regular intervals along a line — an interrupted belt transect. */
export function transectStations(site, line, side) {
  const { x1, y1, x2, y2, interval } = line;
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (!(len > 0) || !(interval > 0)) return [];
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const out = [];
  for (let d = 0; d <= len + 1e-6; d += interval) {
    const cx = x1 + ux * d, cy = y1 + uy * d;
    const x = clamp(cx - side / 2, 0, site.w - side);
    const y = clamp(cy - side / 2, 0, site.h - side);
    out.push({ d: +d.toFixed(2), x: +x.toFixed(3), y: +y.toFixed(3), cx, cy });
  }
  return out;
}

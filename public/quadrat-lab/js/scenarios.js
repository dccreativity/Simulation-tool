/* Habitat definitions.
 *
 * A habitat is a set of species, each with a density or cover function over the
 * site in metres. Those functions are the "truth": the site is generated from
 * them, and the simulation measures the generated site, never the function.
 *
 *   kind 'count' — individuals you can pick out and count.   density(x,y) → per m²
 *   kind 'cover' — a carpet you can only estimate by area.   cover(x,y)   → 0..1
 *
 * slot 1–4 map to the four species colours, which are validated as mutually
 * distinguishable (including for colour-blind readers) in both light and dark.
 */

import { clamp, smoothstep, bump } from './rng.js';

/* Patchiness. `weight` is how strongly clumped (0 = even, 1 = all clumps),
 * `power` sharpens the clumps, and the 2**power factor keeps the mean density
 * near the nominal value. */
export function clumpMod(fbmValue, { weight = 0, power = 1 } = {}) {
  if (!weight) return 1;
  const sharpened = Math.pow(fbmValue, power) * Math.pow(2, power);
  return (1 - weight) + weight * sharpened;
}

/* Local variation in cover: ±amp, relative, so bare ground stays bare. */
export const coverVary = (base, fbmValue, amp) => clamp(base * (1 + 2 * amp * (fbmValue - 0.5)));

const SIZE = { w: 20, h: 20 };

/* ───────────────────────── 1. oak tree in a meadow ───────────────────────── */

const TRUNK = { x: 7, y: 11 };
const shadeAt = (x, y) => {
  const d = Math.hypot(x - TRUNK.x, y - TRUNK.y);
  return 1 - smoothstep(3.0, 6.6, d);
};

const oak = {
  id: 'oak',
  name: 'Oak tree in a meadow',
  short: 'Oak meadow',
  blurb: 'Grass thins to almost nothing in the shade under the canopy, and moss takes over. The gradient runs outwards from the trunk.',
  size: SIZE,
  ground: { light: '#cbd6b2', dark: '#22291b' },
  features: [{ type: 'canopy', x: TRUNK.x, y: TRUNK.y, r: 6.0, trunkR: 0.42 }],
  transect: { x1: 7.5, y1: 11, x2: 19.5, y2: 11, interval: 2, axis: 'Distance from the trunk (m)' },
  zoneAt(x, y) {
    const s = shadeAt(x, y);
    return s > 0.55 ? 'Deep shade' : s > 0.12 ? 'Canopy edge' : 'Open meadow';
  },
  species: [
    { id: 'grass', name: 'Meadow grass', sci: 'Poa spp.', kind: 'cover', slot: 4, glyph: 'blade',
      unitR: 0.045, patch: { scale: 2.4, amp: 0.16 },
      cover: (x, y) => 0.90 * (1 - 0.86 * shadeAt(x, y)) },
    { id: 'moss', name: 'Cushion moss', sci: 'Bryum spp.', kind: 'cover', slot: 1, glyph: 'cushion',
      unitR: 0.04, patch: { scale: 1.5, amp: 0.18 },
      cover: (x, y) => 0.04 + 0.56 * shadeAt(x, y) },
    { id: 'dandelion', name: 'Dandelion', sci: 'Taraxacum officinale', kind: 'count', slot: 2, glyph: 'ray',
      size: 0.075, clump: { scale: 4.5, weight: 0.55, power: 1.6 },
      density: (x, y) => 3.4 * (1 - 0.92 * shadeAt(x, y)) },
    { id: 'clover', name: 'Red clover', sci: 'Trifolium pratense', kind: 'count', slot: 3, glyph: 'trefoil',
      size: 0.06, clump: { scale: 3.0, weight: 0.8, power: 2.0 },
      density: (x, y) => 4.2 * Math.pow(1 - shadeAt(x, y), 2.2) },
  ],
};

/* ───────────────────────── 2. trampled footpath ───────────────────────── */

const PATH_Y = 10;
const offPath = (y) => Math.abs(y - PATH_Y);
const trampleAt = (x, y) => 1 - smoothstep(0.75, 3.1, offPath(y));

const path = {
  id: 'path',
  name: 'Footpath across a field',
  short: 'Footpath',
  blurb: 'Trampling strips the path bare, plantain thrives on the edge where nothing else will grow, and daisies peak in the short turf beyond. The classic transect investigation.',
  size: SIZE,
  ground: { light: '#c8d0ae', dark: '#20271a' },
  features: [{ type: 'path', y: PATH_Y, halfWidth: 0.85, margin: 2.1 }],
  transect: { x1: 10, y1: 2, x2: 10, y2: 18, interval: 2, axis: 'Distance across the path (m)' },
  zoneAt(x, y) {
    const t = offPath(y);
    return t < 0.85 ? 'Bare path' : t < 2.2 ? 'Path edge' : t < 5 ? 'Short turf' : 'Tall grass';
  },
  species: [
    { id: 'grass', name: 'Meadow grass', sci: 'Poa spp.', kind: 'cover', slot: 4, glyph: 'blade',
      unitR: 0.045, patch: { scale: 2.6, amp: 0.14 },
      cover: (x, y) => 0.93 * (1 - 0.94 * trampleAt(x, y)) },
    { id: 'moss', name: 'Wall moss', sci: 'Tortula muralis', kind: 'cover', slot: 1, glyph: 'cushion',
      unitR: 0.035, patch: { scale: 1.4, amp: 0.2 },
      cover: (x, y) => 0.03 + 0.30 * bump(offPath(y) - 1.15, 0.85) },
    { id: 'plantain', name: 'Greater plantain', sci: 'Plantago major', kind: 'count', slot: 2, glyph: 'broadleaf',
      size: 0.085, clump: { scale: 2.2, weight: 0.35, power: 1.4 },
      density: (x, y) => 10.5 * bump(offPath(y) - 1.45, 0.85) + 2.2 * (1 - smoothstep(0.5, 1.1, offPath(y))) },
    { id: 'daisy', name: 'Daisy', sci: 'Bellis perennis', kind: 'count', slot: 3, glyph: 'rosette',
      size: 0.055, clump: { scale: 3.2, weight: 0.5, power: 1.5 },
      density: (x, y) => 4.8 * bump(offPath(y) - 3.2, 1.9) },
  ],
};

/* ───────────────────────── 3. rocky shore ───────────────────────── */

const shore = {
  id: 'shore',
  name: 'Rocky shore, low to high water',
  short: 'Rocky shore',
  blurb: 'Three wracks in bands up the shore, each tolerating a different length of time out of the water, with limpets grazing the middle and lower shore. y is height up the shore.',
  size: SIZE,
  ground: { light: '#b9bcb4', dark: '#23251f' },
  acfor: true,
  features: [
    { type: 'water', y: 0.45 },
    { type: 'tideline', y: 18.7, label: 'High water mark' },
    { type: 'tideline', y: 0.45, label: 'Low water mark' },
  ],
  transect: { x1: 10, y1: 0.5, x2: 10, y2: 18.5, interval: 2, axis: 'Height up the shore (m)' },
  zoneAt(x, y) { return y < 5 ? 'Lower shore' : y < 12.5 ? 'Middle shore' : 'Upper shore'; },
  species: [
    { id: 'serrated', name: 'Serrated wrack', sci: 'Fucus serratus', kind: 'cover', slot: 1, glyph: 'frond',
      unitR: 0.075, patch: { scale: 1.9, amp: 0.2 },
      cover: (x, y) => 0.82 * (1 - smoothstep(3.5, 9.0, y)) },
    { id: 'bladder', name: 'Bladder wrack', sci: 'Fucus vesiculosus', kind: 'cover', slot: 4, glyph: 'frond',
      unitR: 0.07, patch: { scale: 1.9, amp: 0.2 },
      cover: (x, y) => 0.78 * bump(y - 9.5, 3.1) },
    { id: 'channelled', name: 'Channelled wrack', sci: 'Pelvetia canaliculata', kind: 'cover', slot: 2, glyph: 'frond',
      unitR: 0.055, patch: { scale: 1.7, amp: 0.22 },
      cover: (x, y) => 0.68 * smoothstep(11.5, 16.0, y) * (1 - smoothstep(17.8, 19.8, y)) },
    { id: 'limpet', name: 'Common limpet', sci: 'Patella vulgata', kind: 'count', slot: 3, glyph: 'limpet',
      size: 0.045, clump: { scale: 2.6, weight: 0.45, power: 1.5 },
      density: (x, y) => 16 * bump(y - 7.5, 4.4) },
  ],
};

/* ───────────────────────── 4. mown lawn (the control) ───────────────────── */

const lawn = {
  id: 'lawn',
  name: 'Mown lawn',
  short: 'Mown lawn',
  blurb: 'No gradient and no clumping: everything is scattered at random. Use it to check whether random sampling really does recover the right answer — and to see a transect find nothing.',
  size: SIZE,
  ground: { light: '#c4d2a6', dark: '#1e2518' },
  features: [],
  transect: { x1: 2, y1: 10, x2: 18, y2: 10, interval: 2, axis: 'Distance along the lawn (m)' },
  zoneAt() { return 'Mown lawn'; },
  species: [
    { id: 'grass', name: 'Rye grass', sci: 'Lolium perenne', kind: 'cover', slot: 4, glyph: 'blade',
      unitR: 0.045, patch: { scale: 3.5, amp: 0.07 },
      cover: () => 0.87 },
    { id: 'daisy', name: 'Daisy', sci: 'Bellis perennis', kind: 'count', slot: 3, glyph: 'rosette',
      size: 0.055, clump: { scale: 3.0, weight: 0.12, power: 1.1 },
      density: () => 7.8 },
    { id: 'dandelion', name: 'Dandelion', sci: 'Taraxacum officinale', kind: 'count', slot: 2, glyph: 'ray',
      size: 0.075, clump: { scale: 3.5, weight: 0.18, power: 1.2 },
      density: () => 1.9 },
  ],
};

/* ───────────────────────── 5. clumped thistles ───────────────────────── */

const thistle = {
  id: 'thistle',
  name: 'Thistles in rough grassland',
  short: 'Thistle patches',
  blurb: 'Creeping thistle spreads by root, so it grows in dense patches with bare stretches between. Ten quadrats are nowhere near enough here — prove it on the Investigate tab.',
  size: SIZE,
  ground: { light: '#c6cfa4', dark: '#1f2617' },
  features: [],
  transect: { x1: 2, y1: 10, x2: 18, y2: 10, interval: 2, axis: 'Distance along the grassland (m)' },
  zoneAt() { return 'Rough grassland'; },
  species: [
    { id: 'grass', name: 'Meadow grass', sci: 'Poa spp.', kind: 'cover', slot: 4, glyph: 'blade',
      unitR: 0.045, patch: { scale: 2.8, amp: 0.2 },
      cover: () => 0.82 },
    { id: 'thistle', name: 'Creeping thistle', sci: 'Cirsium arvense', kind: 'count', slot: 3, glyph: 'thistle',
      size: 0.09, clump: { scale: 5.5, weight: 0.97, power: 3.2 },
      density: () => 9.0 },
    { id: 'dandelion', name: 'Dandelion', sci: 'Taraxacum officinale', kind: 'count', slot: 2, glyph: 'ray',
      size: 0.075, clump: { scale: 3.4, weight: 0.5, power: 1.5 },
      density: () => 2.4 },
  ],
};

export const SCENARIOS = [oak, path, shore, lawn, thistle];
export const byId = (id) => SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];

/** Percentage cover → the ACFOR abundance scale used in shore surveys. */
export function acfor(pct) {
  if (pct >= 50) return { code: 'A', label: 'Abundant' };
  if (pct >= 20) return { code: 'C', label: 'Common' };
  if (pct >= 10) return { code: 'F', label: 'Frequent' };
  if (pct >= 2)  return { code: 'O', label: 'Occasional' };
  if (pct > 0)   return { code: 'R', label: 'Rare' };
  return { code: '–', label: 'Absent' };
}

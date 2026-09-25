import type { EcosystemDef } from '@/types/ecosystem';
import { bump, smoothstep } from '@/lib/simulation/rng';
import { SITE, baseEnv, edgeNoise, hex, mix, rockAt, rocks } from './helpers';

/** Low-water mark: the sea lies below this line (y increases downwards). */
const seaLine = (x: number) => 21.6 + 0.7 * Math.sin(x * 0.33) + (edgeNoise(x * 0.5, 3) - 0.5) * 1.1;
const POOLS = [
  { x: 8, y: 12.5, r: 1.5 },
  { x: 27, y: 9, r: 1.2 },
  { x: 33.5, y: 15.5, r: 1.8 },
];
const BOULDERS = rocks([
  [15, 5, 0.6],
  [21, 16, 0.5],
  [36, 7, 0.55],
  [4, 18, 0.45],
  [30, 3, 0.4],
]);

const SEA = hex('#3a7580');
const SEA_DEEP = hex('#2a5d69');
const WET_ROCK = hex('#6f7268');
const ROCK = hex('#8f8c80');
const ROCK_LIGHT = hex('#a6a292');
const LICHEN = hex('#b3a877');

export const coastal: EcosystemDef = {
  id: 'coastal',
  name: 'Coastal',
  tagline: 'Rocky shore',
  description:
    'A rocky shore from the low-water mark up to the splash zone. Time out of water sets the limits of each species, producing clear bands — zonation.',
  studyFocus: ['Zonation', 'Species abundance', 'Environmental gradient (exposure)'],
  methods: ['line-transect', 'belt-transect'],
  width: SITE.width,
  height: SITE.height,
  defaultSiteCode: 'SHORE-04',
  zones: [
    { id: 'lower', label: 'Lower shore', description: 'Covered by water most of the time.' },
    { id: 'middle', label: 'Middle shore', description: 'Covered and uncovered by every tide.' },
    { id: 'upper', label: 'Upper shore', description: 'Only covered at high tide.' },
    { id: 'splash', label: 'Splash zone', description: 'Wetted only by spray.' },
  ],
  env(x, y) {
    const e = baseEnv();
    const sea = seaLine(x);
    e.elevation = sea - y; // metres up the shore from low water
    let water = 1 - smoothstep(-0.15, 0.15, e.elevation);
    let poolDist = 99;
    for (const p of POOLS) {
      const d = Math.hypot(x - p.x, y - p.y) - p.r - (edgeNoise(x * 1.1, y * 1.1) - 0.5) * 0.5;
      poolDist = Math.min(poolDist, d);
    }
    water = Math.max(water, 1 - smoothstep(-0.08, 0.08, poolDist));
    e.water = water;
    e.waterDist = Math.min(e.elevation, poolDist);
    e.rock = rockAt(x, y, BOULDERS);
    e.moisture = 1 - smoothstep(0, 20, e.elevation);
    return e;
  },
  zoneAt(_x, _y, e) {
    if (e.elevation < 6) return 'lower';
    if (e.elevation < 13) return 'middle';
    if (e.elevation < 18.5) return 'upper';
    return 'splash';
  },
  ground(_x, _y, e, n) {
    let c = mix(ROCK, ROCK_LIGHT, n);
    c = mix(c, WET_ROCK, 1 - smoothstep(2, 11, e.elevation));
    c = mix(c, LICHEN, smoothstep(17.5, 21, e.elevation) * (0.55 + 0.45 * n));
    const water = mix(SEA, SEA_DEEP, smoothstep(0, -3, e.elevation));
    return mix(c, water, e.water);
  },
  features: [...BOULDERS],
  species: [
    {
      id: 'limpet',
      name: 'Common limpet',
      scientific: 'Patella vulgata',
      description: 'Clamps to rock and grazes algae when the tide is in. Most common on the middle shore.',
      slot: 1,
      glyph: 'circle',
      radius: 0.03,
      clump: { scale: 2.6, weight: 0.5, power: 1.5 },
      density: (_x, _y, e) => 9 * bump(e.elevation - 9, 4),
    },
    {
      id: 'serrated-wrack',
      name: 'Serrated wrack',
      scientific: 'Fucus serratus',
      description: 'A brown seaweed that dries out quickly, so it is confined to the lower shore.',
      slot: 2,
      glyph: 'hexagon',
      radius: 0.18,
      clump: { scale: 2, weight: 0.35, power: 1.3 },
      density: (_x, _y, e) => 5.5 * (1 - smoothstep(4, 8, e.elevation)),
    },
    {
      id: 'bladder-wrack',
      name: 'Bladder wrack',
      scientific: 'Fucus vesiculosus',
      description: 'Air bladders float its fronds towards the light. It dominates the middle shore.',
      slot: 3,
      glyph: 'diamond',
      radius: 0.16,
      clump: { scale: 2, weight: 0.35, power: 1.3 },
      density: (_x, _y, e) => 5 * bump(e.elevation - 9.5, 2.6),
    },
    {
      id: 'barnacle',
      name: 'Acorn barnacle',
      scientific: 'Semibalanus balanoides',
      description: 'Filter-feeds when submerged and seals itself shut at low tide. Covers the upper-middle shore.',
      slot: 4,
      glyph: 'ring',
      radius: 0.012,
      clump: { scale: 2, weight: 0.55, power: 1.5 },
      density: (_x, _y, e) => 18 * bump(e.elevation - 14, 3.5),
    },
    {
      id: 'channelled-wrack',
      name: 'Channelled wrack',
      scientific: 'Pelvetia canaliculata',
      description: 'Survives days out of water by curling its fronds into channels. Found highest of all the seaweeds.',
      slot: 5,
      glyph: 'triangle',
      radius: 0.1,
      clump: { scale: 1.8, weight: 0.4, power: 1.4 },
      density: (_x, _y, e) => 4 * bump(e.elevation - 16, 2),
    },
    {
      id: 'periwinkle',
      name: 'Flat periwinkle',
      scientific: 'Littorina obtusata',
      description: 'A small snail that feeds on wracks on the lower and middle shore.',
      slot: 6,
      glyph: 'square',
      radius: 0.015,
      clump: { scale: 2, weight: 0.5, power: 1.5 },
      density: (_x, _y, e) => 6 * bump(e.elevation - 5, 3),
    },
  ],
  mission: {
    id: 'coastal-zonation',
    ecosystemId: 'coastal',
    title: 'Zonation on the shore',
    question: 'How does the distribution of limpets and seaweeds change from low water to the top of the shore?',
    background:
      'Higher up the shore, organisms spend longer exposed to air, sun and fresh rain. Each species tolerates a different amount of exposure, creating bands called zones.',
    hypothesis: 'Limpet abundance will be greater on the middle shore than on the upper shore.',
    nullHypothesis: 'There is no difference in mean limpet abundance between the middle and upper shore.',
    focalSpeciesId: 'limpet',
    recommendedMethods: ['belt-transect', 'line-transect'],
    suggestedTransect: { start: { x: 20, y: 21 }, end: { x: 20, y: 0.5 } },
    comparison: { zoneA: 'middle', zoneB: 'upper' },
    analysisHint:
      'Run a belt transect straight up the shore. Plot each species against height to see the zones, then compare sections from two zones.',
  },
  art: { sky: '#e3ecec', far: '#9dbebb', mid: '#468189', near: '#7a7b70', accent: '#f4e9cd', water: '#468189', motif: 'shore' },
};

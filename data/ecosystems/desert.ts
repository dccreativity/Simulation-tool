import type { EcosystemDef, Point } from '@/types/ecosystem';
import { bump, smoothstep } from '@/lib/simulation/rng';
import { distToPolyline } from '@/lib/simulation/geometry';
import { SITE, baseEnv, edgeNoise, hex, mix, rockAt, rocks } from './helpers';

const WASH: Point[] = [
  { x: -1, y: 6 },
  { x: 12, y: 9 },
  { x: 22, y: 15 },
  { x: 32, y: 17 },
  { x: 41, y: 22 },
];
const OUTCROP = { x: 33, y: 5, r: 5.5 };
const ROCKS = rocks([
  [31, 3.5, 0.9],
  [34.5, 6, 0.7],
  [36.5, 3, 0.55],
  [30, 7, 0.45],
  [33, 8.8, 0.4],
  [37.5, 7.5, 0.5],
  [9, 20, 0.35],
  [19, 4, 0.3],
]);

const SAND = hex('#dccaa0');
const SAND_LIGHT = hex('#e8dab6');
const WASH_GRAVEL = hex('#c7b58f');
const ROCKY = hex('#b2a488');

export const desert: EcosystemDef = {
  id: 'desert',
  name: 'Desert',
  tagline: 'Sparse vegetation',
  description:
    'Semi-arid scrub where water is the limiting factor. A dry wash channels rare rain, and competition for water spaces the shrubs out evenly.',
  studyFocus: ['Sparse vegetation', 'Distribution patterns (regular, random, clumped)', 'Population density'],
  methods: ['quadrat', 'line-transect'],
  width: SITE.width,
  height: SITE.height,
  defaultSiteCode: 'MOJAVE-05',
  zones: [
    { id: 'wash', label: 'Dry wash', description: 'A sandy channel that carries water after rain.' },
    { id: 'rocky', label: 'Rocky outcrop', description: 'Boulders and thin, stony soil.' },
    { id: 'flat', label: 'Sandy flat', description: 'Open sand between the wash and the rocks.' },
  ],
  env(x, y) {
    const e = baseEnv();
    const washDist = distToPolyline(x, y, WASH) + (edgeNoise(x * 0.6 + 5, y * 0.6) - 0.5) * 0.8;
    e.waterDist = washDist;
    e.moisture = 0.08 + 0.45 * (1 - smoothstep(0.5, 3.5, washDist));
    const outcrop = 1 - smoothstep(OUTCROP.r - 1.5, OUTCROP.r + 1.2, Math.hypot(x - OUTCROP.x, y - OUTCROP.y));
    e.elevation = outcrop; // rockiness 0–1
    e.rock = rockAt(x, y, ROCKS);
    return e;
  },
  zoneAt(_x, _y, e) {
    if (e.waterDist < 2.3) return 'wash';
    if (e.elevation > 0.5) return 'rocky';
    return 'flat';
  },
  ground(x, y, e, n) {
    const ripple = 0.5 + 0.5 * Math.sin(x * 2.2 + y * 0.9 + n * 3);
    let c = mix(SAND, SAND_LIGHT, 0.35 * n + 0.3 * ripple);
    c = mix(c, WASH_GRAVEL, (1 - smoothstep(1.2, 2.6, e.waterDist)) * 0.85);
    c = mix(c, ROCKY, e.elevation * 0.8);
    return c;
  },
  features: [...ROCKS],
  species: [
    {
      id: 'galleta',
      name: 'Big galleta grass',
      scientific: 'Pleuraphis rigida',
      description: 'A drought-tolerant bunchgrass that is densest where the wash holds moisture after rain.',
      slot: 1,
      glyph: 'star',
      radius: 0.15,
      clump: { scale: 3, weight: 0.6, power: 1.8 },
      density: (_x, _y, e) => 0.5 + 4.2 * bump(e.waterDist, 2.2),
    },
    {
      id: 'bursage',
      name: 'White bursage',
      scientific: 'Ambrosia dumosa',
      description: 'A small grey shrub, the most common plant on the open flats.',
      slot: 2,
      glyph: 'circle',
      radius: 0.25,
      clump: { scale: 2, weight: 0.45, power: 1.5 },
      density: (_x, _y, e) => 0.9 * (1 - 0.6 * e.elevation),
    },
    {
      id: 'creosote',
      name: 'Creosote bush',
      scientific: 'Larrea tridentata',
      description: 'Roots compete fiercely for water, so neighbouring bushes end up evenly spaced — a regular distribution.',
      slot: 3,
      glyph: 'hexagon',
      radius: 0.7,
      minSpacing: 3.2,
      density: (_x, _y, e) => 0.1 * (1 - 0.7 * e.elevation) * smoothstep(0.8, 2.2, e.waterDist),
    },
    {
      id: 'brittlebush',
      name: 'Brittlebush',
      scientific: 'Encelia farinosa',
      description: 'Prefers well-drained rocky slopes.',
      slot: 4,
      glyph: 'triangle',
      radius: 0.3,
      clump: { scale: 2, weight: 0.3, power: 1.2 },
      density: (_x, _y, e) => 0.08 + 1.3 * e.elevation,
    },
    {
      id: 'barrel-cactus',
      name: 'Barrel cactus',
      scientific: 'Ferocactus cylindraceus',
      description: 'Rare and slow-growing, mostly on rocky ground.',
      slot: 5,
      glyph: 'cross',
      radius: 0.2,
      clump: { scale: 2, weight: 0.3, power: 1.2 },
      density: (_x, _y, e) => 0.03 + 0.18 * e.elevation,
    },
  ],
  mission: {
    id: 'desert-wash',
    ecosystemId: 'desert',
    title: 'Water in a dry land',
    question: 'Is big galleta grass more abundant in the dry wash than on the sandy flats?',
    background:
      'In deserts, water rather than light or nutrients limits plant growth. After rain, water runs along washes and soaks in, creating a strip of moister ground.',
    hypothesis: 'Galleta grass will be more abundant in the dry wash than on the sandy flats.',
    nullHypothesis: 'There is no difference in mean galleta abundance between the wash and the sandy flats.',
    focalSpeciesId: 'galleta',
    recommendedMethods: ['quadrat', 'line-transect'],
    suggestedTransect: { start: { x: 16, y: 23.5 }, end: { x: 22, y: 2 } },
    comparison: { zoneA: 'wash', zoneB: 'flat' },
    analysisHint:
      'Vegetation is sparse, so small quadrats record mostly zeros. Try a 2 m × 2 m quadrat and see how the mean and SD change.',
  },
  art: { sky: '#f1ead8', far: '#d9c9a3', mid: '#c9b48a', near: '#9d8a67', accent: '#77aca2', motif: 'dunes' },
};

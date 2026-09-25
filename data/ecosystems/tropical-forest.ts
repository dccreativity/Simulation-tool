import type { EcosystemDef, Point } from '@/types/ecosystem';
import { bump, smoothstep } from '@/lib/simulation/rng';
import { distToPolyline } from '@/lib/simulation/geometry';
import { SITE, baseEnv, canopyAt, edgeNoise, hex, mix, trees } from './helpers';

const STREAM: Point[] = [
  { x: -1, y: 20 },
  { x: 10, y: 18 },
  { x: 20, y: 21 },
  { x: 30, y: 19 },
  { x: 41, y: 22 },
];
const STREAM_HALF = 1.2;
const CANOPY = trees([
  [3, 3, 3.5],
  [21, 4, 4.2],
  [29, 3, 3.4],
  [37, 6, 4],
  [33, 13, 4.3],
  [24, 12, 3.6],
  [4.5, 13.5, 3.2],
  [15, 15.5, 3.2],
  [26, 24, 3.4],
  [7, 24.5, 3.4],
  [38.5, 17.5, 2.8],
  [17.5, 25, 2.2],
]);
const PALMS = trees(
  [
    [11, 20.5, 1.6],
    [30, 8.5, 1.4],
    [1.5, 8.5, 1.5],
  ],
  'palm',
  0.12,
);
const ALL_TREES = [...CANOPY, ...PALMS];

const GAP = hex('#86a672');
const GAP_LIGHT = hex('#98b37f');
const FLOOR = hex('#5e7b5a');
const FLOOR_DARK = hex('#4f6c4f');
const WATER = hex('#3f7479');

export const tropicalForest: EcosystemDef = {
  id: 'tropical-forest',
  name: 'Tropical Forest',
  tagline: 'High diversity',
  description:
    'Lowland rainforest with a treefall gap and a clear stream. Many species share the understorey, each specialised for a different light level.',
  studyFocus: ['Species richness and diversity', 'Treefall gaps and light', 'Species distribution'],
  methods: ['quadrat', 'line-transect', 'belt-transect'],
  width: SITE.width,
  height: SITE.height,
  defaultSiteCode: 'SELVA-08',
  zones: [
    { id: 'gap', label: 'Treefall gap', description: 'Bright gap left by a fallen giant.' },
    { id: 'understorey', label: 'Shaded understorey', description: 'Deep shade under the closed canopy.' },
    { id: 'stream', label: 'Stream bank', description: 'Humid ground within 3 m of the stream.' },
  ],
  env(x, y) {
    const e = baseEnv();
    const c = canopyAt(x, y, ALL_TREES);
    e.shade = c.shade;
    e.canopyDist = c.canopyDist;
    const sd = distToPolyline(x, y, STREAM) - STREAM_HALF - (edgeNoise(x * 0.5 + 30, y * 0.5) - 0.5) * 0.6;
    e.waterDist = sd;
    e.water = 1 - smoothstep(-0.1, 0.1, sd);
    e.moisture = 0.55 + 0.4 * (1 - smoothstep(0, 5, sd));
    e.rock = c.trunk ? 1 : 0;
    return e;
  },
  zoneAt(_x, _y, e) {
    if (e.water < 0.5 && e.waterDist < 3) return 'stream';
    if (e.shade < 0.35) return 'gap';
    return 'understorey';
  },
  ground(_x, _y, e, n) {
    let c = mix(GAP, GAP_LIGHT, n);
    c = mix(c, mix(FLOOR, FLOOR_DARK, n), smoothstep(0.15, 0.8, e.shade));
    return mix(c, WATER, e.water);
  },
  features: [...ALL_TREES],
  species: [
    {
      id: 'heliconia',
      name: 'Lobster-claw heliconia',
      scientific: 'Heliconia rostrata',
      description: 'A fast-growing, light-hungry herb that quickly fills treefall gaps.',
      slot: 1,
      glyph: 'star',
      radius: 0.2,
      clump: { scale: 2.5, weight: 0.75, power: 2 },
      density: (_x, _y, e) => 6 * Math.pow(1 - e.shade, 1.4),
    },
    {
      id: 'palm-seedling',
      name: 'Açaí palm seedling',
      scientific: 'Euterpe precatoria',
      description: 'Shade-tolerant seedlings that wait for a gap to open above them.',
      slot: 2,
      glyph: 'circle',
      radius: 0.1,
      clump: { scale: 2, weight: 0.7, power: 1.8 },
      density: (_x, _y, e) => 3 * e.shade,
    },
    {
      id: 'tree-fern',
      name: 'Tree fern',
      scientific: 'Cyathea arborea',
      description: 'Needs constant humidity, so it concentrates along the stream.',
      slot: 3,
      glyph: 'hexagon',
      radius: 0.4,
      clump: { scale: 2.5, weight: 0.3, power: 1.2 },
      density: (_x, _y, e) => 1.8 * bump(e.waterDist - 2, 2.5),
    },
    {
      id: 'ginger',
      name: 'Spiral ginger',
      scientific: 'Costus scaber',
      description: 'Grows in moist, partly shaded ground.',
      slot: 4,
      glyph: 'triangle',
      radius: 0.12,
      clump: { scale: 2.5, weight: 0.5, power: 1.5 },
      density: (_x, _y, e) => 3 * e.moisture * (0.4 + 0.6 * bump(e.shade - 0.5, 0.3)),
    },
    {
      id: 'mahogany',
      name: 'Mahogany seedling',
      scientific: 'Swietenia macrophylla',
      description: 'Seedlings establish best at the edge of gaps, where light and shelter meet.',
      slot: 5,
      glyph: 'diamond',
      radius: 0.08,
      clump: { scale: 2.5, weight: 0.4, power: 1.4 },
      density: (_x, _y, e) => 1.4 * bump(e.canopyDist - 0.5, 2.5),
    },
    {
      id: 'philodendron',
      name: 'Philodendron',
      scientific: 'Philodendron spp.',
      description: 'A climber that starts life on the dark forest floor.',
      slot: 6,
      glyph: 'square',
      radius: 0.12,
      clump: { scale: 2.5, weight: 0.5, power: 1.5 },
      density: (_x, _y, e) => 3.5 * smoothstep(0.3, 0.9, e.shade),
    },
    {
      id: 'selaginella',
      name: 'Spikemoss',
      scientific: 'Selaginella spp.',
      description: 'A low, fern-like carpet of deep shade and damp soil.',
      slot: 7,
      glyph: 'cross',
      radius: 0.05,
      clump: { scale: 2, weight: 0.8, power: 2 },
      density: (_x, _y, e) => 7 * e.shade * e.moisture,
    },
  ],
  mission: {
    id: 'tropical-gap',
    ecosystemId: 'tropical-forest',
    title: 'A gap in the canopy',
    question: 'Is heliconia more abundant in the treefall gap than in the shaded understorey?',
    background:
      'When a giant tree falls, light floods the forest floor. Gap specialists grow fast, while shade-tolerant seedlings wait beneath the canopy.',
    hypothesis: 'Heliconia will be more abundant in the treefall gap than in the shaded understorey.',
    nullHypothesis: 'There is no difference in mean heliconia abundance between the gap and the understorey.',
    focalSpeciesId: 'heliconia',
    recommendedMethods: ['quadrat', 'belt-transect'],
    suggestedTransect: { start: { x: 13, y: 8 }, end: { x: 36, y: 10 } },
    comparison: { zoneA: 'gap', zoneB: 'understorey' },
    analysisHint:
      'With seven species, compare species richness per quadrat between the gap and the understorey too.',
  },
  art: { sky: '#dfe8e2', far: '#77aca2', mid: '#3f7466', near: '#1f4a45', accent: '#f4e9cd', water: '#468189', motif: 'jungle' },
};

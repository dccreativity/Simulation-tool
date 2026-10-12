import type { EcosystemDef, Point } from '@/types/ecosystem';
import { bump, smoothstep } from '@/lib/simulation/rng';
import { distToPolyline } from '@/lib/simulation/geometry';
import { SITE, baseEnv, canopyAt, edgeNoise, hex, mix, rockAt, rocks, trees } from './helpers';

const STREAM: Point[] = [
  { x: 26.5, y: -1 },
  { x: 28.5, y: 4 },
  { x: 32, y: 8.5 },
  { x: 34.5, y: 13.5 },
  { x: 37.5, y: 18.5 },
  { x: 41, y: 22.5 },
];
const STREAM_HALF = 1.1;
const PATH: Point[] = [
  { x: -1, y: 19.5 },
  { x: 7, y: 17 },
  { x: 14, y: 14.2 },
  { x: 21, y: 12.4 },
  { x: 27.5, y: 10.8 },
  { x: 31.5, y: 9.4 },
];
const PATH_HALF = 0.7;
const SHRUBS = trees(
  [
    [5, 5, 1.6],
    [11.5, 21.8, 1.3],
    [19.5, 3.4, 1.8],
    [37.2, 3.4, 1.4],
    [23.5, 21, 1.5],
    [2.8, 11, 1.1],
  ],
  'shrub',
);
const ROCKS = rocks([
  [15, 7, 0.35],
  [9, 9.5, 0.25],
  [25, 17.5, 0.4],
  [30.5, 21.5, 0.3],
  [18.5, 18.5, 0.28],
  [31, 15, 0.3],
]);

const MEADOW = hex('#8fae80');
const MEADOW_LIGHT = hex('#a8bf8e');
const DAMP = hex('#789f79');
const PATH_SOIL = hex('#cbb893');
const WATER = hex('#4c8087');
const WATER_DEEP = hex('#35646d');

export const grassland: EcosystemDef = {
  id: 'grassland',
  name: 'Grassland',
  tagline: 'Plant abundance',
  description:
    'A hay meadow crossed by a well-used footpath and bordered by a stream. Trampling, soil moisture and patchy clover create gradients you can measure.',
  studyFocus: ['Plant abundance', 'Species distribution', 'Effect of disturbance (trampling)'],
  methods: ['quadrat', 'line-transect', 'belt-transect'],
  width: SITE.width,
  height: SITE.height,
  defaultSiteCode: 'MEADOW-01',
  zones: [
    { id: 'footpath', label: 'Trampled path', description: 'The footpath and its trampled edges.' },
    { id: 'meadow', label: 'Open meadow', description: 'Untrampled grassland away from the path and stream.' },
    { id: 'bank', label: 'Stream bank', description: 'Damp ground within a few metres of the stream.' },
    { id: 'stream', label: 'Stream', description: 'Open water — no meadow plants.' },
  ],
  env(x, y) {
    const e = baseEnv();
    const wobble = (edgeNoise(x * 0.4, y * 0.4) - 0.5) * 0.6;
    const sd = distToPolyline(x, y, STREAM) - STREAM_HALF - wobble;
    e.waterDist = sd;
    e.water = 1 - smoothstep(-0.12, 0.12, sd);
    e.pathDist = distToPolyline(x, y, PATH) + (edgeNoise(x * 1.3 + 40, y * 1.3) - 0.5) * 0.35;
    e.trample = 1 - smoothstep(PATH_HALF * 0.5, PATH_HALF + 1.7, e.pathDist);
    const c = canopyAt(x, y, SHRUBS);
    e.shade = c.shade;
    e.canopyDist = c.canopyDist;
    e.rock = rockAt(x, y, ROCKS);
    e.moisture = 0.35 + 0.6 * (1 - smoothstep(0, 5, sd));
    return e;
  },
  zoneAt(_x, _y, e) {
    if (e.water > 0.5) return 'stream';
    if (e.pathDist < PATH_HALF + 0.9) return 'footpath';
    if (e.waterDist < 3) return 'bank';
    return 'meadow';
  },
  ground(_x, _y, e, n) {
    let c = mix(MEADOW, MEADOW_LIGHT, n);
    c = mix(c, DAMP, smoothstep(0.55, 0.9, e.moisture));
    c = mix(c, PATH_SOIL, smoothstep(0.35, 0.92, e.trample) * (0.85 + n * 0.15));
    if (e.water > 0) c = mix(c, mix(WATER, WATER_DEEP, smoothstep(-0.2, -1.0, e.waterDist)), e.water);
    return c;
  },
  features: [...SHRUBS, ...ROCKS],
  species: [
    {
      id: 'daisy',
      name: 'Daisy',
      scientific: 'Bellis perennis',
      description: 'A low rosette plant of short turf. Tolerates mowing and grazing but is crushed by heavy trampling.',
      slot: 1,
      glyph: 'circle',
      radius: 0.04,
      clump: { scale: 3.2, weight: 0.45, power: 1.4 },
      density: (_x, _y, e) =>
        11 * (1 - 0.93 * e.trample) * (1 - 0.7 * smoothstep(0.55, 0.95, e.moisture)) * (1 - e.shade),
    },
    {
      id: 'plantain',
      name: 'Ribwort plantain',
      scientific: 'Plantago lanceolata',
      description: 'Tough, flat leaves survive trampling, so it thrives along path edges where competitors are crushed.',
      slot: 2,
      glyph: 'star',
      radius: 0.07,
      clump: { scale: 2.5, weight: 0.3, power: 1.3 },
      density: (_x, _y, e) => (1.8 + 10 * bump(e.pathDist - 1.1, 0.85)) * (1 - e.shade),
    },
    {
      id: 'buttercup',
      name: 'Meadow buttercup',
      scientific: 'Ranunculus acris',
      description: 'Prefers damp soil, so it is most common on the stream bank.',
      slot: 3,
      glyph: 'triangle',
      radius: 0.05,
      clump: { scale: 2.8, weight: 0.4, power: 1.5 },
      density: (_x, _y, e) => (0.7 + 8.5 * bump(e.waterDist - 1.8, 1.7)) * (1 - 0.6 * e.trample) * (1 - e.shade),
    },
    {
      id: 'clover',
      name: 'White clover',
      scientific: 'Trifolium repens',
      description: 'Spreads by creeping stems, forming dense patches with gaps between — a strongly clumped distribution.',
      slot: 4,
      glyph: 'diamond',
      radius: 0.05,
      clump: { scale: 4, weight: 0.93, power: 2.4 },
      density: (_x, _y, e) => 5 * (1 - 0.55 * e.trample) * (1 - e.shade),
    },
    {
      id: 'dandelion',
      name: 'Dandelion',
      scientific: 'Taraxacum officinale',
      description: 'A coloniser of disturbed ground, scattered across the meadow and slightly commoner beside the path.',
      slot: 5,
      glyph: 'square',
      radius: 0.06,
      clump: { scale: 3.5, weight: 0.25, power: 1.2 },
      density: (_x, _y, e) => (1.3 + 2.2 * e.trample * smoothstep(0.3, 0.8, e.pathDist)) * (1 - e.shade),
    },
  ],
  mission: {
    id: 'grassland-trampling',
    ecosystemId: 'grassland',
    title: 'Trampling and daisies',
    question: 'Does trampling along the footpath reduce the abundance of daisies?',
    background:
      'Footpaths compact the soil and crush plants. Some species cope better than others, so trampling can change which plants grow where.',
    hypothesis: 'Daisies will be less abundant on the trampled path than in the open meadow.',
    nullHypothesis: 'There is no difference in mean daisy abundance between the trampled path and the open meadow.',
    focalSpeciesId: 'daisy',
    recommendedMethods: ['quadrat', 'belt-transect'],
    suggestedTransect: { start: { x: 17, y: 5 }, end: { x: 20, y: 22 } },
    comparison: { zoneA: 'footpath', zoneB: 'meadow' },
    analysisHint:
      'Use stratified sampling so both the path and the meadow get quadrats, then compare the two groups with a t-test.',
  },
  art: { sky: '#dfe9e4', far: '#9dbebb', mid: '#77aca2', near: '#5d8f75', accent: '#f4e9cd', water: '#468189', motif: 'meadow' },
};

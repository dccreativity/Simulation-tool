import type { EcosystemDef, Point } from '@/types/ecosystem';
import { bump, smoothstep } from '@/lib/simulation/rng';
import { distToPolyline } from '@/lib/simulation/geometry';
import { SITE, baseEnv, canopyAt, hex, mix, trees } from './helpers';

const ROAD_EDGE = 2.2; // road occupies y < 2.2
const PAVEMENT_EDGE = 3.2; // pavement y 2.2–3.2, park beyond
const PATH_A: Point[] = [
  { x: -1, y: 22 },
  { x: 14, y: 14 },
  { x: 26, y: 11 },
  { x: 41, y: 5 },
];
const PATH_B: Point[] = [
  { x: 20, y: 3 },
  { x: 22, y: 12 },
  { x: 25, y: 26 },
];
const PATH_HALF = 0.9;
const TREES = trees([
  [8, 7.5, 3.4],
  [33, 16, 3.8],
  [12.5, 21.5, 3],
  [37, 23.5, 2.6],
]);

const ROAD = hex('#6f7477');
const KERB = hex('#bdb6a6');
const PAVING = hex('#cfc7b3');
const LAWN = hex('#93b585');
const LAWN_STRIPE = hex('#a3c190');
const WORN = hex('#b9b28c');
const SHADE_GRASS = hex('#7a9a70');

export const urbanPark: EcosystemDef = {
  id: 'urban-park',
  name: 'Urban Park',
  tagline: 'Disturbance impact',
  description:
    'A mown city park bordered by a busy road and crossed by paths. Trampling, shade and pollution from the road create strong edge effects.',
  studyFocus: ['Human disturbance', 'Biodiversity', 'Edge effects'],
  methods: ['quadrat', 'line-transect', 'belt-transect'],
  width: SITE.width,
  height: SITE.height,
  defaultSiteCode: 'PARK-07',
  zones: [
    { id: 'roadside', label: 'Road edge', description: 'Within 4 m of the road, exposed to salt and exhaust.' },
    { id: 'path', label: 'Path edge', description: 'Trampled strips beside the paths.' },
    { id: 'shade', label: 'Tree shade', description: 'Under the crowns of park trees.' },
    { id: 'lawn', label: 'Open lawn', description: 'Mown grass away from edges.' },
  ],
  env(x, y) {
    const e = baseEnv();
    e.edgeDist = y - PAVEMENT_EDGE;
    e.pathDist = Math.min(distToPolyline(x, y, PATH_A), distToPolyline(x, y, PATH_B));
    e.trample = 1 - smoothstep(PATH_HALF, PATH_HALF + 1.6, e.pathDist);
    const c = canopyAt(x, y, TREES);
    e.shade = c.shade;
    e.canopyDist = c.canopyDist;
    // Paving, road and tree trunks: nothing grows.
    e.rock = y < PAVEMENT_EDGE || e.pathDist < PATH_HALF || c.trunk ? 1 : 0;
    return e;
  },
  zoneAt(_x, _y, e) {
    if (e.edgeDist < 4) return 'roadside';
    if (e.pathDist < PATH_HALF + 1.6) return 'path';
    if (e.shade > 0.5) return 'shade';
    return 'lawn';
  },
  ground(x, y, e, n) {
    if (y < ROAD_EDGE) return mix(ROAD, [120, 125, 128], n * 0.4);
    if (y < PAVEMENT_EDGE) return mix(KERB, PAVING, smoothstep(ROAD_EDGE, ROAD_EDGE + 0.2, y));
    if (e.pathDist < PATH_HALF) return mix(PAVING, KERB, n * 0.3);
    const stripe = Math.floor((x + y * 0.15) / 2.5) % 2 === 0 ? 0.65 : 0.1;
    let c = mix(LAWN, LAWN_STRIPE, stripe * (0.7 + 0.3 * n));
    c = mix(c, WORN, smoothstep(0.2, 0.95, e.trample) * 0.8);
    c = mix(c, SHADE_GRASS, smoothstep(0.2, 0.9, e.shade));
    c = mix(c, WORN, (1 - smoothstep(0, 2.5, e.edgeDist)) * 0.5);
    return c;
  },
  features: [...TREES],
  species: [
    {
      id: 'daisy',
      name: 'Daisy',
      scientific: 'Bellis perennis',
      description: 'Thrives in regularly mown lawns but suffers from salt spray and exhaust near roads.',
      slot: 1,
      glyph: 'circle',
      radius: 0.04,
      clump: { scale: 3, weight: 0.45, power: 1.4 },
      density: (_x, _y, e) => 10 * (1 - 0.9 * e.trample) * smoothstep(0.5, 6, e.edgeDist) * (1 - 0.85 * e.shade),
    },
    {
      id: 'dandelion',
      name: 'Dandelion',
      scientific: 'Taraxacum officinale',
      description: 'A tough coloniser of disturbed ground, commoner along the road edge.',
      slot: 2,
      glyph: 'square',
      radius: 0.06,
      clump: { scale: 3, weight: 0.3, power: 1.3 },
      density: (_x, _y, e) => (1.4 + 3 * (1 - smoothstep(0, 5, e.edgeDist)) + 1.5 * e.trample) * (1 - 0.6 * e.shade),
    },
    {
      id: 'greater-plantain',
      name: 'Greater plantain',
      scientific: 'Plantago major',
      description: 'Flat rosettes survive trampling, so it lines path edges.',
      slot: 3,
      glyph: 'star',
      radius: 0.07,
      clump: { scale: 2.5, weight: 0.35, power: 1.3 },
      density: (_x, _y, e) => 11 * bump(e.pathDist - 1.25, 0.65) + 3.5 * (1 - smoothstep(0, 3, e.edgeDist)),
    },
    {
      id: 'clover',
      name: 'White clover',
      scientific: 'Trifolium repens',
      description: 'Forms patches in the lawn, fixing nitrogen from the air.',
      slot: 4,
      glyph: 'diamond',
      radius: 0.05,
      clump: { scale: 4, weight: 0.9, power: 2.2 },
      density: (_x, _y, e) => 5 * (1 - 0.6 * e.trample) * (1 - 0.7 * e.shade),
    },
    {
      id: 'moss',
      name: 'Rough-stalked feather-moss',
      scientific: 'Brachythecium rutabulum',
      description: 'Replaces grass in shade under trees, where the lawn is thin.',
      slot: 5,
      glyph: 'hexagon',
      radius: 0.08,
      clump: { scale: 2, weight: 0.5, power: 1.5 },
      density: (_x, _y, e) => 9 * smoothstep(0.3, 0.9, e.shade),
    },
  ],
  mission: {
    id: 'park-edge',
    ecosystemId: 'urban-park',
    title: 'The edge effect',
    question: 'Is daisy abundance lower near the road edge than in the open lawn?',
    background:
      'Roads bring salt, exhaust and trampling. Habitat edges often differ from their interiors — an edge effect that matters for conservation in fragmented habitats.',
    hypothesis: 'Daisies will be less abundant within 4 m of the road than in the open lawn.',
    nullHypothesis: 'There is no difference in mean daisy abundance between the road edge and the open lawn.',
    focalSpeciesId: 'daisy',
    recommendedMethods: ['quadrat', 'belt-transect'],
    suggestedTransect: { start: { x: 17.5, y: 3.5 }, end: { x: 15, y: 23.5 } },
    comparison: { zoneA: 'roadside', zoneB: 'lawn' },
    analysisHint:
      'A belt transect running away from the road shows the edge effect. Then compare road-edge and lawn quadrats with a t-test.',
  },
  art: { sky: '#e5ece8', far: '#b9c9c4', mid: '#77aca2', near: '#5b8a70', accent: '#f4e9cd', motif: 'park' },
};

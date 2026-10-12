import type { EcosystemDef, Point } from '@/types/ecosystem';
import { bump, smoothstep } from '@/lib/simulation/rng';
import { distToPolyline } from '@/lib/simulation/geometry';
import { SITE, baseEnv, edgeNoise, hex, mix } from './helpers';

const CHANNEL_A: Point[] = [
  { x: -1, y: 8 },
  { x: 8, y: 10 },
  { x: 15, y: 7.5 },
  { x: 24, y: 11 },
  { x: 31, y: 9 },
  { x: 41, y: 12 },
];
const CHANNEL_B: Point[] = [
  { x: 24, y: 11 },
  { x: 26, y: 17 },
  { x: 22, y: 23 },
  { x: 20, y: 26 },
];
const POOLS = [
  { x: 9, y: 18.5, r: 1.6 },
  { x: 34, y: 19.5, r: 2 },
];

const WATER = hex('#447781');
const WATER_DEEP = hex('#34666f');
const MARSH = hex('#809f7c');
const MARSH_LIGHT = hex('#94ae86');
const DRIER = hex('#a4b387');
const SPHAGNUM = hex('#9aa56d');

export const wetland: EcosystemDef = {
  id: 'wetland',
  name: 'Wetland',
  tagline: 'Biodiversity',
  description:
    'A lowland marsh drained by slow channels and dotted with pools. Waterlogging decides which specialists can survive, and diversity peaks at the wet margins.',
  studyFocus: ['Biodiversity and species richness', 'Moisture gradient', 'Species distribution'],
  methods: ['quadrat', 'line-transect', 'belt-transect'],
  width: SITE.width,
  height: SITE.height,
  defaultSiteCode: 'MARSH-06',
  zones: [
    { id: 'channel', label: 'Open channel', description: 'Slow-moving open water.' },
    { id: 'wet', label: 'Wet margin', description: 'Waterlogged ground up to 2 m from open water.' },
    { id: 'marsh', label: 'Marsh', description: 'Damp ground 2–6 m from open water.' },
    { id: 'dry', label: 'Drier ground', description: 'More than 6 m from open water.' },
  ],
  env(x, y) {
    const e = baseEnv();
    const w = (edgeNoise(x * 0.5 + 70, y * 0.5) - 0.5) * 0.7;
    let d = Math.min(distToPolyline(x, y, CHANNEL_A) - 0.95, distToPolyline(x, y, CHANNEL_B) - 0.7);
    for (const p of POOLS) d = Math.min(d, Math.hypot(x - p.x, y - p.y) - p.r);
    d -= w;
    e.waterDist = d;
    e.water = 1 - smoothstep(-0.1, 0.1, d);
    e.moisture = 1 - smoothstep(0, 8, d);
    return e;
  },
  zoneAt(_x, _y, e) {
    if (e.water > 0.5) return 'channel';
    if (e.waterDist < 2) return 'wet';
    if (e.waterDist < 6) return 'marsh';
    return 'dry';
  },
  ground(_x, _y, e, n) {
    let c = mix(MARSH, MARSH_LIGHT, n);
    c = mix(c, DRIER, smoothstep(4, 9, e.waterDist));
    c = mix(c, SPHAGNUM, bump(e.waterDist - 3, 1.5) * (n > 0.55 ? 0.7 : 0.2));
    return mix(c, mix(WATER, WATER_DEEP, smoothstep(-0.1, -0.8, e.waterDist)), e.water);
  },
  features: [],
  species: [
    {
      id: 'soft-rush',
      name: 'Soft rush',
      scientific: 'Juncus effusus',
      description: 'Dense tussocks on waterlogged ground along the channel banks.',
      slot: 1,
      glyph: 'star',
      radius: 0.15,
      clump: { scale: 2.5, weight: 0.6, power: 1.6 },
      density: (_x, _y, e) => 7 * bump(e.waterDist - 1.4, 1.4),
    },
    {
      id: 'cotton-grass',
      name: 'Common cotton grass',
      scientific: 'Eriophorum angustifolium',
      description: 'A sedge with fluffy white seed heads, growing in the wettest peaty ground.',
      slot: 2,
      glyph: 'circle',
      radius: 0.06,
      clump: { scale: 3.5, weight: 0.8, power: 2 },
      density: (_x, _y, e) => 9 * smoothstep(0.55, 0.9, e.moisture),
    },
    {
      id: 'sphagnum',
      name: 'Sphagnum hummock',
      scientific: 'Sphagnum spp.',
      description: 'Bog moss that builds spongy hummocks and holds many times its weight in water.',
      slot: 3,
      glyph: 'hexagon',
      radius: 0.3,
      clump: { scale: 2, weight: 0.6, power: 1.6 },
      density: (_x, _y, e) => 3 * bump(e.waterDist - 3, 2),
    },
    {
      id: 'ragged-robin',
      name: 'Ragged robin',
      scientific: 'Silene flos-cuculi',
      description: 'A pink-flowered plant of damp meadows and marsh edges.',
      slot: 4,
      glyph: 'triangle',
      radius: 0.05,
      clump: { scale: 2.5, weight: 0.5, power: 1.5 },
      density: (_x, _y, e) => 2.5 * bump(e.waterDist - 2.5, 2),
    },
    {
      id: 'marsh-orchid',
      name: 'Southern marsh orchid',
      scientific: 'Dactylorhiza praetermissa',
      description: 'Uncommon and strongly clumped — easy to miss with too few samples.',
      slot: 5,
      glyph: 'diamond',
      radius: 0.04,
      clump: { scale: 4, weight: 0.9, power: 2.5 },
      density: (_x, _y, e) => 0.8 * bump(e.waterDist - 4, 2),
    },
    {
      id: 'moor-grass',
      name: 'Purple moor-grass',
      scientific: 'Molinia caerulea',
      description: 'A tussock grass of drier, acidic ground away from the channels.',
      slot: 6,
      glyph: 'square',
      radius: 0.1,
      clump: { scale: 3, weight: 0.5, power: 1.5 },
      density: (_x, _y, e) => 5 * smoothstep(4, 9, e.waterDist),
    },
  ],
  mission: {
    id: 'wetland-diversity',
    ecosystemId: 'wetland',
    title: 'Wet feet',
    question: 'Is soft rush more abundant on the wet margins than on drier ground?',
    background:
      'Waterlogged soil is short of oxygen, so only specialist plants can root there. Moving away from open water, conditions — and the plant community — change.',
    hypothesis: 'Soft rush will be more abundant on the wet margin than on drier ground.',
    nullHypothesis: 'There is no difference in mean soft rush abundance between the wet margin and drier ground.',
    focalSpeciesId: 'soft-rush',
    recommendedMethods: ['quadrat', 'belt-transect'],
    suggestedTransect: { start: { x: 15, y: 8.2 }, end: { x: 14, y: 23.5 } },
    comparison: { zoneA: 'wet', zoneB: 'dry' },
    analysisHint:
      'Also compare species richness per quadrat between zones — a simple measure of biodiversity.',
  },
  art: { sky: '#e1eae6', far: '#9dbebb', mid: '#77aca2', near: '#5b806c', accent: '#f4e9cd', water: '#468189', motif: 'marsh' },
};

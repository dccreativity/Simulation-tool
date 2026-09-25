import type { EcosystemDef } from '@/types/ecosystem';
import { bump, smoothstep } from '@/lib/simulation/rng';
import { ellipseSignedDist } from '@/lib/simulation/geometry';
import { SITE, baseEnv, edgeNoise, hex, mix, rockAt, rocks } from './helpers';

const POND = { cx: 17, cy: 12.5, rx: 10.5, ry: 7 };
const ROCKS = rocks([
  [33, 4, 0.35],
  [36.5, 20, 0.3],
  [4, 22.5, 0.3],
]);

const DEEP = hex('#2f5f68');
const SHALLOW = hex('#5f9291');
const MUD = hex('#8e8a68');
const BANK = hex('#7c9f78');
const DRY = hex('#9db584');
const DRY_LIGHT = hex('#afc392');

export const pond: EcosystemDef = {
  id: 'pond',
  name: 'Pond',
  tagline: 'Aquatic plants',
  description:
    'A lowland pond with a reed-fringed margin grading into damp bank and dry grassland. Water depth and soil moisture sort the plants into bands.',
  studyFocus: ['Aquatic plant abundance', 'Gradient from the water’s edge', 'Species distribution'],
  methods: ['quadrat', 'line-transect', 'belt-transect'],
  width: SITE.width,
  height: SITE.height,
  defaultSiteCode: 'POND-03',
  zones: [
    { id: 'open', label: 'Open water', description: 'Deeper water more than 2 m from the edge.' },
    { id: 'margin', label: 'Shallow margin', description: 'Shallow water up to 2 m from the edge.' },
    { id: 'bank', label: 'Damp bank', description: 'Wet ground up to 3.5 m from the water.' },
    { id: 'dry', label: 'Dry grassland', description: 'Drier ground further from the pond.' },
  ],
  env(x, y) {
    const e = baseEnv();
    const wobble = (edgeNoise(x * 0.3 + 11, y * 0.3) - 0.5) * 1.6;
    const sd = ellipseSignedDist(x, y, POND.cx, POND.cy, POND.rx, POND.ry) - wobble;
    e.waterDist = sd;
    e.water = 1 - smoothstep(-0.1, 0.1, sd);
    e.elevation = Math.max(0, -sd) * 0.3; // depth in metres
    e.moisture = 1 - smoothstep(0, 7, sd);
    e.rock = rockAt(x, y, ROCKS);
    return e;
  },
  zoneAt(_x, _y, e) {
    if (e.waterDist < -2) return 'open';
    if (e.waterDist < 0) return 'margin';
    if (e.waterDist < 3.5) return 'bank';
    return 'dry';
  },
  ground(_x, _y, e, n) {
    let land = mix(DRY, DRY_LIGHT, n);
    land = mix(land, BANK, 1 - smoothstep(1, 4.5, e.waterDist));
    land = mix(land, MUD, bump(e.waterDist - 0.25, 0.45) * 0.75);
    const water = mix(SHALLOW, DEEP, smoothstep(0.1, 1.6, e.elevation));
    return mix(land, water, e.water);
  },
  features: [...ROCKS],
  species: [
    {
      id: 'reed',
      name: 'Common reed',
      scientific: 'Phragmites australis',
      description: 'A tall grass rooted in shallow water and waterlogged soil. Forms dense reed beds right at the water’s edge.',
      slot: 1,
      glyph: 'star',
      radius: 0.06,
      habitat: 'both',
      clump: { scale: 3, weight: 0.6, power: 1.6 },
      density: (_x, _y, e) => 16 * bump(e.waterDist + 0.3, 1.0),
    },
    {
      id: 'water-lily',
      name: 'White water lily',
      scientific: 'Nymphaea alba',
      description: 'Rooted in the mud of deeper water with leaves floating on the surface.',
      slot: 2,
      glyph: 'circle',
      radius: 0.3,
      habitat: 'water',
      clump: { scale: 3, weight: 0.5, power: 1.5 },
      density: (_x, _y, e) => 1.6 * smoothstep(0.45, 1.3, e.elevation),
    },
    {
      id: 'marsh-marigold',
      name: 'Marsh marigold',
      scientific: 'Caltha palustris',
      description: 'Needs permanently wet soil, so it hugs the water’s edge.',
      slot: 3,
      glyph: 'diamond',
      radius: 0.08,
      clump: { scale: 2, weight: 0.7, power: 1.8 },
      density: (_x, _y, e) => 5 * bump(e.waterDist - 0.8, 0.8),
    },
    {
      id: 'water-mint',
      name: 'Water mint',
      scientific: 'Mentha aquatica',
      description: 'A scented plant of damp banks and marshy ground.',
      slot: 4,
      glyph: 'square',
      radius: 0.05,
      clump: { scale: 2.5, weight: 0.5, power: 1.5 },
      density: (_x, _y, e) => 7 * bump(e.waterDist - 1.8, 1.4),
    },
    {
      id: 'soft-rush',
      name: 'Soft rush',
      scientific: 'Juncus effusus',
      description: 'Grows in clumps on damp, poorly drained ground a little way back from the water.',
      slot: 5,
      glyph: 'triangle',
      radius: 0.12,
      clump: { scale: 3, weight: 0.6, power: 1.6 },
      density: (_x, _y, e) => 4.5 * bump(e.waterDist - 4, 2.2),
    },
  ],
  mission: {
    id: 'pond-gradient',
    ecosystemId: 'pond',
    title: 'From water to dry land',
    question: 'How does the abundance of common reed change with distance from the water’s edge?',
    background:
      'Around a pond, soil moisture and water depth change over just a few metres. Each species is adapted to a particular band of this gradient.',
    hypothesis: 'Common reed will be most abundant in the shallow margin and decline with distance onto the bank.',
    nullHypothesis: 'There is no difference in mean reed abundance between the shallow margin and the damp bank.',
    focalSpeciesId: 'reed',
    recommendedMethods: ['belt-transect', 'line-transect', 'quadrat'],
    suggestedTransect: { start: { x: 21, y: 12.5 }, end: { x: 39.5, y: 12.5 } },
    comparison: { zoneA: 'margin', zoneB: 'bank' },
    analysisHint:
      'Run a belt transect from open water onto dry land and plot abundance against distance. Look for the band where each species peaks.',
  },
  art: { sky: '#e2ebe8', far: '#9dbebb', mid: '#77aca2', near: '#4f7f6c', accent: '#f4e9cd', water: '#468189', motif: 'pond' },
};

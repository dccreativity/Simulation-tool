import type { EcosystemDef } from '@/types/ecosystem';
import { bump, smoothstep } from '@/lib/simulation/rng';
import { SITE, baseEnv, canopyAt, hex, mix, rockAt, rocks, trees } from './helpers';

const TREES = trees([
  [4, 4, 4.2],
  [11.5, 3, 3.6],
  [18, 2, 3.2],
  [26, 2.5, 3.9],
  [34, 4, 4.4],
  [39.5, 11.5, 3.8],
  [35.5, 19, 4.2],
  [28.5, 24, 3.6],
  [19, 24, 3.8],
  [10.5, 22, 4.4],
  [3, 16.5, 4],
  [6.5, 10.5, 3.2],
  [13.5, 9.5, 2.5],
  [32, 11.5, 2.4],
  [25.5, 19.5, 1.6],
  [14, 16.5, 2.2],
]);
const ROCKS = rocks([
  [22.5, 8, 0.3],
  [17, 13.5, 0.22],
  [29.5, 16, 0.35],
]);

const CLEARING = hex('#98b182');
const CLEARING_LIGHT = hex('#aabf8f');
const LITTER = hex('#7d876a');
const LITTER_DARK = hex('#6a775c');
const MOSSY = hex('#6f8c66');

export const woodland: EcosystemDef = {
  id: 'woodland',
  name: 'Woodland',
  tagline: 'Tree saplings',
  description:
    'Mature oak and beech woodland around a sunny clearing left by a fallen tree. Light, not space, limits what grows on the woodland floor.',
  studyFocus: ['Tree regeneration', 'Understorey vegetation', 'Distance from the canopy', 'Species distribution'],
  methods: ['quadrat', 'line-transect', 'belt-transect'],
  width: SITE.width,
  height: SITE.height,
  defaultSiteCode: 'OAKWOOD-02',
  zones: [
    { id: 'canopy', label: 'Closed canopy', description: 'Deep shade beneath the tree crowns.' },
    { id: 'edge', label: 'Canopy edge', description: 'Dappled light at the edge of the crowns.' },
    { id: 'clearing', label: 'Clearing', description: 'Open, sunny ground in the gap.' },
  ],
  env(x, y) {
    const e = baseEnv();
    const c = canopyAt(x, y, TREES);
    e.shade = c.shade;
    e.canopyDist = c.canopyDist;
    e.rock = c.trunk ? 1 : rockAt(x, y, ROCKS);
    e.moisture = 0.45 + 0.25 * c.shade;
    return e;
  },
  zoneAt(_x, _y, e) {
    if (e.shade > 0.7) return 'canopy';
    if (e.shade > 0.2) return 'edge';
    return 'clearing';
  },
  ground(_x, _y, e, n) {
    let c = mix(CLEARING, CLEARING_LIGHT, n);
    const under = mix(LITTER, LITTER_DARK, n);
    c = mix(c, mix(under, MOSSY, n > 0.62 ? 0.6 : 0), smoothstep(0.1, 0.8, e.shade));
    return c;
  },
  features: [...ROCKS, ...TREES],
  species: [
    {
      id: 'bluebell',
      name: 'Bluebell',
      scientific: 'Hyacinthoides non-scripta',
      description: 'Flowers in spring before the canopy closes. Grows in dense carpets in shade, where grasses and bracken cannot compete.',
      slot: 1,
      glyph: 'circle',
      radius: 0.05,
      clump: { scale: 3, weight: 0.7, power: 1.8 },
      density: (_x, _y, e) => 15 * smoothstep(0.3, 0.8, e.shade),
    },
    {
      id: 'oak-seedling',
      name: 'Oak seedling',
      scientific: 'Quercus robur',
      description: 'Acorns fall beneath parent trees, but seedlings need light to survive. Most establish near the canopy edge.',
      slot: 2,
      glyph: 'triangle',
      radius: 0.08,
      clump: { scale: 2.5, weight: 0.4, power: 1.4 },
      density: (_x, _y, e) => 3.2 * bump(e.canopyDist - 0.5, 2.2),
    },
    {
      id: 'bracken',
      name: 'Bracken',
      scientific: 'Pteridium aquilinum',
      description: 'A light-demanding fern that spreads by underground rhizomes, forming dense stands in clearings.',
      slot: 3,
      glyph: 'star',
      radius: 0.2,
      clump: { scale: 4.5, weight: 0.85, power: 2 },
      density: (_x, _y, e) => 7 * Math.pow(1 - e.shade, 1.5),
    },
    {
      id: 'anemone',
      name: 'Wood anemone',
      scientific: 'Anemone nemorosa',
      description: 'A slow-spreading spring flower of partial shade, often used as an indicator of ancient woodland.',
      slot: 4,
      glyph: 'diamond',
      radius: 0.04,
      clump: { scale: 2.5, weight: 0.6, power: 1.6 },
      density: (_x, _y, e) => 9 * bump(e.shade - 0.55, 0.22),
    },
    {
      id: 'male-fern',
      name: 'Male fern',
      scientific: 'Dryopteris filix-mas',
      description: 'A shade-tolerant fern scattered through the woodland.',
      slot: 5,
      glyph: 'hexagon',
      radius: 0.25,
      clump: { scale: 3, weight: 0.3, power: 1.2 },
      density: (_x, _y, e) => 1.5 * e.shade,
    },
  ],
  mission: {
    id: 'woodland-light',
    ecosystemId: 'woodland',
    title: 'Life under the canopy',
    question: 'Is the abundance of bluebells different under the closed canopy compared with the clearing?',
    background:
      'Tree crowns intercept most of the light. Shade-tolerant spring flowers can grow under the canopy, while light-demanding plants such as bracken dominate open gaps.',
    hypothesis: 'Bluebells will be more abundant under the closed canopy than in the clearing.',
    nullHypothesis: 'There is no difference in mean bluebell abundance between the closed canopy and the clearing.',
    focalSpeciesId: 'bluebell',
    recommendedMethods: ['quadrat', 'belt-transect'],
    suggestedTransect: { start: { x: 22, y: 12.5 }, end: { x: 36, y: 22 } },
    comparison: { zoneA: 'canopy', zoneB: 'clearing' },
    analysisHint:
      'A belt transect from the centre of the clearing into the canopy shows the gradient. For a t-test, take stratified quadrats in both zones.',
  },
  art: { sky: '#e4ece6', far: '#9dbebb', mid: '#5f8f7e', near: '#2f5f5a', accent: '#f4e9cd', motif: 'forest' },
};

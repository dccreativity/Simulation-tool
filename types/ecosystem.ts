export type EcosystemId =
  | 'grassland'
  | 'woodland'
  | 'pond'
  | 'coastal'
  | 'desert'
  | 'wetland'
  | 'urban-park'
  | 'tropical-forest';

export type SamplingMethod = 'quadrat' | 'line-transect' | 'belt-transect';

export type GlyphShape = 'circle' | 'star' | 'triangle' | 'square' | 'diamond' | 'cross' | 'ring' | 'hexagon';

export interface Point {
  x: number;
  y: number;
}

/** Environmental conditions at a point. Species density functions read these. */
export interface Env {
  /** 1 in open water, 0 on land (soft 0–1 at the edge). */
  water: number;
  /** Metres from the water's edge: negative in the water, positive on land. */
  waterDist: number;
  /** Trampling / disturbance intensity, 0–1. */
  trample: number;
  /** Metres from the centre line of the nearest path. */
  pathDist: number;
  /** Canopy shade, 0 (open sky) – 1 (closed canopy). */
  shade: number;
  /** Metres from the nearest canopy edge: negative under the canopy. */
  canopyDist: number;
  /** 1 inside a rock or tree trunk, where nothing grows. */
  rock: number;
  /** Ecosystem-specific gradient, e.g. height up the shore in metres. */
  elevation: number;
  /** Metres from the disturbed edge of the site (roads, field margins). */
  edgeDist: number;
  /** Soil moisture, 0 (dry) – 1 (saturated). */
  moisture: number;
}

export interface SpeciesDef {
  id: string;
  name: string;
  scientific: string;
  description: string;
  /** 1-based slot in the categorical species palette. */
  slot: number;
  glyph: GlyphShape;
  /** Typical spread (radius) of one plant or animal, in metres. */
  radius: number;
  /** Mean number of individuals per m² given the local environment. */
  density: (x: number, y: number, env: Env) => number;
  /** Patchiness: weight 0 = even, 1 = entirely in clumps; power sharpens them. */
  clump?: { scale: number; weight: number; power: number };
  /** Regular spacing from competition (e.g. desert shrubs): minimum gap in metres. */
  minSpacing?: number;
  /** Where it can grow. Land species are excluded from open water, water species from land. */
  habitat?: 'land' | 'water' | 'both';
}

export interface ZoneDef {
  id: string;
  label: string;
  description: string;
}

export type MapFeature =
  | { type: 'tree'; x: number; y: number; r: number; trunk?: number; kind?: 'broadleaf' | 'conifer' | 'palm' | 'shrub' }
  | { type: 'rock'; x: number; y: number; r: number; seed: number }
  | { type: 'label'; x: number; y: number; text: string };

export interface Mission {
  id: string;
  ecosystemId: EcosystemId;
  title: string;
  question: string;
  background: string;
  hypothesis: string;
  nullHypothesis: string;
  focalSpeciesId: string;
  recommendedMethods: SamplingMethod[];
  /** A transect across the main environmental gradient. */
  suggestedTransect: { start: Point; end: Point };
  /** Two zones worth comparing with a t-test. */
  comparison: { zoneA: string; zoneB: string };
  analysisHint: string;
}

export interface EcosystemDef {
  id: EcosystemId;
  name: string;
  /** Short line under the name on cards, e.g. "Plant abundance". */
  tagline: string;
  description: string;
  studyFocus: string[];
  methods: SamplingMethod[];
  /** Site size in metres. */
  width: number;
  height: number;
  /** Default site code; a class entering the same code samples the same site. */
  defaultSiteCode: string;
  species: SpeciesDef[];
  zones: ZoneDef[];
  env: (x: number, y: number) => Env;
  zoneAt: (x: number, y: number, env: Env) => string;
  /** Ground colour for the field view, as [r, g, b] 0–255. `n` is texture noise 0–1. */
  ground: (x: number, y: number, env: Env, n: number) => [number, number, number];
  features: MapFeature[];
  mission: Mission;
  /** Keys the card illustration. */
  art: {
    sky: string;
    far: string;
    mid: string;
    near: string;
    accent: string;
    water?: string;
    motif: 'meadow' | 'forest' | 'pond' | 'shore' | 'dunes' | 'marsh' | 'park' | 'jungle';
  };
}

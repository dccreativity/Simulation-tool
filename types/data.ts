import type { EcosystemId, Point } from './ecosystem';

export type ColumnType = 'number' | 'text';

export interface Column {
  key: string;
  label: string;
  type: ColumnType;
  unit?: string;
}

/** Numbers are stored as numbers; anything a student typed that is not a valid number stays as text. */
export type CellValue = string | number | null;

export interface Row {
  id: string;
  values: Record<string, CellValue>;
}

export type DatasetKind = 'quadrat' | 'line-transect' | 'belt-transect' | 'custom' | 'frequency';
export type DatasetSource = 'simulation' | 'user' | 'example';

export interface Dataset {
  id: string;
  name: string;
  kind: DatasetKind;
  source: DatasetSource;
  description?: string;
  ecosystemId?: EcosystemId;
  missionId?: string;
  siteCode?: string;
  columns: Column[];
  rows: Row[];
  /** Default numeric column for analysis. */
  valueColumn?: string;
  /** Text column that splits rows into groups (e.g. habitat zone). */
  groupColumn?: string;
  createdAt: string;
  updatedAt: string;
}

/** Points at a set of numbers inside a dataset, optionally filtered to one group. */
export interface VariableRef {
  datasetId: string;
  column: string;
  groupColumn?: string;
  groupValue?: string;
}

export type AnalysisType = 'descriptive' | 't-test' | 'chi-squared-gof' | 'chi-squared-independence';

export interface SavedAnalysis {
  id: string;
  type: AnalysisType;
  title: string;
  createdAt: string;
  datasetIds: string[];
  /** Human-readable description of the inputs, e.g. "Dataset A: Quadrats — meadow". */
  inputs: Record<string, string | number | boolean>;
  /** Key numbers of the result. */
  result: Record<string, number | string | boolean | null>;
  headline: string;
  detail: string;
}

/* ── simulation session ─────────────────────────────────────────────────── */

export type PlacementStrategy = 'random' | 'systematic' | 'stratified' | 'manual';

export interface QuadratSample {
  id: string;
  number: number;
  x: number;
  y: number;
  size: number;
  strategy: PlacementStrategy;
  counts: Record<string, number>;
  total: number;
  richness: number;
  zone: string;
  createdAt: number;
}

export interface PlannedQuadrat {
  id: string;
  x: number;
  y: number;
  size: number;
  strategy: PlacementStrategy;
}

export interface TransectSegmentRecord {
  from: number;
  to: number;
  zone: string;
  counts: Record<string, number>;
  total: number;
  richness: number;
  area?: number;
}

export interface TransectRecord {
  id: string;
  number: number;
  kind: 'line' | 'belt';
  start: Point;
  end: Point;
  length: number;
  interval: number;
  width?: number;
  segments: TransectSegmentRecord[];
  createdAt: number;
}

export type SamplingTool = 'quadrat' | 'line-transect' | 'belt-transect';

export interface SimulationSettings {
  tool: SamplingTool;
  quadratSize: number;
  strategy: 'random' | 'systematic' | 'stratified';
  sampleCount: number;
  lineInterval: number;
  beltWidth: number;
  beltInterval: number;
}

export interface SimulationSession {
  ecosystemId: EcosystemId;
  siteCode: string;
  focalSpeciesId: string;
  startedAt: number | null;
  samples: QuadratSample[];
  planned: PlannedQuadrat[];
  transects: TransectRecord[];
  settings: SimulationSettings;
  /** Datasets this session has been exported to, so re-exporting updates them. */
  datasetIds: { quadrat?: string; line?: string; belt?: string };
  /** Line/belt transect being laid out but not yet surveyed. */
  draft: { start: Point | null; end: Point | null };
}

import type { EcosystemId } from './ecosystem';
import type { Column, DatasetKind, Row, SavedAnalysis } from './data';

export type SyncStatus = 'local' | 'pending' | 'synced' | 'error';

export interface DatasetSnapshot {
  id: string;
  name: string;
  kind: DatasetKind;
  columns: Column[];
  rows: Row[];
  valueColumn?: string;
  groupColumn?: string;
}

export interface DescriptiveSnapshot {
  label: string;
  n: number;
  mean: number;
  median: number;
  modes: number[];
  min: number;
  max: number;
  range: number;
  sd: number;
}

export type ChartKind = 'distribution' | 'bar' | 'histogram' | 'box' | 'transect';

export interface ChartSpec {
  kind: ChartKind;
  datasetId: string;
  column: string;
  title: string;
}

export interface NotebookEntry {
  id: string;
  /** Local id of the investigation row this entry belongs to. */
  investigationId: string;
  title: string;
  mode: 'simulation' | 'my-data';
  ecosystemId?: EcosystemId;
  ecosystemName?: string;
  missionId?: string;
  siteCode?: string;
  researchQuestion: string;
  hypothesis: string;
  samplingMethod: string;
  sampleSize: number | null;
  datasets: DatasetSnapshot[];
  descriptive: DescriptiveSnapshot[];
  tests: SavedAnalysis[];
  charts: ChartSpec[];
  conclusion: string;
  limitations: string;
  createdAt: string;
  updatedAt: string;
  sync: { status: SyncStatus; syncedAt?: string; error?: string };
}

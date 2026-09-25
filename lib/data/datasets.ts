import type { EcosystemDef } from '@/types/ecosystem';
import type { CellValue, Column, Dataset, DatasetKind, Row, SimulationSession, VariableRef } from '@/types/data';
import { parseNumber } from '@/lib/validation/numbers';
import { toCsv } from './csv';
import { nowIso, uid } from './ids';

export function newDataset(partial: Partial<Dataset> & Pick<Dataset, 'name' | 'kind' | 'columns'>): Dataset {
  const t = nowIso();
  return {
    id: uid(),
    source: 'user',
    rows: [],
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
}

export function blankRow(columns: readonly Column[]): Row {
  return { id: uid(), values: Object.fromEntries(columns.map((c) => [c.key, null])) };
}

/** Store numbers as numbers; keep unparseable text so the student can see and fix it. */
export function coerceCell(column: Column, raw: string): CellValue {
  const s = raw.trim();
  if (s === '') return null;
  if (column.type === 'text') return s;
  const n = parseNumber(s);
  return n ?? s;
}

export const numericColumns = (d: Dataset) => d.columns.filter((c) => c.type === 'number');
export const textColumns = (d: Dataset) => d.columns.filter((c) => c.type === 'text');

export function groupValues(d: Dataset, groupColumn: string): string[] {
  const seen = new Set<string>();
  for (const r of d.rows) {
    const v = r.values[groupColumn];
    if (v !== null && v !== undefined && String(v).trim() !== '') seen.add(String(v));
  }
  return [...seen];
}

export interface ExtractedNumbers {
  values: number[];
  /** Cells containing text that is not a number. */
  invalid: number;
  /** Empty cells. */
  missing: number;
}

export function extractNumbers(d: Dataset | undefined, ref: Omit<VariableRef, 'datasetId'>): ExtractedNumbers {
  const out: ExtractedNumbers = { values: [], invalid: 0, missing: 0 };
  if (!d) return out;
  for (const r of d.rows) {
    if (ref.groupColumn && ref.groupValue !== undefined && String(r.values[ref.groupColumn] ?? '') !== ref.groupValue) continue;
    const v = r.values[ref.column];
    if (v === null || v === undefined || v === '') {
      out.missing++;
      continue;
    }
    const n = parseNumber(v);
    if (n === null) out.invalid++;
    else out.values.push(n);
  }
  return out;
}

export function describeRef(d: Dataset | undefined, ref: Omit<VariableRef, 'datasetId'>): string {
  if (!d) return 'Missing dataset';
  const col = d.columns.find((c) => c.key === ref.column)?.label ?? ref.column;
  const group = ref.groupColumn && ref.groupValue ? ` — ${ref.groupValue}` : '';
  return `${d.name}: ${col}${group}`;
}

export function datasetToCsv(d: Dataset): string {
  const header = d.columns.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label));
  return toCsv([header, ...d.rows.map((r) => d.columns.map((c) => r.values[c.key]))]);
}

export const KIND_LABELS: Record<DatasetKind, string> = {
  quadrat: 'Quadrat data',
  'line-transect': 'Line transect',
  'belt-transect': 'Belt transect',
  custom: 'Custom data',
  frequency: 'Frequency data',
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const zoneName = (eco: EcosystemDef, id: string) => eco.zones.find((z) => z.id === id)?.label ?? id;

/** Quadrat samples → a dataset with one row per quadrat and one column per species. */
export function quadratDataset(eco: EcosystemDef, session: SimulationSession, existing?: Dataset): Dataset {
  const focal = eco.species.find((s) => s.id === session.focalSpeciesId) ?? eco.species[0];
  const columns: Column[] = [
    { key: 'sample', label: 'Sample', type: 'number' },
    ...eco.species.map((s): Column => ({ key: `sp_${s.id}`, label: s.name, type: 'number' })),
    { key: 'total', label: 'Total individuals', type: 'number' },
    { key: 'richness', label: 'Species richness', type: 'number' },
    { key: 'density', label: `${focal.name} density`, type: 'number', unit: 'per m²' },
    { key: 'zone', label: 'Zone', type: 'text' },
    { key: 'x', label: 'x', type: 'number', unit: 'm' },
    { key: 'y', label: 'y', type: 'number', unit: 'm' },
    { key: 'size', label: 'Quadrat size', type: 'number', unit: 'm' },
    { key: 'strategy', label: 'Placement', type: 'text' },
  ];
  const rows: Row[] = session.samples.map((s) => ({
    id: s.id,
    values: {
      sample: s.number,
      ...Object.fromEntries(eco.species.map((sp) => [`sp_${sp.id}`, s.counts[sp.id] ?? 0])),
      total: s.total,
      richness: s.richness,
      density: r2((s.counts[focal.id] ?? 0) / (s.size * s.size)),
      zone: zoneName(eco, s.zone),
      x: r2(s.x),
      y: r2(s.y),
      size: s.size,
      strategy: s.strategy,
    },
  }));
  const t = nowIso();
  return {
    id: existing?.id ?? uid(),
    name: existing?.name ?? `${eco.name} quadrats (${session.siteCode})`,
    kind: 'quadrat',
    source: 'simulation',
    description: `${session.samples.length} quadrats sampled in the ${eco.name.toLowerCase()} simulation. Counts are individuals rooted inside each frame.`,
    ecosystemId: eco.id,
    missionId: eco.mission.id,
    siteCode: session.siteCode,
    columns,
    rows,
    valueColumn: `sp_${focal.id}`,
    groupColumn: 'zone',
    createdAt: existing?.createdAt ?? t,
    updatedAt: t,
  };
}

/** Transect records → one row per section of each transect. */
export function transectDataset(eco: EcosystemDef, session: SimulationSession, kind: 'line' | 'belt', existing?: Dataset): Dataset {
  const focal = eco.species.find((s) => s.id === session.focalSpeciesId) ?? eco.species[0];
  const transects = session.transects.filter((t) => t.kind === kind);
  const columns: Column[] = [
    { key: 'transect', label: 'Transect', type: 'number' },
    { key: 'distance', label: 'Distance', type: 'number', unit: 'm' },
    ...eco.species.map((s): Column => ({ key: `sp_${s.id}`, label: s.name, type: 'number' })),
    { key: 'total', label: 'Total individuals', type: 'number' },
    { key: 'richness', label: 'Species richness', type: 'number' },
    ...(kind === 'belt' ? [{ key: 'density', label: `${focal.name} density`, type: 'number', unit: 'per m²' } as Column] : []),
    { key: 'zone', label: 'Zone', type: 'text' },
    { key: 'from', label: 'From', type: 'number', unit: 'm' },
    { key: 'to', label: 'To', type: 'number', unit: 'm' },
  ];
  const rows: Row[] = transects.flatMap((t) =>
    t.segments.map((g, i) => ({
      id: `${t.id}-${i}`,
      values: {
        transect: t.number,
        distance: r2((g.from + g.to) / 2),
        ...Object.fromEntries(eco.species.map((sp) => [`sp_${sp.id}`, g.counts[sp.id] ?? 0])),
        total: g.total,
        richness: g.richness,
        ...(kind === 'belt' ? { density: g.area ? r2((g.counts[focal.id] ?? 0) / g.area) : null } : {}),
        zone: zoneName(eco, g.zone),
        from: r2(g.from),
        to: r2(g.to),
      },
    })),
  );
  const t = nowIso();
  const label = kind === 'line' ? 'line transect' : 'belt transect';
  return {
    id: existing?.id ?? uid(),
    name: existing?.name ?? `${eco.name} ${label} (${session.siteCode})`,
    kind: kind === 'line' ? 'line-transect' : 'belt-transect',
    source: 'simulation',
    description:
      kind === 'line'
        ? `Individuals touching the tape, grouped by distance along ${transects.length} line transect${transects.length === 1 ? '' : 's'}.`
        : `Individuals rooted inside each section of ${transects.length} belt transect${transects.length === 1 ? '' : 's'}.`,
    ecosystemId: eco.id,
    missionId: eco.mission.id,
    siteCode: session.siteCode,
    columns,
    rows,
    valueColumn: `sp_${focal.id}`,
    groupColumn: 'zone',
    createdAt: existing?.createdAt ?? t,
    updatedAt: t,
  };
}

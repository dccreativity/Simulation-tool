import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Column, ColumnType, Dataset, SavedAnalysis } from '@/types/data';
import { blankRow, coerceCell } from '@/lib/data/datasets';
import { nowIso, uid } from '@/lib/data/ids';
import { persistStorage } from './storage';

interface DataState {
  datasets: Dataset[];
  /** Recent test results, newest first — available to attach to a notebook entry. */
  analyses: SavedAnalysis[];
  activeDatasetId: string | null;

  upsertDataset: (d: Dataset) => void;
  removeDataset: (id: string) => void;
  renameDataset: (id: string, name: string) => void;
  setActiveDataset: (id: string | null) => void;
  setCell: (datasetId: string, rowId: string, columnKey: string, raw: string) => void;
  addRow: (datasetId: string) => string | null;
  deleteRow: (datasetId: string, rowId: string) => void;
  duplicateRow: (datasetId: string, rowId: string) => void;
  clearRows: (datasetId: string) => void;
  addColumn: (datasetId: string, label: string, type: ColumnType) => void;
  updateColumn: (datasetId: string, key: string, patch: Partial<Pick<Column, 'label' | 'type' | 'unit'>>) => void;
  removeColumn: (datasetId: string, key: string) => void;
  setDatasetRoles: (datasetId: string, roles: { valueColumn?: string; groupColumn?: string | null }) => void;
  saveAnalysis: (a: SavedAnalysis) => void;
  removeAnalysis: (id: string) => void;
}

const touch = (d: Dataset): Dataset => ({ ...d, updatedAt: nowIso() });

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => {
      const patch = (id: string, fn: (d: Dataset) => Dataset) =>
        set((s) => ({ datasets: s.datasets.map((d) => (d.id === id ? touch(fn(d)) : d)) }));
      return {
        datasets: [],
        analyses: [],
        activeDatasetId: null,

        upsertDataset: (d) =>
          set((s) => ({
            datasets: s.datasets.some((x) => x.id === d.id) ? s.datasets.map((x) => (x.id === d.id ? d : x)) : [d, ...s.datasets],
          })),
        removeDataset: (id) =>
          set((s) => ({
            datasets: s.datasets.filter((d) => d.id !== id),
            activeDatasetId: s.activeDatasetId === id ? null : s.activeDatasetId,
          })),
        renameDataset: (id, name) => patch(id, (d) => ({ ...d, name: name.trim() || d.name })),
        setActiveDataset: (id) => set({ activeDatasetId: id }),
        setCell: (datasetId, rowId, columnKey, raw) =>
          patch(datasetId, (d) => {
            const col = d.columns.find((c) => c.key === columnKey);
            if (!col) return d;
            return {
              ...d,
              rows: d.rows.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, [columnKey]: coerceCell(col, raw) } } : r)),
            };
          }),
        addRow: (datasetId) => {
          const d = get().datasets.find((x) => x.id === datasetId);
          if (!d) return null;
          const row = blankRow(d.columns);
          patch(datasetId, (x) => ({ ...x, rows: [...x.rows, row] }));
          return row.id;
        },
        deleteRow: (datasetId, rowId) => patch(datasetId, (d) => ({ ...d, rows: d.rows.filter((r) => r.id !== rowId) })),
        duplicateRow: (datasetId, rowId) =>
          patch(datasetId, (d) => {
            const i = d.rows.findIndex((r) => r.id === rowId);
            if (i < 0) return d;
            const copy = { id: uid(), values: { ...d.rows[i].values } };
            return { ...d, rows: [...d.rows.slice(0, i + 1), copy, ...d.rows.slice(i + 1)] };
          }),
        clearRows: (datasetId) => patch(datasetId, (d) => ({ ...d, rows: [] })),
        addColumn: (datasetId, label, type) =>
          patch(datasetId, (d) => {
            const key = `c_${uid().slice(0, 8)}`;
            return {
              ...d,
              columns: [...d.columns, { key, label: label.trim() || `Column ${d.columns.length + 1}`, type }],
              rows: d.rows.map((r) => ({ ...r, values: { ...r.values, [key]: null } })),
            };
          }),
        updateColumn: (datasetId, key, change) =>
          patch(datasetId, (d) => {
            const columns = d.columns.map((c) => (c.key === key ? { ...c, ...change } : c));
            const col = columns.find((c) => c.key === key)!;
            // Re-interpret existing cells when the type changes.
            const rows =
              change.type === undefined
                ? d.rows
                : d.rows.map((r) => ({
                    ...r,
                    values: { ...r.values, [key]: coerceCell(col, r.values[key] === null ? '' : String(r.values[key])) },
                  }));
            return { ...d, columns, rows };
          }),
        removeColumn: (datasetId, key) =>
          patch(datasetId, (d) => ({
            ...d,
            columns: d.columns.filter((c) => c.key !== key),
            rows: d.rows.map((r) => {
              const values = { ...r.values };
              delete values[key];
              return { ...r, values };
            }),
            valueColumn: d.valueColumn === key ? undefined : d.valueColumn,
            groupColumn: d.groupColumn === key ? undefined : d.groupColumn,
          })),
        setDatasetRoles: (datasetId, roles) =>
          patch(datasetId, (d) => ({
            ...d,
            valueColumn: roles.valueColumn ?? d.valueColumn,
            groupColumn: roles.groupColumn === null ? undefined : (roles.groupColumn ?? d.groupColumn),
          })),
        saveAnalysis: (a) => set((s) => ({ analyses: [a, ...s.analyses.filter((x) => x.id !== a.id)].slice(0, 40) })),
        removeAnalysis: (id) => set((s) => ({ analyses: s.analyses.filter((a) => a.id !== id) })),
      };
    },
    { name: 'efl-data', storage: persistStorage, skipHydration: true, version: 1 },
  ),
);

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Hash, Plus, Trash2, Type } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import type { CellValue, Column, Dataset } from '@/types/data';
import { parseNumber } from '@/lib/validation/numbers';
import { useDataStore } from '@/lib/store/data-store';
import { cn } from '@/lib/cn';

const show = (v: CellValue) => (v === null || v === undefined ? '' : String(v));

function isInvalid(col: Column, v: CellValue) {
  return col.type === 'number' && v !== null && v !== '' && parseNumber(v) === null;
}

/** A cell that edits a draft while focused and commits on blur / Enter, so typing "1." is not lost. */
function Cell({
  col,
  value,
  onCommit,
  onEnter,
  label,
  cellRef,
}: {
  col: Column;
  value: CellValue;
  onCommit: (raw: string) => void;
  onEnter: (dir: 1 | -1) => void;
  label: string;
  cellRef: (el: HTMLInputElement | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = isInvalid(col, value);
  const commit = () => {
    if (draft !== null && draft !== show(value)) onCommit(draft);
    setDraft(null);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      commit();
      onEnter(e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey) ? -1 : 1);
    } else if (e.key === 'Escape') {
      setDraft(null);
      (e.target as HTMLInputElement).blur();
    }
  };
  return (
    <input
      ref={cellRef}
      value={draft ?? show(value)}
      onFocus={() => setDraft(show(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
      inputMode={col.type === 'number' ? 'decimal' : 'text'}
      aria-label={label}
      aria-invalid={invalid || undefined}
      title={invalid ? 'Something looks unusual: this is not a number.' : undefined}
      className={cn(
        'num h-9 w-full min-w-[84px] rounded-md border border-transparent bg-transparent px-2 text-sm text-ink hover:border-line focus:border-teal-600 focus:bg-paper focus:outline-none',
        col.type === 'number' ? 'text-right' : 'text-left',
        invalid && 'border-danger-line bg-danger-bg text-danger',
      )}
    />
  );
}

export function DataGrid({ dataset }: { dataset: Dataset }) {
  const setCell = useDataStore((s) => s.setCell);
  const addRow = useDataStore((s) => s.addRow);
  const deleteRow = useDataStore((s) => s.deleteRow);
  const duplicateRow = useDataStore((s) => s.duplicateRow);
  const updateColumn = useDataStore((s) => s.updateColumn);
  const removeColumn = useDataStore((s) => s.removeColumn);
  const setRoles = useDataStore((s) => s.setDatasetRoles);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const cols = dataset.columns;

  const focusCell = (rowIndex: number, colKey: string) => {
    const row = dataset.rows[rowIndex];
    if (row) window.requestAnimationFrame(() => inputs.current.get(`${row.id}:${colKey}`)?.focus());
  };

  const move = (rowIndex: number, colKey: string, dir: 1 | -1) => {
    const next = rowIndex + dir;
    if (next >= dataset.rows.length && dir === 1) {
      const id = addRow(dataset.id);
      if (id) window.setTimeout(() => inputs.current.get(`${id}:${colKey}`)?.focus(), 30);
      return;
    }
    focusCell(Math.max(0, next), colKey);
  };

  return (
    <div className="scrollbar-thin overflow-auto rounded-2xl border border-line bg-paper">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{dataset.name} — editable data table</caption>
        <thead className="sticky top-0 z-[2] bg-cream-100">
          <tr>
            <th scope="col" className="w-12 px-2 py-2 text-left text-[0.7rem] font-medium text-ink-3">
              #
            </th>
            {cols.map((c) => (
              <th key={c.key} scope="col" className="min-w-[110px] px-1 py-1.5 text-left align-bottom">
                <div className="flex flex-col gap-1">
                  <input
                    defaultValue={c.label}
                    key={c.label}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== c.label && updateColumn(dataset.id, c.key, { label: e.target.value.trim() })}
                    aria-label={`Column name: ${c.label}`}
                    className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-[0.78rem] font-semibold text-ink hover:border-line focus:border-teal-600 focus:bg-paper focus:outline-none"
                  />
                  <div className="flex items-center gap-0.5 px-1">
                    <button
                      type="button"
                      onClick={() => updateColumn(dataset.id, c.key, { type: c.type === 'number' ? 'text' : 'number' })}
                      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[0.68rem] text-ink-3 hover:bg-teal-50 hover:text-ink"
                      title={`Column holds ${c.type === 'number' ? 'numbers' : 'text'} — click to change`}
                    >
                      {c.type === 'number' ? <Hash className="size-3" aria-hidden /> : <Type className="size-3" aria-hidden />}
                      {c.type === 'number' ? 'number' : 'text'}
                    </button>
                    {c.type === 'number' ? (
                      <button
                        type="button"
                        onClick={() => setRoles(dataset.id, { valueColumn: c.key })}
                        aria-pressed={dataset.valueColumn === c.key}
                        className={cn('rounded px-1 py-0.5 text-[0.68rem] hover:bg-teal-50', dataset.valueColumn === c.key ? 'font-semibold text-teal-700' : 'text-ink-3')}
                        title="Analyse this column by default"
                      >
                        {dataset.valueColumn === c.key ? '● analysed' : 'analyse'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRoles(dataset.id, { groupColumn: dataset.groupColumn === c.key ? null : c.key })}
                        aria-pressed={dataset.groupColumn === c.key}
                        className={cn('rounded px-1 py-0.5 text-[0.68rem] hover:bg-teal-50', dataset.groupColumn === c.key ? 'font-semibold text-teal-700' : 'text-ink-3')}
                        title="Use this column to split rows into groups"
                      >
                        {dataset.groupColumn === c.key ? '● groups' : 'group by'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete the column “${c.label}”? Its values will be removed.`)) removeColumn(dataset.id, c.key);
                      }}
                      className="ml-auto rounded p-0.5 text-ink-3 hover:bg-danger-bg hover:text-danger"
                      aria-label={`Delete column ${c.label}`}
                    >
                      <Trash2 className="size-3" aria-hidden />
                    </button>
                  </div>
                </div>
              </th>
            ))}
            <th scope="col" className="w-20 px-2 py-2">
              <span className="sr-only">Row actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {dataset.rows.map((r, ri) => (
              <motion.tr
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="group border-t border-line hover:bg-cream-100/50"
              >
                <td className="num px-2 text-xs text-ink-3">{ri + 1}</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-0.5 py-0.5">
                    <Cell
                      col={c}
                      value={r.values[c.key] ?? null}
                      label={`Row ${ri + 1}, ${c.label}`}
                      onCommit={(raw) => setCell(dataset.id, r.id, c.key, raw)}
                      onEnter={(dir) => move(ri, c.key, dir)}
                      cellRef={(el) => {
                        const k = `${r.id}:${c.key}`;
                        if (el) inputs.current.set(k, el);
                        else inputs.current.delete(k);
                      }}
                    />
                  </td>
                ))}
                <td className="px-1">
                  <div className="flex justify-end opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
                    <button type="button" onClick={() => duplicateRow(dataset.id, r.id)} className="rounded-md p-1.5 text-ink-3 hover:bg-teal-50 hover:text-ink" aria-label={`Duplicate row ${ri + 1}`}>
                      <Copy className="size-3.5" aria-hidden />
                    </button>
                    <button type="button" onClick={() => deleteRow(dataset.id, r.id)} className="rounded-md p-1.5 text-ink-3 hover:bg-danger-bg hover:text-danger" aria-label={`Delete row ${ri + 1}`}>
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => {
          const id = addRow(dataset.id);
          if (id && cols[0]) window.setTimeout(() => inputs.current.get(`${id}:${cols[0].key}`)?.focus(), 30);
        }}
        className="flex w-full items-center justify-center gap-2 border-t border-line py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50"
      >
        <Plus className="size-4" aria-hidden /> Add row
      </button>
    </div>
  );
}

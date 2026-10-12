'use client';

import { useId } from 'react';
import type { Dataset, VariableRef } from '@/types/data';
import { Field, Select } from '@/components/ui/field';
import { groupValues, numericColumns, textColumns, KIND_LABELS } from '@/lib/data/datasets';

/** Choose dataset → numeric column → (optionally) one group of rows. */
export function VariablePicker({
  datasets,
  value,
  onChange,
  label = 'Dataset',
  compact = false,
}: {
  datasets: Dataset[];
  value: VariableRef | null;
  onChange: (v: VariableRef | null) => void;
  label?: string;
  compact?: boolean;
}) {
  const id = useId();
  const ds = datasets.find((d) => d.id === value?.datasetId);
  const numeric = ds ? numericColumns(ds) : [];
  const texts = ds ? textColumns(ds) : [];
  const groups = ds && value?.groupColumn ? groupValues(ds, value.groupColumn) : [];

  const pickDataset = (datasetId: string) => {
    const d = datasets.find((x) => x.id === datasetId);
    if (!d) return onChange(null);
    const column = d.valueColumn && d.columns.some((c) => c.key === d.valueColumn) ? d.valueColumn : numericColumns(d)[0]?.key;
    onChange(column ? { datasetId: d.id, column } : { datasetId: d.id, column: '' });
  };

  return (
    <div className={compact ? 'grid gap-3 sm:grid-cols-3' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'}>
      <Field label={label} htmlFor={`${id}-d`}>
        <Select id={`${id}-d`} value={value?.datasetId ?? ''} onChange={(e) => pickDataset(e.target.value)}>
          <option value="" disabled>
            Choose a dataset…
          </option>
          {(['quadrat', 'line-transect', 'belt-transect', 'custom', 'frequency'] as const).map((kind) => {
            const list = datasets.filter((d) => d.kind === kind);
            if (!list.length) return null;
            return (
              <optgroup key={kind} label={KIND_LABELS[kind]}>
                {list.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </Select>
      </Field>
      <Field label="Variable" htmlFor={`${id}-c`}>
        <Select id={`${id}-c`} value={value?.column ?? ''} disabled={!ds} onChange={(e) => value && onChange({ ...value, column: e.target.value })}>
          {!numeric.length && <option value="">No numeric columns</option>}
          {numeric.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
              {c.unit ? ` (${c.unit})` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Rows" htmlFor={`${id}-g`}>
        <Select
          id={`${id}-g`}
          disabled={!ds || !texts.length}
          value={value?.groupColumn && value.groupValue !== undefined ? `${value.groupColumn}::${value.groupValue}` : ''}
          onChange={(e) => {
            if (!value) return;
            if (!e.target.value) return onChange({ datasetId: value.datasetId, column: value.column });
            const [groupColumn, ...rest] = e.target.value.split('::');
            onChange({ ...value, groupColumn, groupValue: rest.join('::') });
          }}
        >
          <option value="">All rows</option>
          {texts.map((t) =>
            (ds ? groupValues(ds, t.key) : []).length <= 30 ? (
              <optgroup key={t.key} label={`Only rows where ${t.label} is…`}>
                {(ds ? groupValues(ds, t.key) : []).map((g) => (
                  <option key={g} value={`${t.key}::${g}`}>
                    {g}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </Select>
      </Field>
      {groups.length === 0 && value?.groupColumn && <p className="text-xs text-warn">No rows match this group.</p>}
    </div>
  );
}

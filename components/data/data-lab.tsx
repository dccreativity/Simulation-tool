'use client';

import { ChartColumn, Download, Eraser, FilePlus2, FileUp, Plus, Sprout, Table2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import type { ColumnType, DatasetKind } from '@/types/data';
import { useDataStore } from '@/lib/store/data-store';
import { useHydrated } from '@/lib/store/hydration';
import { datasetToCsv, extractNumbers, newDataset, KIND_LABELS } from '@/lib/data/datasets';
import { datasetFromText, downloadText, readTextFile } from '@/lib/data/import';
import { describe } from '@/lib/statistics/descriptive';
import { formatNumber } from '@/lib/statistics/format';
import { uid } from '@/lib/data/ids';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/callout';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input, Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { DataGrid } from './data-grid';

type Tab = 'quadrat' | 'line-transect' | 'belt-transect' | 'custom';
const tabOf = (kind: DatasetKind): Tab => (kind === 'frequency' ? 'custom' : kind);

const EMPTY: Record<Tab, { title: string; body: string }> = {
  quadrat: { title: 'No quadrat data yet', body: 'Collect quadrat samples in a simulation, then choose “Add to Data Lab”.' },
  'line-transect': { title: 'No line transect data yet', body: 'Run a line transect in a simulation, then choose “Add to Data Lab”.' },
  'belt-transect': { title: 'No belt transect data yet', body: 'Run a belt transect in a simulation, then choose “Add to Data Lab”.' },
  custom: { title: 'No custom data yet', body: 'Create a blank dataset, import a CSV, or paste values in My Data mode.' },
};

export function DataLab() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const router = useRouter();
  const notify = useToast();
  const datasets = useDataStore((s) => s.datasets);
  const upsert = useDataStore((s) => s.upsertDataset);
  const remove = useDataStore((s) => s.removeDataset);
  const rename = useDataStore((s) => s.renameDataset);
  const clearRows = useDataStore((s) => s.clearRows);
  const addColumn = useDataStore((s) => s.addColumn);
  const file = useRef<HTMLInputElement>(null);

  const requested = datasets.find((d) => d.id === params.get('dataset'));
  const [tab, setTab] = useState<Tab | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [colOpen, setColOpen] = useState(false);
  const [colName, setColName] = useState('');
  const [colType, setColType] = useState<ColumnType>('number');

  const activeTab: Tab = tab ?? (requested ? tabOf(requested.kind) : 'quadrat');
  const inTab = datasets.filter((d) => tabOf(d.kind) === activeTab);
  const current = inTab.find((d) => d.id === selected) ?? (requested && tabOf(requested.kind) === activeTab ? requested : inTab[0]);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-11 w-full max-w-xl" label="Loading dataset…" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const createBlank = () => {
    const d = newDataset({
      name: `My dataset ${datasets.filter((x) => x.source === 'user').length + 1}`,
      kind: 'custom',
      columns: [
        { key: 'value', label: 'Value', type: 'number' },
        { key: 'group', label: 'Group', type: 'text' },
      ],
      valueColumn: 'value',
    });
    d.rows = Array.from({ length: 5 }, () => ({ id: uid(), values: { value: null, group: null } }));
    upsert(d);
    setTab('custom');
    setSelected(d.id);
    router.replace(`/data-lab?dataset=${d.id}`, { scroll: false });
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const text = await readTextFile(f);
      const { dataset, parsed } = datasetFromText(f.name.replace(/\.[^.]+$/, ''), text);
      if (!dataset.rows.length) {
        notify({ tone: 'warn', title: 'Your dataset is empty.', body: 'We could not find any rows in that file.' });
        return;
      }
      upsert(dataset);
      setTab(tabOf(dataset.kind));
      setSelected(dataset.id);
      notify({
        tone: parsed.invalid.length ? 'warn' : 'success',
        title: `Imported ${dataset.rows.length} rows`,
        body: parsed.invalid.length ? `Some values could not be interpreted as numbers (${parsed.invalid.length}). They are highlighted in the table.` : `${dataset.columns.length} columns detected.`,
      });
    } catch (e) {
      notify({ tone: 'warn', title: 'Something looks unusual.', body: e instanceof Error && e.message.includes('2 MB') ? e.message : 'We could not read that file. Try saving it as CSV.' });
    } finally {
      if (file.current) file.current.value = '';
    }
  };

  const analysed = current?.valueColumn ? extractNumbers(current, { column: current.valueColumn }) : null;
  const stats = analysed ? describe(analysed.values) : null;
  const invalidCount = current
    ? current.rows.reduce((t, r) => t + current.columns.filter((c) => c.type === 'number' && r.values[c.key] !== null && typeof r.values[c.key] === 'string').length, 0)
    : 0;
  const valueLabel = current?.columns.find((c) => c.key === current.valueColumn)?.label;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Data type"
          value={activeTab}
          onChange={(t) => {
            setTab(t);
            setSelected(null);
          }}
          items={[
            { id: 'quadrat', label: 'Quadrat data' },
            { id: 'line-transect', label: 'Line transect' },
            { id: 'belt-transect', label: 'Belt transect' },
            { id: 'custom', label: 'Custom data' },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <input ref={file} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" id="csv-import" onChange={(e) => void onImport(e.target.files?.[0])} />
          <Button variant="secondary" size="sm" onClick={() => file.current?.click()} icon={<FileUp className="size-4" aria-hidden />}>
            Import CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={createBlank} icon={<FilePlus2 className="size-4" aria-hidden />}>
            New dataset
          </Button>
        </div>
      </div>

      {!current ? (
        <EmptyState
          icon={activeTab === 'custom' ? <Table2 className="size-6" aria-hidden /> : <Sprout className="size-6" aria-hidden />}
          title={EMPTY[activeTab].title}
          actions={
            activeTab === 'custom' ? (
              <>
                <Button size="sm" onClick={createBlank}>
                  Create a dataset
                </Button>
                <ButtonLink href="/my-data" size="sm" variant="secondary">
                  Paste data in My Data
                </ButtonLink>
              </>
            ) : (
              <ButtonLink href="/simulation" size="sm">
                Go to the simulations
              </ButtonLink>
            )
          }
        >
          {EMPTY[activeTab].body}
        </EmptyState>
      ) : (
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
              {inTab.length > 1 && (
                <Field label="Dataset" htmlFor="dl-ds" className="sm:w-72">
                  <Select id="dl-ds" value={current.id} onChange={(e) => setSelected(e.target.value)}>
                    {inTab.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Name" htmlFor="dl-name" className="flex-1">
                <Input id="dl-name" key={current.id + current.name} defaultValue={current.name} onBlur={(e) => rename(current.id, e.target.value)} maxLength={120} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => setColOpen(true)} icon={<Plus className="size-4" aria-hidden />}>
                Column
              </Button>
              <Button variant="ghost" size="sm" onClick={() => downloadText(`${current.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, datasetToCsv(current))} icon={<Download className="size-4" aria-hidden />}>
                Export CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!current.rows.length}
                onClick={() => window.confirm('Clear every row from this dataset? Columns are kept.') && clearRows(current.id)}
                icon={<Eraser className="size-4" aria-hidden />}
              >
                Clear
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (window.confirm(`Delete “${current.name}”? This cannot be undone.`)) {
                    remove(current.id);
                    setSelected(null);
                  }
                }}
                icon={<Trash2 className="size-4" aria-hidden />}
              >
                Delete
              </Button>
            </div>
          </div>
          {current.description && <p className="mb-3 text-sm text-ink-3">{current.description}</p>}

          <div className="mb-3 flex flex-col gap-2">
            {!current.rows.length && <Callout tone="info" title="Your dataset is empty.">Add a row, import a CSV, or paste values in My Data mode.</Callout>}
            {invalidCount > 0 && (
              <Callout tone="warn" title="Some values could not be interpreted as numbers.">
                {invalidCount} highlighted cell{invalidCount === 1 ? '' : 's'} will be left out of calculations until corrected.
              </Callout>
            )}
            {stats && stats.n > 0 && stats.n < 5 && <Callout tone="info">This analysis may be unreliable with the current sample size (n = {stats.n}).</Callout>}
          </div>

          <DataGrid dataset={current} />

          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-cream-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-2">
              <span className="font-semibold text-ink">{KIND_LABELS[current.kind]}</span> · {current.rows.length} rows
              {stats && valueLabel && (
                <>
                  {' '}
                  · {valueLabel}: n = <span className="num font-semibold">{stats.n}</span>, mean = <span className="num font-semibold">{formatNumber(stats.mean)}</span>, SD ={' '}
                  <span className="num font-semibold">{formatNumber(stats.sd)}</span>
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {current.kind === 'frequency' ? (
                <ButtonLink href={`/statistics/chi-squared?dataset=${current.id}`} size="sm" icon={<ChartColumn className="size-4" aria-hidden />}>
                  Chi-squared test
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href={`/statistics?dataset=${current.id}`} size="sm" icon={<ChartColumn className="size-4" aria-hidden />}>
                    Descriptive statistics
                  </ButtonLink>
                  <ButtonLink href={`/statistics/t-test?dataset=${current.id}`} size="sm" variant="secondary">
                    t-test
                  </ButtonLink>
                  {current.kind === 'quadrat' && (
                    <ButtonLink href={`/statistics/chi-squared?dataset=${current.id}&mode=association`} size="sm" variant="secondary">
                      Species association
                    </ButtonLink>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {datasets.length > 0 && (
        <p className="text-xs text-ink-3">
          All datasets are saved on this device as you edit. Save an investigation to your{' '}
          <Link href="/notebook" className="text-teal-700 underline">
            Field Notebook
          </Link>{' '}
          to keep it with your account.
        </p>
      )}

      <Dialog
        open={colOpen}
        onClose={() => setColOpen(false)}
        title="Add a column"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setColOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (current) addColumn(current.id, colName, colType);
                setColName('');
                setColOpen(false);
              }}
            >
              Add column
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Column name" htmlFor="col-name">
            <Input id="col-name" value={colName} onChange={(e) => setColName(e.target.value)} placeholder="e.g. Leaf length (mm)" data-autofocus />
          </Field>
          <Field label="Holds" htmlFor="col-type">
            <Select id="col-type" value={colType} onChange={(e) => setColType(e.target.value as ColumnType)}>
              <option value="number">Numbers (measurements or counts)</option>
              <option value="text">Text (groups, categories, notes)</option>
            </Select>
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChartColumn, ClipboardPaste, FileUp, FlaskConical, Sparkles, Table2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import type { Dataset } from '@/types/data';
import { EXAMPLE_VALUES, exampleDatasets } from '@/lib/data/examples';
import { datasetFromParsed, readTextFile } from '@/lib/data/import';
import { parsePastedData, type ParsedPaste } from '@/lib/data/parse';
import { extractNumbers, numericColumns, KIND_LABELS } from '@/lib/data/datasets';
import { describe } from '@/lib/statistics/descriptive';
import { formatNumber } from '@/lib/statistics/format';
import { GROUP_COLORS } from '@/lib/simulation/palette';
import { useDataStore } from '@/lib/store/data-store';
import { useHydrated } from '@/lib/store/hydration';
import { useProgressStore } from '@/lib/store/progress-store';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Callout } from '@/components/ui/callout';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Tabs } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { useToast } from '@/components/ui/toast';
import { ChartFrame } from '@/components/charts/chart-frame';
import { ObservedExpectedChart } from '@/components/charts/sample-charts';
import { MeanSdChart, SpreadDotPlot } from '@/components/charts/stat-charts';
import { cn } from '@/lib/cn';

type Mode = 'paste' | 'import' | 'examples';

const FORMATS = [
  { label: 'Simple values', text: EXAMPLE_VALUES, note: 'Numbers separated by commas, spaces or new lines.' },
  { label: 'Two groups', text: 'Group A\tGroup B\n12\t7\n15\t5\n8\t9\n17\t4\n11\t8\n14\t6', note: 'Two columns, e.g. pasted from a spreadsheet.' },
  { label: 'Frequency data', text: 'Category, Observed\nDamp side, 29\nDry side, 11', note: 'A category column and a count column.' },
];

function describeParse(p: ParsedPaste): string {
  const n = p.rows.length;
  if (!n) return 'Nothing to analyse yet.';
  if (p.shape === 'values') return `${n} value${n === 1 ? '' : 's'} detected.`;
  if (p.shape === 'groups') return `Two groups detected: ${p.columns[0].label} and ${p.columns[1].label} (${n} rows).`;
  if (p.shape === 'frequency') return `Frequency table detected: ${n} categories.`;
  return `Table detected: ${n} rows × ${p.columns.length} columns.`;
}

export function MyData() {
  const hydrated = useHydrated();
  const notify = useToast();
  const upsert = useDataStore((s) => s.upsertDataset);
  const datasets = useDataStore((s) => s.datasets);
  const record = useProgressStore((s) => s.record);
  const [mode, setMode] = useState<Mode>('paste');
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [resultId, setResultId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parsePastedData(text), [text]);
  const result = datasets.find((d) => d.id === resultId) ?? null;

  const create = (p: ParsedPaste, fallbackName: string) => {
    if (!p.rows.length) {
      notify({ tone: 'warn', title: 'Your dataset is empty.', body: 'Paste or type some values first.' });
      return;
    }
    const d = datasetFromParsed(name || fallbackName, p);
    upsert(d);
    setResultId(d.id);
    record({ type: 'my-data-analysed' });
    notify({
      tone: p.invalid.length ? 'warn' : 'success',
      title: p.invalid.length ? 'Some values could not be interpreted as numbers.' : 'Dataset created',
      body: p.invalid.length ? `${p.invalid.length} value(s) were left out: ${p.invalid.slice(0, 4).map((i) => `“${i.value}”`).join(', ')}` : `${d.name} is saved in your Data Lab.`,
    });
    window.setTimeout(() => document.getElementById('my-data-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const t = await readTextFile(f);
      const p = parsePastedData(t);
      if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
      create(p, f.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      notify({ tone: 'warn', title: 'Something looks unusual.', body: e instanceof Error && e.message.includes('2 MB') ? e.message : 'We could not read that file. Try saving it as CSV.' });
    } finally {
      if (file.current) file.current.value = '';
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
      <div className="flex flex-col gap-5">
        <Card className="overflow-hidden">
          <div className="on-dark bg-navy px-6 py-5 text-cream">
            <p className="text-xs font-semibold tracking-[0.2em] text-pale">USE YOUR OWN DATA</p>
            <p className="mt-1 text-lg">Paste your values or upload a dataset and analyse it.</p>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <Tabs
              label="How to add data"
              value={mode}
              onChange={setMode}
              items={[
                { id: 'paste', label: 'Paste data', icon: <ClipboardPaste className="size-4" aria-hidden /> },
                { id: 'import', label: 'Import CSV', icon: <FileUp className="size-4" aria-hidden /> },
                { id: 'examples', label: 'Try example data', icon: <Sparkles className="size-4" aria-hidden /> },
              ]}
            />

            {mode === 'paste' && (
              <div className="flex flex-col gap-4">
                <Field label="Dataset name" htmlFor="md-name">
                  <Input id="md-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Leaf lengths, north and south side" maxLength={120} />
                </Field>
                <Field
                  label={
                    <span className="flex w-full items-center justify-between">
                      <span>Enter or paste your data</span>
                      {text && (
                        <button type="button" className="text-xs font-medium text-teal-700 hover:underline" onClick={() => setText('')}>
                          Clear
                        </button>
                      )}
                    </span>
                  }
                  htmlFor="md-text"
                  hint={describeParse(parsed)}
                >
                  <Textarea id="md-text" value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={EXAMPLE_VALUES} className="font-mono text-sm" spellCheck={false} />
                </Field>
                {parsed.invalid.length > 0 && (
                  <Callout tone="warn" title="Some values could not be interpreted as numbers.">
                    {parsed.invalid.slice(0, 6).map((i) => `“${i.value}”`).join(', ')}
                    {parsed.invalid.length > 6 ? ` and ${parsed.invalid.length - 6} more` : ''} will be highlighted and left out of calculations.
                  </Callout>
                )}
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map((f) => (
                    <button key={f.label} type="button" onClick={() => setText(f.text)} className="rounded-full border border-line bg-cream-100 px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-teal/50" title={f.note}>
                      Example: {f.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button size="lg" onClick={() => create(parsed, 'My data')} disabled={!parsed.rows.length} icon={<ChartColumn className="size-5" aria-hidden />}>
                    Analyse my data
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => { setText(EXAMPLE_VALUES); setName('Example daisy counts'); }}>
                    Try example data
                  </Button>
                </div>
              </div>
            )}

            {mode === 'import' && (
              <div className="flex flex-col gap-3">
                <input ref={file} id="md-file" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
                <label
                  htmlFor="md-file"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void onFile(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                    dragging ? 'border-teal-600 bg-teal-50' : 'border-line-strong bg-cream-100/60 hover:border-teal/60',
                  )}
                >
                  <Upload className="size-8 text-teal-700" aria-hidden />
                  <span className="text-sm font-semibold text-ink">Drop a CSV file here, or choose one</span>
                  <span className="text-xs text-ink-3">Comma- or tab-separated, with column headings in the first row. Up to 2 MB.</span>
                </label>
              </div>
            )}

            {mode === 'examples' && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {exampleDatasets().map((ex) => (
                  <li key={ex.name}>
                    <button
                      type="button"
                      onClick={() => {
                        const fresh = exampleDatasets().find((d) => d.name === ex.name)!;
                        upsert(fresh);
                        setResultId(fresh.id);
                        record({ type: 'my-data-analysed' });
                        window.setTimeout(() => document.getElementById('my-data-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
                      }}
                      className="flex h-full w-full flex-col gap-1 rounded-2xl border border-line bg-paper p-4 text-left transition-shadow hover:shadow-card"
                    >
                      <span className="text-xs font-medium text-teal-700">{KIND_LABELS[ex.kind]}</span>
                      <span className="text-sm font-semibold text-ink">{ex.name.replace('Example: ', '')}</span>
                      <span className="text-xs text-ink-3">{ex.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <AnimatePresence>{result && <Results key={result.id} dataset={result} />}</AnimatePresence>
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title="What can I paste?" level={3} />
          <ul className="flex flex-col gap-3 px-5 pb-5 text-sm text-ink-2">
            {FORMATS.map((f) => (
              <li key={f.label}>
                <p className="font-medium text-ink">{f.label}</p>
                <p className="text-xs text-ink-3">{f.note}</p>
                <pre className="mt-1.5 overflow-x-auto rounded-xl bg-cream-100 px-3 py-2 font-mono text-xs text-ink-2">{f.text.split('\n').slice(0, 3).join('\n')}</pre>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Your datasets" level={3} subtitle={hydrated ? `${datasets.length} saved on this device` : undefined} />
          <ul className="flex flex-col px-3 pb-3">
            {hydrated && datasets.slice(0, 8).map((d) => (
              <li key={d.id}>
                <Link href={`/data-lab?dataset=${d.id}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm hover:bg-teal-50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{d.name}</span>
                    <span className="text-xs text-ink-3">
                      {KIND_LABELS[d.kind]} · {d.rows.length} rows
                    </span>
                  </span>
                  <Table2 className="size-4 shrink-0 text-ink-3" aria-hidden />
                </Link>
              </li>
            ))}
            {hydrated && !datasets.length && <li className="px-2 pb-2 text-sm text-ink-3">Datasets you create or collect appear here.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Results({ dataset }: { dataset: Dataset }) {
  const nums = numericColumns(dataset);
  const isFrequency = dataset.kind === 'frequency';
  const isGroups = !isFrequency && nums.length >= 2 && dataset.columns.length === 2;
  const main = nums.find((c) => c.key === dataset.valueColumn) ?? nums[0];
  const values = main ? extractNumbers(dataset, { column: main.key }).values : [];
  const stats = describe(values);

  return (
    <motion.section id="my-data-results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} aria-labelledby="results-title" className="scroll-mt-24">
      <Card>
        <CardHeader
          id="results-title"
          title={dataset.name}
          subtitle={`${KIND_LABELS[dataset.kind]} · ${dataset.rows.length} rows · saved to your Data Lab`}
          actions={
            <ButtonLink href={`/data-lab?dataset=${dataset.id}`} size="sm" variant="ghost" icon={<Table2 className="size-4" aria-hidden />}>
              Edit
            </ButtonLink>
          }
        />
        <div className="flex flex-col gap-5 px-5 pb-5">
          {isFrequency ? (
            <>
              <ChartFrame title="Observed frequencies">
                <ObservedExpectedChart
                  data={dataset.rows.map((r) => {
                    const total = dataset.rows.reduce((t, x) => t + (Number(x.values[main.key]) || 0), 0);
                    return { label: String(r.values[dataset.columns[0].key] ?? ''), observed: Number(r.values[main.key]) || 0, expected: Math.round((total / dataset.rows.length) * 100) / 100 };
                  })}
                />
              </ChartFrame>
              <p className="text-sm text-ink-3">Expected bars assume equal frequencies. Change the expected ratio in the chi-squared test.</p>
              <ButtonLink href={`/statistics/chi-squared?dataset=${dataset.id}`} iconRight={<ArrowRight className="size-4" aria-hidden />}>
                Run a chi-squared test
              </ButtonLink>
            </>
          ) : isGroups ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {nums.slice(0, 2).map((c, i) => {
                  const s = describe(extractNumbers(dataset, { column: c.key }).values);
                  return (
                    <div key={c.key} className="rounded-2xl border border-line bg-cream-100/60 p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <span className="inline-block size-2.5 rounded-full" style={{ background: i ? GROUP_COLORS.b : GROUP_COLORS.a }} aria-hidden />
                        {c.label}
                      </p>
                      <p className="mt-1 text-sm text-ink-2">
                        n = <span className="num font-semibold">{s?.n ?? 0}</span> · mean = <span className="num font-semibold">{formatNumber(s?.mean)}</span> · SD ={' '}
                        <span className="num font-semibold">{formatNumber(s?.sd)}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
              <ChartFrame title="Both groups">
                <MeanSdChart
                  yLabel="Value"
                  groups={nums.slice(0, 2).map((c, i) => {
                    const v = extractNumbers(dataset, { column: c.key }).values;
                    const s = describe(v);
                    return { label: c.label, values: v, mean: s?.mean ?? 0, sd: s?.sd ?? 0, color: i ? GROUP_COLORS.b : GROUP_COLORS.a };
                  })}
                />
              </ChartFrame>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={`/statistics/t-test?dataset=${dataset.id}`} icon={<FlaskConical className="size-4" aria-hidden />}>
                  Compare with a t-test
                </ButtonLink>
                <ButtonLink href={`/statistics?dataset=${dataset.id}`} variant="secondary">
                  Descriptive statistics
                </ButtonLink>
              </div>
            </>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="n" value={stats.n} decimals={0} />
                <StatCard label="Mean" value={stats.mean} decimals={2} emphasis />
                <StatCard label="Median" value={stats.median} decimals={2} />
                <StatCard label="SD (n − 1)" value={stats.sd} decimals={2} />
              </div>
              <ChartFrame title={`Spread of ${main.label}`} description="Mean and ±1 / ±2 standard deviations">
                <SpreadDotPlot values={values} stats={stats} xLabel={main.label} />
              </ChartFrame>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={`/statistics?dataset=${dataset.id}`} iconRight={<ArrowRight className="size-4" aria-hidden />}>
                  Full descriptive statistics
                </ButtonLink>
                <ButtonLink href="/statistics/which-test" variant="secondary">
                  Which test should I use?
                </ButtonLink>
              </div>
            </>
          ) : (
            <Callout tone="warn" title="Some values could not be interpreted as numbers.">
              None of the values in this dataset are numbers yet. Open it in the Data Lab to fix them.
            </Callout>
          )}
        </div>
      </Card>
    </motion.section>
  );
}

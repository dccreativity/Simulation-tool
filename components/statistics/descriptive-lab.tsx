'use client';

import { ArrowRight, BookmarkPlus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { VariableRef } from '@/types/data';
import { useDataStore } from '@/lib/store/data-store';
import { useHydrated } from '@/lib/store/hydration';
import { useProgressStore } from '@/lib/store/progress-store';
import { describeRef, extractNumbers } from '@/lib/data/datasets';
import { describe, histogram } from '@/lib/statistics/descriptive';
import { autoDecimals, formatNumber } from '@/lib/statistics/format';
import { parseNumber } from '@/lib/validation/numbers';
import { Card, CardHeader } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Disclosure } from '@/components/ui/disclosure';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard, StatText } from '@/components/ui/stat-card';
import { Segmented, Tabs } from '@/components/ui/tabs';
import { VariablePicker } from '@/components/data/variable-picker';
import { ChartFrame } from '@/components/charts/chart-frame';
import { HistogramChart, SampleBarChart } from '@/components/charts/sample-charts';
import { BoxPlot, SpreadDotPlot } from '@/components/charts/stat-charts';
import { SaveToNotebookDialog } from '@/components/notebook/save-dialog';
import { NoDataState } from './no-data';

type ChartKind = 'dot' | 'histogram' | 'box' | 'bar';

export function DescriptiveLab() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const datasets = useDataStore((s) => s.datasets);
  const setCell = useDataStore((s) => s.setCell);
  const record = useProgressStore((s) => s.record);
  const [picked, setPicked] = useState<VariableRef | null>(null);
  const [sdMode, setSdMode] = useState<'sample' | 'population'>('sample');
  const [chart, setChart] = useState<ChartKind>('dot');
  const [saveOpen, setSaveOpen] = useState(false);

  // Default selection: the dataset in the URL, else the most recent one.
  const fallback = ((): VariableRef | null => {
    const d = datasets.find((x) => x.id === params.get('dataset')) ?? datasets[0];
    if (!d) return null;
    const column = params.get('column') ?? d.valueColumn ?? d.columns.find((c) => c.type === 'number')?.key;
    return column ? { datasetId: d.id, column } : null;
  })();
  const ref = picked && datasets.some((d) => d.id === picked.datasetId) ? picked : fallback;
  const ds = datasets.find((d) => d.id === ref?.datasetId);
  const extracted = extractNumbers(ds, ref ?? { column: '' });
  const stats = describe(extracted.values);
  const column = ds?.columns.find((c) => c.key === ref?.column);
  const varLabel = column ? `${column.label}${column.unit ? ` (${column.unit})` : ''}` : 'Value';
  const dp = Math.min(3, Math.max(1, autoDecimals(extracted.values)));

  const hasOutliers = chart === 'box' && (stats?.outliers.length ?? 0) > 0;
  useEffect(() => {
    if (hasOutliers) record({ type: 'outlier-seen' });
  }, [hasOutliers, record]);

  if (!hydrated) return <Skeleton className="h-96" label="Calculating statistics…" />;
  if (!datasets.length) return <NoDataState onLoaded={(d) => d.valueColumn && setPicked({ datasetId: d.id, column: d.valueColumn })} />;

  // Rows behind the current values, so students can edit them here.
  const editable = ds && ref
    ? ds.rows.filter((r) => !ref.groupColumn || String(r.values[ref.groupColumn] ?? '') === ref.groupValue).slice(0, 60)
    : [];
  const sd = stats ? (sdMode === 'sample' ? stats.sd : stats.populationSd) : null;
  const modeText = !stats ? '—' : stats.modes.length === 0 ? 'None' : stats.modes.length > 3 ? `${stats.modes.length} modes` : stats.modes.map((m) => formatNumber(m, dp)).join(', ');

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="mb-3 text-base font-semibold text-ink">1. Choose your data</h2>
        <VariablePicker datasets={datasets} value={ref} onChange={setPicked} />
      </Card>

      {ds && (
        <div className="flex flex-col gap-2">
          {!ds.rows.length && <Callout tone="info" title="Your dataset is empty.">Add values in the Data Lab first.</Callout>}
          {extracted.invalid > 0 && (
            <Callout tone="warn" title="Some values could not be interpreted as numbers.">
              {extracted.invalid} value{extracted.invalid === 1 ? ' was' : 's were'} left out. Correct them in the Data Lab or below.
            </Callout>
          )}
          {stats && stats.n < 5 && <Callout tone="info">This analysis may be unreliable with the current sample size (n = {stats.n}).</Callout>}
        </div>
      )}

      {stats && ref && (
        <>
          <Card>
            <CardHeader
              title="2. Descriptive statistics"
              subtitle={describeRef(ds, ref)}
              actions={
                <Segmented
                  label="Standard deviation convention"
                  size="sm"
                  value={sdMode}
                  onChange={setSdMode}
                  options={[
                    { value: 'sample', label: 'Sample SD (n − 1)' },
                    { value: 'population', label: 'Population SD (n)' },
                  ]}
                />
              }
            />
            <div className="grid grid-cols-2 gap-3 px-5 pb-3 md:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Mean" value={stats.mean} decimals={dp + 1} emphasis />
              <StatCard label="Median" value={stats.median} decimals={dp + 1} />
              <StatText label="Mode" text={modeText} hint={stats.modes.length ? `occurs ${stats.modeFrequency}×` : 'no value repeats'} />
              <StatCard label="Range" value={stats.range} decimals={dp} hint={`${formatNumber(stats.min, dp)} to ${formatNumber(stats.max, dp)}`} />
              <StatCard label={sdMode === 'sample' ? 'Std deviation (s)' : 'Std deviation (σ)'} value={sd} decimals={dp + 1} hint={sdMode === 'sample' ? 'divides by n − 1' : 'divides by n'} emphasis />
              <StatCard label="Sample size (n)" value={stats.n} decimals={0} />
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-line px-5 py-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Minimum', stats.min],
                ['Maximum', stats.max],
                ['Lower quartile', stats.q1],
                ['Upper quartile', stats.q3],
                ['Standard error', stats.standardError],
                ['Variance (s²)', stats.variance],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-2 sm:block">
                  <dt className="text-xs text-ink-3">{k}</dt>
                  <dd className="num font-semibold text-ink">{formatNumber(v as number, dp + 1)}</dd>
                </div>
              ))}
            </dl>
            <p className="px-5 pb-4 text-xs text-ink-3">
              Your values are a <em>sample</em> from a larger population, so the lab uses the sample standard deviation (dividing by n − 1) by default — the same as
              your calculator’s <span className="font-mono">sx</span> and a spreadsheet’s STDEV.S. Quartiles use linear interpolation (QUARTILE.INC).
            </p>
          </Card>

          <Card>
            <CardHeader
              title="3. Visualise"
              actions={
                <Tabs
                  label="Chart type"
                  size="sm"
                  value={chart}
                  onChange={setChart}
                  items={[
                    { id: 'dot', label: 'Dot plot' },
                    { id: 'histogram', label: 'Histogram' },
                    { id: 'box', label: 'Box plot' },
                    { id: 'bar', label: 'Bar chart' },
                  ]}
                />
              }
            />
            <div className="px-5 pb-5">
              <ChartFrame
                title={chart === 'dot' ? `Spread of ${varLabel}` : chart === 'histogram' ? `Distribution of ${varLabel}` : chart === 'box' ? `Box plot of ${varLabel}` : `${varLabel} by row`}
                description={chart === 'dot' ? 'Mean and ±1 / ±2 standard deviations (sample SD)' : undefined}
                table={{ columns: ['#', varLabel], rows: extracted.values.map((v, i) => [i + 1, v]) }}
              >
                {chart === 'dot' && <SpreadDotPlot values={extracted.values} stats={stats} xLabel={varLabel} />}
                {chart === 'histogram' && <HistogramChart bins={histogram(extracted.values)} xLabel={varLabel} />}
                {chart === 'box' && <BoxPlot groups={[{ label: varLabel, stats, values: extracted.values, color: '#14989e' }]} xLabel={varLabel} />}
                {chart === 'bar' && <SampleBarChart data={extracted.values.map((v, i) => ({ index: i + 1, value: v }))} mean={stats.mean} yLabel={varLabel} />}
              </ChartFrame>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Change a value, watch the statistics respond" subtitle="Edits are saved to the dataset." level={3} />
              <div className="grid grid-cols-3 gap-2 px-5 pb-5 sm:grid-cols-5">
                {editable.map((r, i) => (
                  <ValueInput key={r.id} index={i} value={r.values[ref.column] ?? null} onCommit={(raw) => setCell(ds!.id, r.id, ref.column, raw)} />
                ))}
              </div>
            </Card>
            <div className="flex flex-col gap-2">
              <Disclosure label="What does the mean tell me?">
                <p>
                  The mean is the total divided by the number of values: {formatNumber(stats.sum, dp)} ÷ {stats.n} = <strong>{formatNumber(stats.mean, dp + 1)}</strong>. It uses every
                  value, so a few extreme values can pull it up or down.
                </p>
              </Disclosure>
              <Disclosure label="Mean or median?">
                <p>
                  The median is the middle value when sorted: <strong>{formatNumber(stats.median, dp + 1)}</strong>.{' '}
                  {Math.abs(stats.mean - stats.median) > 0.1 * (stats.sd || 1)
                    ? `Here the mean is ${stats.mean > stats.median ? 'above' : 'below'} the median, a sign the data are skewed ${stats.mean > stats.median ? 'by some high values' : 'by some low values'}. The median may describe a typical value better.`
                    : 'Here the mean and median are close, so the data are fairly symmetrical and either describes a typical value.'}
                </p>
              </Disclosure>
              <Disclosure label="What does the standard deviation mean?">
                <p>
                  The standard deviation measures how far values typically sit from the mean. An SD of <strong>{formatNumber(stats.sd, dp + 1)}</strong> means most values lie within
                  about {formatNumber(stats.sd, dp)} of {formatNumber(stats.mean, dp)}. In the dot plot, the dark band shows mean ± 1 SD.
                </p>
                <p>
                  A large SD relative to the mean (here {Number.isFinite(stats.coefficientOfVariation) ? `${Math.round(stats.coefficientOfVariation * 100)}%` : '—'} of the mean) signals very variable data — in
                  ecology often a clumped distribution. More samples are then needed to estimate the mean reliably.
                </p>
              </Disclosure>
              <Disclosure label="Mode and range">
                <p>
                  The mode is the most frequent value ({modeText}). The range, {formatNumber(stats.range, dp)}, is the gap between the smallest and largest values — easy to calculate, but it
                  depends on just two values, so one unusual sample changes it a lot.
                </p>
              </Disclosure>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setSaveOpen(true)} icon={<BookmarkPlus className="size-4" aria-hidden />}>
              Save to Field Notebook
            </Button>
            <ButtonLink href={`/statistics/t-test?dataset=${ds?.id ?? ''}`} iconRight={<ArrowRight className="size-4" aria-hidden />}>
              Compare two groups with a t-test
            </ButtonLink>
          </div>

          {ds && (
            <SaveToNotebookDialog
              open={saveOpen}
              onClose={() => setSaveOpen(false)}
              draft={{
                title: `${ds.name}: descriptive statistics`,
                mode: ds.source === 'simulation' ? 'simulation' : 'my-data',
                ecosystemId: ds.ecosystemId,
                missionId: ds.missionId,
                siteCode: ds.siteCode,
                researchQuestion: '',
                hypothesis: '',
                samplingMethod: ds.description ?? '',
                sampleSize: stats.n,
                datasets: [ds],
                descriptive: [
                  {
                    label: describeRef(ds, ref),
                    n: stats.n,
                    mean: stats.mean,
                    median: stats.median,
                    modes: stats.modes,
                    min: stats.min,
                    max: stats.max,
                    range: stats.range,
                    sd: stats.sd,
                  },
                ],
                charts: [{ kind: chart === 'dot' ? 'distribution' : chart, datasetId: ds.id, column: ref.column, title: varLabel }],
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Commits valid numbers as the student types, so statistics and charts update live. */
function ValueInput({ index, value, onCommit }: { index: number; value: string | number | null; onCommit: (raw: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : String(value));
  const bad = shown.trim() !== '' && parseNumber(shown) === null;
  return (
    <label className="flex flex-col gap-0.5 text-[0.65rem] text-ink-3">
      #{index + 1}
      <input
        value={shown}
        inputMode="decimal"
        onChange={(e) => {
          setDraft(e.target.value);
          if (parseNumber(e.target.value) !== null) onCommit(e.target.value);
        }}
        onBlur={() => {
          if (draft !== null) onCommit(draft);
          setDraft(null);
        }}
        aria-label={`Value ${index + 1}`}
        aria-invalid={bad || undefined}
        className={`num h-9 rounded-lg border px-2 text-sm text-ink focus:border-teal-600 focus:outline-none ${bad ? 'border-danger-line bg-danger-bg' : 'border-line bg-paper'}`}
      />
    </label>
  );
}

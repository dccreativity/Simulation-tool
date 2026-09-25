'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BookmarkPlus, Check, CircleCheck, CircleX, FlaskConical, Save } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import type { Dataset, SavedAnalysis, VariableRef } from '@/types/data';
import { getEcosystem } from '@/data/ecosystems';
import { describeRef, extractNumbers, groupValues, numericColumns } from '@/lib/data/datasets';
import { uid } from '@/lib/data/ids';
import { describe } from '@/lib/statistics/descriptive';
import { formatDf, formatNumber, formatP } from '@/lib/statistics/format';
import { interpretTTest } from '@/lib/statistics/interpret';
import { independentTTest, type Alternative, type TTestVariant } from '@/lib/statistics/ttest';
import { GROUP_COLORS } from '@/lib/simulation/palette';
import { useDataStore } from '@/lib/store/data-store';
import { useHydrated } from '@/lib/store/hydration';
import { useProgressStore } from '@/lib/store/progress-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Disclosure } from '@/components/ui/disclosure';
import { Field, Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { VariablePicker } from '@/components/data/variable-picker';
import { ChartFrame } from '@/components/charts/chart-frame';
import { BoxPlot, MeanSdChart } from '@/components/charts/stat-charts';
import { SaveToNotebookDialog } from '@/components/notebook/save-dialog';
import { cn } from '@/lib/cn';
import { NoDataState } from './no-data';

/** Sensible starting comparison for a dataset: the mission's two zones, two groups, or two columns. */
export function defaultPair(ds: Dataset | undefined): [VariableRef | null, VariableRef | null] {
  if (!ds) return [null, null];
  const column = ds.valueColumn ?? numericColumns(ds)[0]?.key;
  if (!column) return [null, null];
  if (ds.groupColumn) {
    const groups = groupValues(ds, ds.groupColumn);
    let a = groups[0];
    let b = groups[1];
    const eco = ds.ecosystemId ? getEcosystem(ds.ecosystemId) : undefined;
    if (eco) {
      const za = eco.zones.find((z) => z.id === eco.mission.comparison.zoneA)?.label;
      const zb = eco.zones.find((z) => z.id === eco.mission.comparison.zoneB)?.label;
      if (za && groups.includes(za)) a = za;
      if (zb && groups.includes(zb)) b = zb;
    }
    if (a && b && a !== b) {
      return [
        { datasetId: ds.id, column, groupColumn: ds.groupColumn, groupValue: a },
        { datasetId: ds.id, column, groupColumn: ds.groupColumn, groupValue: b },
      ];
    }
  }
  const nums = numericColumns(ds);
  if (nums.length >= 2 && ds.kind === 'custom') return [{ datasetId: ds.id, column: nums[0].key }, { datasetId: ds.id, column: nums[1].key }];
  return [{ datasetId: ds.id, column }, null];
}

function Step({ n, title, done, children, active }: { n: number; title: string; done: boolean; active: boolean; children: ReactNode }) {
  return (
    <Card className={cn('p-5 transition-opacity', !active && 'opacity-55')}>
      <div className="mb-3 flex items-center gap-3">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold', done ? 'bg-teal-600 text-white' : 'bg-cream-100 text-ink-2 ring-1 ring-line')}>
          {done ? <Check className="size-4" aria-hidden /> : n}
        </span>
        <h2 className="text-base font-semibold text-ink">
          Step {n}: {title}
        </h2>
      </div>
      {children}
    </Card>
  );
}

function Preview({ label, values, color }: { label: string; values: number[]; color: string }) {
  const s = describe(values);
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-cream-100 px-3 py-2 text-sm text-ink-2">
      <span className="inline-block size-3 rounded-full" style={{ background: color }} aria-hidden />
      <span className="font-medium text-ink">{label}</span>
      {s ? (
        <>
          <span>
            n = <span className="num font-semibold">{s.n}</span>
          </span>
          <span>
            mean = <span className="num font-semibold">{formatNumber(s.mean)}</span>
          </span>
          <span>
            SD = <span className="num font-semibold">{formatNumber(s.sd)}</span>
          </span>
        </>
      ) : (
        <span className="text-warn">No numeric values selected.</span>
      )}
    </p>
  );
}

export function TTestLab() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const datasets = useDataStore((s) => s.datasets);
  const saveAnalysis = useDataStore((s) => s.saveAnalysis);
  const record = useProgressStore((s) => s.record);
  const notify = useToast();
  const [a, setA] = useState<VariableRef | null | undefined>(undefined);
  const [b, setB] = useState<VariableRef | null | undefined>(undefined);
  const [variant, setVariant] = useState<TTestVariant>('student');
  const [alternative, setAlternative] = useState<Alternative>('two-sided');
  const [alpha, setAlpha] = useState(0.05);
  const [independent, setIndependent] = useState(false);
  const [ran, setRan] = useState(false);
  const [saved, setSaved] = useState<SavedAnalysis | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  if (!hydrated) return <Skeleton className="h-96" label="Loading datasets…" />;
  if (!datasets.length) {
    return (
      <NoDataState
        onLoaded={(d) => {
          const [pa, pb] = defaultPair(d);
          setA(pa);
          setB(pb);
        }}
      />
    );
  }

  const initial = defaultPair(datasets.find((d) => d.id === params.get('dataset')) ?? datasets.find((d) => d.groupColumn || d.kind === 'custom') ?? datasets[0]);
  const refA = a === undefined ? initial[0] : a;
  const refB = b === undefined ? initial[1] : b;
  const dsA = datasets.find((d) => d.id === refA?.datasetId);
  const dsB = datasets.find((d) => d.id === refB?.datasetId);
  const valuesA = refA ? extractNumbers(dsA, refA).values : [];
  const valuesB = refB ? extractNumbers(dsB, refB).values : [];
  const labelA = refA ? describeRef(dsA, refA) : 'Dataset A';
  const labelB = refB ? describeRef(dsB, refB) : 'Dataset B';
  const shortA = refA?.groupValue ?? dsA?.columns.find((c) => c.key === refA?.column)?.label ?? 'A';
  const shortB = refB?.groupValue ?? dsB?.columns.find((c) => c.key === refB?.column)?.label ?? 'B';
  const sameSelection = refA && refB && JSON.stringify(refA) === JSON.stringify(refB);
  const step12 = valuesA.length >= 2 && valuesB.length >= 2 && !sameSelection;
  const statsA = describe(valuesA);
  const statsB = describe(valuesB);
  const result = step12 ? independentTTest(valuesA, valuesB, { variant, alternative, alpha }) : null;
  const interpretation = result?.ok ? interpretTTest(result, shortA, shortB) : null;

  const reset = () => {
    setRan(false);
    setSaved(null);
  };

  const run = () => {
    setRan(true);
    setSaved(null);
    record({ type: 't-test' });
  };

  const save = () => {
    if (!result?.ok || !interpretation) return;
    const analysis: SavedAnalysis = {
      id: uid(),
      type: 't-test',
      title: `t-test: ${shortA} vs ${shortB}`,
      createdAt: new Date().toISOString(),
      datasetIds: [...new Set([refA?.datasetId, refB?.datasetId].filter(Boolean) as string[])],
      inputs: { datasetA: labelA, datasetB: labelB, variant: variant === 'student' ? "Student's (pooled variance)" : "Welch's", alternative, alpha },
      result: {
        nA: result.a.n,
        nB: result.b.n,
        meanA: result.a.mean,
        meanB: result.b.mean,
        sdA: result.a.sd,
        sdB: result.b.sd,
        t: result.t,
        df: result.df,
        p: result.p,
        criticalValue: result.criticalValue,
        significant: result.significant,
      },
      headline: interpretation.headline,
      detail: interpretation.detail,
    };
    saveAnalysis(analysis);
    setSaved(analysis);
    notify({ tone: 'success', title: 'Result saved', body: 'You can attach it when you save to your Field Notebook.' });
  };

  return (
    <div className="flex flex-col gap-4">
      <Step n={1} title="Choose Dataset A" done={valuesA.length >= 2} active>
        <VariablePicker datasets={datasets} value={refA} onChange={(v) => { setA(v); reset(); }} label="Dataset A" />
        {refA && <Preview label={shortA} values={valuesA} color={GROUP_COLORS.a} />}
      </Step>

      <Step n={2} title="Choose Dataset B" done={step12} active={valuesA.length >= 2}>
        <VariablePicker datasets={datasets} value={refB} onChange={(v) => { setB(v); reset(); }} label="Dataset B" />
        {refB && <Preview label={shortB} values={valuesB} color={GROUP_COLORS.b} />}
        {sameSelection && <p className="mt-2 text-sm text-warn">Dataset B is the same as Dataset A. Choose a different group or column.</p>}
        {dsA?.groupColumn && (
          <p className="mt-2 text-xs text-ink-3">Tip: to compare two zones in one dataset, pick the same dataset twice and choose a different group under “Rows”.</p>
        )}
      </Step>

      <Step n={3} title="Identify the test" done={step12 && independent} active={step12}>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-2 text-sm text-ink-2">
            <p className="font-medium text-ink">Why a t-test?</p>
            <ul className="flex flex-col gap-1.5">
              <li className="flex gap-2">
                <CircleCheck className="size-4 shrink-0 text-success" aria-hidden /> Both datasets are numerical (counts or measurements).
              </li>
              <li className="flex gap-2">
                <CircleCheck className="size-4 shrink-0 text-success" aria-hidden /> You are comparing the <strong>means</strong> of two groups.
              </li>
              <li className="flex gap-2">
                {statsA && statsB && statsA.n >= 5 && statsB.n >= 5 ? (
                  <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <CircleX className="size-4 shrink-0 text-warn" aria-hidden />
                )}
                At least five values in each group {statsA && statsB ? `(you have ${statsA.n} and ${statsB.n})` : ''}.
              </li>
            </ul>
            <label className="mt-1 flex items-start gap-2 rounded-xl border border-line bg-cream-100 px-3 py-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-teal-600" checked={independent} onChange={(e) => setIndependent(e.target.checked)} />
              <span>
                The two groups are <strong>independent</strong>: different quadrats, individuals or sites, not repeated measurements of the same ones.
              </span>
            </label>
            <p className="rounded-xl bg-sage-100 px-3 py-2 text-xs">
              Two numerical datasets → comparing means → <strong>independent two-sample t-test</strong>. If you were comparing counts in categories with an expected
              ratio, you would use chi-squared instead.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Field label="Version" htmlFor="tt-variant" hint={variant === 'student' ? 'Assumes similar spreads. df = nA + nB − 2 (matches printed tables).' : 'Does not assume equal spreads. Safer when SDs differ a lot.'}>
              <Select id="tt-variant" value={variant} onChange={(e) => { setVariant(e.target.value as TTestVariant); reset(); }}>
                <option value="student">Student’s t-test (pooled variance)</option>
                <option value="welch">Welch’s t-test (unequal variances)</option>
              </Select>
            </Field>
            <Field label="Alternative hypothesis" htmlFor="tt-alt">
              <Select id="tt-alt" value={alternative} onChange={(e) => { setAlternative(e.target.value as Alternative); reset(); }}>
                <option value="two-sided">The means differ (two-tailed)</option>
                <option value="greater">{shortA} has a greater mean (one-tailed)</option>
                <option value="less">{shortA} has a smaller mean (one-tailed)</option>
              </Select>
            </Field>
            <Field label="Significance level (α)" htmlFor="tt-alpha" hint="0.05 is standard in biology: a 5% risk of calling a difference real when it is due to chance.">
              <Select id="tt-alpha" value={alpha} onChange={(e) => { setAlpha(Number(e.target.value)); reset(); }}>
                <option value={0.05}>0.05</option>
                <option value={0.01}>0.01</option>
                <option value={0.1}>0.10</option>
              </Select>
            </Field>
          </div>
        </div>
      </Step>

      <Step n={4} title="Run the analysis" done={ran && Boolean(result?.ok)} active={step12}>
        {!ran ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} disabled={!step12} icon={<FlaskConical className="size-4" aria-hidden />}>
              Run t-test
            </Button>
            {!independent && step12 && <span className="text-xs text-ink-3">Confirm in step 3 that your groups are independent.</span>}
          </div>
        ) : result && !result.ok ? (
          <Callout tone="warn" title="Something looks unusual.">
            {result.reason}
          </Callout>
        ) : result?.ok && interpretation ? (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
              <div className="scrollbar-thin overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <caption className="sr-only">Summary of both groups</caption>
                  <thead className="text-left text-xs text-ink-3">
                    <tr>
                      <th scope="col" className="py-1.5 font-medium">Group</th>
                      <th scope="col" className="py-1.5 font-medium">n</th>
                      <th scope="col" className="py-1.5 font-medium">Mean</th>
                      <th scope="col" className="py-1.5 font-medium">SD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: labelA, g: result.a, color: GROUP_COLORS.a },
                      { label: labelB, g: result.b, color: GROUP_COLORS.b },
                    ].map((r) => (
                      <tr key={r.label} className="border-t border-line">
                        <td className="py-2 pr-3 text-ink-2">
                          <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: r.color }} aria-hidden />
                          {r.label}
                        </td>
                        <td className="num py-2 font-semibold">{r.g.n}</td>
                        <td className="num py-2 font-semibold">{formatNumber(r.g.mean, 3)}</td>
                        <td className="num py-2 font-semibold">{formatNumber(r.g.sd, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['t statistic', formatNumber(result.t, 3)],
                  ['Degrees of freedom', formatDf(result.df)],
                  ['p value', formatP(result.p)],
                  ['Significance level', String(alpha)],
                  ['Critical value', formatNumber(result.criticalValue, 3)],
                  ['Mean difference', formatNumber(result.meanDifference, 3)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl border border-line bg-cream-100/70 px-3 py-2.5">
                    <p className="text-[0.7rem] tracking-wide text-ink-3 uppercase">{k}</p>
                    <p className="num text-xl font-semibold text-ink">{v}</p>
                  </div>
                ))}
              </div>

              <div className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3', result.significant ? 'border-success-line bg-success-bg' : 'border-line bg-cream-100')} role="status">
                {result.significant ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <CircleX className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />}
                <div className="text-sm leading-relaxed text-ink-2">
                  <p className="font-semibold text-ink">{interpretation.headline}</p>
                  <p className="mt-1">{interpretation.detail}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    Decision rule: {Math.abs(result.t) >= result.criticalValue ? '|t|' : '|t|'} = {formatNumber(Math.abs(result.t), 3)}{' '}
                    {Math.abs(result.t) >= result.criticalValue ? '≥' : '<'} critical value {formatNumber(result.criticalValue, 3)}, and p {result.p <= alpha ? '≤' : '>'} α.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <ChartFrame title="Means and spread" table={{ columns: ['Group', 'Values'], rows: [[shortA, valuesA.join(', ')], [shortB, valuesB.join(', ')]] }}>
                  <MeanSdChart
                    yLabel={refA?.column === refB?.column ? (dsA?.columns.find((c) => c.key === refA?.column)?.label ?? 'Value') : 'Value'}
                    groups={[
                      { label: shortA, values: valuesA, mean: result.a.mean, sd: result.a.sd, color: GROUP_COLORS.a },
                      { label: shortB, values: valuesB, mean: result.b.mean, sd: result.b.sd, color: GROUP_COLORS.b },
                    ]}
                  />
                </ChartFrame>
                {statsA && statsB && (
                  <ChartFrame title="Box plots">
                    <BoxPlot
                      xLabel={refA?.column === refB?.column ? (dsA?.columns.find((c) => c.key === refA?.column)?.label ?? 'Value') : 'Value'}
                      groups={[
                        { label: shortA, stats: statsA, values: valuesA, color: GROUP_COLORS.a },
                        { label: shortB, stats: statsB, values: valuesB, color: GROUP_COLORS.b },
                      ]}
                    />
                  </ChartFrame>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-ink">Before you conclude</p>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-2">
                  {interpretation.caveats.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <Disclosure label="What does the p value mean?">
                  <p>
                    The p value is the probability of getting a difference at least as large as yours <em>if the null hypothesis were true</em> — if the two populations really
                    had the same mean. A small p value (below α) makes the null hypothesis hard to believe, so we reject it.
                  </p>
                  <p>It is not the probability that your hypothesis is true, and it says nothing about how big or important the difference is.</p>
                </Disclosure>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={save} disabled={Boolean(saved)} icon={<Save className="size-4" aria-hidden />}>
                  {saved ? 'Result saved' : 'Save result'}
                </Button>
                <Button
                  onClick={() => {
                    if (!saved) save();
                    setSaveOpen(true);
                  }}
                  icon={<BookmarkPlus className="size-4" aria-hidden />}
                >
                  Save to Field Notebook
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </Step>

      {saveOpen && result?.ok && (
        <SaveToNotebookDialog
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          draft={{
            title: `Comparing ${shortA} and ${shortB}`,
            mode: dsA?.source === 'simulation' ? 'simulation' : 'my-data',
            ecosystemId: dsA?.ecosystemId,
            missionId: dsA?.missionId,
            siteCode: dsA?.siteCode,
            researchQuestion: dsA?.ecosystemId ? (getEcosystem(dsA.ecosystemId)?.mission.question ?? '') : '',
            hypothesis: dsA?.ecosystemId ? (getEcosystem(dsA.ecosystemId)?.mission.hypothesis ?? '') : '',
            samplingMethod: dsA?.description ?? '',
            sampleSize: result.a.n + result.b.n,
            datasets: [...new Map([dsA, dsB].filter(Boolean).map((d) => [d!.id, d!])).values()],
            descriptive: [
              { label: labelA, n: result.a.n, mean: result.a.mean, median: statsA?.median ?? NaN, modes: statsA?.modes ?? [], min: statsA?.min ?? NaN, max: statsA?.max ?? NaN, range: statsA?.range ?? NaN, sd: result.a.sd },
              { label: labelB, n: result.b.n, mean: result.b.mean, median: statsB?.median ?? NaN, modes: statsB?.modes ?? [], min: statsB?.min ?? NaN, max: statsB?.max ?? NaN, range: statsB?.range ?? NaN, sd: result.b.sd },
            ],
            tests: saved ? [saved] : [],
            conclusion: interpretation ? `${interpretation.headline} (t = ${formatNumber(result.t, 3)}, df = ${formatDf(result.df)}, p ${formatP(result.p).startsWith('<') ? formatP(result.p) : `= ${formatP(result.p)}`}).` : '',
          }}
        />
      )}
    </div>
  );
}

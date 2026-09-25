'use client';

import { BookmarkPlus, CircleCheck, CircleX, Plus, Save, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Dataset, SavedAnalysis } from '@/types/data';
import { extractNumbers, numericColumns, textColumns } from '@/lib/data/datasets';
import { uid } from '@/lib/data/ids';
import { chiSquaredGoodnessOfFit, chiSquaredIndependence } from '@/lib/statistics/chisquare';
import { formatNumber, formatP } from '@/lib/statistics/format';
import { interpretGoodnessOfFit, interpretIndependence, type Interpretation } from '@/lib/statistics/interpret';
import { parseNumber } from '@/lib/validation/numbers';
import { useDataStore } from '@/lib/store/data-store';
import { useHydrated } from '@/lib/store/hydration';
import { useProgressStore } from '@/lib/store/progress-store';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Disclosure } from '@/components/ui/disclosure';
import { Field, Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { ChartFrame } from '@/components/charts/chart-frame';
import { ObservedExpectedChart } from '@/components/charts/sample-charts';
import { SaveToNotebookDialog } from '@/components/notebook/save-dialog';
import { cn } from '@/lib/cn';

interface Row {
  id: string;
  label: string;
  observed: string;
  expected: string;
}

const PRESETS: { label: string; ratio: number[] }[] = [
  { label: '3 : 1', ratio: [3, 1] },
  { label: '1 : 2 : 1', ratio: [1, 2, 1] },
  { label: '9 : 3 : 3 : 1', ratio: [9, 3, 3, 1] },
];

function rowsFromDataset(d: Dataset): Row[] {
  const cat = textColumns(d)[0];
  const nums = numericColumns(d);
  const obs = nums.find((c) => c.key === d.valueColumn) ?? nums[0];
  const exp = nums.find((c) => c !== obs);
  if (!cat || !obs) return [];
  return d.rows.map((r) => ({
    id: r.id,
    label: String(r.values[cat.key] ?? ''),
    observed: r.values[obs.key] === null ? '' : String(r.values[obs.key]),
    expected: exp && r.values[exp.key] !== null ? String(r.values[exp.key]) : '1',
  }));
}

const STARTER: Row[] = [
  { id: 'a', label: 'Category A', observed: '30', expected: '1' },
  { id: 'b', label: 'Category B', observed: '18', expected: '1' },
];

function Verdict({ significant, interpretation }: { significant: boolean; interpretation: Interpretation }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3', significant ? 'border-success-line bg-success-bg' : 'border-line bg-cream-100')} role="status">
      {significant ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <CircleX className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />}
      <div className="text-sm leading-relaxed text-ink-2">
        <p className="font-semibold text-ink">{interpretation.headline}</p>
        <p className="mt-1">{interpretation.detail}</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-ink-3">
          {interpretation.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function KeyFigures({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-2xl border border-line bg-cream-100/70 px-3 py-2.5">
          <p className="text-[0.7rem] tracking-wide text-ink-3 uppercase">{k}</p>
          <p className="num text-xl font-semibold text-ink">{v}</p>
        </div>
      ))}
    </div>
  );
}

export function ChiSquaredLab() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const initialMode = params.get('mode') === 'association' ? 'association' : 'gof';
  const [mode, setMode] = useState<'gof' | 'association'>(initialMode);
  if (!hydrated) return <Skeleton className="h-96" label="Loading datasets…" />;
  return (
    <div className="flex flex-col gap-5">
      <Tabs
        label="Chi-squared test type"
        value={mode}
        onChange={setMode}
        className="self-start"
        items={[
          { id: 'gof', label: 'Goodness of fit' },
          { id: 'association', label: 'Species association' },
        ]}
      />
      {mode === 'gof' ? <GoodnessOfFit initialDataset={params.get('dataset')} /> : <Association initialDataset={params.get('dataset')} />}
    </div>
  );
}

function GoodnessOfFit({ initialDataset }: { initialDataset: string | null }) {
  const datasets = useDataStore((s) => s.datasets);
  const saveAnalysis = useDataStore((s) => s.saveAnalysis);
  const notify = useToast();
  const frequency = datasets.filter((d) => d.kind === 'frequency' || (textColumns(d).length > 0 && numericColumns(d).length > 0 && d.kind === 'custom'));
  const start = frequency.find((d) => d.id === initialDataset) ?? frequency[0];
  const [source, setSource] = useState<string>(start?.id ?? 'manual');
  const [rows, setRows] = useState<Row[]>(start ? rowsFromDataset(start) : STARTER);
  const [alpha, setAlpha] = useState(0.05);
  const [saved, setSaved] = useState<SavedAnalysis | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  const labels = rows.map((r) => r.label.trim() || 'Unnamed');
  const observed = rows.map((r) => parseNumber(r.observed) ?? NaN);
  const expected = rows.map((r) => parseNumber(r.expected) ?? NaN);
  const invalid = [...observed, ...expected].some((v) => Number.isNaN(v));
  const result = invalid ? null : chiSquaredGoodnessOfFit(labels, observed, expected, alpha);
  const interpretation = result?.ok ? interpretGoodnessOfFit(result) : null;

  const update = (id: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSaved(null);
  };
  const dataset = datasets.find((d) => d.id === source);

  const save = () => {
    if (!result?.ok || !interpretation) return;
    const a: SavedAnalysis = {
      id: uid(),
      type: 'chi-squared-gof',
      title: `Chi-squared goodness of fit${dataset ? `: ${dataset.name}` : ''}`,
      createdAt: new Date().toISOString(),
      datasetIds: dataset ? [dataset.id] : [],
      inputs: { categories: labels.join(', '), observed: observed.join(', '), expectedRatio: expected.join(' : '), alpha },
      result: { chiSquared: result.chiSquared, df: result.df, p: result.p, criticalValue: result.criticalValue, significant: result.significant, total: result.total },
      headline: interpretation.headline,
      detail: interpretation.detail,
    };
    saveAnalysis(a);
    setSaved(a);
    notify({ tone: 'success', title: 'Result saved', body: 'You can attach it when you save to your Field Notebook.' });
    return a;
  };

  return (
    <>
      <RecordChiSquared when={Boolean(result?.ok)} />
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Frequency data" htmlFor="gof-src" hint="Counts in categories — e.g. seed colours, woodlice choices, or habitat preferences.">
            <Select
              id="gof-src"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                const d = datasets.find((x) => x.id === e.target.value);
                setRows(d ? rowsFromDataset(d) : STARTER);
                setSaved(null);
              }}
            >
              <option value="manual">Type my own categories</option>
              {frequency.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Significance level" htmlFor="gof-alpha">
            <Select id="gof-alpha" value={alpha} onChange={(e) => setAlpha(Number(e.target.value))}>
              <option value={0.05}>0.05</option>
              <option value={0.01}>0.01</option>
              <option value={0.1}>0.10</option>
            </Select>
          </Field>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
        <Card>
          <CardHeader title="Observed and expected" subtitle="Change the expected ratio and watch the result update." />
          <div className="px-5 pb-5">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <caption className="sr-only">Observed frequencies, expected ratio, expected counts and chi-squared contributions</caption>
                <thead className="text-left text-xs text-ink-3">
                  <tr>
                    <th scope="col" className="py-1.5 font-medium">Category</th>
                    <th scope="col" className="py-1.5 font-medium">Observed (O)</th>
                    <th scope="col" className="py-1.5 font-medium">Expected ratio</th>
                    <th scope="col" className="py-1.5 font-medium">Expected (E)</th>
                    <th scope="col" className="py-1.5 font-medium">(O − E)² / E</th>
                    <th scope="col"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const cat = result?.ok ? result.categories[i] : null;
                    return (
                      <tr key={r.id} className="border-t border-line">
                        <td className="py-1.5 pr-2">
                          <input value={r.label} onChange={(e) => update(r.id, { label: e.target.value })} aria-label={`Category ${i + 1} name`} className="h-9 w-full min-w-[110px] rounded-lg border border-line bg-paper px-2 focus:border-teal-600 focus:outline-none" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input value={r.observed} inputMode="numeric" onChange={(e) => update(r.id, { observed: e.target.value })} aria-label={`Observed frequency for ${r.label}`} aria-invalid={Number.isNaN(observed[i]) || undefined} className={cn('num h-9 w-20 rounded-lg border bg-paper px-2 text-right focus:border-teal-600 focus:outline-none', Number.isNaN(observed[i]) ? 'border-danger-line bg-danger-bg' : 'border-line')} />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input value={r.expected} inputMode="decimal" onChange={(e) => update(r.id, { expected: e.target.value })} aria-label={`Expected ratio for ${r.label}`} aria-invalid={Number.isNaN(expected[i]) || undefined} className={cn('num h-9 w-20 rounded-lg border bg-paper px-2 text-right focus:border-teal-600 focus:outline-none', Number.isNaN(expected[i]) ? 'border-danger-line bg-danger-bg' : 'border-line')} />
                        </td>
                        <td className="num py-1.5 pr-2 text-ink-2">{cat ? formatNumber(cat.expected, 2) : '—'}</td>
                        <td className="num py-1.5 pr-2 font-semibold text-ink">{cat ? formatNumber(cat.contribution, 3) : '—'}</td>
                        <td>
                          <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} disabled={rows.length <= 2} className="rounded-md p-1.5 text-ink-3 hover:bg-danger-bg hover:text-danger disabled:opacity-30" aria-label={`Remove ${r.label}`}>
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {result?.ok && (
                  <tfoot>
                    <tr className="border-t-2 border-line-strong font-semibold">
                      <td className="py-2">Total</td>
                      <td className="num py-2">{formatNumber(result.total)}</td>
                      <td />
                      <td className="num py-2">{formatNumber(result.total)}</td>
                      <td className="num py-2">χ² = {formatNumber(result.chiSquared, 3)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" icon={<Plus className="size-4" aria-hidden />} onClick={() => setRows((rs) => [...rs, { id: uid(), label: `Category ${String.fromCharCode(65 + rs.length)}`, observed: '0', expected: '1' }])}>
                Category
              </Button>
              <span className="text-xs text-ink-3">Expected ratio:</span>
              <Button size="sm" variant="subtle" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, expected: '1' })))}>
                Equal
              </Button>
              {PRESETS.filter((p) => p.ratio.length === rows.length).map((p) => (
                <Button key={p.label} size="sm" variant="subtle" onClick={() => setRows((rs) => rs.map((r, i) => ({ ...r, expected: String(p.ratio[i]) })))}>
                  {p.label}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-3">
              Expected frequencies are your ratio scaled to the observed total, so they always add up to N as the test requires.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="How far is observed from expected?" />
          <div className="flex flex-col gap-4 px-5 pb-5">
            {invalid && <Callout tone="warn" title="Some values could not be interpreted as numbers.">Check the highlighted cells.</Callout>}
            {result && !result.ok && <Callout tone="warn" title="Something looks unusual.">{result.reason}</Callout>}
            {result?.ok && interpretation && (
              <>
                <ChartFrame title="Observed vs expected frequencies" table={{ columns: ['Category', 'Observed', 'Expected'], rows: result.categories.map((c) => [c.label, c.observed, formatNumber(c.expected, 2)]) }}>
                  <ObservedExpectedChart data={result.categories.map((c) => ({ label: c.label, observed: c.observed, expected: Math.round(c.expected * 100) / 100 }))} />
                </ChartFrame>
                <KeyFigures
                  items={[
                    ['χ²', formatNumber(result.chiSquared, 3)],
                    ['Degrees of freedom', String(result.df)],
                    ['p value', formatP(result.p)],
                    [`Critical value (α ${alpha})`, formatNumber(result.criticalValue, 3)],
                  ]}
                />
                <Verdict significant={result.significant} interpretation={interpretation} />
                <Disclosure label="How is χ² calculated?">
                  <p>For each category, square the difference between observed and expected and divide by expected: (O − E)² / E. Add these up to get χ².</p>
                  <p>
                    Degrees of freedom = number of categories − 1 = {result.df}. If χ² is larger than the critical value, the difference is too big to put down to chance.
                  </p>
                </Disclosure>
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
              </>
            )}
          </div>
        </Card>
      </div>
      {saveOpen && (
        <SaveToNotebookDialog
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          draft={{
            title: dataset ? `${dataset.name}: chi-squared` : 'Chi-squared goodness of fit',
            mode: 'my-data',
            researchQuestion: '',
            hypothesis: '',
            samplingMethod: dataset?.description ?? '',
            sampleSize: result?.ok ? result.total : null,
            datasets: dataset ? [dataset] : [],
            descriptive: [],
            tests: saved ? [saved] : [],
            conclusion: interpretation?.headline ?? '',
          }}
        />
      )}
    </>
  );
}

/** Counts a chi-squared test towards achievements once a valid result is shown. */
function RecordChiSquared({ when }: { when: boolean }) {
  const record = useProgressStore((s) => s.record);
  useEffect(() => {
    if (when) record({ type: 'chi-squared' });
  }, [when, record]);
  return null;
}

function Association({ initialDataset }: { initialDataset: string | null }) {
  const datasets = useDataStore((s) => s.datasets);
  const saveAnalysis = useDataStore((s) => s.saveAnalysis);
  const notify = useToast();
  const candidates = datasets.filter((d) => numericColumns(d).length >= 2 && d.kind === 'quadrat');
  const start = candidates.find((d) => d.id === initialDataset) ?? candidates[0];
  const [dsId, setDsId] = useState(start?.id ?? '');
  const ds = candidates.find((d) => d.id === dsId);
  const speciesCols = ds ? ds.columns.filter((c) => c.key.startsWith('sp_')) : [];
  const [colA, setColA] = useState<string>('');
  const [colB, setColB] = useState<string>('');
  const a = speciesCols.find((c) => c.key === colA) ?? speciesCols[0];
  const b = speciesCols.find((c) => c.key === colB && c.key !== a?.key) ?? speciesCols.find((c) => c.key !== a?.key);
  const [saved, setSaved] = useState<SavedAnalysis | null>(null);

  if (!candidates.length || !ds || !a || !b) {
    return (
      <Callout tone="info" title="You need quadrat data with at least two species.">
        Collect quadrats in any simulation and choose “Add to Data Lab”. Each quadrat records every species, so you can test whether two species tend to be found
        together.
      </Callout>
    );
  }

  const valuesA = extractNumbers(ds, { column: a.key });
  const pairs = ds.rows
    .map((r) => [parseNumber(r.values[a.key]), parseNumber(r.values[b.key])] as const)
    .filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null);
  const table = [
    [pairs.filter(([x, y]) => x > 0 && y > 0).length, pairs.filter(([x, y]) => x > 0 && y === 0).length],
    [pairs.filter(([x, y]) => x === 0 && y > 0).length, pairs.filter(([x, y]) => x === 0 && y === 0).length],
  ];
  const result = chiSquaredIndependence(table);
  const interpretation = result.ok ? interpretIndependence(result, { a: a.label, b: b.label }) : null;

  const save = () => {
    if (!result.ok || !interpretation) return;
    const s: SavedAnalysis = {
      id: uid(),
      type: 'chi-squared-independence',
      title: `Association: ${a.label} and ${b.label}`,
      createdAt: new Date().toISOString(),
      datasetIds: [ds.id],
      inputs: { dataset: ds.name, speciesA: a.label, speciesB: b.label, quadrats: pairs.length },
      result: { chiSquared: result.chiSquared, df: result.df, p: result.p, criticalValue: result.criticalValue, significant: result.significant, association: result.association },
      headline: interpretation.headline,
      detail: interpretation.detail,
    };
    saveAnalysis(s);
    setSaved(s);
    notify({ tone: 'success', title: 'Result saved' });
  };

  const cell = (i: number, j: number) => (
    <td className="num px-3 py-2 text-center">
      <span className="text-lg font-semibold text-ink">{table[i][j]}</span>
      {result.ok && <span className="block text-xs text-ink-3">expected {formatNumber(result.expected[i][j], 1)}</span>}
    </td>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <RecordChiSquared when={result.ok} />
      <Card className="p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Quadrat dataset" htmlFor="as-ds">
            <Select id="as-ds" value={ds.id} onChange={(e) => { setDsId(e.target.value); setSaved(null); }}>
              {candidates.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Species A" htmlFor="as-a">
            <Select id="as-a" value={a.key} onChange={(e) => { setColA(e.target.value); setSaved(null); }}>
              {speciesCols.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Species B" htmlFor="as-b">
            <Select id="as-b" value={b.key} onChange={(e) => { setColB(e.target.value); setSaved(null); }}>
              {speciesCols.filter((c) => c.key !== a.key).map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="mt-4 text-sm text-ink-2">
          Each of the {valuesA.values.length} quadrats is classed by whether each species is present. If the species are independent, the expected count in each
          cell is (row total × column total) ÷ grand total.
        </p>
        <div className="scrollbar-thin mt-4 overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse text-sm">
            <caption className="sr-only">Contingency table of presence and absence</caption>
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col" className="px-3 py-2 text-xs font-medium text-ink-3">{b.label} present</th>
                <th scope="col" className="px-3 py-2 text-xs font-medium text-ink-3">{b.label} absent</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-ink-3">{a.label} present</th>
                {cell(0, 0)}
                {cell(0, 1)}
              </tr>
              <tr className="border-t border-line">
                <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-ink-3">{a.label} absent</th>
                {cell(1, 0)}
                {cell(1, 1)}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-5">
        {!result.ok ? (
          <Callout tone="warn" title="Something looks unusual.">{result.reason}</Callout>
        ) : (
          interpretation && (
            <div className="flex flex-col gap-4">
              <KeyFigures
                items={[
                  ['χ²', formatNumber(result.chiSquared, 3)],
                  ['Degrees of freedom', String(result.df)],
                  ['p value', formatP(result.p)],
                  ['Critical value (α 0.05)', formatNumber(result.criticalValue, 3)],
                ]}
              />
              <Verdict significant={result.significant} interpretation={interpretation} />
              <div className="flex justify-end">
                <Button variant="secondary" onClick={save} disabled={Boolean(saved)} icon={<Save className="size-4" aria-hidden />}>
                  {saved ? 'Result saved' : 'Save result'}
                </Button>
              </div>
            </div>
          )
        )}
      </Card>
    </div>
  );
}

'use client';

import { BookmarkPlus, Check } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import type { EcosystemId } from '@/types/ecosystem';
import type { Dataset, SavedAnalysis } from '@/types/data';
import type { ChartSpec, DatasetSnapshot, DescriptiveSnapshot, NotebookEntry } from '@/types/notebook';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Callout } from '@/components/ui/callout';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/components/providers/auth-provider';
import { useNotebookSync } from '@/components/providers/sync-provider';
import { getEcosystem } from '@/data/ecosystems';
import { extractNumbers } from '@/lib/data/datasets';
import { nowIso, uid } from '@/lib/data/ids';
import { describe } from '@/lib/statistics/descriptive';
import { useDataStore } from '@/lib/store/data-store';
import { useProgressStore } from '@/lib/store/progress-store';
import { cn } from '@/lib/cn';

export interface NotebookDraft {
  title: string;
  mode: 'simulation' | 'my-data';
  ecosystemId?: EcosystemId;
  missionId?: string;
  siteCode?: string;
  researchQuestion: string;
  hypothesis: string;
  samplingMethod: string;
  sampleSize: number | null;
  datasets: Dataset[];
  /** Analyses to include by default. Recent analyses are also offered. */
  tests?: SavedAnalysis[];
  charts?: ChartSpec[];
  /** Descriptive statistics to record; computed from each dataset's analysed column if omitted. */
  descriptive?: DescriptiveSnapshot[];
  conclusion?: string;
  limitations?: string;
}

const LIMITATION_PROMPTS = [
  'The sample size was small, so the estimate may not be precise.',
  'Samples came from one site on one day, so results may not apply to other places or seasons.',
  'Counting errors are possible, especially for small or overlapping individuals.',
  'Other factors (such as soil moisture or light) were not measured and may explain the pattern.',
];

export function describeDatasets(datasets: Dataset[]): DescriptiveSnapshot[] {
  const out: DescriptiveSnapshot[] = [];
  for (const d of datasets) {
    if (!d.valueColumn) continue;
    const col = d.columns.find((c) => c.key === d.valueColumn);
    const stats = describe(extractNumbers(d, { column: d.valueColumn }).values);
    if (!col || !stats) continue;
    out.push({
      label: `${d.name}: ${col.label}`,
      n: stats.n,
      mean: stats.mean,
      median: stats.median,
      modes: stats.modes,
      min: stats.min,
      max: stats.max,
      range: stats.range,
      sd: stats.sd,
    });
  }
  return out;
}

function snapshot(d: Dataset): DatasetSnapshot {
  return {
    id: uid(),
    name: d.name,
    kind: d.kind,
    columns: d.columns,
    rows: d.rows.map((r) => ({ id: uid(), values: { ...r.values } })),
    valueColumn: d.valueColumn,
    groupColumn: d.groupColumn,
  };
}

export function SaveToNotebookDialog({ open, onClose, draft }: { open: boolean; onClose: () => void; draft: NotebookDraft }) {
  return (
    <Dialog open={open} onClose={onClose} title="Save to Field Notebook" description="Record the question, evidence and conclusion of this investigation." size="lg">
      {open && <SaveForm draft={draft} onClose={onClose} />}
    </Dialog>
  );
}

function SaveForm({ draft, onClose }: { draft: NotebookDraft; onClose: () => void }) {
  const { user, configured } = useAuth();
  const { saveEntry } = useNotebookSync();
  const notify = useToast();
  const record = useProgressStore((s) => s.record);
  const recent = useDataStore((s) => s.analyses);
  const ids = useId();
  const [title, setTitle] = useState(draft.title);
  const [question, setQuestion] = useState(draft.researchQuestion);
  const [hypothesis, setHypothesis] = useState(draft.hypothesis);
  const [method, setMethod] = useState(draft.samplingMethod);
  const [conclusion, setConclusion] = useState(draft.conclusion ?? '');
  const [limitations, setLimitations] = useState(draft.limitations ?? '');
  const [datasetIds, setDatasetIds] = useState<string[]>(draft.datasets.map((d) => d.id));
  const candidates = [...(draft.tests ?? []), ...recent.filter((r) => !(draft.tests ?? []).some((t) => t.id === r.id))].slice(0, 8);
  const [testIds, setTestIds] = useState<string[]>((draft.tests ?? []).map((t) => t.id));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<NotebookEntry | null>(null);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const save = async () => {
    setSaving(true);
    const chosen = draft.datasets.filter((d) => datasetIds.includes(d.id));
    const t = nowIso();
    const eco = draft.ecosystemId ? getEcosystem(draft.ecosystemId) : undefined;
    const entry: NotebookEntry = {
      id: uid(),
      investigationId: uid(),
      title: title.trim() || 'Untitled investigation',
      mode: draft.mode,
      ecosystemId: draft.ecosystemId,
      ecosystemName: eco?.name,
      missionId: draft.missionId,
      siteCode: draft.siteCode,
      researchQuestion: question.trim(),
      hypothesis: hypothesis.trim(),
      samplingMethod: method.trim(),
      sampleSize: draft.sampleSize,
      datasets: chosen.map(snapshot),
      descriptive: draft.descriptive ?? describeDatasets(chosen),
      tests: candidates.filter((c) => testIds.includes(c.id)).map((c) => ({ ...c, id: uid() })),
      charts: draft.charts ?? [],
      conclusion: conclusion.trim(),
      limitations: limitations.trim(),
      createdAt: t,
      updatedAt: t,
      sync: { status: 'local' },
    };
    const result = await saveEntry(entry);
    record({ type: 'notebook-saved', complete: Boolean(entry.conclusion && entry.limitations) });
    setSaving(false);
    setSaved(entry);
    notify({
      tone: result === 'error' ? 'warn' : 'success',
      title: 'Saved to your Field Notebook',
      body: result === 'synced' ? 'Synced to your account.' : result === 'local' ? 'Saved on this device.' : undefined,
    });
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-bg text-success">
          <Check className="size-6" aria-hidden />
        </span>
        <p className="text-lg font-semibold text-ink">“{saved.title}” is in your notebook</p>
        {!user && (
          <p className="max-w-md text-sm text-ink-3">
            It is saved on this device. {configured ? 'Sign in to keep your notebook across devices.' : ''}
          </p>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link href={`/notebook/${saved.id}`} className="inline-flex h-11 items-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700" onClick={onClose}>
            Open entry
          </Link>
          <Button variant="secondary" onClick={onClose}>
            Keep working
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field label="Investigation name" htmlFor={`${ids}-t`}>
        <Input id={`${ids}-t`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} data-autofocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Research question" htmlFor={`${ids}-q`}>
          <Textarea id={`${ids}-q`} value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} />
        </Field>
        <Field label="Hypothesis" htmlFor={`${ids}-h`}>
          <Textarea id={`${ids}-h`} value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} rows={3} />
        </Field>
      </div>
      <Field label="Sampling method" htmlFor={`${ids}-m`}>
        <Input id={`${ids}-m`} value={method} onChange={(e) => setMethod(e.target.value)} />
      </Field>

      {draft.datasets.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-2">Datasets to include</legend>
          <div className="flex flex-col gap-2">
            {draft.datasets.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" className="size-4 accent-teal-600" checked={datasetIds.includes(d.id)} onChange={() => setDatasetIds((l) => toggle(l, d.id))} />
                {d.name} <span className="text-ink-3">({d.rows.length} rows)</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {candidates.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-2">Statistical tests to include</legend>
          <div className="flex flex-col gap-2">
            {candidates.map((a) => (
              <label key={a.id} className="flex items-start gap-2 text-sm text-ink-2">
                <input type="checkbox" className="mt-0.5 size-4 accent-teal-600" checked={testIds.includes(a.id)} onChange={() => setTestIds((l) => toggle(l, a.id))} />
                <span>
                  {a.title}
                  <span className="block text-xs text-ink-3">{a.headline}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Field label="Conclusion" htmlFor={`${ids}-c`} hint="Answer the question using your evidence: state the pattern, the test result, and whether it supports the hypothesis.">
        <Textarea id={`${ids}-c`} value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={4} placeholder="The data show that… (t = …, p = …). This supports / does not support the hypothesis because…" />
      </Field>
      <Field label="Limitations" htmlFor={`${ids}-l`} hint="What could make these conclusions less reliable? Tap a suggestion to add it.">
        <Textarea id={`${ids}-l`} value={limitations} onChange={(e) => setLimitations(e.target.value)} rows={3} />
      </Field>
      <div className="-mt-2 flex flex-wrap gap-1.5">
        {LIMITATION_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setLimitations((l) => (l.includes(p) ? l : `${l}${l.trim() ? '\n' : ''}${p}`))}
            className={cn('rounded-full border border-line bg-cream-100 px-2.5 py-1 text-left text-xs text-ink-2 hover:border-teal/50')}
          >
            + {p.split(',')[0]}
          </button>
        ))}
      </div>
      {!user && (
        <Callout tone="info">
          You’re in guest mode, so this entry will be saved on this device.{' '}
          {configured && (
            <Link href="/auth" className="font-medium text-teal-700 underline">
              Sign in
            </Link>
          )}
          {configured && ' to keep investigations in your account.'}
        </Callout>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} icon={<BookmarkPlus className="size-4" aria-hidden />}>
          {saving ? 'Saving investigation…' : 'Save to notebook'}
        </Button>
      </div>
    </form>
  );
}

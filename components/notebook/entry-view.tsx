'use client';

import { ArrowLeft, Download, FileText, Pencil, Printer, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { NotebookEntry } from '@/types/notebook';
import { getEcosystem } from '@/data/ecosystems';
import { useNotebookSync } from '@/components/providers/sync-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { ChartFrame } from '@/components/charts/chart-frame';
import { SampleIndexChart, TransectProfileChart } from '@/components/charts/sample-charts';
import { EcosystemArt } from '@/components/ecosystem/ecosystem-art';
import { toCsv } from '@/lib/data/csv';
import { downloadText } from '@/lib/data/import';
import { entryToMarkdown } from '@/lib/notebook/report';
import { describe } from '@/lib/statistics/descriptive';
import { formatNumber, formatP } from '@/lib/statistics/format';
import { parseNumber } from '@/lib/validation/numbers';
import { speciesColor } from '@/lib/simulation/palette';
import { useHydrated } from '@/lib/store/hydration';
import { useNotebookStore } from '@/lib/store/notebook-store';
import { SyncBadge } from './notebook-list';
import { formatDate } from './recent-investigations';

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'investigation';

function EntryCharts({ entry }: { entry: NotebookEntry }) {
  const eco = entry.ecosystemId ? getEcosystem(entry.ecosystemId) : undefined;
  return (
    <>
      {entry.datasets.map((d) => {
        const col = d.valueColumn && d.columns.find((c) => c.key === d.valueColumn);
        if (!col) return null;
        if (d.kind === 'line-transect' || d.kind === 'belt-transect') {
          const species = d.columns.filter((c) => c.key.startsWith('sp_'));
          const first = d.rows.length ? d.rows[0].values.transect : null;
          const rows = d.rows.filter((r) => r.values.transect === first);
          return (
            <ChartFrame key={d.id} title={`${d.name}: transect ${first ?? ''}`} className="print-card">
              <TransectProfileChart
                data={rows.map((r) => ({ distance: Number(r.values.distance) || 0, ...Object.fromEntries(species.map((s) => [s.key, Number(r.values[s.key]) || 0])) }))}
                series={species.map((s) => {
                  const sp = eco?.species.find((x) => `sp_${x.id}` === s.key);
                  return { key: s.key, label: s.label, color: speciesColor(sp?.slot ?? 1), emphasis: s.key === d.valueColumn };
                })}
              />
            </ChartFrame>
          );
        }
        const values = d.rows.map((r) => parseNumber(r.values[col.key])).filter((x): x is number => x !== null);
        const stats = describe(values);
        return (
          <ChartFrame key={d.id} title={`${d.name}: ${col.label}`} className="print-card">
            <SampleIndexChart data={values.map((v, i) => ({ index: i + 1, value: v }))} mean={stats?.mean} sd={stats?.sd} yLabel={col.label} />
          </ChartFrame>
        );
      })}
    </>
  );
}

export function NotebookEntryView({ id }: { id: string }) {
  const hydrated = useHydrated();
  const entry = useNotebookStore((s) => s.entries.find((e) => e.id === id));
  const { saveEntry, deleteEntry } = useNotebookSync();
  const { user } = useAuth();
  const notify = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', conclusion: '', limitations: '', hypothesis: '' });

  if (!hydrated) return <Skeleton className="h-96" label="Loading investigation…" />;
  if (!entry) {
    return (
      <EmptyState icon={<FileText className="size-6" aria-hidden />} title="We couldn’t find this investigation" actions={<ButtonLink href="/notebook" size="sm">Back to the notebook</ButtonLink>}>
        It may have been deleted, or saved on a different device. Sign in to see investigations saved to your account.
      </EmptyState>
    );
  }

  const eco = entry.ecosystemId ? getEcosystem(entry.ecosystemId) : undefined;
  const startEdit = () => {
    setDraft({ title: entry.title, conclusion: entry.conclusion, limitations: entry.limitations, hypothesis: entry.hypothesis });
    setEditing(true);
  };
  const saveEdit = async () => {
    await saveEntry({ ...entry, ...draft, title: draft.title.trim() || entry.title, updatedAt: new Date().toISOString() });
    setEditing(false);
    notify({ tone: 'success', title: 'Investigation updated' });
  };

  return (
    <article className="flex flex-col gap-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/notebook" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Field Notebook
        </Link>
        <div className="flex flex-wrap gap-2">
          {!editing && (
            <Button variant="ghost" size="sm" onClick={startEdit} icon={<Pencil className="size-4" aria-hidden />}>
              Edit
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => window.print()} icon={<Printer className="size-4" aria-hidden />}>
            Print / PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => downloadText(`${slug(entry.title)}.md`, entryToMarkdown(entry), 'text/markdown')} icon={<Download className="size-4" aria-hidden />}>
            Export report
          </Button>
          {user && entry.sync.status !== 'synced' && (
            <Button variant="secondary" size="sm" onClick={() => void saveEntry(entry)} icon={<RefreshCw className="size-4" aria-hidden />}>
              Retry sync
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!window.confirm(`Delete “${entry.title}” from your notebook? This cannot be undone.`)) return;
              await deleteEntry(entry);
              notify({ tone: 'info', title: 'Investigation deleted' });
              router.push('/notebook');
            }}
            icon={<Trash2 className="size-4" aria-hidden />}
          >
            Delete
          </Button>
        </div>
      </div>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {eco && (
          <div className="no-print h-24 w-40 shrink-0 overflow-hidden rounded-2xl">
            <EcosystemArt eco={eco} className="size-full" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">
            {entry.ecosystemName ? `${entry.ecosystemName} simulation` : 'My data'} · {formatDate(entry.createdAt)}
            {entry.siteCode ? ` · site ${entry.siteCode}` : ''}
          </p>
          {editing ? (
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Investigation name" className="mt-1 text-xl font-semibold" />
          ) : (
            <h1 className="mt-1 text-[1.9rem] leading-tight font-semibold text-ink">{entry.title}</h1>
          )}
          <div className="mt-1 no-print">
            <SyncBadge entry={entry} />
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="print-card p-5">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">Research question</h2>
          <p className="mt-1 text-ink">{entry.researchQuestion || '—'}</p>
          <h2 className="mt-4 text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">Hypothesis</h2>
          {editing ? (
            <Textarea value={draft.hypothesis} onChange={(e) => setDraft({ ...draft, hypothesis: e.target.value })} aria-label="Hypothesis" rows={2} className="mt-1" />
          ) : (
            <p className="mt-1 text-ink">{entry.hypothesis || '—'}</p>
          )}
        </Card>
        <Card className="print-card p-5">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">Method</h2>
          <p className="mt-1 text-ink">{entry.samplingMethod || '—'}</p>
          <h2 className="mt-4 text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">Sample size</h2>
          <p className="num mt-1 text-2xl font-semibold text-ink">{entry.sampleSize ?? '—'}</p>
        </Card>
      </div>

      {entry.descriptive.length > 0 && (
        <Card className="print-card">
          <CardHeader title="Descriptive statistics" />
          <div className="scrollbar-thin overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-ink-3">
                <tr>
                  {['Data', 'n', 'Mean', 'Median', 'Mode', 'Range', 'SD (n − 1)'].map((h) => (
                    <th key={h} scope="col" className="py-1.5 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entry.descriptive.map((d) => (
                  <tr key={d.label} className="border-t border-line">
                    <td className="py-2 pr-3 text-ink-2">{d.label}</td>
                    <td className="num py-2 pr-3">{d.n}</td>
                    <td className="num py-2 pr-3 font-semibold">{formatNumber(d.mean)}</td>
                    <td className="num py-2 pr-3">{formatNumber(d.median)}</td>
                    <td className="num py-2 pr-3">{d.modes.length ? d.modes.map((m) => formatNumber(m)).join(', ') : 'none'}</td>
                    <td className="num py-2 pr-3">{formatNumber(d.range)}</td>
                    <td className="num py-2 pr-3 font-semibold">{formatNumber(d.sd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {entry.tests.length > 0 && (
        <Card className="print-card">
          <CardHeader title="Statistical tests" />
          <ul className="flex flex-col gap-3 px-5 pb-5">
            {entry.tests.map((t) => (
              <li key={t.id} className="rounded-2xl border border-line bg-cream-100/60 p-4">
                <p className="font-semibold text-ink">{t.title}</p>
                <p className="num mt-1 text-xs text-ink-3">
                  {typeof t.result.t === 'number' && `t = ${formatNumber(t.result.t, 3)} · df = ${formatNumber(Number(t.result.df), 2)} · `}
                  {typeof t.result.chiSquared === 'number' && `χ² = ${formatNumber(t.result.chiSquared, 3)} · df = ${t.result.df} · `}
                  {typeof t.result.p === 'number' && `p ${formatP(t.result.p).startsWith('<') ? formatP(t.result.p) : `= ${formatP(t.result.p)}`}`}
                </p>
                <p className="mt-2 text-sm font-medium text-ink">{t.headline}</p>
                <p className="mt-1 text-sm text-ink-2">{t.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {entry.datasets.length > 0 && (
        <Card className="print-card">
          <CardHeader title="Charts" />
          <div className="grid gap-5 px-5 pb-5 lg:grid-cols-2">
            <EntryCharts entry={entry} />
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="print-card p-5">
          <h2 className="text-base font-semibold text-ink">Conclusion</h2>
          {editing ? (
            <Textarea value={draft.conclusion} onChange={(e) => setDraft({ ...draft, conclusion: e.target.value })} aria-label="Conclusion" rows={5} className="mt-2" />
          ) : (
            <p className="mt-2 leading-relaxed whitespace-pre-line text-ink-2">{entry.conclusion || 'No conclusion written yet.'}</p>
          )}
        </Card>
        <Card className="print-card p-5">
          <h2 className="text-base font-semibold text-ink">Limitations</h2>
          {editing ? (
            <Textarea value={draft.limitations} onChange={(e) => setDraft({ ...draft, limitations: e.target.value })} aria-label="Limitations" rows={5} className="mt-2" />
          ) : (
            <p className="mt-2 leading-relaxed whitespace-pre-line text-ink-2">{entry.limitations || 'No limitations recorded yet.'}</p>
          )}
        </Card>
      </div>
      {editing && (
        <div className="no-print flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button onClick={() => void saveEdit()}>Save changes</Button>
        </div>
      )}

      {entry.datasets.map((d) => (
        <Card key={d.id} className="print-card">
          <CardHeader
            title={`Data: ${d.name}`}
            subtitle={`${d.rows.length} rows`}
            actions={
              <Button
                variant="ghost"
                size="sm"
                className="no-print"
                icon={<Download className="size-4" aria-hidden />}
                onClick={() => downloadText(`${slug(d.name)}.csv`, toCsv([d.columns.map((c) => c.label), ...d.rows.map((r) => d.columns.map((c) => r.values[c.key]))]))}
              >
                CSV
              </Button>
            }
          />
          <div className="scrollbar-thin max-h-80 overflow-auto px-5 pb-5">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-paper text-left text-xs text-ink-3">
                <tr>
                  {d.columns.map((c) => (
                    <th key={c.key} scope="col" className="py-1.5 pr-3 font-medium whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    {d.columns.map((c) => (
                      <td key={c.key} className="num py-1 pr-3 text-ink-2">
                        {r.values[c.key] === null || r.values[c.key] === undefined ? '' : String(r.values[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </article>
  );
}

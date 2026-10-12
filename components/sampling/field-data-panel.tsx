'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Grid2x2, Leaf, Scale, ShieldCheck, Sigma, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { EcosystemDef } from '@/types/ecosystem';
import type { QuadratSample, SimulationSession } from '@/types/data';
import type { BiasAssessment } from '@/lib/sampling/bias';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/field';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs } from '@/components/ui/tabs';
import { ChartFrame } from '@/components/charts/chart-frame';
import { SampleBarChart, SampleIndexChart, TransectProfileChart } from '@/components/charts/sample-charts';
import { BoxPlot } from '@/components/charts/stat-charts';
import { SpeciesGlyph } from '@/components/ecosystem/species-glyph';
import { describe } from '@/lib/statistics/descriptive';
import { formatNumber } from '@/lib/statistics/format';
import { speciesColor } from '@/lib/simulation/palette';
import { useProgressStore } from '@/lib/store/progress-store';
import { cn } from '@/lib/cn';

type View = 'quadrats' | 'transects';

export function FieldDataPanel({
  eco,
  session,
  bias,
  onFocal,
  onRemoveSample,
  onRemoveTransect,
  onAddToDataLab,
  onCompare,
  preferred,
}: {
  eco: EcosystemDef;
  session: SimulationSession;
  bias: BiasAssessment | null;
  onFocal: (id: string) => void;
  onRemoveSample: (id: string) => void;
  onRemoveTransect: (id: string) => void;
  onAddToDataLab: () => void;
  onCompare: () => void;
  preferred: View;
}) {
  const [view, setView] = useState<View>(preferred);
  const [lastPreferred, setLastPreferred] = useState(preferred);
  if (lastPreferred !== preferred) {
    setLastPreferred(preferred);
    setView(preferred);
  }
  const focal = eco.species.find((s) => s.id === session.focalSpeciesId) ?? eco.species[0];
  const hasAny = session.samples.length > 0 || session.transects.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <span className="whitespace-nowrap">Counting</span>
          <Select value={focal.id} onChange={(e) => onFocal(e.target.value)} aria-label="Species to analyse" className="h-9 py-0 text-sm">
            {eco.species.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
        {eco.methods.length > 1 && (
          <Tabs
            label="Data type"
            size="sm"
            value={view}
            onChange={setView}
            items={[
              { id: 'quadrats', label: `Quadrats (${session.samples.length})` },
              { id: 'transects', label: `Transects (${session.transects.length})` },
            ]}
          />
        )}
      </div>

      {view === 'quadrats' ? (
        <QuadratData eco={eco} session={session} focalId={focal.id} bias={bias} onRemove={onRemoveSample} onCompare={onCompare} />
      ) : (
        <TransectData eco={eco} session={session} focalId={focal.id} onRemove={onRemoveTransect} />
      )}

      <Button onClick={onAddToDataLab} disabled={!hasAny} iconRight={<ArrowRight className="size-4" aria-hidden />} className="w-full">
        Add to Data Lab
      </Button>
    </div>
  );
}

function QuadratData({
  eco,
  session,
  focalId,
  bias,
  onRemove,
  onCompare,
}: {
  eco: EcosystemDef;
  session: SimulationSession;
  focalId: string;
  bias: BiasAssessment | null;
  onRemove: (id: string) => void;
  onCompare: () => void;
}) {
  const [chart, setChart] = useState<'distribution' | 'bar' | 'box'>('distribution');
  const samples = session.samples;
  const focal = eco.species.find((s) => s.id === focalId)!;
  const counts = samples.map((s) => s.counts[focalId] ?? 0);
  const stats = describe(counts);
  const densities = samples.map((s) => (s.counts[focalId] ?? 0) / (s.size * s.size));
  const density = densities.length ? densities.reduce((a, b) => a + b, 0) / densities.length : null;
  const richness = new Set(samples.flatMap((s) => Object.entries(s.counts).filter(([, c]) => c > 0).map(([k]) => k))).size;
  const mixedSizes = new Set(samples.map((s) => s.size)).size > 1;
  const zoneLabel = (id: string) => eco.zones.find((z) => z.id === id)?.label ?? id;
  const indexed = samples.map((s) => ({ index: s.number, value: s.counts[focalId] ?? 0 }));
  const record = useProgressStore((s) => s.record);
  const hasOutliers = chart === 'box' && (stats?.outliers.length ?? 0) > 0;
  useEffect(() => {
    if (hasOutliers) record({ type: 'outlier-seen' });
  }, [hasOutliers, record]);

  if (!samples.length) {
    return (
      <EmptyState icon={<Grid2x2 className="size-6" aria-hidden />} title="No samples yet">
        Generate locations or click the map to place your first quadrat. Each sample appears here with its counts.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="scrollbar-thin max-h-[300px] overflow-auto rounded-2xl border border-line">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Quadrat samples: {focal.name} count, species richness, location and zone</caption>
          <thead className="sticky top-0 z-[1] bg-cream-100 text-[0.72rem] text-ink-3">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Sample</th>
              <th scope="col" className="px-2 py-2 font-medium">{focal.name}</th>
              <th scope="col" className="px-2 py-2 font-medium" title="Number of species in the quadrat">Species</th>
              <th scope="col" className="px-2 py-2 font-medium">Location (x, y)</th>
              <th scope="col" className="px-2 py-2 font-medium">Zone</th>
              <th scope="col" className="px-2 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {[...samples].reverse().map((s: QuadratSample) => (
                <motion.tr
                  key={s.id}
                  layout
                  initial={{ opacity: 0, backgroundColor: '#e3eeeb' }}
                  animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className="border-t border-line"
                >
                  <td className="num px-3 py-1.5 text-ink-2">{s.number}</td>
                  <td className="num px-2 py-1.5 font-semibold text-ink">{s.counts[focalId] ?? 0}</td>
                  <td className="num px-2 py-1.5 text-ink-2">{s.richness}</td>
                  <td className="num px-2 py-1.5 whitespace-nowrap text-ink-2">
                    ({formatNumber(s.x, 1)}, {formatNumber(s.y, 1)})
                  </td>
                  <td className="px-2 py-1.5 text-xs text-ink-3">{zoneLabel(s.zone)}</td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => onRemove(s.id)} className="rounded-md p-1.5 text-ink-3 hover:bg-danger-bg hover:text-danger" aria-label={`Remove sample ${s.number}`}>
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <section aria-labelledby="live-summary">
        <h3 id="live-summary" className="mb-2 text-sm font-semibold text-ink">
          Live summary
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Total samples" value={samples.length} decimals={0} icon={<Leaf className="size-4" aria-hidden />} />
          <StatCard label="Mean" value={stats?.mean} decimals={1} unit={`per quadrat`} icon={<Sigma className="size-4" aria-hidden />} />
          <StatCard label="Species richness" value={richness} decimals={0} hint="species found in all quadrats" icon={<Leaf className="size-4" aria-hidden />} />
          <StatCard
            label="Est. density"
            value={density}
            decimals={1}
            unit={
              <span>
                m<sup>−2</sup>
              </span>
            }
            icon={<Grid2x2 className="size-4" aria-hidden />}
            emphasis
          />
        </div>
        {mixedSizes && (
          <p className="mt-2 text-xs text-warn">Your quadrats are different sizes. Compare densities (per m²), not raw counts.</p>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <Tabs
          label="Chart type"
          size="sm"
          value={chart}
          onChange={setChart}
          className="self-start"
          items={[
            { id: 'distribution', label: 'Distribution' },
            { id: 'bar', label: 'Bar chart' },
            { id: 'box', label: 'Box plot' },
          ]}
        />
        <ChartFrame
          title={`${focal.name} per quadrat`}
          description={stats && Number.isFinite(stats.sd) ? `Mean ${formatNumber(stats.mean)} · SD ${formatNumber(stats.sd)} (sample, n − 1)` : undefined}
          table={{ columns: ['Sample', `${focal.name} count`], rows: indexed.map((d) => [d.index, d.value]) }}
        >
          {chart === 'distribution' && <SampleIndexChart data={indexed} mean={stats?.mean} sd={stats?.sd} yLabel="Count" color={speciesColor(focal.slot)} />}
          {chart === 'bar' && <SampleBarChart data={indexed} mean={stats?.mean} yLabel="Count" color={speciesColor(focal.slot)} />}
          {chart === 'box' && stats && <BoxPlot groups={[{ label: focal.name, stats, values: counts, color: speciesColor(focal.slot) }]} xLabel={`${focal.name} per quadrat`} />}
        </ChartFrame>
      </div>

      {bias && bias.assessed && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {bias.biased ? (
            <Callout
              tone="warn"
              title="⚠ Sampling bias detected"
              action={
                <Button size="sm" variant="secondary" onClick={onCompare} icon={<Scale className="size-4" aria-hidden />}>
                  Compare with the actual population
                </Button>
              }
            >
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {bias.issues
                  .filter((i) => i.severity === 'warning')
                  .map((i) => (
                    <li key={i.kind}>{i.message}</li>
                  ))}
              </ul>
            </Callout>
          ) : (
            <Callout
              tone={Math.abs(bias.relativeError) > 0.25 ? 'info' : 'success'}
              title={Math.abs(bias.relativeError) > 0.25 ? 'No sign of bias' : 'Well spread samples'}
              action={
                <Button size="sm" variant="ghost" onClick={onCompare} icon={<ShieldCheck className="size-4" aria-hidden />}>
                  Check my sampling
                </Button>
              }
            >
              {bias.summary}
            </Callout>
          )}
          {bias.issues
            .filter((i) => i.severity === 'note')
            .map((i) => (
              <p key={i.message} className="mt-2 flex gap-2 text-xs text-ink-3">
                <TriangleAlert className="size-3.5 shrink-0 text-warn" aria-hidden />
                {i.message}
              </p>
            ))}
        </motion.div>
      )}
    </>
  );
}

function TransectData({ eco, session, focalId, onRemove }: { eco: EcosystemDef; session: SimulationSession; focalId: string; onRemove: (id: string) => void }) {
  const transects = session.transects;
  const [selected, setSelected] = useState<string | null>(null);
  const current = transects.find((t) => t.id === selected) ?? transects[transects.length - 1];
  const [perArea, setPerArea] = useState(false);
  if (!current) {
    return (
      <EmptyState icon={<ArrowRight className="size-6" aria-hidden />} title="No transects yet">
        Lay out a tape on the map with two clicks, or use the mission’s suggested line, then run the transect.
      </EmptyState>
    );
  }
  const focal = eco.species.find((s) => s.id === focalId)!;
  const belt = current.kind === 'belt';
  const useDensity = belt && perArea;
  const data = current.segments.map((g) => {
    const row: Record<string, number> = { distance: Math.round(((g.from + g.to) / 2) * 100) / 100 };
    for (const sp of eco.species) row[sp.id] = useDensity && g.area ? Math.round(((g.counts[sp.id] ?? 0) / g.area) * 100) / 100 : g.counts[sp.id] ?? 0;
    return row;
  });
  const total = current.segments.reduce((t, g) => t + g.total, 0);
  const richness = new Set(current.segments.flatMap((g) => Object.entries(g.counts).filter(([, c]) => c > 0).map(([k]) => k))).size;
  const presentIn = current.segments.filter((g) => (g.counts[focalId] ?? 0) > 0).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={current.id} onChange={(e) => setSelected(e.target.value)} aria-label="Transect" className="h-9 py-0 text-sm">
          {transects.map((t) => (
            <option key={t.id} value={t.id}>
              T{t.number}: {t.kind === 'line' ? 'Line' : `Belt ${t.width} m`} · {t.length.toFixed(1)} m
            </option>
          ))}
        </Select>
        <button type="button" onClick={() => onRemove(current.id)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-ink-3 hover:bg-danger-bg hover:text-danger">
          <Trash2 className="size-3.5" aria-hidden /> Remove
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Sections" value={current.segments.length} decimals={0} hint={`every ${current.interval} m`} />
        <StatCard label="Individuals" value={total} decimals={0} hint={belt ? 'rooted in the belt' : 'touching the tape'} />
        <StatCard label="Species richness" value={richness} decimals={0} />
        <StatCard label={`${focal.name} frequency`} value={(presentIn / current.segments.length) * 100} decimals={0} unit="%" hint="of sections" emphasis />
      </div>
      <ChartFrame
        title="Distance → species abundance"
        description={belt ? (useDensity ? 'Individuals per m² in each section' : 'Individuals in each section of the belt') : 'Individuals touching the tape in each interval'}
        table={{ columns: ['Distance (m)', ...eco.species.map((s) => s.name)], rows: data.map((r) => [r.distance, ...eco.species.map((s) => r[s.id])]) }}
        actions={
          belt ? (
            <button type="button" onClick={() => setPerArea((p) => !p)} aria-pressed={perArea} className={cn('inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium hover:bg-teal-50', perArea ? 'text-teal-700' : 'text-ink-2')}>
              per m²
            </button>
          ) : undefined
        }
      >
        <TransectProfileChart
          data={data}
          yLabel={useDensity ? 'Density (m⁻²)' : 'Individuals'}
          series={eco.species.map((s) => ({ key: s.id, label: s.name, color: speciesColor(s.slot), emphasis: s.id === focalId }))}
        />
      </ChartFrame>
      <div className="scrollbar-thin max-h-56 overflow-auto rounded-2xl border border-line">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Transect {current.number} sections</caption>
          <thead className="sticky top-0 bg-cream-100 text-[0.72rem] text-ink-3">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Distance (m)</th>
              <th scope="col" className="px-2 py-2 font-medium">
                <span className="flex items-center gap-1">
                  <SpeciesGlyph species={focal} size={11} />
                  {focal.name}
                </span>
              </th>
              <th scope="col" className="px-2 py-2 font-medium">Total</th>
              <th scope="col" className="px-2 py-2 font-medium">Species</th>
              <th scope="col" className="px-2 py-2 font-medium">Zone</th>
            </tr>
          </thead>
          <tbody>
            {current.segments.map((g, i) => (
              <tr key={i} className="border-t border-line">
                <td className="num px-3 py-1.5 text-ink-2">
                  {formatNumber(g.from, 1)}–{formatNumber(g.to, 1)}
                </td>
                <td className="num px-2 py-1.5 font-semibold text-ink">{g.counts[focalId] ?? 0}</td>
                <td className="num px-2 py-1.5 text-ink-2">{g.total}</td>
                <td className="num px-2 py-1.5 text-ink-2">{g.richness}</td>
                <td className="px-2 py-1.5 text-xs text-ink-3">{eco.zones.find((z) => z.id === g.zone)?.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

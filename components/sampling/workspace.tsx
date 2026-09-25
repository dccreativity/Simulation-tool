'use client';

import { BookmarkPlus, ChevronDown, CircleHelp, RefreshCcw, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EcosystemId, Point } from '@/types/ecosystem';
import type { Dataset, QuadratSample } from '@/types/data';
import { getEcosystem, METHOD_LABELS } from '@/data/ecosystems';
import { generateSite, type Site } from '@/lib/simulation/site';
import { rngFrom, hashString } from '@/lib/simulation/rng';
import { clampQuadrat, countQuadrat, planLocations, runBeltTransect, runLineTransect } from '@/lib/sampling/sampling';
import { assessBias } from '@/lib/sampling/bias';
import { quadratDataset, transectDataset } from '@/lib/data/datasets';
import { uid } from '@/lib/data/ids';
import { playChime } from '@/lib/sound/sound';
import { useSimulationStore } from '@/lib/store/simulation-store';
import { useDataStore } from '@/lib/store/data-store';
import { useProgressStore } from '@/lib/store/progress-store';
import { useSettingsStore } from '@/lib/store/settings-store';
import { useHydrated } from '@/lib/store/hydration';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { LoadingPanel, Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Callout } from '@/components/ui/callout';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { SaveToNotebookDialog, type NotebookDraft } from '@/components/notebook/save-dialog';
import { FieldMap, type Highlight } from './field-map';
import { ToolPanel } from './tool-panel';
import { FieldDataPanel } from './field-data-panel';
import { BiasDialog } from './bias-dialog';
import { MissionBar } from './mission-bar';
import { formatNumber } from '@/lib/statistics/format';

/** Build the site after first paint so the skeleton shows while it generates. */
function useSite(ecoId: EcosystemId, siteCode: string | undefined) {
  const [state, setState] = useState<{ key: string; site: Site } | null>(null);
  const key = `${ecoId}:${siteCode}`;
  useEffect(() => {
    if (!siteCode) return;
    const eco = getEcosystem(ecoId)!;
    const t = window.setTimeout(() => setState({ key, site: generateSite(eco, siteCode) }), 20);
    return () => window.clearTimeout(t);
  }, [ecoId, siteCode, key]);
  return state && state.key === key ? state.site : null;
}

export function SimulationWorkspace({ ecoId }: { ecoId: EcosystemId }) {
  const eco = getEcosystem(ecoId)!;
  const hydrated = useHydrated();
  const router = useRouter();
  const notify = useToast();
  const session = useSimulationStore((s) => s.sessions[ecoId]);
  const store = useSimulationStore;
  const record = useProgressStore((s) => s.record);
  const sound = useSettingsStore((s) => s.sound);
  const upsertDataset = useDataStore((s) => s.upsertDataset);

  useEffect(() => {
    if (hydrated) store.getState().ensure(eco);
  }, [hydrated, eco, store]);

  const site = useSite(ecoId, session?.siteCode);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [recentTransectId, setRecentTransectId] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [biasOpen, setBiasOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(true);
  const [siteCodeInput, setSiteCodeInput] = useState('');
  const highlightTimer = useRef<number | undefined>(undefined);
  const collectTimers = useRef<number[]>([]);

  useEffect(
    () => () => {
      window.clearTimeout(highlightTimer.current);
      collectTimers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const focalIndex = session ? Math.max(0, eco.species.findIndex((s) => s.id === session.focalSpeciesId)) : 0;

  const bias = useMemo(() => {
    if (!site || !session) return null;
    return assessBias(
      site,
      focalIndex,
      session.samples.map((s) => ({ x: s.x, y: s.y, size: s.size, count: s.counts[eco.species[focalIndex].id] ?? 0 })),
    );
  }, [site, session, focalIndex, eco.species]);

  // Tell the progress tracker when a bias warning appears.
  const biased = bias?.biased ?? false;
  useEffect(() => {
    if (biased) record({ type: 'bias-warning', ecosystemId: ecoId });
  }, [biased, ecoId, record]);

  const flash = useCallback((h: Highlight) => {
    setHighlight(h);
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlight(null), 2600);
  }, []);

  /** Count one quadrat, add it to the table, highlight what was inside. */
  const collectOne = useCallback(
    (x: number, y: number, size: number, strategy: QuadratSample['strategy'], quiet = false) => {
      if (!site) return null;
      const q = countQuadrat(site, x, y, size);
      const counts = Object.fromEntries(eco.species.map((s, i) => [s.id, q.counts[i]]));
      const [added] = store.getState().addSamples(ecoId, [
        { id: uid(), x, y, size, strategy, counts, total: q.total, richness: q.richness, zone: q.zone, createdAt: Date.now() },
      ]);
      const focal = eco.species[focalIndex];
      flash({ key: added.id, members: q.members, label: `${focal.name}: ${q.counts[focalIndex]}`, x: x + size / 2, y });
      if (sound) playChime();
      if (!quiet) notify({ tone: 'success', title: `Sample ${String(added.number).padStart(2, '0')} recorded`, body: `${focal.name}: ${q.counts[focalIndex]} · ${q.richness} species in a ${size} m × ${size} m quadrat` });
      return added;
    },
    [site, eco.species, ecoId, focalIndex, flash, sound, notify, store],
  );

  const afterCollect = useCallback(() => {
    const s = store.getState().sessions[ecoId];
    if (!s || !site) return;
    const b = assessBias(
      site,
      focalIndex,
      s.samples.map((q) => ({ x: q.x, y: q.y, size: q.size, count: q.counts[eco.species[focalIndex].id] ?? 0 })),
    );
    record({ type: 'samples-collected', ecosystemId: ecoId, randomCount: s.samples.filter((q) => q.strategy === 'random').length, biased: b.biased, total: s.samples.length });
  }, [store, ecoId, site, focalIndex, eco.species, record]);

  const placeQuadrat = useCallback(
    (x: number, y: number) => {
      if (!session || !site) return;
      const size = session.settings.quadratSize;
      const p = clampQuadrat(site, x - size / 2, y - size / 2, size);
      collectOne(p.x, p.y, size, 'manual');
      afterCollect();
    },
    [session, site, collectOne, afterCollect],
  );

  const collectPlanned = useCallback(
    (id: string) => {
      const s = store.getState().sessions[ecoId];
      const q = s?.planned.find((p) => p.id === id);
      if (!q) return;
      store.getState().removePlanned(ecoId, id);
      collectOne(q.x, q.y, q.size, q.strategy);
      afterCollect();
    },
    [store, ecoId, collectOne, afterCollect],
  );

  const generate = () => {
    if (!session || !site) return;
    const { strategy, sampleCount, quadratSize } = session.settings;
    const rng = rngFrom(hashString(`${Date.now()}:${Math.random()}`));
    const plan = planLocations(site, strategy, sampleCount, quadratSize, rng);
    store.getState().setPlanned(
      ecoId,
      plan.map((p) => ({ id: uid(), x: p.x, y: p.y, size: quadratSize, strategy })),
    );
    notify({ tone: 'info', title: `${plan.length} ${strategy} locations planned`, body: 'Click each dashed quadrat on the map, or collect them all.' });
  };

  const collectAll = () => {
    const s = store.getState().sessions[ecoId];
    if (!s?.planned.length) return;
    setCollecting(true);
    const list = [...s.planned];
    list.forEach((q, i) => {
      const t = window.setTimeout(() => {
        store.getState().removePlanned(ecoId, q.id);
        collectOne(q.x, q.y, q.size, q.strategy, true);
        if (i === list.length - 1) {
          setCollecting(false);
          afterCollect();
          notify({ tone: 'success', title: `${list.length} samples recorded`, body: 'Your table, charts and summary have been updated.' });
        }
      }, i * 170);
      collectTimers.current.push(t);
    });
  };

  const onDraftPoint = (p: Point) => {
    const d = session?.draft ?? { start: null, end: null };
    if (!d.start || d.end) store.getState().setDraft(ecoId, { start: p, end: null });
    else store.getState().setDraft(ecoId, { start: d.start, end: p });
  };

  const setLength = (m: number) => {
    const d = session?.draft;
    if (!d?.start || !d.end || !site) return;
    const len = Math.hypot(d.end.x - d.start.x, d.end.y - d.start.y) || 1;
    const ux = (d.end.x - d.start.x) / len;
    const uy = (d.end.y - d.start.y) / len;
    // Stop at the site boundary.
    let max = m;
    if (ux > 0) max = Math.min(max, (site.width - d.start.x) / ux);
    if (ux < 0) max = Math.min(max, -d.start.x / ux);
    if (uy > 0) max = Math.min(max, (site.height - d.start.y) / uy);
    if (uy < 0) max = Math.min(max, -d.start.y / uy);
    store.getState().setDraft(ecoId, { start: d.start, end: { x: d.start.x + ux * max, y: d.start.y + uy * max } });
  };

  const runTransect = () => {
    if (!session || !site) return;
    const { start, end } = session.draft;
    if (!start || !end) return;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length < 1) {
      notify({ tone: 'warn', title: 'Something looks unusual.', body: 'The tape is shorter than 1 m. Choose points further apart.' });
      return;
    }
    const kind = session.settings.tool === 'line-transect' ? 'line' : 'belt';
    const r =
      kind === 'line'
        ? runLineTransect(site, start, end, session.settings.lineInterval)
        : runBeltTransect(site, start, end, session.settings.beltWidth, session.settings.beltInterval);
    const t = store.getState().addTransect(ecoId, {
      id: uid(),
      kind,
      start,
      end,
      length: r.length,
      interval: r.interval,
      width: r.width,
      segments: r.segments.map((g) => ({
        from: g.from,
        to: g.to,
        zone: g.zone,
        counts: Object.fromEntries(eco.species.map((s, i) => [s.id, g.counts[i]])),
        total: g.total,
        richness: g.richness,
        area: g.area,
      })),
      createdAt: Date.now(),
    });
    setRecentTransectId(t.id);
    window.setTimeout(() => flash({ key: t.id, members: r.members, label: `${r.members.length} recorded`, x: end.x, y: end.y }), 1200);
    if (sound) playChime();
    record({ type: 'transect', kind, ecosystemId: ecoId });
    notify({ tone: 'success', title: `Transect ${t.number} recorded`, body: `${r.segments.length} sections along ${r.length.toFixed(1)} m · ${r.members.length} individuals.` });
  };

  const buildDatasets = (): Dataset[] => {
    const s = store.getState().sessions[ecoId];
    if (!s) return [];
    const existing = useDataStore.getState().datasets;
    const out: Dataset[] = [];
    if (s.samples.length) {
      const d = quadratDataset(eco, s, existing.find((x) => x.id === s.datasetIds.quadrat));
      out.push(d);
      store.getState().setDatasetId(ecoId, 'quadrat', d.id);
    }
    for (const kind of ['line', 'belt'] as const) {
      if (s.transects.some((t) => t.kind === kind)) {
        const d = transectDataset(eco, s, kind, existing.find((x) => x.id === s.datasetIds[kind]));
        out.push(d);
        store.getState().setDatasetId(ecoId, kind, d.id);
      }
    }
    out.forEach(upsertDataset);
    return out;
  };

  const addToDataLab = () => {
    const ds = buildDatasets();
    if (!ds.length) return;
    notify({ tone: 'success', title: 'Added to the Data Lab', body: ds.map((d) => d.name).join(' · ') });
    router.push(`/data-lab?dataset=${ds[0].id}`);
  };

  const [notebookDraft, setNotebookDraft] = useState<NotebookDraft | null>(null);
  const openSave = () => {
    const s = store.getState().sessions[ecoId];
    if (!s) return;
    const datasets = buildDatasets();
    const methods = [
      s.samples.length ? `${s.samples.length} quadrats (${[...new Set(s.samples.map((q) => `${q.size} m × ${q.size} m`))].join(', ')}; ${[...new Set(s.samples.map((q) => q.strategy))].join(', ')} placement)` : null,
      ...(['line', 'belt'] as const).map((k) => {
        const n = s.transects.filter((t) => t.kind === k).length;
        return n ? `${n} ${k} transect${n > 1 ? 's' : ''}` : null;
      }),
    ].filter(Boolean);
    setNotebookDraft({
      title: `${eco.mission.title} — ${eco.name}`,
      mode: 'simulation',
      ecosystemId: eco.id,
      missionId: eco.mission.id,
      siteCode: s.siteCode,
      researchQuestion: eco.mission.question,
      hypothesis: eco.mission.hypothesis,
      samplingMethod: methods.join('; ') || 'Not yet sampled',
      sampleSize: s.samples.length || s.transects.reduce((t, x) => t + x.segments.length, 0) || null,
      datasets,
      charts: datasets.map((d) => ({ kind: d.kind === 'quadrat' ? 'distribution' : 'transect', datasetId: d.id, column: d.valueColumn ?? '', title: d.name })),
    });
    setSaveOpen(true);
    setEndOpen(false);
  };

  if (!hydrated || !session) {
    return (
      <PageContainer wide>
        <Skeleton className="mb-4 h-10 w-72" label="Loading ecosystem…" />
        <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)_360px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-[480px]" />
          <Skeleton className="h-96" />
        </div>
      </PageContainer>
    );
  }

  const s = session;
  const tool = s.settings.tool;
  const focal = eco.species[focalIndex];

  return (
    <PageContainer wide>
      <PageHeader
        crumbs={[{ href: '/simulation', label: 'Simulation' }, { label: eco.name }]}
        title={`${eco.name} Ecosystem`}
        subtitle="Explore, sample and analyse plant and animal populations."
        actions={<MissionBar ecoId={ecoId} startedAt={s.startedAt} onEnd={() => setEndOpen(true)} />}
      />

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)_380px]">
        {/* Tools */}
        <div className="order-2 flex flex-col gap-4 lg:order-1 lg:row-span-2 xl:row-span-1">
          <Card>
            <CardHeader title="Sampling tools" />
            <div className="px-5 pb-5">
              <ToolPanel
                eco={eco}
                settings={s.settings}
                onSettings={(v) => store.getState().setSettings(ecoId, v)}
                planned={s.planned}
                draft={s.draft}
                onGenerate={generate}
                onCollectAll={collectAll}
                onClearPlanned={() => store.getState().setPlanned(ecoId, [])}
                onSuggested={() => store.getState().setDraft(ecoId, { ...eco.mission.suggestedTransect })}
                onRunTransect={runTransect}
                onClearDraft={() => store.getState().setDraft(ecoId, { start: null, end: null })}
                onSetLength={setLength}
                collecting={collecting}
              />
            </div>
          </Card>
          <Card>
            <button type="button" className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left" aria-expanded={briefOpen} onClick={() => setBriefOpen((o) => !o)}>
              <span className="flex items-center gap-2 text-[1.02rem] font-semibold text-ink">
                <Target className="size-5 text-teal" aria-hidden /> Mission: {eco.mission.title}
              </span>
              <ChevronDown className={`size-4 text-ink-3 transition-transform ${briefOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {briefOpen && (
              <div className="flex flex-col gap-3 px-5 pb-5 text-sm leading-relaxed text-ink-2">
                <p className="font-medium text-ink">{eco.mission.question}</p>
                <p>{eco.mission.background}</p>
                <p>
                  <span className="font-semibold text-ink">Hypothesis:</span> {eco.mission.hypothesis}
                </p>
                <p className="text-xs text-ink-3">
                  <span className="font-semibold">Null hypothesis:</span> {eco.mission.nullHypothesis}
                </p>
                <p className="rounded-xl bg-sage-100 px-3 py-2 text-xs">
                  <CircleHelp className="mr-1 inline size-3.5 text-teal-700" aria-hidden />
                  {eco.mission.analysisHint} Recommended: {eco.mission.recommendedMethods.map((m) => METHOD_LABELS[m]).join(', ')}.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-3">
                  <span>
                    Site code <span className="num font-semibold text-ink">{s.siteCode}</span>
                  </span>
                  <button type="button" onClick={() => { setSiteCodeInput(''); setSiteOpen(true); }} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-teal-700 hover:bg-teal-50">
                    <RefreshCcw className="size-3.5" aria-hidden /> New site
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Map */}
        <Card className="order-1 min-w-0 self-start p-3 sm:p-4 lg:order-2">
          {site ? (
            <FieldMap
              site={site}
              tool={tool}
              quadratSize={s.settings.quadratSize}
              beltWidth={s.settings.beltWidth}
              samples={s.samples}
              planned={s.planned}
              transects={s.transects}
              draft={s.draft}
              highlight={highlight}
              focalIndex={focalIndex}
              recentTransectId={recentTransectId}
              onPlaceQuadrat={placeQuadrat}
              onCollectPlanned={collectPlanned}
              onDraftPoint={onDraftPoint}
            />
          ) : (
            <div className="flex aspect-[5/3] flex-col items-center justify-center gap-3 rounded-2xl bg-sage-100">
              <LoadingPanel label="Loading ecosystem…" className="w-64" />
            </div>
          )}
        </Card>

        {/* Data */}
        <Card className="order-3 min-w-0 self-start lg:col-start-2 xl:col-start-3 xl:row-start-1">
          <CardHeader title="Field data" subtitle={tool === 'quadrat' ? `Counts of individuals rooted in each quadrat` : 'Records along each transect'} />
          <div className="px-5 pb-5">
            <FieldDataPanel
              eco={eco}
              session={s}
              bias={tool === 'quadrat' ? bias : null}
              preferred={tool === 'quadrat' ? 'quadrats' : 'transects'}
              onFocal={(id) => store.getState().setFocal(ecoId, id)}
              onRemoveSample={(id) => store.getState().removeSample(ecoId, id)}
              onRemoveTransect={(id) => store.getState().removeTransect(ecoId, id)}
              onAddToDataLab={addToDataLab}
              onCompare={() => setBiasOpen(true)}
            />
            <Button variant="secondary" className="mt-2 w-full" onClick={openSave} icon={<BookmarkPlus className="size-4" aria-hidden />} disabled={!s.samples.length && !s.transects.length}>
              Save to Field Notebook
            </Button>
          </div>
        </Card>
      </div>

      {site && <BiasDialog open={biasOpen} onClose={() => setBiasOpen(false)} site={site} focalIndex={focalIndex} samples={s.samples} bias={bias} />}

      <Dialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        title="Mission summary"
        description={eco.mission.question}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEndOpen(false)}>
              Keep sampling
            </Button>
            <Button variant="secondary" onClick={openSave} disabled={!s.samples.length && !s.transects.length}>
              Save to Field Notebook
            </Button>
            <Button onClick={addToDataLab} disabled={!s.samples.length && !s.transects.length}>
              Analyse in Data Lab
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-cream-100 p-4">
            <p className="text-xs text-ink-3">Quadrats</p>
            <p className="num text-2xl font-semibold">{s.samples.length}</p>
          </div>
          <div className="rounded-2xl bg-cream-100 p-4">
            <p className="text-xs text-ink-3">Transects</p>
            <p className="num text-2xl font-semibold">{s.transects.length}</p>
          </div>
          <div className="rounded-2xl bg-cream-100 p-4">
            <p className="text-xs text-ink-3">{focal.name} density</p>
            <p className="num text-2xl font-semibold">{bias && Number.isFinite(bias.estimatedDensity) ? `${formatNumber(bias.estimatedDensity, 1)} m⁻²` : '—'}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 text-sm text-ink-2">
          {bias?.assessed ? (
            <Callout tone={bias.biased ? 'warn' : 'success'} title={bias.biased ? 'This sampling strategy may introduce bias.' : 'Your sampling looks representative.'}>
              {bias.biased ? bias.issues.find((i) => i.severity === 'warning')?.message : bias.summary}
            </Callout>
          ) : (
            <Callout tone="info">Collect at least four quadrats to check your sampling for bias.</Callout>
          )}
          <p>
            <span className="font-semibold text-ink">Next:</span> in the Data Lab you can check your data, then compare the{' '}
            {eco.zones.find((z) => z.id === eco.mission.comparison.zoneA)?.label.toLowerCase()} and{' '}
            {eco.zones.find((z) => z.id === eco.mission.comparison.zoneB)?.label.toLowerCase()} zones with a t-test.
          </p>
        </div>
      </Dialog>

      <Dialog
        open={siteOpen}
        onClose={() => setSiteOpen(false)}
        title="Sample a new site"
        description="Every site code generates a different population. Share a code so the whole class samples the same site."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSiteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const code = siteCodeInput.trim() || `${eco.defaultSiteCode.split('-')[0]}-${Math.floor(100 + Math.random() * 900)}`;
                store.getState().newSite(eco, code);
                setSiteOpen(false);
                notify({ tone: 'info', title: `New site: ${code.toUpperCase()}`, body: 'Your previous samples were cleared. Saved datasets are unchanged.' });
              }}
            >
              Start new site
            </Button>
          </>
        }
      >
        <Field label="Site code" htmlFor="site-code" hint="Leave blank for a random site. This clears the samples collected in the current site.">
          <Input id="site-code" value={siteCodeInput} onChange={(e) => setSiteCodeInput(e.target.value)} placeholder={`e.g. ${eco.defaultSiteCode}`} maxLength={24} data-autofocus />
        </Field>
      </Dialog>

      {notebookDraft && <SaveToNotebookDialog open={saveOpen} onClose={() => setSaveOpen(false)} draft={notebookDraft} />}
    </PageContainer>
  );
}

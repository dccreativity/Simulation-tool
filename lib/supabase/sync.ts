/**
 * Cloud persistence for notebook entries (and the investigation, datasets,
 * rows and analyses behind them). All calls run as the signed-in user, so Row
 * Level Security limits every read and write to their own rows.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AchievementId } from '@/data/achievements';
import { ACHIEVEMENTS } from '@/data/achievements';
import { ECOSYSTEM_IDS, getEcosystem } from '@/data/ecosystems';
import type { Column, DatasetKind, Row, SavedAnalysis } from '@/types/data';
import type { EcosystemId } from '@/types/ecosystem';
import type { ChartSpec, DatasetSnapshot, DescriptiveSnapshot, NotebookEntry } from '@/types/notebook';

const PAGE = 1000;

async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function pushEntry(sb: SupabaseClient, userId: string, entry: NotebookEntry): Promise<void> {
  const ecosystemId = entry.ecosystemId && ECOSYSTEM_IDS.includes(entry.ecosystemId) ? entry.ecosystemId : null;
  const missionId = ecosystemId && entry.missionId === getEcosystem(ecosystemId)?.mission.id ? entry.missionId : null;
  check(
    (
      await sb.from('investigations').upsert({
        id: entry.investigationId,
        user_id: userId,
        mode: entry.mode,
        ecosystem_id: ecosystemId,
        mission_id: missionId,
        site_code: entry.siteCode ?? null,
        title: entry.title.slice(0, 200) || 'Untitled investigation',
        research_question: entry.researchQuestion,
        hypothesis: entry.hypothesis,
        sampling_method: entry.samplingMethod,
        sample_size: entry.sampleSize,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
      })
    ).error,
  );

  for (const d of entry.datasets) {
    check(
      (
        await sb.from('datasets').upsert({
          id: d.id,
          user_id: userId,
          investigation_id: entry.investigationId,
          name: d.name.slice(0, 200) || 'Dataset',
          kind: d.kind,
          source: 'user',
          columns: d.columns,
          value_column: d.valueColumn ?? null,
          group_column: d.groupColumn ?? null,
        })
      ).error,
    );
    check(
      (await sb.rpc('replace_dataset_rows', { p_dataset_id: d.id, p_rows: d.rows.map((r) => ({ cells: r.values })) })).error,
    );
  }

  const datasetIds = new Set(entry.datasets.map((d) => d.id));
  if (entry.tests.length) {
    check(
      (
        await sb.from('analyses').upsert(
          entry.tests.map((t) => ({
            id: t.id,
            user_id: userId,
            investigation_id: entry.investigationId,
            dataset_id: t.datasetIds.find((id) => datasetIds.has(id)) ?? null,
            type: t.type,
            title: t.title,
            parameters: t.inputs,
            results: { ...t.result, headline: t.headline, detail: t.detail },
            created_at: t.createdAt,
          })),
        )
      ).error,
    );
  }

  check(
    (
      await sb.from('notebook_entries').upsert({
        id: entry.id,
        user_id: userId,
        investigation_id: entry.investigationId,
        title: entry.title.slice(0, 200) || 'Untitled investigation',
        dataset_ids: entry.datasets.map((d) => d.id),
        descriptive: entry.descriptive,
        tests: entry.tests,
        charts: entry.charts,
        conclusion: entry.conclusion,
        limitations: entry.limitations,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
      })
    ).error,
  );
}

export async function deleteInvestigation(sb: SupabaseClient, investigationId: string): Promise<void> {
  // Cascades to the notebook entry, datasets, rows and analyses.
  check((await sb.from('investigations').delete().eq('id', investigationId)).error);
}

interface EntryRow {
  id: string;
  investigation_id: string;
  title: string;
  dataset_ids: string[];
  descriptive: DescriptiveSnapshot[];
  tests: SavedAnalysis[];
  charts: ChartSpec[];
  conclusion: string;
  limitations: string;
  created_at: string;
  updated_at: string;
  investigation: {
    mode: 'simulation' | 'my-data';
    ecosystem_id: string | null;
    mission_id: string | null;
    site_code: string | null;
    research_question: string;
    hypothesis: string;
    sampling_method: string;
    sample_size: number | null;
  } | null;
}

export async function pullEntries(sb: SupabaseClient): Promise<NotebookEntry[]> {
  const entries = await fetchAll<EntryRow>((from, to) =>
    sb
      .from('notebook_entries')
      .select('*, investigation:investigations(mode, ecosystem_id, mission_id, site_code, research_question, hypothesis, sampling_method, sample_size)')
      .order('created_at', { ascending: false })
      .range(from, to),
  );
  if (!entries.length) return [];
  const ids = [...new Set(entries.flatMap((e) => e.dataset_ids))];
  const datasets = ids.length
    ? await fetchAll<{ id: string; name: string; kind: DatasetKind; columns: Column[]; value_column: string | null; group_column: string | null }>(
        (from, to) => sb.from('datasets').select('id, name, kind, columns, value_column, group_column').in('id', ids).range(from, to),
      )
    : [];
  const rows = ids.length
    ? await fetchAll<{ id: string; dataset_id: string; position: number; cells: Row['values'] }>((from, to) =>
        sb.from('dataset_rows').select('id, dataset_id, position, cells').in('dataset_id', ids).order('position').range(from, to),
      )
    : [];
  const snapshots = new Map<string, DatasetSnapshot>(
    datasets.map((d) => [
      d.id,
      { id: d.id, name: d.name, kind: d.kind, columns: d.columns, rows: [], valueColumn: d.value_column ?? undefined, groupColumn: d.group_column ?? undefined },
    ]),
  );
  for (const r of rows) snapshots.get(r.dataset_id)?.rows.push({ id: r.id, values: r.cells });

  return entries.map((e): NotebookEntry => {
    const inv = e.investigation;
    const eco = inv?.ecosystem_id ? getEcosystem(inv.ecosystem_id) : undefined;
    return {
      id: e.id,
      investigationId: e.investigation_id,
      title: e.title,
      mode: inv?.mode ?? 'my-data',
      ecosystemId: eco?.id as EcosystemId | undefined,
      ecosystemName: eco?.name,
      missionId: inv?.mission_id ?? undefined,
      siteCode: inv?.site_code ?? undefined,
      researchQuestion: inv?.research_question ?? '',
      hypothesis: inv?.hypothesis ?? '',
      samplingMethod: inv?.sampling_method ?? '',
      sampleSize: inv?.sample_size ?? null,
      datasets: e.dataset_ids.map((id) => snapshots.get(id)).filter((d): d is DatasetSnapshot => Boolean(d)),
      descriptive: e.descriptive ?? [],
      tests: e.tests ?? [],
      charts: e.charts ?? [],
      conclusion: e.conclusion,
      limitations: e.limitations,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
      sync: { status: 'synced', syncedAt: new Date().toISOString() },
    };
  });
}

export async function syncAchievements(
  sb: SupabaseClient,
  userId: string,
  earned: Partial<Record<AchievementId, string>>,
): Promise<Partial<Record<AchievementId, string>>> {
  const valid = new Set(ACHIEVEMENTS.map((a) => a.id));
  const local = (Object.entries(earned) as [AchievementId, string][]).filter(([id]) => valid.has(id));
  if (local.length) {
    check(
      (
        await sb
          .from('user_achievements')
          .upsert(local.map(([id, at]) => ({ user_id: userId, achievement_id: id, earned_at: at })), { ignoreDuplicates: true })
      ).error,
    );
  }
  const { data, error } = await sb.from('user_achievements').select('achievement_id, earned_at');
  check(error);
  const reputation = ACHIEVEMENTS.reduce(
    (t, a) => t + ((data ?? []).some((r) => r.achievement_id === a.id) ? a.points : 0),
    0,
  );
  await sb.from('profiles').update({ reputation }).eq('id', userId);
  return Object.fromEntries((data ?? []).map((r) => [r.achievement_id, r.earned_at])) as Partial<Record<AchievementId, string>>;
}

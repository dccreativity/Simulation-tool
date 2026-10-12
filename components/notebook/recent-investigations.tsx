'use client';

import { BookOpen, Cloud, HardDrive } from 'lucide-react';
import Link from 'next/link';
import { getEcosystem } from '@/data/ecosystems';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EcosystemArt } from '@/components/ecosystem/ecosystem-art';
import { useHydrated } from '@/lib/store/hydration';
import { useNotebookStore } from '@/lib/store/notebook-store';

export function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export function RecentInvestigations({ limit = 3 }: { limit?: number }) {
  const hydrated = useHydrated();
  const entries = useNotebookStore((s) => s.entries);
  if (!hydrated) {
    return (
      <div className="grid gap-3 sm:grid-cols-3" aria-busy>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28" label={i === 0 ? 'Loading investigations…' : undefined} />
        ))}
      </div>
    );
  }
  if (!entries.length) {
    return (
      <EmptyState icon={<BookOpen className="size-6" aria-hidden />} title="No investigations yet" actions={<ButtonLink href="/simulation" size="sm">Start your first investigation</ButtonLink>}>
        Saved investigations appear here, with their question, data, statistics and conclusion.
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.slice(0, limit).map((e) => {
        const eco = e.ecosystemId ? getEcosystem(e.ecosystemId) : undefined;
        return (
          <li key={e.id}>
            <Link href={`/notebook/${e.id}`} className="flex h-full gap-3 rounded-2xl border border-line bg-paper p-3 transition-shadow hover:shadow-card">
              <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-sage-100">{eco && <EcosystemArt eco={eco} className="size-full" />}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{e.title}</p>
                <p className="truncate text-xs text-ink-3">
                  {e.ecosystemName ?? 'My data'} · {formatDate(e.createdAt)}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-ink-2">{e.conclusion || e.researchQuestion}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-[0.7rem] text-ink-3">
                  {e.sync.status === 'synced' ? <Cloud className="size-3" aria-hidden /> : <HardDrive className="size-3" aria-hidden />}
                  {e.sync.status === 'synced' ? 'Synced' : 'On this device'}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

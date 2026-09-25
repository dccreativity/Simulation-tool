'use client';

import { motion } from 'framer-motion';
import { BookOpen, Cloud, CloudOff, HardDrive, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { getEcosystem } from '@/data/ecosystems';
import { useAuth } from '@/components/providers/auth-provider';
import { useNotebookSync } from '@/components/providers/sync-provider';
import { EcosystemArt } from '@/components/ecosystem/ecosystem-art';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useHydrated } from '@/lib/store/hydration';
import { useNotebookStore } from '@/lib/store/notebook-store';
import type { NotebookEntry } from '@/types/notebook';
import { formatDate } from './recent-investigations';

export function SyncBadge({ entry }: { entry: NotebookEntry }) {
  const s = entry.sync.status;
  const map = {
    synced: { icon: <Cloud className="size-3.5" aria-hidden />, text: 'Synced to your account', cls: 'text-success' },
    local: { icon: <HardDrive className="size-3.5" aria-hidden />, text: 'Saved on this device', cls: 'text-ink-3' },
    pending: { icon: <CloudOff className="size-3.5" aria-hidden />, text: 'Waiting to sync', cls: 'text-warn' },
    error: { icon: <CloudOff className="size-3.5" aria-hidden />, text: 'Not synced — saved locally', cls: 'text-danger' },
  }[s];
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${map.cls}`}>
      {map.icon}
      {map.text}
    </span>
  );
}

export function NotebookList() {
  const hydrated = useHydrated();
  const entries = useNotebookStore((s) => s.entries);
  const { user, configured } = useAuth();
  const { syncNow } = useNotebookSync();
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);

  if (!hydrated) {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-40" label={i === 0 ? 'Loading notebook…' : undefined} />
        ))}
      </div>
    );
  }

  const filtered = entries.filter((e) => `${e.title} ${e.ecosystemName ?? ''} ${e.researchQuestion} ${e.conclusion}`.toLowerCase().includes(q.toLowerCase()));
  const unsynced = entries.filter((e) => e.sync.status !== 'synced').length;

  return (
    <div className="flex flex-col gap-5">
      {!user && configured && entries.length > 0 && (
        <Callout tone="info" title="Your notebook is saved on this device." action={<ButtonLink href="/auth" size="sm">Sign in to sync</ButtonLink>}>
          Sign in to keep your investigations in your account and see them on any device.
        </Callout>
      )}
      {user && unsynced > 0 && (
        <Callout
          tone="warn"
          title={`${unsynced} ${unsynced === 1 ? 'entry is' : 'entries are'} not yet synced.`}
          action={
            <Button
              size="sm"
              variant="secondary"
              loading={syncing}
              icon={<RefreshCw className="size-4" aria-hidden />}
              onClick={async () => {
                setSyncing(true);
                await syncNow();
                setSyncing(false);
              }}
            >
              Sync now
            </Button>
          }
        >
          Offline changes saved locally. They will sync when you are back online.
        </Callout>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-6" aria-hidden />}
          title="Your Field Notebook is empty"
          actions={
            <>
              <ButtonLink href="/simulation" size="sm">
                Start a simulation
              </ButtonLink>
              <ButtonLink href="/my-data" size="sm" variant="secondary">
                Analyse my data
              </ButtonLink>
            </>
          }
        >
          Collect or analyse some data, then choose “Save to Field Notebook” to record your question, evidence and conclusion.
        </EmptyState>
      ) : (
        <>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search investigations" aria-label="Search investigations" className="pl-10" />
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {filtered.map((e, i) => {
              const eco = e.ecosystemId ? getEcosystem(e.ecosystemId) : undefined;
              return (
                <motion.li key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
                  <Link href={`/notebook/${e.id}`} className="flex h-full gap-4 rounded-card border border-line bg-paper p-4 shadow-card transition-shadow hover:shadow-lift">
                    <div className="size-24 shrink-0 overflow-hidden rounded-2xl bg-sage-100">
                      {eco ? <EcosystemArt eco={eco} className="size-full" /> : <div className="flex size-full items-center justify-center text-teal-700"><BookOpen className="size-8" aria-hidden /></div>}
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="font-semibold text-ink">{e.title}</p>
                      <p className="text-xs text-ink-3">
                        {e.ecosystemName ?? 'My data'} · {formatDate(e.createdAt)}
                        {e.sampleSize ? ` · n = ${e.sampleSize}` : ''}
                        {e.tests.length ? ` · ${e.tests.length} test${e.tests.length > 1 ? 's' : ''}` : ''}
                      </p>
                      <p className="line-clamp-2 text-sm text-ink-2">{e.conclusion || e.researchQuestion || 'No conclusion yet.'}</p>
                      <div className="mt-auto pt-1">
                        <SyncBadge entry={e} />
                      </div>
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
          {!filtered.length && <p className="text-sm text-ink-3">No investigations match “{q}”.</p>}
        </>
      )}
    </div>
  );
}

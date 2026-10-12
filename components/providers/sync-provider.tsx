'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useToast } from '@/components/ui/toast';
import { getSupabase } from '@/lib/supabase/client';
import { deleteInvestigation, pullEntries, pushEntry, syncAchievements } from '@/lib/supabase/sync';
import { useNotebookStore } from '@/lib/store/notebook-store';
import { useProgressStore } from '@/lib/store/progress-store';
import { useHydrated } from '@/lib/store/hydration';
import type { NotebookEntry } from '@/types/notebook';
import { useAuth } from './auth-provider';

interface SyncContextValue {
  /** Save locally first, then to the cloud when signed in and online. */
  saveEntry: (entry: NotebookEntry) => Promise<'synced' | 'local' | 'pending' | 'error'>;
  deleteEntry: (entry: NotebookEntry) => Promise<void>;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useNotebookSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useNotebookSync must be used inside <SyncProvider>');
  return ctx;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const hydrated = useHydrated();
  const notify = useToast();
  const running = useRef(false);

  const pushOne = useCallback(
    async (entry: NotebookEntry): Promise<'synced' | 'pending' | 'error'> => {
      const sb = getSupabase();
      const store = useNotebookStore.getState();
      if (!sb || !user) return 'error';
      if (!navigator.onLine) {
        store.setSync(entry.id, 'pending');
        return 'pending';
      }
      try {
        await pushEntry(sb, user.id, entry);
        store.setSync(entry.id, 'synced');
        return 'synced';
      } catch (e) {
        const offline = !navigator.onLine || (e instanceof Error && /fetch|network/i.test(e.message));
        store.setSync(entry.id, offline ? 'pending' : 'error', offline ? undefined : 'We couldn’t save your investigation to your account.');
        return offline ? 'pending' : 'error';
      }
    },
    [user],
  );

  const syncNow = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !user || running.current || !navigator.onLine) return;
    running.current = true;
    try {
      const store = useNotebookStore.getState();
      for (const inv of store.tombstones) {
        try {
          await deleteInvestigation(sb, inv);
          store.clearTombstone(inv);
        } catch {
          // Try again next time.
        }
      }
      const remote = await pullEntries(sb);
      useNotebookStore.getState().mergeRemote(remote);
      for (const e of useNotebookStore.getState().entries) {
        if (e.sync.status !== 'synced') await pushOne(e);
      }
      const earned = await syncAchievements(sb, user.id, useProgressStore.getState().earned);
      useProgressStore.getState().mergeEarned(earned);
    } catch {
      notify({ tone: 'offline', title: 'Offline changes saved locally.', body: 'We’ll sync your notebook when the connection returns.' });
    } finally {
      running.current = false;
    }
  }, [user, pushOne, notify]);

  // Sync when a user signs in (after local data has loaded) and whenever the connection returns.
  useEffect(() => {
    if (!hydrated || !user) return;
    void syncNow();
    const onOnline = () => void syncNow();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [hydrated, user, syncNow]);

  const saveEntry = useCallback<SyncContextValue['saveEntry']>(
    async (entry) => {
      const store = useNotebookStore.getState();
      if (!user) {
        store.upsert({ ...entry, sync: { status: 'local' } });
        return 'local';
      }
      store.upsert({ ...entry, sync: { status: 'pending' } });
      const result = await pushOne(entry);
      if (result === 'pending') {
        notify({ tone: 'offline', title: 'Offline changes saved locally.', body: 'This entry will sync when you’re back online.' });
      } else if (result === 'error') {
        notify({ tone: 'warn', title: 'We couldn’t save your investigation.', body: 'Your current work is still available locally.' });
      }
      return result;
    },
    [user, pushOne, notify],
  );

  const deleteEntry = useCallback(
    async (entry: NotebookEntry) => {
      const store = useNotebookStore.getState();
      store.remove(entry.id);
      const sb = getSupabase();
      if (!sb || !user || entry.sync.status === 'local') return;
      try {
        if (!navigator.onLine) throw new Error('offline');
        await deleteInvestigation(sb, entry.investigationId);
      } catch {
        store.addTombstone(entry.investigationId);
      }
    },
    [user],
  );

  const value = useMemo(() => ({ saveEntry, deleteEntry, syncNow }), [saveEntry, deleteEntry, syncNow]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

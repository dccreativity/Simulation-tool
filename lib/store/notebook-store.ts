import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NotebookEntry, SyncStatus } from '@/types/notebook';
import { persistStorage } from './storage';

interface NotebookState {
  entries: NotebookEntry[];
  /** Investigation ids deleted on this device but not yet removed from the cloud. */
  tombstones: string[];
  addTombstone: (investigationId: string) => void;
  clearTombstone: (investigationId: string) => void;
  upsert: (entry: NotebookEntry) => void;
  remove: (id: string) => void;
  setSync: (id: string, status: SyncStatus, error?: string) => void;
  /** Merge entries pulled from the cloud; the most recently updated copy wins. */
  mergeRemote: (remote: NotebookEntry[]) => void;
}

export const useNotebookStore = create<NotebookState>()(
  persist(
    (set) => ({
      entries: [],
      tombstones: [],
      addTombstone: (id) => set((s) => ({ tombstones: s.tombstones.includes(id) ? s.tombstones : [...s.tombstones, id] })),
      clearTombstone: (id) => set((s) => ({ tombstones: s.tombstones.filter((t) => t !== id) })),
      upsert: (entry) =>
        set((s) => ({
          entries: s.entries.some((e) => e.id === entry.id)
            ? s.entries.map((e) => (e.id === entry.id ? entry : e))
            : [entry, ...s.entries],
        })),
      remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      setSync: (id, status, error) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? { ...e, sync: { status, error, syncedAt: status === 'synced' ? new Date().toISOString() : e.sync.syncedAt } }
              : e,
          ),
        })),
      mergeRemote: (remote) =>
        set((s) => {
          const byId = new Map(s.entries.map((e) => [e.id, e]));
          for (const r of remote) {
            if (s.tombstones.includes(r.investigationId)) continue;
            const local = byId.get(r.id);
            const remoteAt = Date.parse(r.updatedAt);
            const localAt = local ? Date.parse(local.updatedAt) : 0;
            if (!local || (local.sync.status === 'synced' && remoteAt >= localAt) || remoteAt > localAt) {
              byId.set(r.id, r);
            }
          }
          return { entries: [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) };
        }),
    }),
    { name: 'efl-notebook', storage: persistStorage, skipHydration: true, version: 1 },
  ),
);

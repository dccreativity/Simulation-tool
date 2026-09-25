import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ACHIEVEMENTS, type AchievementId } from '@/data/achievements';
import { persistStorage } from './storage';

export type ProgressEvent =
  | { type: 'samples-collected'; ecosystemId: string; randomCount: number; biased: boolean; total: number }
  | { type: 'bias-warning'; ecosystemId: string }
  | { type: 'transect'; kind: 'line' | 'belt'; ecosystemId: string }
  | { type: 'my-data-analysed' }
  | { type: 'outlier-seen' }
  | { type: 't-test' }
  | { type: 'chi-squared' }
  | { type: 'notebook-saved'; complete: boolean };

interface Counters {
  ecosystemsSampled: string[];
  lineTransects: number;
  beltTransects: number;
  tTests: number;
  chiTests: number;
  /** Ecosystems where a bias warning has been shown and not yet cleared. */
  biasWarnedIn: string[];
}

interface ProgressState {
  earned: Partial<Record<AchievementId, string>>;
  counters: Counters;
  /** Newly earned, waiting to be announced. */
  announce: AchievementId[];
  record: (event: ProgressEvent) => void;
  acknowledge: (id: AchievementId) => void;
  mergeEarned: (earned: Partial<Record<AchievementId, string>>) => void;
}

export const reputationOf = (earned: Partial<Record<AchievementId, string>>) =>
  ACHIEVEMENTS.reduce((t, a) => t + (earned[a.id] ? a.points : 0), 0);

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      earned: {},
      counters: { ecosystemsSampled: [], lineTransects: 0, beltTransects: 0, tTests: 0, chiTests: 0, biasWarnedIn: [] },
      announce: [],
      record: (event) => {
        const { counters, earned } = get();
        const c: Counters = { ...counters, ecosystemsSampled: [...counters.ecosystemsSampled], biasWarnedIn: [...counters.biasWarnedIn] };
        const unlock: AchievementId[] = [];
        const add = (id: AchievementId, condition: boolean) => {
          if (condition && !earned[id] && !unlock.includes(id)) unlock.push(id);
        };
        switch (event.type) {
          case 'samples-collected':
            if (!c.ecosystemsSampled.includes(event.ecosystemId)) c.ecosystemsSampled.push(event.ecosystemId);
            add('random-sampling-specialist', event.randomCount >= 10 && !event.biased);
            if (!event.biased && event.total >= 6 && c.biasWarnedIn.includes(event.ecosystemId)) {
              add('bias-aware', true);
              c.biasWarnedIn = c.biasWarnedIn.filter((e) => e !== event.ecosystemId);
            }
            break;
          case 'bias-warning':
            if (!c.biasWarnedIn.includes(event.ecosystemId)) c.biasWarnedIn.push(event.ecosystemId);
            break;
          case 'transect':
            if (!c.ecosystemsSampled.includes(event.ecosystemId)) c.ecosystemsSampled.push(event.ecosystemId);
            if (event.kind === 'line') c.lineTransects++;
            else c.beltTransects++;
            add('transect-explorer', c.lineTransects > 0 && c.beltTransects > 0);
            break;
          case 'my-data-analysed':
            add('data-detective', true);
            break;
          case 'outlier-seen':
            add('outlier-hunter', true);
            break;
          case 't-test':
            c.tTests++;
            break;
          case 'chi-squared':
            c.chiTests++;
            break;
          case 'notebook-saved':
            add('evidence-defender', event.complete);
            break;
        }
        add('field-ecologist', c.ecosystemsSampled.length >= 3);
        add('statistical-investigator', c.tTests > 0 && c.chiTests > 0);
        const now = new Date().toISOString();
        set((s) => ({
          counters: c,
          earned: unlock.length ? { ...s.earned, ...Object.fromEntries(unlock.map((id) => [id, now])) } : s.earned,
          announce: unlock.length ? [...s.announce, ...unlock] : s.announce,
        }));
      },
      acknowledge: (id) => set((s) => ({ announce: s.announce.filter((a) => a !== id) })),
      mergeEarned: (remote) =>
        set((s) => {
          const merged = { ...s.earned };
          for (const [id, at] of Object.entries(remote) as [AchievementId, string][]) {
            if (!merged[id] || at < merged[id]!) merged[id] = at;
          }
          return { earned: merged };
        }),
    }),
    {
      name: 'efl-progress',
      storage: persistStorage,
      skipHydration: true,
      version: 1,
      partialize: (s) => ({ earned: s.earned, counters: s.counters }),
    },
  ),
);

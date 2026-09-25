'use client';

import { motion } from 'framer-motion';
import { Dices, Leaf, Lock, Route, Scale, Search, Shield, Sigma, Target } from 'lucide-react';
import { ACHIEVEMENTS } from '@/data/achievements';
import { reputationOf, useProgressStore } from '@/lib/store/progress-store';
import { useHydrated } from '@/lib/store/hydration';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

const ICONS = { dice: Dices, search: Search, target: Target, route: Route, sigma: Sigma, shield: Shield, leaf: Leaf, scale: Scale };

export function AchievementsView() {
  const hydrated = useHydrated();
  const earned = useProgressStore((s) => s.earned);
  const counters = useProgressStore((s) => s.counters);
  if (!hydrated) return <Skeleton className="h-80" label="Loading achievements…" />;
  const total = ACHIEVEMENTS.reduce((t, a) => t + a.points, 0);
  const rep = reputationOf(earned);
  const count = ACHIEVEMENTS.filter((a) => earned[a.id]).length;
  return (
    <div className="flex flex-col gap-6">
      <div className="on-dark grid gap-4 rounded-card bg-navy p-6 text-cream sm:grid-cols-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-pale uppercase">Scientific reputation</p>
          <p className="num mt-1 text-4xl font-semibold">{rep}</p>
          <div className="mt-3 h-2 rounded-full bg-navy-700" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={rep} aria-label="Reputation progress">
            <div className="h-2 rounded-full bg-sage transition-[width] duration-700" style={{ width: `${(rep / total) * 100}%` }} />
          </div>
        </div>
        <div>
          <p className="text-xs tracking-[0.16em] text-pale uppercase">Achievements</p>
          <p className="num mt-1 text-4xl font-semibold">
            {count}
            <span className="text-lg text-pale"> / {ACHIEVEMENTS.length}</span>
          </p>
        </div>
        <div>
          <p className="text-xs tracking-[0.16em] text-pale uppercase">Ecosystems sampled</p>
          <p className="num mt-1 text-4xl font-semibold">{counters.ecosystemsSampled.length}</p>
        </div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ACHIEVEMENTS.map((a, i) => {
          const Icon = ICONS[a.icon];
          const got = earned[a.id];
          return (
            <motion.li key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className={cn('flex h-full flex-col gap-3 rounded-card border p-5', got ? 'border-teal-100 bg-paper shadow-card' : 'border-line bg-cream-100/50')}>
                <div className="flex items-center justify-between">
                  <span className={cn('flex size-12 items-center justify-center rounded-2xl', got ? 'bg-teal-600 text-white' : 'bg-line/60 text-ink-3')}>
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', got ? 'bg-success-bg text-success' : 'bg-cream-100 text-ink-3')}>
                    {got ? 'Earned' : <span className="inline-flex items-center gap-1"><Lock className="size-3" aria-hidden /> Locked</span>}
                  </span>
                </div>
                <p className="font-semibold text-ink">{a.title}</p>
                <p className="text-sm text-ink-2">{a.description}</p>
                <p className="mt-auto text-xs text-ink-3">
                  +{a.points} reputation{got ? ` · ${new Date(got).toLocaleDateString()}` : ''}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

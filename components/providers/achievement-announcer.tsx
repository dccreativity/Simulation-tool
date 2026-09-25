'use client';

import { useEffect } from 'react';
import { getAchievement } from '@/data/achievements';
import { useToast } from '@/components/ui/toast';
import { useProgressStore } from '@/lib/store/progress-store';

/** Announces newly earned achievements with a quiet toast. */
export function AchievementAnnouncer() {
  const announce = useProgressStore((s) => s.announce);
  const acknowledge = useProgressStore((s) => s.acknowledge);
  const notify = useToast();
  useEffect(() => {
    for (const id of announce) {
      const a = getAchievement(id);
      notify({ tone: 'success', title: `Achievement: ${a.title}`, body: `${a.description} +${a.points} reputation.` });
      acknowledge(id);
    }
  }, [announce, acknowledge, notify]);
  return null;
}

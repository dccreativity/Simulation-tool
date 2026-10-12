'use client';

import { ChevronLeft, ChevronRight, Timer } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ECOSYSTEMS } from '@/data/ecosystems';
import type { EcosystemId } from '@/types/ecosystem';
import { Button } from '@/components/ui/button';

export const FIELD_TIME_MS = 20 * 60 * 1000;

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

export function MissionBar({ ecoId, startedAt, onEnd }: { ecoId: EcosystemId; startedAt: number | null; onEnd: () => void }) {
  const index = ECOSYSTEMS.findIndex((e) => e.id === ecoId);
  const prev = ECOSYSTEMS[(index - 1 + ECOSYSTEMS.length) % ECOSYSTEMS.length];
  const next = ECOSYSTEMS[(index + 1) % ECOSYSTEMS.length];
  const now = useNow(startedAt !== null);
  const remaining = startedAt === null ? FIELD_TIME_MS : Math.max(0, FIELD_TIME_MS - (now - startedAt));
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const over = startedAt !== null && remaining === 0;
  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-5">
      <div className="flex items-center gap-1">
        <Link href={`/simulation/${prev.id}`} className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-paper text-ink-2 hover:border-teal/60" aria-label={`Previous mission: ${prev.name}`}>
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <span className="px-2 text-sm font-medium whitespace-nowrap text-ink-2">
          Mission {index + 1} of {ECOSYSTEMS.length}
        </span>
        <Link href={`/simulation/${next.id}`} className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-paper text-ink-2 hover:border-teal/60" aria-label={`Next mission: ${next.name}`}>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="flex items-center gap-2" title="Field time starts with your first sample. It is a guide, not a hard limit.">
        <Timer className="size-5 text-ink-3" aria-hidden />
        <div className="leading-tight">
          <p className="text-[0.7rem] text-ink-3">{over ? 'Field time' : 'Time remaining'}</p>
          <p className="num text-base font-semibold text-ink" aria-live="off">
            {over ? 'Time’s up' : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`}
          </p>
        </div>
      </div>
      <Button onClick={onEnd} size="sm">
        End mission
      </Button>
    </div>
  );
}

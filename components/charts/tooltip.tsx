'use client';

import type { ReactNode } from 'react';

export function TooltipCard({ title, rows }: { title?: ReactNode; rows: { label: ReactNode; value: ReactNode; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-line bg-paper px-3 py-2 text-xs shadow-lift">
      {title && <p className="mb-1 font-semibold text-ink">{title}</p>}
      {rows.map((r, i) => (
        <p key={i} className="flex items-center gap-2 text-ink-2">
          {r.color && <span className="inline-block size-2.5 rounded-full" style={{ background: r.color }} aria-hidden />}
          <span>{r.label}</span>
          <span className="num ml-auto pl-3 font-semibold text-ink">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

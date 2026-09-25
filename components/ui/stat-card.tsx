import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CountUp } from './count-up';

export function StatCard({
  label,
  value,
  decimals = 2,
  unit,
  hint,
  icon,
  className,
  emphasis = false,
}: {
  label: ReactNode;
  value: number | null | undefined;
  decimals?: number;
  unit?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-2xl border px-4 py-3',
        emphasis ? 'border-teal-100 bg-teal-50' : 'border-line bg-cream-100/70',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-ink-3 uppercase">{label}</span>
        {icon && <span className="text-teal">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <CountUp value={value} decimals={decimals} className="num text-[1.7rem] leading-tight font-semibold text-ink" />
        {unit && <span className="text-sm text-ink-3">{unit}</span>}
      </div>
      {hint && <p className="text-xs leading-snug text-ink-3">{hint}</p>}
    </div>
  );
}

/** Static text value in the same frame (e.g. "No mode", "7, 9"). */
export function StatText({ label, text, hint, className }: { label: ReactNode; text: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-cream-100/70 px-4 py-3', className)}>
      <span className="text-xs font-medium tracking-wide text-ink-3 uppercase">{label}</span>
      <span className="num truncate text-[1.7rem] leading-tight font-semibold text-ink">{text}</span>
      {hint && <p className="text-xs leading-snug text-ink-3">{hint}</p>}
    </div>
  );
}

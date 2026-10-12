import { cn } from '@/lib/cn';

export function Skeleton({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('skeleton', className)} role={label ? 'status' : undefined} aria-label={label}>
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

export function LoadingPanel({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 p-5', className)} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-ink-3">
        <span className="inline-block size-2 animate-pulse rounded-full bg-sage" aria-hidden />
        {label}
      </div>
      <div className="skeleton h-4 w-2/3" />
      <div className="skeleton h-4 w-1/2" />
      <div className="skeleton h-24 w-full" />
    </div>
  );
}

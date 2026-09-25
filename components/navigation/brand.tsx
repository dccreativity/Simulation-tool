import Link from 'next/link';
import { cn } from '@/lib/cn';

export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M26 5C14 5 6 11 6 21c0 2 .4 3.7 1 5 1.5-6 6-11 12-14-5 4-8.6 8.7-10 15 1.4.6 3 1 5 1 9.5 0 13-8 12-23Z" fill="currentColor" />
    </svg>
  );
}

export function Brand({ compact = false, className, dark = true }: { compact?: boolean; className?: string; dark?: boolean }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2.5 rounded-lg', className)} aria-label="Eco Field Lab home">
      <LeafMark className={cn('shrink-0', compact ? 'size-7' : 'size-9', dark ? 'text-sage' : 'text-teal')} />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn('text-[1.35rem] font-semibold tracking-[0.18em]', dark ? 'text-cream' : 'text-navy')}>ECO</span>
          <span className={cn('mt-1 text-[0.62rem] font-medium tracking-[0.32em]', dark ? 'text-pale' : 'text-teal-700')}>FIELD LAB</span>
        </span>
      )}
    </Link>
  );
}

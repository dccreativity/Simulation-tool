'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/** Simulation Mode | My Data Mode — the two ways to learn, always one click apart. */
export function ModeSwitch({ className }: { className?: string }) {
  const pathname = usePathname();
  const sim = pathname.startsWith('/simulation') || pathname.startsWith('/explore');
  const mine = pathname.startsWith('/my-data');
  const item = (active: boolean) =>
    cn(
      'flex h-9 items-center rounded-lg px-3.5 text-sm font-medium transition-colors',
      active ? 'bg-navy text-cream' : 'text-ink-2 hover:text-ink',
    );
  return (
    <nav aria-label="Learning mode" className={cn('inline-flex gap-1 rounded-xl border border-line bg-paper p-1', className)}>
      <Link href="/simulation" className={item(sim)} aria-current={sim ? 'page' : undefined}>
        Simulation Mode
      </Link>
      <Link href="/my-data" className={item(mine)} aria-current={mine ? 'page' : undefined}>
        My Data Mode
      </Link>
    </nav>
  );
}

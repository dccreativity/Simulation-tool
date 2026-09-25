'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const ITEMS = [
  { href: '/statistics', label: 'Descriptive statistics' },
  { href: '/statistics/t-test', label: 't-test' },
  { href: '/statistics/chi-squared', label: 'Chi-squared' },
  { href: '/statistics/which-test', label: 'Which test should I use?' },
];

export function StatsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Statistics Lab sections" className="scrollbar-thin -mx-1 mb-6 overflow-x-auto">
      <ul className="flex gap-1 px-1 pb-1">
        {ITEMS.map((i) => {
          const active = pathname === i.href;
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 items-center rounded-xl px-4 text-sm font-medium whitespace-nowrap transition-colors',
                  active ? 'bg-teal-600 text-white' : 'border border-line bg-paper text-ink-2 hover:border-teal/50 hover:text-ink',
                )}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

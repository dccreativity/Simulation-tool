'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { BOTTOM_NAV, NAV_ITEMS, isActive } from './nav-items';

/** Phone: the five most important destinations within thumb reach. */
export function BottomNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => BOTTOM_NAV.includes(i.href));
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium', active ? 'text-teal-700' : 'text-ink-3')}
              >
                <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-teal-50')}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Brand } from './brand';
import { NAV_ITEMS, isActive } from './nav-items';

/** Desktop navigation: a slim navy rail (icons + labels at xl, icons over short labels at lg). */
export function NavRail() {
  const pathname = usePathname();
  return (
    <aside className="no-print on-dark sticky top-0 hidden h-dvh shrink-0 flex-col bg-navy text-cream lg:flex lg:w-[92px] xl:w-[228px]" aria-label="Main">
      <div className="flex h-20 items-center justify-center px-4 xl:justify-start xl:px-6">
        <Brand className="hidden xl:flex" />
        <Brand compact className="xl:hidden" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin" aria-label="Main navigation">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex items-center rounded-xl transition-colors',
                    'flex-col gap-1 px-1 py-2.5 text-[0.68rem] xl:flex-row xl:gap-3 xl:px-3.5 xl:py-2.5 xl:text-[0.92rem]',
                    active ? 'bg-teal-600 text-white' : 'text-pale hover:bg-navy-700 hover:text-cream',
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="text-center leading-tight font-medium xl:text-left">
                    <span className="xl:hidden">{item.short}</span>
                    <span className="hidden xl:inline">{item.label}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="relative hidden overflow-hidden xl:block" aria-hidden>
        <svg viewBox="0 0 228 190" className="block w-full">
          <path d="M0 120 L40 70 L70 100 L110 40 L150 95 L180 70 L228 115 L228 190 L0 190Z" fill="#14384a" />
          <path d="M110 40 L124 58 L116 56 L110 64 L104 56 L98 58Z" fill="#9dbebb" opacity=".5" />
          <path d="M0 150 C60 130 120 150 228 136 L228 190 L0 190Z" fill="#0f3040" />
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M${i * 17 + 4} ${160 - (i % 3) * 4} l8 22 h-16z`} fill="#1d4a4a" />
          ))}
        </svg>
        <p className="absolute bottom-4 left-6 text-[0.6rem] leading-[1.7] tracking-[0.14em] text-pale/80">
          EXPLORE. SAMPLE.
          <br />
          ANALYSE. UNDERSTAND.
          <br />
          REAL ECOSYSTEMS.
          <br />
          REAL DATA.
        </p>
      </div>
    </aside>
  );
}

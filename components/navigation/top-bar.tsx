'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { AccountMenu, SyncIndicator } from './account-menu';
import { Brand } from './brand';
import { ModeSwitch } from './mode-switch';
import { NAV_ITEMS, isActive } from './nav-items';
import { SoundToggle } from './sound-toggle';

/**
 * Top bar, three layouts:
 *  - desktop (lg+): utilities only — the rail carries navigation.
 *  - tablet (md): brand + a compact scrolling navigation bar.
 *  - phone: brand + hamburger; the bottom bar carries the main actions.
 */
export function TopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/90 backdrop-blur-md">
      {/* Desktop utilities */}
      <div className="hidden h-16 items-center justify-between gap-4 px-6 lg:flex xl:px-8">
        <SyncIndicator />
        <div className="flex items-center gap-3">
          <ModeSwitch />
          <SoundToggle />
          <AccountMenu />
        </div>
      </div>

      {/* Tablet */}
      <div className="hidden flex-col gap-2 px-5 pt-3 pb-2 md:flex lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Brand dark={false} />
          <div className="flex items-center gap-2">
            <ModeSwitch />
            <SoundToggle />
            <AccountMenu />
          </div>
        </div>
        <nav aria-label="Main navigation" className="scrollbar-thin -mx-1 overflow-x-auto">
          <ul className="flex gap-1 px-1 pb-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition-colors',
                      active ? 'bg-navy text-cream' : 'text-ink-2 hover:bg-teal-50 hover:text-ink',
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Phone */}
      <div className="flex h-14 items-center justify-between gap-2 px-4 md:hidden">
        <Brand dark={false} />
        <div className="flex items-center gap-1">
          <AccountMenu />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label="Open menu"
            className="inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-teal-50"
          >
            <Menu className="size-6" aria-hidden />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div className="absolute inset-0 bg-navy/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} aria-hidden />
            <motion.nav
              id="mobile-menu"
              aria-label="Main navigation"
              className="on-dark absolute inset-y-0 right-0 flex w-[84%] max-w-sm flex-col bg-navy text-cream shadow-lift"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex h-16 items-center justify-between px-5">
                <Brand />
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-navy-700">
                  <X className="size-6" aria-hidden />
                </button>
              </div>
              <ul className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex h-12 items-center gap-3 rounded-xl px-4 text-base font-medium',
                          active ? 'bg-teal-600 text-white' : 'text-pale hover:bg-navy-700 hover:text-cream',
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between border-t border-navy-700 px-5 py-4">
                <span className="text-xs tracking-[0.18em] text-pale">REAL DATA. REAL DECISIONS.</span>
                <SoundToggle className="text-pale hover:bg-navy-700 hover:text-cream" withLabel />
              </div>
            </motion.nav>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Cloud, CloudOff, HardDrive, LogIn, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useOnline } from '@/hooks/use-online';
import { useNotebookStore } from '@/lib/store/notebook-store';
import { useProgressStore, reputationOf } from '@/lib/store/progress-store';
import { cn } from '@/lib/cn';

/** Where the student's work lives right now: this device, the cloud, or waiting to sync. */
export function SyncIndicator({ className }: { className?: string }) {
  const { user, configured } = useAuth();
  const online = useOnline();
  const pending = useNotebookStore((s) => s.entries.filter((e) => e.sync.status === 'pending' || e.sync.status === 'error').length);
  let icon = <HardDrive className="size-4" aria-hidden />;
  let text = 'Saved on this device';
  if (!online) {
    icon = <CloudOff className="size-4" aria-hidden />;
    text = 'Offline — changes saved locally';
  } else if (user && pending > 0) {
    icon = <CloudOff className="size-4" aria-hidden />;
    text = `${pending} waiting to sync`;
  } else if (user) {
    icon = <Cloud className="size-4" aria-hidden />;
    text = 'Synced to your account';
  } else if (!configured) {
    text = 'Guest mode · saved on this device';
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-ink-3', className)} role="status">
      {icon}
      {text}
    </span>
  );
}

export function AccountMenu({ className }: { className?: string }) {
  const { user, configured, loading, signOut } = useAuth();
  const earned = useProgressStore((s) => s.earned);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (loading) return <span className={cn('skeleton size-10 rounded-full', className)} aria-hidden />;

  if (!user) {
    return (
      <Link
        href="/auth"
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-paper px-3 text-sm font-medium text-ink-2 hover:border-teal/60 hover:text-ink',
          className,
        )}
        title={configured ? 'Sign in to save investigations to your account' : 'Accounts are not configured for this deployment'}
      >
        <LogIn className="size-4" aria-hidden />
        <span>Sign in</span>
      </Link>
    );
  }

  const name = (user.user_metadata?.display_name as string | undefined) || user.email?.split('@')[0] || 'Scientist';
  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account: ${name}`}
        className="flex size-10 items-center justify-center rounded-full border border-line bg-paper text-sm font-semibold text-teal-700 hover:border-teal/60"
      >
        {name.slice(0, 1).toUpperCase()}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-line bg-paper p-2 shadow-lift"
          >
            <div className="flex items-center gap-3 px-3 py-2">
              <UserRound className="size-5 text-teal" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{name}</p>
                <p className="truncate text-xs text-ink-3">{user.email}</p>
              </div>
            </div>
            <p className="px-3 pb-2 text-xs text-ink-3">
              Scientific reputation: <span className="num font-semibold text-ink">{reputationOf(earned)}</span>
            </p>
            <SyncIndicator className="px-3 pb-2" />
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-2 hover:bg-teal-50 hover:text-ink"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

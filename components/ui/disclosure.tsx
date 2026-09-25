'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, CircleHelp } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** "What does this mean?" — an expandable explanation. */
export function Disclosure({
  label = 'What does this mean?',
  children,
  defaultOpen = false,
  className,
}: {
  label?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cn('rounded-2xl border border-line bg-paper', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-teal-700 hover:bg-teal-50/60"
      >
        <span className="flex items-center gap-2">
          <CircleHelp className="size-4" aria-hidden />
          {label}
        </span>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-ink-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

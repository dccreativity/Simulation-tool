'use client';

import { motion } from 'framer-motion';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
}

/**
 * Accessible tabs (roving tabindex, arrow keys) with a sliding indicator.
 * Panels are rendered by the caller with `tabPanelProps(id)`.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
  size = 'md',
  idBase,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
  idBase?: string;
}) {
  const auto = useId();
  const base = idBase ?? auto;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = items.length;
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % n;
    else if (e.key === 'ArrowLeft') next = (i - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(items[next].id);
      refs.current[next]?.focus();
    }
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('scrollbar-thin flex gap-1 overflow-x-auto rounded-xl bg-cream-100 p-1', className)}
    >
      {items.map((item, i) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${base}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 rounded-lg font-medium transition-colors',
              size === 'sm' ? 'h-8 px-3 text-[0.8rem]' : 'h-10 px-4 text-sm',
              selected ? 'text-white' : 'text-ink-2 hover:text-ink',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${base}-indicator`}
                className="absolute inset-0 rounded-lg bg-teal-600"
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                aria-hidden
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {item.icon}
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function tabPanelProps(idBase: string, id: string) {
  return {
    role: 'tabpanel' as const,
    id: `${idBase}-panel-${id}`,
    'aria-labelledby': `${idBase}-tab-${id}`,
    tabIndex: 0,
  };
}

/** Single-choice options (radio-group semantics), styled like the reference's pills. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
  dark = false,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
  dark?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = options.length;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n : -1;
    if (next >= 0) {
      e.preventDefault();
      onChange(options[next].value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex gap-1 rounded-xl p-1', dark ? 'bg-navy-700' : 'bg-cream-100', className)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'flex-1 rounded-lg font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-8 px-2.5 text-[0.8rem]' : 'h-10 px-3.5 text-sm',
              on
                ? dark
                  ? 'bg-cream text-navy shadow-sm'
                  : 'bg-paper text-ink shadow-[0_1px_2px_rgb(3_25_38/0.12)]'
                : dark
                  ? 'text-pale hover:text-cream'
                  : 'text-ink-3 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

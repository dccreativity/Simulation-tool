import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' }) {
  return (
    <section className={cn('rounded-card border border-line bg-paper shadow-card', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  icon,
  className,
  id,
  level = 2,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
  id?: string;
  level?: 2 | 3;
}) {
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-4 pb-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 text-teal">{icon}</span>}
        <div className="min-w-0">
          <H id={id} className="text-[1.05rem] font-semibold text-ink">
            {title}
          </H>
          {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = 'sage',
  className,
}: {
  children: ReactNode;
  tone?: 'sage' | 'teal' | 'cream' | 'navy' | 'warn' | 'danger' | 'success';
  className?: string;
}) {
  const tones = {
    sage: 'bg-sage-100 text-ink-2',
    teal: 'bg-teal-50 text-teal-700',
    cream: 'bg-cream-100 text-ink-2 border border-line',
    navy: 'bg-navy text-cream',
    warn: 'bg-warn-bg text-warn',
    danger: 'bg-danger-bg text-danger',
    success: 'bg-success-bg text-success',
  } as const;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}

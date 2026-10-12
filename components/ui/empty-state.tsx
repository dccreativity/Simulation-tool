import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({
  icon,
  title,
  children,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-cream-100/50 px-6 py-10 text-center', className)}>
      {icon && <div className="flex size-12 items-center justify-center rounded-2xl bg-sage-100 text-teal-700">{icon}</div>}
      <p className="text-base font-semibold text-ink">{title}</p>
      {children && <div className="max-w-md text-sm leading-relaxed text-ink-3">{children}</div>}
      {actions && <div className="mt-1 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

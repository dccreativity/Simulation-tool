import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function PageContainer({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-7', wide ? 'max-w-[1600px]' : 'max-w-7xl', className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  crumbs?: { href?: string; label: string }[];
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-1.5">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-3">
              {crumbs.map((c, i) => (
                <li key={c.label} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
                  {c.href ? (
                    <Link href={c.href} className="rounded hover:text-ink hover:underline">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">{eyebrow}</p>}
        <h1 className="text-[1.75rem] leading-tight font-semibold text-ink sm:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-[0.98rem] text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

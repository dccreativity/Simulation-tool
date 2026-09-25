import { CircleAlert, CircleCheck, Info, Lightbulb, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'warn' | 'danger' | 'success' | 'tip';

const styles: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: 'bg-teal-50 border-teal-100 text-ink-2', icon: <Info className="size-5 text-teal-700" aria-hidden /> },
  tip: { box: 'bg-sage-100 border-sage-200 text-ink-2', icon: <Lightbulb className="size-5 text-teal-700" aria-hidden /> },
  warn: { box: 'bg-warn-bg border-warn-line text-ink-2', icon: <TriangleAlert className="size-5 text-warn" aria-hidden /> },
  danger: { box: 'bg-danger-bg border-danger-line text-ink-2', icon: <CircleAlert className="size-5 text-danger" aria-hidden /> },
  success: { box: 'bg-success-bg border-success-line text-ink-2', icon: <CircleCheck className="size-5 text-success" aria-hidden /> },
};

export function Callout({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const s = styles[tone];
  return (
    <div className={cn('flex gap-3 rounded-2xl border px-4 py-3 text-sm', s.box, className)} role={tone === 'danger' || tone === 'warn' ? 'alert' : undefined}>
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}

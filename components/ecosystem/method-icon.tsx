import { RectangleHorizontal, Spline, Square } from 'lucide-react';
import type { SamplingMethod } from '@/types/ecosystem';

export function MethodIcon({ method, className = 'size-3.5' }: { method: SamplingMethod; className?: string }) {
  if (method === 'quadrat') return <Square className={className} aria-hidden />;
  if (method === 'line-transect') return <Spline className={className} aria-hidden />;
  return <RectangleHorizontal className={className} aria-hidden />;
}

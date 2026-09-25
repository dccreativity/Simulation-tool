import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DescriptiveLab } from '@/components/statistics/descriptive-lab';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Descriptive statistics' };

export default function DescriptivePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" label="Calculating statistics…" />}>
      <DescriptiveLab />
    </Suspense>
  );
}

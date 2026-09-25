import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ChiSquaredLab } from '@/components/statistics/chi-squared-lab';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Chi-squared test' };

export default function ChiSquaredPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" label="Loading datasets…" />}>
      <ChiSquaredLab />
    </Suspense>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TTestLab } from '@/components/statistics/t-test-lab';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 't-test' };

export default function TTestPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" label="Loading datasets…" />}>
      <TTestLab />
    </Suspense>
  );
}

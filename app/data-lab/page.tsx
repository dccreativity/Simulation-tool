import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DataLab } from '@/components/data/data-lab';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Data Lab' };

export default function DataLabPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Field → Data"
        title="Data Lab"
        subtitle="Check, clean and organise your data before you analyse it. Edit any cell, add or duplicate rows, and import or export CSV."
      />
      <Suspense fallback={<Skeleton className="h-96" label="Loading dataset…" />}>
        <DataLab />
      </Suspense>
    </PageContainer>
  );
}

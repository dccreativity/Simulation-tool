import type { ReactNode } from 'react';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { StatsNav } from '@/components/statistics/stats-nav';

export default function StatisticsLayout({ children }: { children: ReactNode }) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Data → Analysis → Evidence"
        title="Statistics Lab"
        subtitle="Describe your data, measure its uncertainty, and test whether a pattern is strong enough to count as evidence."
      />
      <StatsNav />
      {children}
    </PageContainer>
  );
}

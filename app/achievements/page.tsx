import type { Metadata } from 'next';
import { AchievementsView } from '@/components/layout/achievements-view';
import { PageContainer, PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Achievements' };

export default function AchievementsPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Scientific reputation" title="Achievements" subtitle="Earned by doing science well: sampling without bias, choosing the right test, and defending your conclusions with evidence." />
      <AchievementsView />
    </PageContainer>
  );
}

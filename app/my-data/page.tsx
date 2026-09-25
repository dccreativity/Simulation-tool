import type { Metadata } from 'next';
import { MyData } from '@/components/data/my-data';
import { PageContainer, PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'My Data' };

export default function MyDataPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="My Data mode"
        title="Analyse your own data"
        subtitle="Already collected data in the field or the lab? Skip the simulation — paste it, import a CSV, and go straight to statistics."
      />
      <MyData />
    </PageContainer>
  );
}

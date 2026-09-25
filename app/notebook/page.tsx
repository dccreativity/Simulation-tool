import type { Metadata } from 'next';
import { NotebookList } from '@/components/notebook/notebook-list';
import { PageContainer, PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Field Notebook' };

export default function NotebookPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Evidence → Conclusion"
        title="Field Notebook"
        subtitle="Every investigation you save: the question, the method, the data, the statistics and what you concluded."
      />
      <NotebookList />
    </PageContainer>
  );
}

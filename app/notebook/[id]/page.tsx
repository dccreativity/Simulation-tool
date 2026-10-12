import type { Metadata } from 'next';
import { NotebookEntryView } from '@/components/notebook/entry-view';
import { PageContainer } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Notebook entry' };

export default async function NotebookEntryPage({ params }: PageProps<'/notebook/[id]'>) {
  const { id } = await params;
  return (
    <PageContainer>
      <NotebookEntryView id={id} />
    </PageContainer>
  );
}

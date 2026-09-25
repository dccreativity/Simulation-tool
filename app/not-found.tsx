import { Compass } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <PageContainer>
      <EmptyState icon={<Compass className="size-6" aria-hidden />} title="This page is off the map" actions={<ButtonLink href="/">Back to home</ButtonLink>}>
        The page you were looking for doesn’t exist. It may have moved, or the link may be mistyped.
      </EmptyState>
    </PageContainer>
  );
}

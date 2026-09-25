'use client';

import { TriangleAlert } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink } from '@/components/ui/button';

/** Friendly error page — never a stack trace. Local work is untouched. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer>
      <EmptyState
        icon={<TriangleAlert className="size-6" aria-hidden />}
        title="Something looks unusual."
        actions={
          <>
            <Button onClick={reset}>Try again</Button>
            <ButtonLink href="/" variant="secondary">
              Home
            </ButtonLink>
          </>
        }
      >
        This part of the lab ran into a problem. Your saved work is still available on this device.
      </EmptyState>
    </PageContainer>
  );
}

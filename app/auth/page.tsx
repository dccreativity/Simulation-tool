import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/layout/auth-form';
import { PageContainer } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Sign in' };

export default function AuthPage() {
  return (
    <PageContainer className="max-w-lg">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AuthForm />
      </Suspense>
    </PageContainer>
  );
}

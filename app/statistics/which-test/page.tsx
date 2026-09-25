import type { Metadata } from 'next';
import { WhichTest } from '@/components/statistics/which-test';

export const metadata: Metadata = { title: 'Which test should I use?' };

export default function WhichTestPage() {
  return <WhichTest />;
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ECOSYSTEMS, METHOD_LABELS } from '@/data/ecosystems';
import { EcosystemArt } from '@/components/ecosystem/ecosystem-art';
import { PageContainer, PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Explore ecosystems' };

export default function ExplorePage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Explore" title="Explore ecosystems" subtitle="Meet each site before you sample it: what lives there, what shapes where it grows, and what question you will investigate." />
      <ul className="grid gap-5 md:grid-cols-2">
        {ECOSYSTEMS.map((eco) => (
          <li key={eco.id}>
            <Link href={`/explore/${eco.id}`} className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-paper shadow-card transition-shadow hover:shadow-lift sm:flex-row">
              <div className="h-40 shrink-0 overflow-hidden sm:h-auto sm:w-48">
                <EcosystemArt eco={eco} className="size-full transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="flex flex-col gap-2 p-5">
                <p className="text-xs font-semibold tracking-[0.14em] text-teal-700 uppercase">{eco.tagline}</p>
                <h2 className="text-lg font-semibold text-ink">{eco.name}</h2>
                <p className="text-sm text-ink-2">{eco.description}</p>
                <p className="text-xs text-ink-3">
                  {eco.species.length} species · {eco.methods.map((m) => METHOD_LABELS[m]).join(', ')}
                </p>
                <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium text-teal-700">
                  Learn about this ecosystem <ArrowRight className="size-4" aria-hidden />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-sm text-ink-3">
        Want to practise counting by hand and see the survey repeated hundreds of times? Try the original{' '}
        <a href="/quadrat-lab/index.html" className="font-medium text-teal-700 underline">
          Quadrat &amp; Transect Lab
        </a>
        .
      </p>
    </PageContainer>
  );
}

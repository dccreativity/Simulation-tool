import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Sprout, Target } from 'lucide-react';
import { ECOSYSTEMS, METHOD_LABELS, getEcosystem } from '@/data/ecosystems';
import { EcosystemArt } from '@/components/ecosystem/ecosystem-art';
import { SpeciesGlyph } from '@/components/ecosystem/species-glyph';
import { MethodIcon } from '@/components/ecosystem/method-icon';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';

export function generateStaticParams() {
  return ECOSYSTEMS.map((e) => ({ id: e.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<'/explore/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: getEcosystem(id)?.name ?? 'Explore' };
}

export default async function ExploreEcosystemPage({ params }: PageProps<'/explore/[id]'>) {
  const { id } = await params;
  const eco = getEcosystem(id);
  if (!eco) notFound();
  return (
    <PageContainer>
      <PageHeader
        crumbs={[{ href: '/explore', label: 'Explore' }, { label: eco.name }]}
        title={`${eco.name} ecosystem`}
        subtitle={eco.description}
        actions={
          <ButtonLink href={`/simulation/${eco.id}`} size="lg" icon={<Sprout className="size-5" aria-hidden />}>
            Start sampling
          </ButtonLink>
        }
      />
      <div className="mb-6 h-56 overflow-hidden rounded-card border border-line sm:h-72">
        <EcosystemArt eco={eco} className="size-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Species you will meet" subtitle="Each has its own symbol on the field map, so colour is never the only clue." />
          <ul className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            {eco.species.map((s) => (
              <li key={s.id} className="flex gap-3 rounded-2xl border border-line bg-cream-100/60 p-3">
                <span className="mt-1">
                  <SpeciesGlyph species={s} size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{s.name}</p>
                  <p className="text-xs text-ink-3 italic">{s.scientific}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-2">{s.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title={`Mission: ${eco.mission.title}`} icon={<Target className="size-5" aria-hidden />} />
            <div className="flex flex-col gap-2 px-5 pb-5 text-sm leading-relaxed text-ink-2">
              <p className="font-medium text-ink">{eco.mission.question}</p>
              <p>{eco.mission.background}</p>
              <p>
                <span className="font-semibold text-ink">Hypothesis:</span> {eco.mission.hypothesis}
              </p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Habitat zones" />
            <ul className="flex flex-col gap-2 px-5 pb-5 text-sm">
              {eco.zones.map((z) => (
                <li key={z.id}>
                  <span className="font-medium text-ink">{z.label}</span> <span className="text-ink-3">— {z.description}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Study focus & methods" />
            <div className="flex flex-col gap-3 px-5 pb-5 text-sm">
              <ul className="list-disc pl-5 text-ink-2">
                {eco.studyFocus.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <ul className="flex flex-wrap gap-2">
                {eco.methods.map((m) => (
                  <li key={m} className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1 text-xs font-medium text-ink-2">
                    <MethodIcon method={m} /> {METHOD_LABELS[m]}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

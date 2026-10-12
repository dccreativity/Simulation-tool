import type { Metadata } from 'next';
import { ECOSYSTEMS } from '@/data/ecosystems';
import { EcosystemCard } from '@/components/ecosystem/ecosystem-card';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { InvestigationJourney } from '@/components/layout/journey';
import { Callout } from '@/components/ui/callout';

export const metadata: Metadata = { title: 'Simulation' };

export default function SimulationIndexPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Simulation mode"
        title="Choose an ecosystem"
        subtitle="Each site is a living population of thousands of individual plants and animals. Your sampling choices decide what data you collect — and how close you get to the truth."
      />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {ECOSYSTEMS.map((eco, i) => (
          <li key={eco.id}>
            <EcosystemCard ecoId={eco.id} href={`/simulation/${eco.id}`} index={i} />
          </li>
        ))}
      </ul>
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Callout tone="tip" title="How a simulated investigation works">
          Read the mission question, choose a sampling method, and collect data with quadrats or transects. The simulation knows the real population, so it can
          show you when your sampling is biased — something real fieldwork never can.
        </Callout>
        <div>
          <h2 className="mb-3 text-base font-semibold text-ink">Investigation journey</h2>
          <InvestigationJourney compact />
        </div>
      </div>
    </PageContainer>
  );
}

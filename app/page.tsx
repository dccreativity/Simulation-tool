import { ArrowRight, ClipboardPaste, Sprout } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { EcosystemCard } from '@/components/ecosystem/ecosystem-card';
import { HeroArt } from '@/components/ecosystem/ecosystem-art';
import { InvestigationJourney } from '@/components/layout/journey';
import { PageContainer } from '@/components/layout/page-header';
import { RecentInvestigations } from '@/components/notebook/recent-investigations';
import { ECOSYSTEMS } from '@/data/ecosystems';

const FLOW = ['Field', 'Data', 'Analysis', 'Evidence', 'Conclusion'];

export default function HomePage() {
  return (
    <PageContainer>
      <section className="relative overflow-hidden rounded-[1.75rem] border border-line bg-navy text-cream shadow-card on-dark">
        <HeroArt className="absolute inset-0 size-full opacity-95" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/65 to-navy/5" aria-hidden />
        <div className="relative flex min-h-[360px] flex-col justify-center gap-6 px-6 py-10 sm:px-10 lg:min-h-[400px] lg:px-14">
          <p className="text-xs font-semibold tracking-[0.3em] text-pale">ECOLOGY · STATISTICS · FIELDWORK</p>
          <div>
            <h1 className="text-[2.4rem] leading-[1.05] font-semibold tracking-[0.04em] sm:text-[3.3rem]">ECO FIELD LAB</h1>
            <p className="mt-3 max-w-xl text-lg text-cream/90 sm:text-xl">Real Data. Real Decisions. Healthier Planets.</p>
          </div>
          <p className="max-w-xl text-[0.98rem] leading-relaxed text-cream/80">
            Sample living ecosystems with quadrats and transects, or bring your own data. Then find the pattern, measure the uncertainty and test it —
            the way ecologists do.
          </p>
          <div className="grid max-w-xl gap-3 sm:grid-cols-2">
            <ButtonLink href="/simulation" size="lg" className="w-full bg-teal-600 text-white hover:bg-teal-700" icon={<Sprout className="size-5" aria-hidden />}>
              Start Simulation
            </ButtonLink>
            <ButtonLink href="/my-data" size="lg" variant="secondary" className="w-full border-cream/40 bg-cream text-navy hover:bg-cream-100" icon={<ClipboardPaste className="size-5" aria-hidden />}>
              Use My Data
            </ButtonLink>
          </div>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium tracking-[0.14em] text-pale" aria-label="How the lab works">
            {FLOW.map((f, i) => (
              <li key={f} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="size-3" aria-hidden />}
                {f.toUpperCase()}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="featured">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="featured" className="text-xl font-semibold text-ink">
              Featured ecosystems
            </h2>
            <p className="text-sm text-ink-3">Eight living sites, each with its own research question and sampling challenges.</p>
          </div>
          <ButtonLink href="/explore" variant="ghost" size="sm" iconRight={<ArrowRight className="size-4" aria-hidden />}>
            Explore all
          </ButtonLink>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {ECOSYSTEMS.map((eco, i) => (
            <li key={eco.id}>
              <EcosystemCard ecoId={eco.id} href={`/simulation/${eco.id}`} index={i} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="journey">
        <h2 id="journey" className="text-xl font-semibold text-ink">
          Your investigation journey
        </h2>
        <p className="mb-4 text-sm text-ink-3">Every investigation follows the same path from a question to a defensible conclusion.</p>
        <InvestigationJourney />
      </section>

      <section className="mt-10" aria-labelledby="recent">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 id="recent" className="text-xl font-semibold text-ink">
            Recent investigations
          </h2>
          <ButtonLink href="/notebook" variant="ghost" size="sm" iconRight={<ArrowRight className="size-4" aria-hidden />}>
            Field notebook
          </ButtonLink>
        </div>
        <RecentInvestigations />
      </section>
    </PageContainer>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ECOSYSTEMS, getEcosystem } from '@/data/ecosystems';
import { SimulationWorkspace } from '@/components/sampling/workspace';

export function generateStaticParams() {
  return ECOSYSTEMS.map((e) => ({ id: e.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<'/simulation/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const eco = getEcosystem(id);
  return { title: eco ? `${eco.name} simulation` : 'Simulation' };
}

export default async function SimulationPage({ params }: PageProps<'/simulation/[id]'>) {
  const { id } = await params;
  const eco = getEcosystem(id);
  if (!eco) notFound();
  return <SimulationWorkspace ecoId={eco.id} />;
}

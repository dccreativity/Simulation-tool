'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { EcosystemId } from '@/types/ecosystem';
import { METHOD_LABELS, getEcosystem } from '@/data/ecosystems';
import { cn } from '@/lib/cn';
import { EcosystemArt } from './ecosystem-art';
import { MethodIcon } from './method-icon';

export function EcosystemCard({
  ecoId,
  href,
  index = 0,
  compact = false,
  selected = false,
}: {
  ecoId: EcosystemId;
  href: string;
  index?: number;
  compact?: boolean;
  selected?: boolean;
}) {
  const eco = getEcosystem(ecoId)!;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="h-full"
    >
      <Link
        href={href}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'group flex h-full flex-col overflow-hidden rounded-card border bg-paper shadow-card transition-shadow hover:shadow-lift',
          selected ? 'border-teal-600 ring-2 ring-teal-600/30' : 'border-line',
        )}
      >
        <div className={cn('relative overflow-hidden', compact ? 'h-24' : 'h-32 sm:h-36')}>
          <EcosystemArt eco={eco} className="size-full transition-transform duration-500 group-hover:scale-[1.04]" />
        </div>
        <div className="flex flex-1 flex-col gap-1 px-4 pt-3 pb-4">
          <h3 className="text-[1.02rem] font-semibold text-ink">{eco.name}</h3>
          <p className="text-sm text-ink-3">{eco.tagline}</p>
          {!compact && (
            <ul className="mt-auto flex flex-wrap gap-1.5 pt-3" aria-label="Sampling methods">
              {eco.methods.map((m) => (
                <li key={m} className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-[0.72rem] font-medium text-ink-2">
                  <MethodIcon method={m} />
                  {METHOD_LABELS[m]}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

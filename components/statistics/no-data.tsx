'use client';

import { ClipboardPaste, FlaskConical, Sprout } from 'lucide-react';
import type { Dataset } from '@/types/data';
import { exampleDatasets } from '@/lib/data/examples';
import { useDataStore } from '@/lib/store/data-store';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/** Shown when a statistics page has no datasets to work with. */
export function NoDataState({ onLoaded }: { onLoaded?: (first: Dataset) => void }) {
  const upsert = useDataStore((s) => s.upsertDataset);
  return (
    <EmptyState
      icon={<FlaskConical className="size-6" aria-hidden />}
      title="Your dataset is empty."
      actions={
        <>
          <Button
            size="sm"
            onClick={() => {
              const ex = exampleDatasets();
              ex.forEach(upsert);
              onLoaded?.(ex[0]);
            }}
          >
            Try example data
          </Button>
          <ButtonLink href="/simulation" size="sm" variant="secondary" icon={<Sprout className="size-4" aria-hidden />}>
            Collect data
          </ButtonLink>
          <ButtonLink href="/my-data" size="sm" variant="secondary" icon={<ClipboardPaste className="size-4" aria-hidden />}>
            Use my data
          </ButtonLink>
        </>
      }
    >
      There is nothing to analyse yet. Collect samples in a simulation, paste your own data, or load a set of example datasets.
    </EmptyState>
  );
}

'use client';

import { useEffect } from 'react';
import { useDataStore } from '@/lib/store/data-store';
import { useHydration } from '@/lib/store/hydration';
import { useNotebookStore } from '@/lib/store/notebook-store';
import { useProgressStore } from '@/lib/store/progress-store';
import { useSettingsStore } from '@/lib/store/settings-store';
import { useSimulationStore } from '@/lib/store/simulation-store';

/** Load this device's saved work after the first render, so server and client HTML match. */
export function StoreHydration() {
  useEffect(() => {
    void Promise.all([
      useDataStore.persist.rehydrate(),
      useSimulationStore.persist.rehydrate(),
      useNotebookStore.persist.rehydrate(),
      useProgressStore.persist.rehydrate(),
      useSettingsStore.persist.rehydrate(),
    ]).finally(() => useHydration.getState().setHydrated());
  }, []);
  return null;
}

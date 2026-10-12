import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EcosystemDef, EcosystemId, Point } from '@/types/ecosystem';
import type {
  PlannedQuadrat,
  QuadratSample,
  SimulationSession,
  SimulationSettings,
  TransectRecord,
} from '@/types/data';
import { normaliseSiteCode } from '@/lib/simulation/site';
import { persistStorage } from './storage';

export function defaultSession(eco: EcosystemDef, siteCode = eco.defaultSiteCode): SimulationSession {
  return {
    ecosystemId: eco.id,
    siteCode: normaliseSiteCode(siteCode),
    focalSpeciesId: eco.mission.focalSpeciesId,
    startedAt: null,
    samples: [],
    planned: [],
    transects: [],
    settings: {
      tool: eco.methods[0],
      quadratSize: 1,
      strategy: 'random',
      sampleCount: 10,
      lineInterval: 1,
      beltWidth: 1,
      beltInterval: 1,
    },
    datasetIds: {},
    draft: { start: null, end: null },
  };
}

interface SimulationState {
  sessions: Partial<Record<EcosystemId, SimulationSession>>;
  ensure: (eco: EcosystemDef) => void;
  patch: (id: EcosystemId, fn: (s: SimulationSession) => SimulationSession) => void;
  setSettings: (id: EcosystemId, settings: Partial<SimulationSettings>) => void;
  addSamples: (id: EcosystemId, samples: Omit<QuadratSample, 'number'>[]) => QuadratSample[];
  removeSample: (id: EcosystemId, sampleId: string) => void;
  setPlanned: (id: EcosystemId, planned: PlannedQuadrat[]) => void;
  removePlanned: (id: EcosystemId, plannedId: string) => void;
  addTransect: (id: EcosystemId, t: Omit<TransectRecord, 'number'>) => TransectRecord;
  removeTransect: (id: EcosystemId, transectId: string) => void;
  setDraft: (id: EcosystemId, draft: { start: Point | null; end: Point | null }) => void;
  setFocal: (id: EcosystemId, speciesId: string) => void;
  setDatasetId: (id: EcosystemId, kind: 'quadrat' | 'line' | 'belt', datasetId: string) => void;
  newSite: (eco: EcosystemDef, siteCode: string) => void;
  clearSamples: (id: EcosystemId) => void;
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set, get) => {
      const patch = (id: EcosystemId, fn: (s: SimulationSession) => SimulationSession) =>
        set((st) => {
          const current = st.sessions[id];
          return current ? { sessions: { ...st.sessions, [id]: fn(current) } } : st;
        });
      return {
        sessions: {},
        ensure: (eco) => {
          if (!get().sessions[eco.id]) set((st) => ({ sessions: { ...st.sessions, [eco.id]: defaultSession(eco) } }));
        },
        patch,
        setSettings: (id, settings) => patch(id, (s) => ({ ...s, settings: { ...s.settings, ...settings } })),
        addSamples: (id, samples) => {
          const session = get().sessions[id];
          if (!session) return [];
          let next = session.samples.reduce((m, s) => Math.max(m, s.number), 0);
          const numbered = samples.map((s) => ({ ...s, number: ++next }));
          patch(id, (s) => ({
            ...s,
            startedAt: s.startedAt ?? Date.now(),
            samples: [...s.samples, ...numbered],
          }));
          return numbered;
        },
        removeSample: (id, sampleId) => patch(id, (s) => ({ ...s, samples: s.samples.filter((x) => x.id !== sampleId) })),
        setPlanned: (id, planned) => patch(id, (s) => ({ ...s, planned })),
        removePlanned: (id, plannedId) => patch(id, (s) => ({ ...s, planned: s.planned.filter((p) => p.id !== plannedId) })),
        addTransect: (id, t) => {
          const session = get().sessions[id]!;
          const number = session.transects.reduce((m, x) => Math.max(m, x.number), 0) + 1;
          const record = { ...t, number };
          patch(id, (s) => ({
            ...s,
            startedAt: s.startedAt ?? Date.now(),
            transects: [...s.transects, record],
            draft: { start: null, end: null },
          }));
          return record;
        },
        removeTransect: (id, transectId) => patch(id, (s) => ({ ...s, transects: s.transects.filter((t) => t.id !== transectId) })),
        setDraft: (id, draft) => patch(id, (s) => ({ ...s, draft })),
        setFocal: (id, speciesId) => patch(id, (s) => ({ ...s, focalSpeciesId: speciesId })),
        setDatasetId: (id, kind, datasetId) => patch(id, (s) => ({ ...s, datasetIds: { ...s.datasetIds, [kind]: datasetId } })),
        newSite: (eco, siteCode) =>
          set((st) => {
            const previous = st.sessions[eco.id];
            const fresh = defaultSession(eco, siteCode);
            return {
              sessions: {
                ...st.sessions,
                [eco.id]: previous ? { ...fresh, settings: previous.settings, focalSpeciesId: previous.focalSpeciesId } : fresh,
              },
            };
          }),
        clearSamples: (id) =>
          patch(id, (s) => ({ ...s, samples: [], planned: [], transects: [], startedAt: null, draft: { start: null, end: null } })),
      };
    },
    { name: 'efl-simulation', storage: persistStorage, skipHydration: true, version: 1 },
  ),
);

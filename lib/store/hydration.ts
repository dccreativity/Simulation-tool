import { create } from 'zustand';

/** Flips to true once persisted stores have loaded from this device. */
export const useHydration = create<{ hydrated: boolean; setHydrated: () => void }>((set) => ({
  hydrated: false,
  setHydrated: () => set({ hydrated: true }),
}));

export const useHydrated = () => useHydration((s) => s.hydrated);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

interface SettingsState {
  /** Sound is off by default and never needed to understand anything. */
  sound: boolean;
  ambience: boolean;
  setSound: (on: boolean) => void;
  setAmbience: (on: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sound: false,
      ambience: false,
      setSound: (sound) => set(sound ? { sound } : { sound, ambience: false }),
      setAmbience: (ambience) => set({ ambience }),
    }),
    { name: 'efl-settings', storage: persistStorage, skipHydration: true, version: 1 },
  ),
);

import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/**
 * localStorage that never throws. Private browsing, blocked site data or a full
 * quota must not break the app — work simply stays in memory for the session.
 */
const safeLocalStorage: StateStorage = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Quota exceeded or storage blocked: keep going in memory.
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

export const persistStorage = createJSONStorage(() => safeLocalStorage);

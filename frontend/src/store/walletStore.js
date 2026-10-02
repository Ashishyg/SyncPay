import { create } from 'zustand';
import { getWalletState, saveWalletState, getUserProfile, saveUserProfile } from '../services/storageService';

export const useWalletStore = create((set, get) => ({
  // Balance state
  confirmed_bal: 0,
  locked_bal: 0,
  unconfirmed_received: 0,
  nonce: 0,
  daily_spent: 0,
  daily_date: '',

  // User state
  user: null,
  isLoggedIn: false,
  pinAttempts: 0,
  isLocked: false,

  // Network state
  isOnline: navigator.onLine,
  isSyncing: false,

  // Theme
  theme: localStorage.getItem('sp_theme') || 'dark',

  // Actions
  loadWalletState: async () => {
    const state = await getWalletState();
    set(state);
  },

  loadUserProfile: async () => {
    const profile = await getUserProfile();
    if (profile) {
      set({ user: profile, isLoggedIn: true });
    }
  },

  setUser: async (profile) => {
    await saveUserProfile(profile);
    set({ user: profile, isLoggedIn: true, pinAttempts: 0, isLocked: false });
  },

  logout: () => {
    set({ user: null, isLoggedIn: false });
  },

  updateBalance: async (updates) => {
    const state = await getWalletState();
    const newState = { ...state, ...updates };
    await saveWalletState(newState);
    set(updates);
  },

  incrementPinAttempt: () => {
    const attempts = get().pinAttempts + 1;
    const isLocked = attempts >= 5;
    set({ pinAttempts: attempts, isLocked });
    return isLocked;
  },

  resetPinAttempts: () => set({ pinAttempts: 0, isLocked: false }),

  setOnline: (online) => set({ isOnline: online }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('sp_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme === 'light' ? 'light' : '');
    set({ theme: newTheme });
  },

  getSpendable: () => {
    const { confirmed_bal, locked_bal } = get();
    return confirmed_bal - locked_bal;
  }
}));

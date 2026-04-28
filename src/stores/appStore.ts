import { create } from "zustand";

interface AppState {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  showNav: boolean;
  setShowNav: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  showNav: true,
  setShowNav: (show) => set({ showNav: show }),
}));

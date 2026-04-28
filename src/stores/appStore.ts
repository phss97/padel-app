import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface AppState {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  showNav: boolean;
  setShowNav: (show: boolean) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const storedTheme = (localStorage.getItem("theme") as Theme | null) || "system";

export const useAppStore = create<AppState>((set) => ({
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  showNav: true,
  setShowNav: (show) => set({ showNav: show }),
  theme: storedTheme,
  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    set({ theme });
  },
}));

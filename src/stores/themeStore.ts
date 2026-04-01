import { create } from "zustand";

interface ThemeState {
	isDark: boolean;
	toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
	isDark: true,
	toggle: () => set((state) => ({ isDark: !state.isDark })),
}));

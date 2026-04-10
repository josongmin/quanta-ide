import { create } from "zustand";

export type IdeTheme = "dark" | "light" | "cool-gray" | "cool-light";

function getSystemPreference(): IdeTheme {
  try {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  } catch {
    /* ignore */
  }
  return "dark";
}

function loadSaved(): IdeTheme | null {
  try {
    const v = window.localStorage.getItem("p0-ide-theme");
    if (v === "dark" || v === "light" || v === "cool-gray" || v === "cool-light") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function persist(theme: IdeTheme): void {
  try {
    window.localStorage.setItem("p0-ide-theme", theme);
  } catch {
    /* ignore */
  }
}

interface IdeThemeState {
  theme: IdeTheme;
  setTheme: (t: IdeTheme) => void;
  toggle: () => void;
}

export const useIdeTheme = create<IdeThemeState>()((set) => ({
  theme: loadSaved() ?? getSystemPreference(),
  setTheme: (theme) => {
    persist(theme);
    set({ theme });
  },
  toggle: () => {
    set((s) => {
      const next: IdeTheme = s.theme === "dark" ? "light" : s.theme === "light" ? "cool-gray" : s.theme === "cool-gray" ? "cool-light" : "dark";
      persist(next);
      return { theme: next };
    });
  },
}));

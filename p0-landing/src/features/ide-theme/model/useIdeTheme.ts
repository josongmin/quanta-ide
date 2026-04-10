import { create } from "zustand";

export type IdeTheme = "dark" | "light" | "cool-gray" | "cool-light" | "forest" | "amoled" | "sepia" | "dracula" | "solarized" | "monokai" | "nord" | "tokyo-night" | "github-light" | "paper" | "catppuccin" | "cyberpunk" | "obsidian" | "rose-pine" | "everforest" | "one-light" | "rose-pine-dawn" | "gruvbox-light" | "kanagawa" | "midnight-blue" | "deep-ocean" | "warm-void" | "slate-pro" | "parchment" | "zen" | "notion-light" | "notion-dark" | "augment" | "vercel" | "aurora-borealis" | "latte" | "noctis" | "horizon" | "supabase" | "firebase" | "linear" | "stripe" | "planetscale" | "figma" | "turso" | "vercel-light" | "linear-light" | "supabase-light" | "stripe-light" | "amethyst" | "coral-reef" | "triton" | "matcha-smoke" | "solaris" | "sakura-ink" | "arctic-prism" | "volcanic" | "dusk-gradient" | "mojave" | "vercel-dash";

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
    const valid: IdeTheme[] = ["dark","light","cool-gray","cool-light","forest","amoled","sepia","dracula","solarized","monokai","nord","tokyo-night","github-light","paper","catppuccin","cyberpunk","obsidian","rose-pine","everforest","one-light","rose-pine-dawn","gruvbox-light","kanagawa","midnight-blue","deep-ocean","warm-void","slate-pro","parchment","zen","notion-light","notion-dark","augment","vercel","aurora-borealis","latte","noctis","horizon","supabase","firebase","linear","stripe","planetscale","figma","turso","vercel-light","linear-light","supabase-light","stripe-light","amethyst","coral-reef","triton","matcha-smoke","solaris","sakura-ink","arctic-prism","volcanic","dusk-gradient","mojave","vercel-dash"];
    if (valid.includes(v as IdeTheme)) return v as IdeTheme;
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

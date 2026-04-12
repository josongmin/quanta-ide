import { create } from "zustand";
import { persist } from "zustand/middleware";

export const AURORA_PRESETS = [
  "violet","ocean","emerald","sunset","rose","slate","midnight","lavender",
  "amber","mint","berry","neon","dusk","glacier","moss","wine","candy",
  "storm","jungle","sakura","honey","void","teal",
  "infrared","cobalt","matcha","tangerine","frost","crimson",
] as const;
export type AuroraPreset = (typeof AURORA_PRESETS)[number];

interface ThemeState { aurora: AuroraPreset; setAurora: (p: AuroraPreset) => void; }
export const useThemeStore = create<ThemeState>()(
  persist((set) => ({ aurora: "candy" as AuroraPreset, setAurora: (aurora) => set({ aurora }) }), { name: "p0-aurora" }),
);
